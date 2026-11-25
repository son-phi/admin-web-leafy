import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRange } from '../src/utils/dateRange';
import { buckets } from '../src/utils/groupByPeriod';

const NOW = new Date(2026, 10, 26, 15, 30); // 26/11/2026 15:30 giờ địa phương

describe('date ranges and buckets (bước 4)', () => {
  it('builds 7/30 daily buckets ending today and 12 monthly buckets ending this month', () => {
    const week = buckets(resolveRange('7d', NOW));
    expect(week.map((b) => b.label)).toEqual(['20/11', '21/11', '22/11', '23/11', '24/11', '25/11', '26/11']);
    expect(buckets(resolveRange('30d', NOW))).toHaveLength(30);
    const year = buckets(resolveRange('12m', NOW));
    expect(year).toHaveLength(12);
    expect([year[0].label, year[11].label]).toEqual(['12/2025', '11/2026']);
    expect(year[11].end).toEqual(new Date(2026, 11, 1));
  });

  it('groups custom ranges by day up to 62 days, by month beyond, clipping the edge months', () => {
    const short = resolveRange('custom', NOW, '2026-09-26', '2026-11-26');
    expect(short.granularity).toBe('day');
    expect(buckets(short)).toHaveLength(62);
    const long = resolveRange('custom', NOW, '2026-03-15', '2026-11-26');
    expect(long.granularity).toBe('month');
    const b = buckets(long);
    expect(b[0]).toMatchObject({ label: '03/2026', start: new Date(2026, 2, 15) });
    expect(b.at(-1)).toMatchObject({ label: '11/2026', end: new Date(2026, 10, 27) });
  });

  it('rejects invalid custom ranges with INVALID_RANGE (4a)', () => {
    for (const [from, to] of [['', '2026-11-01'], ['2026-11-10', '2026-11-01'], ['2026-11-01', '2026-11-27'], ['2026-02-30', '2026-03-01']]) {
      expect(() => resolveRange('custom', NOW, from, to)).toThrow('Khoảng thời gian không hợp lệ');
    }
  });
});

describe('statistic controller on mock data', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  });

  async function setup() {
    const { createMockBackend } = await import('../src/services/backendMock');
    const { createStatisticController } = await import('../src/controllers/StatisticController');
    const backend = createMockBackend();
    await backend.auth.login('admin@example.test', '');
    return { backend, stats: createStatisticController(backend.userStat, backend.plantStat, backend.deviceStat, backend.species) };
  }

  it('returns 5 overview numbers consistent with the data', async () => {
    const { stats } = await setup();
    const o = await stats.getOverview();
    expect(o).toMatchObject({ users: 8, devices: 5, online: 3 });
    expect(o.plants).toBeGreaterThan(0);
  });

  it('series cover every bucket with zeros filled and match totals', async () => {
    const { stats } = await setup();
    const now = new Date();
    const all = resolveRange('custom', now, '2020-01-01', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
    const users = await stats.getStatistic('users', all, now);
    expect(users.type === 'users' && users.series.reduce((s, r) => s + r.newUsers, 0)).toBe(8);
    expect(users.type === 'users' && users.active + users.locked).toBe(8);
    const plants = await stats.getStatistic('plants', all, now);
    if (plants.type !== 'plants') throw new Error('type');
    expect(plants.series.reduce((s, r) => s + r.newPlants, 0)).toBe(plants.bySpecies.reduce((s, r) => s + r.count, 0));
    expect(plants.top5.length).toBeLessThanOrEqual(5);
    const week = await stats.getStatistic('devices', resolveRange('7d', now), now);
    if (week.type !== 'devices') throw new Error('type');
    expect(week.series).toHaveLength(7);
    expect(week.online + week.offline).toBe(5);
    expect(week.disconnected.every((d) => now.getTime() - d.lastSeen.getTime() > 24 * 3600_000)).toBe(true);
  });

  it('flags an empty range (6a) and maps failures to LOAD_FAILED (5a)', async () => {
    const { backend, stats } = await setup();
    const old = resolveRange('custom', new Date(), '2020-01-01', '2020-01-31');
    expect((await stats.getStatistic('users', old)).empty).toBe(true);
    const { createStatisticController } = await import('../src/controllers/StatisticController');
    const broken = createStatisticController({ ...backend.userStat, countUserByPeriod: async () => { throw new Error('offline'); } }, backend.plantStat, backend.deviceStat, backend.species);
    await expect(broken.getStatistic('users', old)).rejects.toThrow('Không thể tải dữ liệu, vui lòng thử lại');
  });
});
