// Entity thống kê thiết bị IoT: getDeviceOverview / getDeviceStat.
// Danh sách thiết bị: Firestore `devices`; trạng thái kết nối: RTDB `devices/{id}/status/lastSeen` (4.2).
import { endAt, get, limitToFirst, orderByChild, query as rtdbQuery, ref, startAt, type Database } from 'firebase/database';
import {
  Timestamp, collection, collectionGroup, doc, getCountFromServer, getDoc, query, where, type Firestore, type Query } from 'firebase/firestore';
import { ONLINE_THRESHOLD_MS } from '../../../shared/catalog';
import { countInBuckets, type Bucket } from '../../utils/groupByPeriod';
import type { MockStore } from '../mock/store';

export const DISCONNECTED_MS = 24 * 3600_000;

export type DisconnectedDevice = { id: string; name: string; userId: string; lastSeen: Date };

export interface DeviceStat {
  /** countDevicesAndOnline: tổng thiết bị đã đăng ký và số đang trực tuyến (now − lastSeen ≤ 5 phút). */
  countDevicesAndOnline(now: Date): Promise<{ total: number; online: number }>;
  /** countDeviceByPeriod: số thiết bị đăng ký mới theo từng mốc. */
  countDeviceByPeriod(list: Bucket[]): Promise<number[]>;
  /** countWateringByTrigger: lượt tưới AUTO / MANUAL theo từng mốc. */
  countWateringByTrigger(list: Bucket[]): Promise<{ auto: number[]; manual: number[] }>;
  /** Thiết bị mất kết nối > 24 giờ (lâu nhất trước), tối đa `max`. */
  getDisconnectedDevices(now: Date, max: number): Promise<DisconnectedDevice[]>;
}

export function createFirebaseDeviceStat(db: Firestore, rtdb: Database): DeviceStat {
  const count = async (q: Query) => (await getCountFromServer(q)).data().count;
  const inBucket = (field: string, b: Bucket) => [where(field, '>=', Timestamp.fromDate(b.start)), where(field, '<', Timestamp.fromDate(b.end))];
  const statusQuery = () => rtdbQuery(ref(rtdb, 'devices'), orderByChild('status/lastSeen'));
  return {
    async countDevicesAndOnline(now) {
      const [total, online] = await Promise.all([
        count(collection(db, 'devices')),
        // Truy vấn có chỉ mục `.indexOn: status/lastSeen`; chỉ trả về thiết bị đang trực tuyến.
        get(rtdbQuery(statusQuery(), startAt(now.getTime() - ONLINE_THRESHOLD_MS))).then((s) => s.size),
      ]);
      return { total, online };
    },
    countDeviceByPeriod: (list) => Promise.all(list.map((b) => count(query(collection(db, 'devices'), ...inBucket('registeredAt', b))))),
    async countWateringByTrigger(list) {
      const logs = collectionGroup(db, 'wateringLogs');
      const byTrigger = (trigger: string) => Promise.all(list.map((b) => count(query(logs, where('trigger', '==', trigger), ...inBucket('startedAt', b)))));
      const [auto, manual] = await Promise.all([byTrigger('AUTO'), byTrigger('MANUAL')]);
      return { auto, manual };
    },
    async getDisconnectedDevices(now, max) {
      // startAt(1): bỏ qua thiết bị chưa từng báo trạng thái.
      const snap = await get(rtdbQuery(statusQuery(), startAt(1), endAt(now.getTime() - DISCONNECTED_MS), limitToFirst(max)));
      const ids: { id: string; lastSeen: number }[] = [];
      snap.forEach((child) => { ids.push({ id: child.key!, lastSeen: Number(child.child('status/lastSeen').val()) }); });
      return Promise.all(ids.map(async ({ id, lastSeen }) => {
        const d = await getDoc(doc(db, 'devices', id));
        return { id, name: String(d.get('name') ?? id), userId: String(d.get('userId') ?? ''), lastSeen: new Date(lastSeen) };
      }));
    },
  };
}

export function createMockDeviceStat(store: MockStore, assertAdmin: () => void): DeviceStat {
  return {
    async countDevicesAndOnline(now) {
      assertAdmin();
      const devices = store.data.devices;
      return { total: devices.length, online: devices.filter((d) => now.getTime() - d.lastSeen <= ONLINE_THRESHOLD_MS).length };
    },
    async countDeviceByPeriod(list) { assertAdmin(); return countInBuckets(store.data.devices.map((d) => d.registeredAt), list); },
    async countWateringByTrigger(list) {
      assertAdmin();
      const times = (t: 'AUTO' | 'MANUAL') => store.data.wateringLogs.filter((w) => w.trigger === t).map((w) => w.startedAt);
      return { auto: countInBuckets(times('AUTO'), list), manual: countInBuckets(times('MANUAL'), list) };
    },
    async getDisconnectedDevices(now, max) {
      assertAdmin();
      return store.data.devices
        .filter((d) => now.getTime() - d.lastSeen > DISCONNECTED_MS)
        .sort((a, b) => a.lastSeen - b.lastSeen)
        .slice(0, max)
        .map((d) => ({ id: d.id, name: d.name, userId: d.userId, lastSeen: new Date(d.lastSeen) }));
    },
  };
}
