// Entity thống kê người dùng (biểu đồ 2.3.2.1): getUserOverview / getUserStat.
// Mọi số liệu đếm bằng aggregation count(), không tải tài liệu.
import { Timestamp, collection, getCountFromServer, query, where, type Firestore } from 'firebase/firestore';
import { countInBuckets, type Bucket } from '../../utils/groupByPeriod';
import type { MockStore } from '../mock/store';

export interface UserStat {
  /** Tổng số người dùng (role == 'user'). */
  countUsers(): Promise<number>;
  /** Người dùng đăng ký mới trong [start, end). */
  countNewUsers(start: Date, end: Date): Promise<number>;
  /** countUserByPeriod: số đăng ký mới theo từng mốc. */
  countUserByPeriod(list: Bucket[]): Promise<number[]>;
  /** Số tài khoản đang hoạt động / bị khóa (hiện tại). */
  countUsersByStatus(): Promise<{ active: number; locked: number }>;
}

export function createFirebaseUserStat(db: Firestore): UserStat {
  const users = query(collection(db, 'users'), where('role', '==', 'user'));
  const count = async (...c: Parameters<typeof where>[]) =>
    (await getCountFromServer(query(users, ...c.map((args) => where(...args))))).data().count;
  const between = (start: Date, end: Date) => count(['createdAt', '>=', Timestamp.fromDate(start)], ['createdAt', '<', Timestamp.fromDate(end)]);
  return {
    countUsers: () => count(),
    countNewUsers: between,
    countUserByPeriod: (list) => Promise.all(list.map((b) => between(b.start, b.end))),
    async countUsersByStatus() {
      const [active, locked] = await Promise.all([count(['status', '==', 'active']), count(['status', '==', 'locked'])]);
      return { active, locked };
    },
  };
}

export function createMockUserStat(store: MockStore, assertAdmin: () => void): UserStat {
  const members = () => { assertAdmin(); return store.data.users.filter((u) => u.role === 'user'); };
  return {
    async countUsers() { return members().length; },
    async countNewUsers(start, end) { return members().filter((u) => u.createdAt >= start.getTime() && u.createdAt < end.getTime()).length; },
    async countUserByPeriod(list) { return countInBuckets(members().map((u) => u.createdAt), list); },
    async countUsersByStatus() {
      const all = members();
      return { active: all.filter((u) => u.status === 'active').length, locked: all.filter((u) => u.status === 'locked').length };
    },
  };
}
