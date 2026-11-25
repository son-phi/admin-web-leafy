// Kiểm tra Security Rules thật trên Emulator (ADMIN_SPEC mục 7, B8).
// Chạy bằng `npm run test:emulator`; tự bỏ qua khi không có emulator.
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet, set as rtdbSet } from 'firebase/database';
import { getBytes, ref as storageRef, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const ON_EMULATOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const PROJECT = 'demo-leafy-admin';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe.skipIf(!ON_EMULATOR)('Security Rules trên Emulator', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync('firebase/firestore.dev.rules', 'utf8') },
      storage: { rules: readFileSync('firebase/storage.rules', 'utf8') },
      database: { rules: readFileSync('firebase/database.rules.json', 'utf8') },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.clearDatabase();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'species/s1'), { commonName: 'Trầu bà' });
      await setDoc(doc(db, 'diseases/d1'), { nameVi: 'Vàng lá' });
      await setDoc(doc(db, 'users/u1'), { role: 'user', status: 'active' });
      await setDoc(doc(db, 'users/u2'), { role: 'user', status: 'active' });
      await setDoc(doc(db, 'users/u1/lockHistory/l1'), { action: 'LOCK' });
      await setDoc(doc(db, 'users/u1/plants/p1'), { speciesId: 's1' });
      await setDoc(doc(db, 'users/u1/plants/p1/diagnoses/x1'), { diseaseId: 'd1' });
      await setDoc(doc(db, 'devices/dev1'), { userId: 'u1' });
      await setDoc(doc(db, 'devices/dev1/nodes/n1'), { plantId: 'p1' });
      await rtdbSet(rtdbRef(ctx.database(), 'devices/dev1/status/lastSeen'), Date.now());
      await uploadBytes(storageRef(ctx.storage(), 'species/a.png'), PNG, { contentType: 'image/png' });
    });
  });

  const anon = () => env.unauthenticatedContext();
  const user = () => env.authenticatedContext('u1');
  const admin = () => env.authenticatedContext('a1', { admin: true });

  describe('Firestore', () => {
    it('người chưa đăng nhập không đọc được danh mục', async () => {
      await assertFails(getDoc(doc(anon().firestore(), 'species/s1')));
      await assertFails(getDoc(doc(anon().firestore(), 'diseases/d1')));
    });

    it('người dùng thường đọc được danh mục nhưng KHÔNG ghi được species / diseases', async () => {
      const db = user().firestore();
      await assertSucceeds(getDoc(doc(db, 'species/s1')));
      await assertSucceeds(getDoc(doc(db, 'diseases/d1')));
      await assertFails(setDoc(doc(db, 'species/new'), { commonName: 'Hack' }));
      await assertFails(updateDoc(doc(db, 'species/s1'), { commonName: 'Đổi' }));
      await assertFails(deleteDoc(doc(db, 'species/s1')));
      await assertFails(setDoc(doc(db, 'diseases/new'), { nameVi: 'Hack' }));
      await assertFails(deleteDoc(doc(db, 'diseases/d1')));
    });

    it('người dùng thường KHÔNG đọc được lockHistory (kể cả của mình), hồ sơ người khác, dữ liệu thống kê', async () => {
      const db = user().firestore();
      await assertSucceeds(getDoc(doc(db, 'users/u1')));
      await assertFails(getDoc(doc(db, 'users/u2')));
      await assertFails(getDoc(doc(db, 'users/u1/lockHistory/l1')));
      await assertFails(getDocs(collection(db, 'users/u1/lockHistory')));
      await assertFails(setDoc(doc(db, 'users/u1/lockHistory/fake'), { action: 'UNLOCK' }));
      await assertFails(updateDoc(doc(db, 'users/u1'), { status: 'active', role: 'admin' }));
      await assertFails(getDocs(collectionGroup(db, 'plants')));
      await assertFails(getDoc(doc(db, 'devices/dev1')));
    });

    it('admin đọc được hồ sơ, lịch sử khóa, collection group thống kê; vẫn KHÔNG ghi trực tiếp', async () => {
      const db = admin().firestore();
      await assertSucceeds(getDoc(doc(db, 'users/u2')));
      await assertSucceeds(getDocs(collection(db, 'users/u1/lockHistory')));
      await assertSucceeds(getDocs(collectionGroup(db, 'plants')));
      await assertSucceeds(getDocs(collectionGroup(db, 'diagnoses')));
      await assertSucceeds(getDocs(collectionGroup(db, 'nodes')));
      await assertSucceeds(getDoc(doc(db, 'devices/dev1')));
      await assertFails(setDoc(doc(db, 'species/new'), { commonName: 'Trực tiếp' }));
      await assertFails(setDoc(doc(db, 'users/u1/lockHistory/fake'), { action: 'UNLOCK' }));
      await assertFails(updateDoc(doc(db, 'users/u1'), { status: 'locked' }));
    });

    it('claim admin phải đúng boolean true', async () => {
      const db = env.authenticatedContext('a2', { admin: 'true' }).firestore();
      await assertFails(getDoc(doc(db, 'users/u2')));
    });
  });

  describe('Storage', () => {
    it('chỉ admin tải ảnh jpg/png/webp < 5 MB vào species/ và diseases/', async () => {
      await assertFails(uploadBytes(storageRef(user().storage(), 'species/x.png'), PNG, { contentType: 'image/png' }));
      await assertSucceeds(uploadBytes(storageRef(admin().storage(), 'species/x.png'), PNG, { contentType: 'image/png' }));
      await assertSucceeds(uploadBytes(storageRef(admin().storage(), 'diseases/x.webp'), PNG, { contentType: 'image/webp' }));
      await assertFails(uploadBytes(storageRef(admin().storage(), 'species/x.gif'), PNG, { contentType: 'image/gif' }));
      await assertFails(uploadBytes(storageRef(admin().storage(), 'species/big.png'), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/png' }));
      await assertFails(uploadBytes(storageRef(admin().storage(), 'users/x.png'), PNG, { contentType: 'image/png' }));
    });

    it('ảnh danh mục: đã đăng nhập mới đọc được', async () => {
      await assertSucceeds(getBytes(storageRef(user().storage(), 'species/a.png')));
      await assertFails(getBytes(storageRef(anon().storage(), 'species/a.png')));
    });
  });

  describe('Realtime Database', () => {
    it('chỉ admin đọc trạng thái thiết bị; không ai ghi được từ web', async () => {
      await assertFails(rtdbGet(rtdbRef(user().database(), 'devices/dev1/status')));
      await assertFails(rtdbGet(rtdbRef(anon().database(), 'devices')));
      await assertSucceeds(rtdbGet(rtdbRef(admin().database(), 'devices')));
      await assertFails(rtdbSet(rtdbRef(admin().database(), 'devices/dev1/status/lastSeen'), 1));
    });
  });
});
