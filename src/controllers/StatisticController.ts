// Control: xem thống kê (kịch bản 2.2.5.1, biểu đồ 2.3.2.1).
import type { SpeciesRepository } from '../entities/SpeciesRepository';
import type { DeviceStat, DisconnectedDevice } from '../entities/stats/DeviceStat';
import type { PlantStat, SpeciesCount } from '../entities/stats/PlantStat';
import type { UserStat } from '../entities/stats/UserStat';
import { addMonths, startOfMonth, type DateRange } from '../utils/dateRange';
import { buckets } from '../utils/groupByPeriod';
import { toAppError } from '../utils/messages';

export type StatType = 'users' | 'plants' | 'devices';

/** Bước 2 – 5 chỉ số tổng quan. */
export type Overview = { users: number; newUsersThisMonth: number; plants: number; devices: number; online: number };

export type UserStatistic = { type: 'users'; series: { label: string; newUsers: number }[]; active: number; locked: number };
export type PlantStatistic = { type: 'plants'; series: { label: string; newPlants: number }[]; bySpecies: SpeciesCount[]; top5: SpeciesCount[] };
export type DeviceStatistic = {
  type: 'devices';
  series: { label: string; newDevices: number; auto: number; manual: number }[];
  online: number;
  offline: number;
  disconnected: DisconnectedDevice[];
};
/** `empty`: không có dữ liệu phát sinh trong khoảng thời gian (ngoại lệ 6a). */
export type Statistic = (UserStatistic | PlantStatistic | DeviceStatistic) & { empty: boolean };

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function createStatisticController(userStat: UserStat, plantStat: PlantStat, deviceStat: DeviceStat, species: SpeciesRepository) {
  return {
    /** getOverview: gọi song song getUserOverview, getPlantOverview, getDeviceOverview. */
    async getOverview(now = new Date()): Promise<Overview> {
      try {
        const month = startOfMonth(now);
        const [users, newUsersThisMonth, plants, devices] = await Promise.all([
          userStat.countUsers(), userStat.countNewUsers(month, addMonths(month, 1)), plantStat.countPlants(), deviceStat.countDevicesAndOnline(now),
        ]);
        return { users, newUsersThisMonth, plants, devices: devices.total, online: devices.online };
      } catch (e) {
        throw toAppError(e, 'LOAD_FAILED'); // 5a
      }
    },

    /** Bước 5–6: getStatistic(type, from, to) – số liệu theo mốc đã điền đủ giá trị 0. */
    async getStatistic(type: StatType, range: DateRange, now = new Date()): Promise<Statistic> {
      const list = buckets(range);
      try {
        if (type === 'users') {
          const [series, status] = await Promise.all([userStat.countUserByPeriod(list), userStat.countUsersByStatus()]);
          return { type, series: list.map((b, i) => ({ label: b.label, newUsers: series[i] })), ...status, empty: sum(series) === 0 };
        }
        if (type === 'plants') {
          const [series, bySpecies] = await Promise.all([
            plantStat.countPlantByPeriod(list),
            species.getSpeciesList().then((s) => plantStat.countPlantBySpecies(s)),
          ]);
          return {
            type, series: list.map((b, i) => ({ label: b.label, newPlants: series[i] })),
            bySpecies, top5: bySpecies.filter((s) => s.count > 0).slice(0, 5), empty: sum(series) === 0,
          };
        }
        const [registered, watering, status, disconnected] = await Promise.all([
          deviceStat.countDeviceByPeriod(list), deviceStat.countWateringByTrigger(list), deviceStat.countDevicesAndOnline(now),
          deviceStat.getDisconnectedDevices(now, 20),
        ]);
        return {
          type,
          series: list.map((b, i) => ({ label: b.label, newDevices: registered[i], auto: watering.auto[i], manual: watering.manual[i] })),
          online: status.online, offline: status.total - status.online, disconnected,
          empty: sum(registered) + sum(watering.auto) + sum(watering.manual) === 0,
        };
      } catch (e) {
        throw toAppError(e, 'LOAD_FAILED'); // 5a
      }
    },
  };
}

export type StatisticController = ReturnType<typeof createStatisticController>;
