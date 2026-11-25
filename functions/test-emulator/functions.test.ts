// Kiểm tra Cloud Functions THẬT đang chạy trên Functions Emulator: gọi callable qua HTTP với ID token
// thật từ Auth Emulator, đọc kết quả bằng Admin SDK. Không dùng mock. Chạy bằng `npm run test:emulator`.
import { initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const ON_EMULATOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const PROJECT = 'demo-leafy-admin';
const BUCKET = `${PROJECT}.appspot.com`;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const FUNCTIONS = `http://${process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001'}/${PROJECT}/us-central1`;

type CallResult = { result?: unknown; error?: { status: string; message: string; details?: { code?: string } } };

async function call(name: string, data: unknown, token?: string): Promise<CallResult> {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return res.json() as Promise<CallResult>;
}
const code = (r: CallResult) => r.error?.details?.code ?? r.error?.status;

async function signIn(email: string, password: string): Promise<{ token?: string; error?: string }> {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json() as { idToken?: string; error?: { message: string } };
  return { token: json.idToken, error: json.error?.message };
}

async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const start = Date.now();
  let value = await read();
  while (!ok(value) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 300));
    value = await read();
  }
  return value;
}

const species = (over: Record<string, unknown> = {}) => ({
  commonName: 'Trầu bà', scientificName: 'Epipremnum aureum', aiLabel: 'epipremnum_aureum',
  imageUrl: 'https://example.test/a.png', imagePath: 'species/a.png', description: 'Mô tả',
  lightNeed: 'MEDIUM', wateringCycleDays: 5, fertilizingCycleDays: 30,
  threshold: { soilMoistureMin: 40, soilMoistureMax: 70, temperatureMin: 18, temperatureMax: 32, airHumidityMin: 50, airHumidityMax: 80, lightMin: 1000, lightMax: 10000 },
  ...over,
});
const disease = (affectedSpeciesIds: string[], over: Record<string, unknown> = {}) => ({
  nameVi: 'Vàng lá', scientificName: null, aiLabel: 'yellow_leaf', imageUrl: 'https://example.test/b.png', imagePath: 'diseases/b.png',
  affectedSpeciesIds, causes: 'a', symptoms: 'b', treatmentMild: 'c', treatmentModerate: 'd', treatmentSevere: 'e', prevention: null,
  ...over,
});

describe.skipIf(!ON_EMULATOR)('Cloud Functions thật trên Emulator', () => {
  let app: App;
  let adminToken: string;
  let userToken: string;
  const ids = { admin: '', user: '', otherAdmin: '' };

  beforeAll(async () => {
    app = initializeApp({ projectId: PROJECT, storageBucket: BUCKET, databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000'}?ns=${PROJECT}` }, 'functions-test');
  });
  afterAll(async () => { /* emulator bị hủy sau emulators:exec */ });

  beforeEach(async () => {
    await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
    await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    await getDatabase(app).ref('/').remove();
    const auth = getAuth(app);
    const db = getFirestore(app);
    for (const [key, email, claims] of [['admin', 'admin@test.test', { admin: true }], ['user', 'user@test.test', null], ['otherAdmin', 'admin2@test.test', { admin: true }]] as const) {
      const u = await auth.createUser({ email, password: 'Passw0rd!' });
      ids[key] = u.uid;
      if (claims) await auth.setCustomUserClaims(u.uid, claims);
      await db.doc(`users/${u.uid}`).set({ fullName: key, email, role: claims ? 'admin' : 'user', status: 'active', createdAt: Timestamp.now() });
    }
    adminToken = (await signIn('admin@test.test', 'Passw0rd!')).token!;
    userToken = (await signIn('user@test.test', 'Passw0rd!')).token!;
  });

  it('mọi callable từ chối người chưa đăng nhập và người dùng thường', async () => {
    const calls: [string, unknown][] = [
      ['saveSpecies', { data: species() }], ['deleteSpecies', { id: 'x' }], ['saveDisease', { data: disease(['x']) }],
      ['deleteDisease', { id: 'x' }], ['setAccountStatus', { uid: 'x', action: 'UNLOCK' }], ['getUserAuthInfo', { uid: 'x' }],
    ];
    for (const [name, data] of calls) {
      expect(code(await call(name, data)), `${name} không token`).toBe('PERMISSION_DENIED');
      expect((await call(name, data)).error?.status, `${name} không token`).toBe('UNAUTHENTICATED');
      expect(code(await call(name, data, userToken)), `${name} user thường`).toBe('PERMISSION_DENIED');
    }
    expect((await getFirestore(app).collection('species').get()).size).toBe(0);
  });

  it('loài cây: validate, trùng tên/nhãn, xung đột, sửa, đồng bộ ngưỡng xuống RTDB, chặn xóa khi đang dùng, xóa kèm ảnh', async () => {
    const db = getFirestore(app);
    expect(code(await call('saveSpecies', { data: { ...species(), role: 'admin' } }, adminToken))).toBe('INVALID_INPUT');
    expect(code(await call('saveSpecies', { data: species({ threshold: { ...species().threshold, temperatureMin: 40 } }) }, adminToken))).toBe('INVALID_THRESHOLD');
    expect(code(await call('saveSpecies', { data: species({ imagePath: 'users/secret.png' }) }, adminToken))).toBe('INVALID_IMAGE');

    await getStorage(app).bucket().file('species/a.png').save(Buffer.from('png'), { contentType: 'image/png' });
    const created = await call('saveSpecies', { data: species() }, adminToken);
    const id = (created.result as { id: string }).id;
    const stored = (await db.doc(`species/${id}`).get()).data()!;
    expect(stored).toMatchObject({ searchName: 'trau ba', updatedBy: ids.admin });
    expect(stored.searchPrefixes).toEqual(expect.arrayContaining(['trau ba', 'epipremnum']));

    expect(code(await call('saveSpecies', { data: species({ commonName: 'TRAU BA', aiLabel: 'khac' }) }, adminToken))).toBe('SPECIES_EXISTS');
    expect(code(await call('saveSpecies', { data: species({ commonName: 'Cây khác' }) }, adminToken))).toBe('LABEL_USED');
    expect(code(await call('saveSpecies', { id, data: species(), fingerprint: 'cu' }, adminToken))).toBe('CONFLICT');

    // Cây dùng ngưỡng theo loài (p1) và cây dùng ngưỡng riêng (p2), mỗi cây gắn 1 node.
    await db.doc(`users/${ids.user}/plants/p1`).set({ speciesId: id, useSpeciesThresholds: true, createdAt: Timestamp.now() });
    await db.doc(`users/${ids.user}/plants/p2`).set({ speciesId: id, useSpeciesThresholds: false, createdAt: Timestamp.now() });
    await db.doc('devices/esp/nodes/n1').set({ plantId: 'p1', userId: ids.user });
    await db.doc('devices/esp/nodes/n2').set({ plantId: 'p2', userId: ids.user });
    await getDatabase(app).ref('devices/esp/nodes/n2/config/thresholds').set({ custom: true });

    const { fingerprint } = await import('../../shared/catalog');
    const { SPECIES_FIELDS } = await import('../../shared/catalog');
    const fp = fingerprint(SPECIES_FIELDS, (await db.doc(`species/${id}`).get()).data()!);
    const newThreshold = { ...species().threshold, soilMoistureMin: 45 };
    expect((await call('saveSpecies', { id, data: species({ threshold: newThreshold }), fingerprint: fp }, adminToken)).result).toEqual({ id });

    const synced = await eventually(() => getDatabase(app).ref('devices/esp/nodes/n1/config/thresholds').get().then((s) => s.val()), (v) => v?.soilMoistureMin === 45);
    expect(synced).toEqual(newThreshold);
    expect((await getDatabase(app).ref('devices/esp/nodes/n2/config/thresholds').get()).val()).toEqual({ custom: true });

    expect(code(await call('deleteSpecies', { id }, adminToken))).toBe('SPECIES_IN_USE');
    expect((await db.doc(`species/${id}`).get()).exists).toBe(true);
    await db.doc(`users/${ids.user}/plants/p1`).delete();
    await db.doc(`users/${ids.user}/plants/p2`).delete();
    expect((await call('deleteSpecies', { id }, adminToken)).result).toEqual({ ok: true });
    expect((await db.doc(`species/${id}`).get()).exists).toBe(false);
    expect((await getStorage(app).bucket().file('species/a.png').exists())[0]).toBe(false);
    expect(code(await call('deleteSpecies', { id }, adminToken))).toBe('NOT_FOUND');
  });

  it('bệnh cây: loài phải tồn tại, trùng tên/nhãn, xóa không đụng lượt chẩn đoán cũ', async () => {
    const db = getFirestore(app);
    expect(code(await call('saveDisease', { data: disease(['khong-co']) }, adminToken))).toBe('SPECIES_NOT_FOUND');
    const speciesId = ((await call('saveSpecies', { data: species() }, adminToken)).result as { id: string }).id;
    const id = ((await call('saveDisease', { data: disease([speciesId]) }, adminToken)).result as { id: string }).id;
    expect(code(await call('saveDisease', { data: disease([speciesId], { nameVi: 'VANG LA', aiLabel: 'khac' }) }, adminToken))).toBe('DISEASE_EXISTS');
    expect(code(await call('saveDisease', { data: disease([speciesId], { nameVi: 'Bệnh khác' }) }, adminToken))).toBe('DISEASE_EXISTS');
    await db.doc(`users/${ids.user}/plants/p1/diagnoses/x1`).set({ diseaseId: id });
    expect((await call('deleteDisease', { id }, adminToken)).result).toEqual({ ok: true });
    expect((await db.doc(`diseases/${id}`).get()).exists).toBe(false);
    expect((await db.doc(`users/${ids.user}/plants/p1/diagnoses/x1`).get()).data()).toEqual({ diseaseId: id });
  });

  it('tài khoản: 9a, 9b, thiếu lý do, khóa chặn đăng nhập + ghi lịch sử, mở khóa, thông tin Auth', async () => {
    const db = getFirestore(app);
    expect(code(await call('setAccountStatus', { uid: ids.admin, action: 'LOCK', reason: 'x' }, adminToken))).toBe('CANNOT_LOCK_SELF');
    expect(code(await call('setAccountStatus', { uid: ids.otherAdmin, action: 'LOCK', reason: 'x' }, adminToken))).toBe('CANNOT_LOCK_ADMIN');
    expect(code(await call('setAccountStatus', { uid: ids.user, action: 'LOCK' }, adminToken))).toBe('INVALID_INPUT');
    expect(code(await call('setAccountStatus', { uid: 'khong-co', action: 'LOCK', reason: 'x' }, adminToken))).toBe('ACCOUNT_NOT_FOUND');

    expect((await call('setAccountStatus', { uid: ids.user, action: 'LOCK', reason: 'Spam hoặc lạm dụng hệ thống' }, adminToken)).result)
      .toEqual({ status: 'locked', changed: true });
    expect((await signIn('user@test.test', 'Passw0rd!')).error).toBe('USER_DISABLED');
    expect((await db.doc(`users/${ids.user}`).get()).get('status')).toBe('locked');
    const history = (await db.collection(`users/${ids.user}/lockHistory`).get()).docs.map((d) => d.data());
    expect(history).toEqual([expect.objectContaining({ userId: ids.user, adminId: ids.admin, action: 'LOCK', reason: 'Spam hoặc lạm dụng hệ thống' })]);

    expect((await call('setAccountStatus', { uid: ids.user, action: 'UNLOCK' }, adminToken)).result).toEqual({ status: 'active', changed: true });
    expect((await signIn('user@test.test', 'Passw0rd!')).token).toBeTruthy();
    const info = (await call('getUserAuthInfo', { uid: ids.user }, adminToken)).result as { lastSignInTime: string | null; disabled: boolean };
    expect(info.disabled).toBe(false);
    expect(info.lastSignInTime).toEqual(expect.any(String));
  });

  it('trigger hồ sơ: tự bổ sung trường tìm kiếm cho hồ sơ do app tạo', async () => {
    const db = getFirestore(app);
    await db.doc('users/android-1').set({ fullName: 'Trương Quốc Bảo', email: 'bao@test.test', role: 'user', status: 'active' });
    const doc = await eventually(() => db.doc('users/android-1').get().then((s) => s.data()!), (d) => Array.isArray(d.searchPrefixes));
    expect(doc.searchName).toBe('truong quoc bao');
    expect(doc.searchPrefixes).toEqual(expect.arrayContaining(['truong q', 'bao@']));
  });
});
