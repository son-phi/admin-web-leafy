// Entity: tài khoản người dùng – `users/{uid}` (chỉ đọc; đổi trạng thái qua callable setAccountStatus).
import {
  collection, doc, getCountFromServer, getDoc, getDocs, query, where, type Firestore, type Query, type QueryConstraint,
} from 'firebase/firestore';
import { fetchPage, toDate } from './firestore';
import { mockPage } from './mock/paging';
import type { MockStore, MockUser } from './mock/store';
import type { Page, PageRequest } from './types';

export type UserStatus = 'active' | 'locked';
export type UserRecord = {
  id: string; fullName: string; email: string; avatarUrl: string;
  role: string; status: UserStatus; createdAt: Date | null; lastLoginAt: Date | null;
};
export type UsageCounts = { plants: number; devices: number; diagnoses: number; chatSessions: number };

export interface UserRepository {
  /**
   * searchUsers: chỉ `role == 'user'`; `request.search` tìm tiền tố theo họ tên hoặc email;
   * `request.filter` = 'active' | 'locked' để lọc trạng thái.
   */
  getAllUser(request: PageRequest): Promise<Page<UserRecord>>;
  getUserDetail(uid: string): Promise<UserRecord | null>;
  /** Số cây của người dùng (cột "Số cây"). */
  countPlantsByUser(uid: string): Promise<number>;
  /** countUsage: số cây, thiết bị IoT, lượt chẩn đoán, phiên hội thoại (bước 7). */
  countUsage(uid: string): Promise<UsageCounts>;
}

function fromFirestore(id: string, d: Record<string, unknown>): UserRecord {
  return {
    id,
    fullName: String(d.fullName ?? ''),
    email: String(d.email ?? ''),
    avatarUrl: String(d.avatarUrl ?? ''),
    role: String(d.role ?? ''),
    status: d.status === 'locked' ? 'locked' : 'active',
    createdAt: toDate(d.createdAt),
    lastLoginAt: toDate(d.lastLoginAt),
  };
}

const count = async (q: Query) => (await getCountFromServer(q)).data().count;

export function createFirebaseUserRepository(db: Firestore): UserRepository {
  return {
    async getAllUser(request) {
      const filters: QueryConstraint[] = [where('role', '==', 'user')];
      if (request.filter === 'active' || request.filter === 'locked') filters.push(where('status', '==', request.filter));
      const page = await fetchPage(db, 'users', request, { filters, prefixArrayField: 'searchPrefixes', idOrderWhenBrowsing: true });
      return { items: page.docs.map((d) => fromFirestore(d.id, d.data())), cursor: page.cursor, more: page.more };
    },
    async getUserDetail(uid) {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? fromFirestore(snap.id, snap.data()) : null;
    },
    async countPlantsByUser(uid) {
      return count(collection(db, 'users', uid, 'plants'));
    },
    async countUsage(uid) {
      const plantsRef = collection(db, 'users', uid, 'plants');
      // Lượt chẩn đoán nằm dưới từng cây: đếm theo từng cây (số cây của một người dùng nhỏ).
      const plantIds = (await getDocs(plantsRef)).docs.map((d) => d.id);
      const [devices, chatSessions, perPlant] = await Promise.all([
        count(query(collection(db, 'devices'), where('userId', '==', uid))),
        count(collection(db, 'users', uid, 'chatSessions')),
        Promise.all(plantIds.map((pid) => count(collection(db, 'users', uid, 'plants', pid, 'diagnoses')))),
      ]);
      return { plants: plantIds.length, devices, diagnoses: perPlant.reduce((a, b) => a + b, 0), chatSessions };
    },
  };
}

const fromMock = (u: MockUser): UserRecord => ({
  id: u.id, fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl, role: u.role, status: u.status,
  createdAt: new Date(u.createdAt), lastLoginAt: u.lastLoginAt === null ? null : new Date(u.lastLoginAt),
});

export function createMockUserRepository(store: MockStore, assertAdmin: () => void): UserRepository {
  return {
    async getAllUser(request) {
      assertAdmin();
      const rows = store.data.users.filter((u) => u.role === 'user' && (!request.filter || u.status === request.filter));
      return mockPage(rows, request, fromMock, (u) => [u.fullName, u.email]);
    },
    async getUserDetail(uid) {
      assertAdmin();
      const u = store.data.users.find((x) => x.id === uid);
      return u ? fromMock(u) : null;
    },
    async countPlantsByUser(uid) {
      assertAdmin();
      return store.data.plants.filter((p) => p.userId === uid).length;
    },
    async countUsage(uid) {
      assertAdmin();
      return {
        plants: store.data.plants.filter((p) => p.userId === uid).length,
        devices: store.data.devices.filter((d) => d.userId === uid).length,
        diagnoses: store.data.diagnoses.filter((d) => d.userId === uid).length,
        chatSessions: store.data.chatSessions.filter((c) => c.userId === uid).length,
      };
    },
  };
}
