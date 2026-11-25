import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore/Storage giả lập trong bộ nhớ: đủ cho doc, where ==, collection group, transaction (commit khi không lỗi).
type Data = Record<string, unknown>;
type Op = { op: 'create' | 'update' | 'delete'; path: string; data?: Data };
const state = vi.hoisted(() => ({ docs: new Map<string, Data>(), ops: [] as Op[], deletedFiles: [] as string[] }));

vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase-functions', () => ({ logger: { warn: vi.fn() } }));
vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: () => ({ file: (path: string) => ({ delete: async () => { state.deletedFiles.push(path); } }) }) }),
}));
vi.mock('firebase-admin/firestore', () => {
  type Query = { kind: 'query'; match: (path: string, data: Data) => boolean; limit: () => Query };
  const makeQuery = (match: Query['match']): Query => { const q: Query = { kind: 'query', match, limit: () => q }; return q; };
  const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
  const lastCollection = (path: string) => path.split('/').at(-2);
  return {
    FieldValue: { serverTimestamp: () => 'SERVER_TIME' },
    getFirestore: () => ({
      collection: (name: string) => ({
        doc: (id = 'auto-id') => ({ kind: 'doc', id, path: `${name}/${id}` }),
        where: (field: string, _op: string, value: unknown) => makeQuery((p, d) => parentOf(p) === name && d[field] === value),
      }),
      collectionGroup: (name: string) => ({
        where: (field: string, _op: string, value: unknown) => makeQuery((p, d) => lastCollection(p) === name && d[field] === value),
      }),
      runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
        const pending: Op[] = [];
        await fn({
          get: async (target: { kind: string; path?: string; match?: Query['match'] }) => {
            if (target.kind === 'query') {
              const docs = [...state.docs].filter(([p, d]) => target.match!(p, d)).map(([p, d]) => ({ id: p.split('/').at(-1), data: () => d }));
              return { docs, empty: docs.length === 0 };
            }
            const d = state.docs.get(target.path!);
            return { exists: d !== undefined, data: () => d, get: (k: string) => d?.[k] };
          },
          getAll: async (...refs: { path: string }[]) => refs.map((r) => ({ exists: state.docs.has(r.path) })),
          create: (ref: { path: string }, data: Data) => pending.push({ op: 'create', path: ref.path, data }),
          update: (ref: { path: string }, data: Data) => pending.push({ op: 'update', path: ref.path, data }),
          delete: (ref: { path: string }) => pending.push({ op: 'delete', path: ref.path }),
        });
        for (const o of pending) { // chỉ commit khi transaction không ném lỗi
          if (o.op === 'delete') state.docs.delete(o.path);
          else state.docs.set(o.path, { ...(o.op === 'update' ? state.docs.get(o.path) : {}), ...o.data });
        }
        state.ops.push(...pending);
      },
    }),
  };
});
vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class extends Error {
    constructor(public code: string, message: string, public details?: unknown) { super(message); }
  },
  onCall: (_options: unknown, handler: unknown) => handler,
}));

import { deleteDisease, deleteSpecies, saveDisease, saveSpecies } from './index';
import { SPECIES_FIELDS, fingerprint } from '../../shared/catalog';

type Request = { auth?: { uid: string; token: Data }; data: unknown };
type Callable = (r: Request) => Promise<unknown>;
const callSpecies = saveSpecies as unknown as Callable;
const callDelete = deleteSpecies as unknown as Callable;
const callDisease = saveDisease as unknown as Callable;
const callDeleteDisease = deleteDisease as unknown as Callable;

const species = {
  commonName: 'Trầu Bà', scientificName: 'Epipremnum aureum', aiLabel: 'epipremnum_aureum',
  imageUrl: 'https://example.test/a.png', imagePath: 'species/a.png', description: 'Mô tả',
  lightNeed: 'MEDIUM', wateringCycleDays: 5, fertilizingCycleDays: 30,
  threshold: { soilMoistureMin: 30, soilMoistureMax: 60, temperatureMin: 18, temperatureMax: 30, airHumidityMin: 40, airHumidityMax: 80, lightMin: 100, lightMax: 1000 },
};
const stored = { ...species, searchName: 'trau ba', updatedBy: 'someone', createdAt: 'T' };
const auth = { uid: 'admin-uid', token: { admin: true } };

describe('callable backend boundary (mocked Admin SDK)', () => {
  beforeEach(() => {
    state.docs.clear();
    state.ops = [];
    state.deletedFiles = [];
    vi.stubEnv('GCLOUD_PROJECT', 'demo-leafy-admin');
  });

  it('denies unauthenticated and non-admin calls before any write', async () => {
    await expect(callSpecies({ data: { data: species } })).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(callSpecies({ auth: { uid: 'u', token: {} }, data: { data: species } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(callDelete({ auth: { uid: 'u', token: { admin: 'true' } }, data: { id: 'x' } })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(state.ops).toHaveLength(0);
  });

  it('blocks production and invalid payloads with MSG codes', async () => {
    const invalid = async (data: unknown, key: string) => expect(callSpecies({ auth, data })).rejects.toMatchObject({ details: { code: key } });
    await invalid({ data: { ...species, role: 'admin' } }, 'INVALID_INPUT');
    await invalid({ data: { ...species, threshold: { ...species.threshold, soilMoistureMin: 90 } } }, 'INVALID_THRESHOLD');
    await invalid({ id: '../x', data: species }, 'INVALID_INPUT');
    await invalid({ data: { ...species, imagePath: 'users/secret.png' } }, 'INVALID_IMAGE');
    vi.stubEnv('GCLOUD_PROJECT', 'leafyapp-cf95a');
    await expect(callSpecies({ auth, data: { data: species } })).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'BACKEND_NOT_ALLOWED' } });
    expect(state.ops).toHaveLength(0);
  });

  it('creates species with system fields and search prefixes for both names', async () => {
    expect(await callSpecies({ auth, data: { data: species } })).toEqual({ id: 'auto-id' });
    const doc = state.docs.get('species/auto-id')!;
    expect(doc).toMatchObject({ ...species, searchName: 'trau ba', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME', updatedBy: 'admin-uid' });
    expect(doc.searchPrefixes).toEqual(expect.arrayContaining(['t', 'trau b', 'trau ba', 'e', 'epipremnum aureum']));
  });

  it('rejects duplicate common names (7c) and AI labels (7e), except the record itself', async () => {
    state.docs.set('species/trau-ba', stored);
    await expect(callSpecies({ auth, data: { data: { ...species, commonName: 'trau ba', aiLabel: 'other' } } }))
      .rejects.toMatchObject({ code: 'already-exists', details: { code: 'SPECIES_EXISTS' } });
    await expect(callSpecies({ auth, data: { data: { ...species, commonName: 'Cây khác' } } }))
      .rejects.toMatchObject({ code: 'already-exists', details: { code: 'LABEL_USED' } });
    expect(state.ops).toHaveLength(0);
    await callSpecies({ auth, data: { id: 'trau-ba', data: { ...species, description: 'Mới' }, fingerprint: fingerprint(SPECIES_FIELDS, stored) } });
    expect(state.docs.get('species/trau-ba')).toMatchObject({ description: 'Mới', createdAt: 'T' });
  });

  it('rejects missing and stale updates; deletes the old image only after a successful image change', async () => {
    await expect(callSpecies({ auth, data: { id: 'trau-ba', data: species, fingerprint: 'x' } })).rejects.toMatchObject({ code: 'not-found' });
    state.docs.set('species/trau-ba', stored);
    await expect(callSpecies({ auth, data: { id: 'trau-ba', data: { ...species, imagePath: 'species/new.png' }, fingerprint: 'stale' } }))
      .rejects.toMatchObject({ code: 'aborted', details: { code: 'CONFLICT' } });
    expect(state.deletedFiles).toEqual([]);
    const fp = fingerprint(SPECIES_FIELDS, stored);
    await callSpecies({ auth, data: { id: 'trau-ba', data: { ...species, description: 'Giữ ảnh' }, fingerprint: fp } });
    expect(state.deletedFiles).toEqual([]);
    await callSpecies({ auth, data: { id: 'trau-ba', data: { ...species, description: 'Giữ ảnh', imagePath: 'species/new.png' }, fingerprint: fingerprint(SPECIES_FIELDS, state.docs.get('species/trau-ba')!) } });
    expect(state.deletedFiles).toEqual(['species/a.png']);
  });

  it('refuses to delete a species still used by a user plant (18a), deletes an unused one with its image', async () => {
    await expect(callDelete({ auth, data: { id: 'missing' } })).rejects.toMatchObject({ code: 'not-found' });
    state.docs.set('species/trau-ba', stored);
    state.docs.set('users/u1/plants/p1', { speciesId: 'trau-ba' });
    await expect(callDelete({ auth, data: { id: 'trau-ba' } })).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'SPECIES_IN_USE' } });
    expect(state.docs.has('species/trau-ba')).toBe(true);
    state.docs.delete('users/u1/plants/p1');
    await callDelete({ auth, data: { id: 'trau-ba' } });
    expect(state.docs.has('species/trau-ba')).toBe(false);
    expect(state.deletedFiles).toEqual(['species/a.png']);
  });

  const disease = {
    nameVi: 'Vàng lá', scientificName: null, aiLabel: 'yellow_leaf', imageUrl: 'https://example.test/b.png', imagePath: 'diseases/b.png',
    affectedSpeciesIds: ['trau-ba'], causes: 'a', symptoms: 'b', treatmentMild: 'c', treatmentModerate: 'd', treatmentSevere: 'e', prevention: null,
  };

  it('saves diseases with nullable optional fields when every affected species exists', async () => {
    await expect(callDisease({ auth, data: { data: disease } })).rejects.toMatchObject({ details: { code: 'SPECIES_NOT_FOUND' } });
    state.docs.set('species/trau-ba', stored);
    await callDisease({ auth, data: { data: disease } });
    expect(state.docs.get('diseases/auto-id')).toMatchObject({ searchName: 'vang la', scientificName: null, updatedBy: 'admin-uid' });
    await expect(callDisease({ auth, data: { data: { ...disease, imagePath: 'species/x.png' } } })).rejects.toMatchObject({ details: { code: 'INVALID_IMAGE' } });
  });

  it('rejects a disease whose name or AI label already exists (7b)', async () => {
    state.docs.set('species/trau-ba', stored);
    state.docs.set('diseases/vang-la', { ...disease, searchName: 'vang la' });
    await expect(callDisease({ auth, data: { data: { ...disease, nameVi: 'VANG LA', aiLabel: 'other' } } }))
      .rejects.toMatchObject({ code: 'already-exists', details: { code: 'DISEASE_EXISTS' } });
    await expect(callDisease({ auth, data: { data: { ...disease, nameVi: 'Bệnh khác' } } }))
      .rejects.toMatchObject({ code: 'already-exists', details: { code: 'DISEASE_EXISTS' } });
    expect(state.ops).toHaveLength(0);
  });

  it('deletes a disease and its image without touching past diagnoses', async () => {
    await expect(callDeleteDisease({ auth, data: { id: 'missing' } })).rejects.toMatchObject({ code: 'not-found' });
    await expect(callDeleteDisease({ auth: { uid: 'u', token: {} }, data: { id: 'vang-la' } })).rejects.toMatchObject({ code: 'permission-denied' });
    state.docs.set('diseases/vang-la', { ...disease, searchName: 'vang la' });
    state.docs.set('users/u1/plants/p1/diagnoses/d1', { diseaseId: 'vang-la' });
    await callDeleteDisease({ auth, data: { id: 'vang-la' } });
    expect(state.docs.has('diseases/vang-la')).toBe(false);
    expect(state.docs.get('users/u1/plants/p1/diagnoses/d1')).toEqual({ diseaseId: 'vang-la' });
    expect(state.deletedFiles).toEqual(['diseases/b.png']);
  });
});
