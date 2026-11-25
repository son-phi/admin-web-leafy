// Entity: lịch sử khóa/mở khóa – `users/{uid}/lockHistory` (ghi qua callable).
import { collection, getDocs, limit, orderBy, query, type Firestore } from 'firebase/firestore';
import { toDate } from './firestore';
import type { MockStore } from './mock/store';

export type LockLog = { id: string; adminId: string; action: 'LOCK' | 'UNLOCK'; reason: string; createdAt: Date | null };

export interface AccountLockLogRepository {
  /** Mới nhất trước. */
  getLockHistory(uid: string): Promise<LockLog[]>;
}

export function createFirebaseLockLogRepository(db: Firestore): AccountLockLogRepository {
  return {
    async getLockHistory(uid) {
      const snap = await getDocs(query(collection(db, 'users', uid, 'lockHistory'), orderBy('createdAt', 'desc'), limit(50)));
      return snap.docs.map((d) => ({
        id: d.id,
        adminId: String(d.get('adminId') ?? ''),
        action: d.get('action') === 'UNLOCK' ? 'UNLOCK' : 'LOCK',
        reason: String(d.get('reason') ?? ''),
        createdAt: toDate(d.get('createdAt')),
      }));
    },
  };
}

export function createMockLockLogRepository(store: MockStore, assertAdmin: () => void): AccountLockLogRepository {
  return {
    async getLockHistory(uid) {
      assertAdmin();
      return store.data.lockHistory
        .filter((l) => l.userId === uid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((l) => ({ id: l.id, adminId: l.adminId, action: l.action, reason: l.reason, createdAt: new Date(l.createdAt) }));
    },
  };
}
