// Tạo dữ liệu mẫu cho Firebase Emulator Suite theo lược đồ 2.4 (ADMIN_SPEC mục 4).
// CHỈ chạy trên Emulator: script tự trỏ mọi Admin SDK vào 127.0.0.1 và từ chối project không phải demo-*.
// Dữ liệu hoàn toàn giả lập, không sao chép dữ liệu người dùng thật.
//
// Tài khoản thử (chỉ tồn tại trong Auth Emulator):
//   admin@leafy.test / Admin@123        – quản trị viên (claim admin: true, role 'admin')
//   user01..user10@leafy.test / User@123 – người dùng thường; user09, user10 đang bị khóa

import { readFileSync } from 'node:fs';

const PROJECT = process.env.SEED_PROJECT_ID || 'demo-leafy-admin';
if (!PROJECT.startsWith('demo-')) {
  console.error('Seed chỉ dành cho project demo-* trên Emulator.');
  process.exit(1);
}

const HOSTS = {
  auth: '127.0.0.1:9099',
  firestore: '127.0.0.1:8080',
  database: '127.0.0.1:9000',
  storage: '127.0.0.1:9199',
};
// Ghi đè (không dùng ??=) để chắc chắn không thể trỏ ra cloud.
process.env.FIREBASE_AUTH_EMULATOR_HOST = HOSTS.auth;
process.env.FIRESTORE_EMULATOR_HOST = HOSTS.firestore;
process.env.FIREBASE_DATABASE_EMULATOR_HOST = HOSTS.database;
process.env.FIREBASE_STORAGE_EMULATOR_HOST = HOSTS.storage;
process.env.GCLOUD_PROJECT = PROJECT;

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const { getDatabase } = await import('firebase-admin/database');
const { getStorage } = await import('firebase-admin/storage');

const BUCKET = `${PROJECT}.appspot.com`;
initializeApp({ projectId: PROJECT, storageBucket: BUCKET, databaseURL: `http://${HOSTS.database}?ns=${PROJECT}` });
const auth = getAuth();
const db = getFirestore();
const rtdb = getDatabase();
const bucket = getStorage().bucket();

// ---------- tiện ích ----------
const DAY = 86_400_000;
const NOW = Date.now();
let seed = 20261125;
const rand = () => { // mulberry32 – cố định để số liệu lặp lại được giữa các lần seed
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (from, to) => from + Math.floor(rand() * Math.max(1, to - from));
const ts = (ms) => Timestamp.fromMillis(ms);
// Phải khớp với shared/normalize.ts.
const normalize = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
// Phải khớp với searchPrefixes trong shared/normalize.ts.
const prefixes = (...names) => [...new Set(names.flatMap((n) => {
  const v = normalize(n ?? '').slice(0, 40);
  return Array.from({ length: v.length }, (_, k) => v.slice(0, k + 1));
}))];

async function assertEmulatorsUp() {
  for (const [name, host] of Object.entries(HOSTS)) {
    try { await fetch(`http://${host}/`); } catch {
      throw new Error(`Không kết nối được ${name} emulator tại ${host}. Chạy "npm run emulators" trước.`);
    }
  }
}

async function clearEmulators() {
  await fetch(`http://${HOSTS.auth}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`http://${HOSTS.firestore}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await rtdb.ref('/').remove();
  await bucket.deleteFiles({ force: true }).catch(() => undefined);
}

// Ảnh PNG 1x1 (màu xanh lá) để có imageUrl/imagePath thật trên Storage Emulator.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2PH/PwAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64');
async function uploadImage(folder, name) {
  const path = `${folder}/${name}.png`;
  const token = `seed-${name}`;
  await bucket.file(path).save(PNG, { contentType: 'image/png', metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  const imageUrl = `http://${HOSTS.storage}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { imageUrl, imagePath: path };
}

// ---------- dữ liệu danh mục ----------
// Danh mục mẫu dùng chung với chế độ mock của web.
const { species: SPECIES, diseases: DISEASES } = JSON.parse(readFileSync(new URL('../../shared/sample-catalog.json', import.meta.url), 'utf8'));

const FIRST_NAMES = ['Nguyễn An', 'Trần Bình', 'Lê Chi', 'Phạm Dũng', 'Hoàng Giang', 'Vũ Hà', 'Đặng Khoa', 'Bùi Lan', 'Đỗ Minh', 'Ngô Nhi'];
const LOCK_REASONS = ['Vi phạm điều khoản sử dụng', 'Spam hoặc lạm dụng hệ thống'];

// ---------- chạy ----------
await assertEmulatorsUp();
await clearEmulators();

const bulk = db.bulkWriter();
const counters = { users: 0, species: 0, diseases: 0, plants: 0, diagnoses: 0, wateringLogs: 0, chatSessions: 0, devices: 0, nodes: 0 };

// Danh mục
for (const s of SPECIES) {
  const { id, ...data } = s;
  const image = await uploadImage('species', id);
  const at = ts(NOW - 400 * DAY);
  bulk.set(db.doc(`species/${id}`), {
    ...data, ...image, searchName: normalize(data.commonName), searchPrefixes: prefixes(data.commonName, data.scientificName),
    createdAt: at, updatedAt: at, updatedBy: 'seed',
  });
  counters.species++;
}
for (const d of DISEASES) {
  const { id, ...data } = d;
  const image = await uploadImage('diseases', id);
  const at = ts(NOW - 400 * DAY);
  bulk.set(db.doc(`diseases/${id}`), { ...data, ...image, searchName: normalize(data.nameVi), createdAt: at, updatedAt: at, updatedBy: 'seed' });
  counters.diseases++;
}

// Admin
const admin = await auth.createUser({ uid: 'admin-seed', email: 'admin@leafy.test', password: 'Admin@123', displayName: 'Quản trị viên Leafy' });
await auth.setCustomUserClaims(admin.uid, { admin: true });
bulk.set(db.doc(`users/${admin.uid}`), {
  fullName: 'Quản trị viên Leafy', email: admin.email, avatarUrl: '', role: 'admin', status: 'active',
  searchName: normalize('Quản trị viên Leafy'), searchPrefixes: prefixes('Quản trị viên Leafy', 'admin@leafy.test'),
  createdAt: ts(NOW - 400 * DAY), lastLoginAt: ts(NOW - DAY),
});
counters.users++;

const rtdbUpdates = {};
for (let i = 1; i <= 10; i++) {
  const n = String(i).padStart(2, '0');
  const uid = `user-${n}`;
  const fullName = FIRST_NAMES[i - 1];
  const email = `user${n}@leafy.test`;
  const locked = i >= 9;
  const createdAt = NOW - int(5, 360) * DAY;
  await auth.createUser({ uid, email, password: 'User@123', displayName: fullName, disabled: locked });
  bulk.set(db.doc(`users/${uid}`), {
    fullName, email, avatarUrl: '', role: 'user', status: locked ? 'locked' : 'active',
    searchName: normalize(fullName), searchPrefixes: prefixes(fullName, email), createdAt: ts(createdAt),
    lastLoginAt: i % 3 === 0 ? null : ts(between(createdAt, NOW)), // một số để trống → web gọi getUserAuthInfo
  });
  counters.users++;
  if (locked) {
    const lockAt = between(createdAt, NOW);
    bulk.set(db.collection(`users/${uid}/lockHistory`).doc(), {
      userId: uid, adminId: admin.uid, action: 'LOCK', reason: pick(LOCK_REASONS), createdAt: ts(lockAt),
    });
  }

  // Cây của người dùng
  const plants = [];
  for (let p = 0; p < int(1, 4); p++) {
    const species = pick(SPECIES);
    const plantId = `${uid}-plant-${p + 1}`;
    const plantCreated = between(createdAt, NOW);
    const useSpeciesThresholds = rand() < 0.7;
    plants.push({ plantId, species, plantCreated, useSpeciesThresholds });
    bulk.set(db.doc(`users/${uid}/plants/${plantId}`), {
      name: `${species.commonName} ${p + 1}`, speciesId: species.id, useSpeciesThresholds, createdAt: ts(plantCreated),
    });
    counters.plants++;
    for (let k = 0; k < int(0, 3); k++) {
      const disease = pick(DISEASES);
      bulk.set(db.collection(`users/${uid}/plants/${plantId}/diagnoses`).doc(), {
        diseaseId: disease.id, confidence: Math.round((0.6 + rand() * 0.4) * 100) / 100, createdAt: ts(between(plantCreated, NOW)),
      });
      counters.diagnoses++;
    }
  }

  for (let c = 0; c < int(0, 3); c++) {
    bulk.set(db.collection(`users/${uid}/chatSessions`).doc(), { title: 'Hỏi đáp chăm sóc cây', createdAt: ts(between(createdAt, NOW)) });
    counters.chatSessions++;
  }

  // Thiết bị IoT: 7 người dùng đầu có thiết bị
  if (i <= 7) {
    const deviceId = `esp32-${n}`;
    const registeredAt = between(createdAt, NOW - 3 * DAY);
    // Trực tuyến: user 01–04; ngoại tuyến < 24h: 05; mất kết nối > 24h: 06, 07
    const lastSeen = i <= 4 ? NOW - int(10, 120) * 1000 : i === 5 ? NOW - 3 * 3600_000 : NOW - int(2, 20) * DAY;
    bulk.set(db.doc(`devices/${deviceId}`), { userId: uid, name: `Bộ cảm biến ${fullName}`, registeredAt: ts(registeredAt), lastSeen: ts(lastSeen) });
    rtdbUpdates[`devices/${deviceId}/status/lastSeen`] = lastSeen;
    counters.devices++;

    for (const [idx, plant] of plants.entries()) {
      const nodeId = `node-${idx + 1}`;
      bulk.set(db.doc(`devices/${deviceId}/nodes/${nodeId}`), { plantId: plant.plantId, userId: uid });
      const threshold = plant.useSpeciesThresholds
        ? plant.species.threshold
        : { ...plant.species.threshold, soilMoistureMin: plant.species.threshold.soilMoistureMin + 5 }; // ngưỡng tùy chỉnh
      rtdbUpdates[`devices/${deviceId}/nodes/${nodeId}/config/thresholds`] = threshold;
      counters.nodes++;

      // Lượt tưới: rải từ khi đăng ký thiết bị tới thời điểm thấy cuối
      const start = Math.max(registeredAt, plant.plantCreated);
      const end = Math.min(lastSeen, NOW);
      for (let t = start; t < end; t += int(2, 6) * DAY) {
        bulk.set(db.collection(`users/${uid}/plants/${plant.plantId}/wateringLogs`).doc(), {
          trigger: rand() < 0.65 ? 'AUTO' : 'MANUAL', startedAt: ts(t), durationSec: int(5, 30), deviceId, nodeId,
        });
        counters.wateringLogs++;
      }
    }
  }
}

await bulk.close();
await rtdb.ref('/').update(rtdbUpdates);

console.log('Đã seed Emulator project', PROJECT);
console.table(counters);
console.log('Admin: admin@leafy.test / Admin@123');
process.exit(0);
