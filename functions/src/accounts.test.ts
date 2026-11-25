import { beforeEach, describe, expect, it, vi } from 'vitest';

type Data = Record<string, unknown>;
type AuthUser = { uid: string; disabled: boolean; customClaims?: Data; metadata: { lastSignInTime?: string } };
const state = vi.hoisted(() => ({
  docs: new Map<string, Data>(),
  users: new Map<string, AuthUser>(),
  revoked: [] as string[],
  failBatch: false,
  updates: [] as { path: string; data: Data }[],
}));

vi.mock('firebase-functions', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class extends Error {
    constructor(public code: string, message: string, public details?: unknown) { super(message); }
  },
  onCall: (_options: unknown, handler: unknown) => handler,
}));
vi.mock('firebase-functions/v2/firestore', () => ({ onDocumentWritten: (_options: unknown, handler: unknown) => handler }));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: async (uid: string) => {
      const u = state.users.get(uid);
      if (!u) throw new Error('auth/user-not-found');
      return structuredClone(u);
    },
    updateUser: async (uid: string, patch: Partial<AuthUser>) => { Object.assign(state.users.get(uid)!, patch); },
    revokeRefreshTokens: async (uid: string) => { state.revoked.push(uid); },
  }),
}));
vi.mock('firebase-admin/firestore', () => {
  const docRef = (path: string): unknown => ({
    path,
    get: async () => {
      const d = state.docs.get(path);
      return { exists: d !== undefined, get: (k: string) => d?.[k] };
    },
    collection: (name: string) => ({ doc: () => docRef(`${path}/${name}/log-${state.docs.size}`) }),
  });
  return {
    FieldValue: { serverTimestamp: () => 'SERVER_TIME' },
    getFirestore: () => ({
      collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
      batch: () => {
        const ops: (() => void)[] = [];
        return {
          update: (ref: { path: string }, data: Data) => ops.push(() => state.docs.set(ref.path, { ...state.docs.get(ref.path), ...data })),
          create: (ref: { path: string }, data: Data) => ops.push(() => state.docs.set(ref.path, data)),
          commit: async () => { if (state.failBatch) throw new Error('firestore down'); ops.forEach((op) => op()); },
        };
      },
    }),
  };
});

import { getUserAuthInfo, onUserProfileWritten, setAccountStatus } from './accounts';

type Request = { auth?: { uid: string; token: Data }; data: unknown };
const callStatus = setAccountStatus as unknown as (r: Request) => Promise<unknown>;
const callInfo = getUserAuthInfo as unknown as (r: Request) => Promise<unknown>;
const admin = { uid: 'admin-1', token: { admin: true } };
const history = () => [...state.docs].filter(([p]) => p.includes('/lockHistory/')).map(([, d]) => d);

describe('setAccountStatus / getUserAuthInfo / onUserProfileWritten', () => {
  beforeEach(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-leafy-admin');
    state.docs.clear();
    state.users.clear();
    state.revoked = [];
    state.failBatch = false;
    state.docs.set('users/u1', { role: 'user', status: 'active', fullName: 'Nguyễn An' });
    state.docs.set('users/admin-2', { role: 'admin', status: 'active' });
    state.docs.set('users/u3', { role: 'user', status: 'active' });
    state.users.set('u1', { uid: 'u1', disabled: false, metadata: { lastSignInTime: 'Tue, 24 Nov 2026 10:00:00 GMT' } });
    state.users.set('admin-2', { uid: 'admin-2', disabled: false, customClaims: { admin: true }, metadata: {} });
    state.users.set('u3', { uid: 'u3', disabled: false, customClaims: { admin: true }, metadata: {} }); // claim admin, role chưa cập nhật
  });

  it('denies unauthenticated and non-admin callers', async () => {
    await expect(callStatus({ data: { uid: 'u1', action: 'UNLOCK' } })).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(callStatus({ auth: { uid: 'u9', token: {} }, data: { uid: 'u1', action: 'UNLOCK' } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(callInfo({ auth: { uid: 'u9', token: {} }, data: { uid: 'u1' } })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects self-lock (9a), admins by role or claim (9b), unknown accounts and missing reason', async () => {
    const reject = async (data: unknown, key: string) =>
      expect(callStatus({ auth: { ...admin, uid: 'admin-2' }, data })).rejects.toMatchObject({ details: { code: key } });
    await reject({ uid: 'admin-2', action: 'LOCK', reason: 'x' }, 'CANNOT_LOCK_SELF');
    await expect(callStatus({ auth: admin, data: { uid: 'admin-2', action: 'LOCK', reason: 'x' } })).rejects.toMatchObject({ details: { code: 'CANNOT_LOCK_ADMIN' } });
    await expect(callStatus({ auth: admin, data: { uid: 'u3', action: 'LOCK', reason: 'x' } })).rejects.toMatchObject({ details: { code: 'CANNOT_LOCK_ADMIN' } });
    await expect(callStatus({ auth: admin, data: { uid: 'nobody', action: 'LOCK', reason: 'x' } })).rejects.toMatchObject({ details: { code: 'ACCOUNT_NOT_FOUND' } });
    await expect(callStatus({ auth: admin, data: { uid: 'u1', action: 'LOCK' } })).rejects.toMatchObject({ details: { code: 'INVALID_INPUT' } });
    await expect(callStatus({ auth: admin, data: { uid: 'users/u1', action: 'LOCK', reason: 'x' } })).rejects.toMatchObject({ details: { code: 'INVALID_INPUT' } });
    expect(state.users.get('u1')!.disabled).toBe(false);
    expect(history()).toEqual([]);
  });

  it('locks: disables Auth, revokes tokens, sets status and writes history; unlock reverses it', async () => {
    expect(await callStatus({ auth: admin, data: { uid: 'u1', action: 'LOCK', reason: 'Spam hoặc lạm dụng hệ thống' } })).toEqual({ status: 'locked', changed: true });
    expect(state.users.get('u1')!.disabled).toBe(true);
    expect(state.revoked).toEqual(['u1']);
    expect(state.docs.get('users/u1')).toMatchObject({ status: 'locked' });
    expect(history()).toEqual([{ userId: 'u1', adminId: 'admin-1', action: 'LOCK', reason: 'Spam hoặc lạm dụng hệ thống', createdAt: 'SERVER_TIME' }]);
    // Gọi lại khi đã khóa: không ghi thêm lịch sử.
    expect(await callStatus({ auth: admin, data: { uid: 'u1', action: 'LOCK', reason: 'x' } })).toEqual({ status: 'locked', changed: false });
    expect(history()).toHaveLength(1);
    await callStatus({ auth: admin, data: { uid: 'u1', action: 'UNLOCK' } });
    expect(state.users.get('u1')!.disabled).toBe(false);
    expect(state.docs.get('users/u1')).toMatchObject({ status: 'active' });
    expect(history().map((h) => h.action)).toEqual(['LOCK', 'UNLOCK']);
  });

  it('rolls Auth back and reports UPDATE_FAILED when Firestore cannot be written (12a)', async () => {
    state.failBatch = true;
    await expect(callStatus({ auth: admin, data: { uid: 'u1', action: 'LOCK', reason: 'x' } })).rejects.toMatchObject({ details: { code: 'UPDATE_FAILED' } });
    expect(state.users.get('u1')!.disabled).toBe(false);
    expect(state.docs.get('users/u1')).toMatchObject({ status: 'active' });
  });

  it('returns Auth sign-in info for the detail view', async () => {
    expect(await callInfo({ auth: admin, data: { uid: 'u1' } })).toEqual({ lastSignInTime: '2026-11-24T10:00:00.000Z', disabled: false });
    await expect(callInfo({ auth: admin, data: { uid: 'nobody' } })).rejects.toMatchObject({ details: { code: 'ACCOUNT_NOT_FOUND' } });
  });

  it('maintains search fields from full name and email without rewriting unchanged profiles', async () => {
    const trigger = onUserProfileWritten as unknown as (event: unknown) => Promise<void>;
    const updates: Data[] = [];
    const after = (d: Data) => ({ data: { after: { exists: true, get: (k: string) => d[k], ref: { update: async (u: Data) => { updates.push(u); } } } } });
    await trigger(after({ fullName: 'Lê Chi', email: 'chi@x.test' }));
    expect(updates[0].searchName).toBe('le chi');
    expect(updates[0].searchPrefixes).toEqual(expect.arrayContaining(['l', 'le chi', 'c', 'chi@x.test']));
    await trigger(after({ fullName: 'Lê Chi', email: 'chi@x.test', ...updates[0] }));
    expect(updates).toHaveLength(1);
  });
});
