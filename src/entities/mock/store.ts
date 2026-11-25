// Dữ liệu mock lưu trên trình duyệt (localStorage). Không kết nối Firebase, không chứa dữ liệu người thật.
import sample from '../../../shared/sample-catalog.json';
import type { Disease, Species } from '../../../shared/catalog';
import { normalizeSearch } from '../../../shared/normalize';

const KEY = 'leafy-mock-v2';
const DAY = 86_400_000;

export type MockCatalog<T> = { id: string; searchName: string; data: T; createdAt: number; updatedAt: number; updatedBy: string };
export type MockUser = {
  id: string; searchName: string; fullName: string; email: string; avatarUrl: string;
  role: 'admin' | 'user'; status: 'active' | 'locked'; createdAt: number; lastLoginAt: number | null;
};
export type MockLockLog = { id: string; userId: string; adminId: string; action: 'LOCK' | 'UNLOCK'; reason: string; createdAt: number };
export type MockPlant = { id: string; userId: string; speciesId: string; useSpeciesThresholds: boolean; createdAt: number };
export type MockDiagnosis = { id: string; userId: string; plantId: string; diseaseId: string; createdAt: number };
export type MockDevice = { id: string; userId: string; name: string; registeredAt: number; lastSeen: number };
export type MockChatSession = { id: string; userId: string; createdAt: number };
export type MockWateringLog = { id: string; userId: string; plantId: string; trigger: 'AUTO' | 'MANUAL'; startedAt: number };
export type MockData = {
  species: MockCatalog<Species>[];
  diseases: MockCatalog<Disease>[];
  users: MockUser[];
  lockHistory: MockLockLog[];
  plants: MockPlant[];
  diagnoses: MockDiagnosis[];
  devices: MockDevice[];
  chatSessions: MockChatSession[];
  wateringLogs: MockWateringLog[];
};

const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin;

function seed(now = Date.now()): MockData {
  const image = { imageUrl: `${origin}/mock-leaf.svg`, imagePath: '' };
  const meta = { createdAt: now - 400 * DAY, updatedAt: now - 400 * DAY, updatedBy: 'mock' };
  const species = sample.species.map(({ id, ...rest }) => {
    const data = { ...rest, ...image } as Species;
    return { id, searchName: normalizeSearch(data.commonName), data, ...meta };
  });
  const diseases = sample.diseases.map(({ id, ...rest }) => {
    const data = { ...rest, ...image } as Disease;
    return { id, searchName: normalizeSearch(data.nameVi), data, ...meta };
  });
  const names = ['Nguyễn An', 'Trần Bình', 'Lê Chi', 'Phạm Dũng', 'Hoàng Giang', 'Vũ Hà', 'Đặng Khoa', 'Bùi Lan'];
  const users: MockUser[] = [
    {
      id: 'mock-admin', searchName: 'quan tri vien mock', fullName: 'Quản trị viên Mock', email: 'admin@example.test',
      avatarUrl: '', role: 'admin', status: 'active', createdAt: now - 400 * DAY, lastLoginAt: now,
    },
    ...names.map((fullName, i): MockUser => ({
      id: `mock-user-${i + 1}`, searchName: normalizeSearch(fullName), fullName, email: `user${i + 1}@example.test`, avatarUrl: '',
      role: 'user', status: i === 7 ? 'locked' : 'active', createdAt: now - (20 + i * 40) * DAY, lastLoginAt: i % 3 ? now - i * DAY : null,
    })),
  ];
  const plants: MockPlant[] = users.filter((u) => u.role === 'user').flatMap((u, i) =>
    Array.from({ length: (i % 3) + 1 }, (_, k) => ({
      id: `${u.id}-plant-${k + 1}`, userId: u.id, speciesId: species[(i + k) % species.length].id,
      useSpeciesThresholds: k !== 1, createdAt: u.createdAt + (k + 1) * DAY,
    })));
  const lockHistory: MockLockLog[] = [
    { id: 'lock-1', userId: 'mock-user-8', adminId: 'mock-admin', action: 'LOCK', reason: 'Vi phạm điều khoản sử dụng', createdAt: now - 3 * DAY },
  ];
  const diagnoses: MockDiagnosis[] = plants.flatMap((p, i) =>
    Array.from({ length: i % 3 }, (_, k) => ({
      id: `${p.id}-dx-${k + 1}`, userId: p.userId, plantId: p.id, diseaseId: diseases[(i + k) % diseases.length].id, createdAt: p.createdAt + (k + 2) * DAY,
    })));
  const members = users.filter((u) => u.role === 'user');
  const devices: MockDevice[] = members.slice(0, 5).map((u, i) => ({
    id: `mock-esp32-${i + 1}`, userId: u.id, name: `Bộ cảm biến ${u.fullName}`, registeredAt: u.createdAt + 2 * DAY,
    lastSeen: i < 3 ? now - 60_000 : now - (i + 1) * DAY,
  }));
  const chatSessions: MockChatSession[] = members.flatMap((u, i) =>
    Array.from({ length: i % 4 }, (_, k) => ({ id: `${u.id}-chat-${k + 1}`, userId: u.id, createdAt: u.createdAt + (k + 3) * DAY })));
  const deviceOwners = new Set(devices.map((d) => d.userId));
  const wateringLogs: MockWateringLog[] = plants.filter((p) => deviceOwners.has(p.userId)).flatMap((p, i) =>
    Array.from({ length: 40 }, (_, k) => ({
      id: `${p.id}-w-${k}`, userId: p.userId, plantId: p.id, trigger: (k + i) % 3 === 0 ? 'MANUAL' as const : 'AUTO' as const,
      startedAt: now - (k * 9 + i) * DAY / 2,
    })));
  return { species, diseases, users, lockHistory, plants, diagnoses, devices, chatSessions, wateringLogs };
}

export class MockStore {
  data: MockData;

  constructor() {
    this.data = seed();
    try {
      const stored = localStorage.getItem(KEY);
      // Dữ liệu cũ có thể thiếu collection mới → bổ sung từ seed.
      if (stored) this.data = { ...this.data, ...(JSON.parse(stored) as Partial<MockData>) };
    } catch {
      try { localStorage.removeItem(KEY); } catch { /* bộ nhớ trình duyệt không khả dụng */ }
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* bộ nhớ trình duyệt không khả dụng */ }
  }
}
