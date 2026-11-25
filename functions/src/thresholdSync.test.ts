import { beforeEach, describe, expect, it, vi } from 'vitest';

type Data = Record<string, unknown>;
const state = vi.hoisted(() => ({ docs: new Map<string, Data>(), rtdbUpdates: [] as Record<string, unknown>[], queries: 0 }));

vi.mock('firebase-functions', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));
vi.mock('firebase-admin/database', () => ({
  getDatabase: () => ({ ref: () => ({ update: async (u: Record<string, unknown>) => { state.rtdbUpdates.push(u); } }) }),
}));
vi.mock('firebase-admin/firestore', () => {
  type Filter = { field: string; op: string; value: unknown };
  const refOf = (path: string) => {
    const parts = path.split('/');
    return { id: parts.at(-1), parent: { parent: parts.length >= 4 ? { id: parts.at(-3) } : null } };
  };
  const group = (name: string, filters: Filter[] = []) => ({
    where: (field: string, op: string, value: unknown) => group(name, [...filters, { field, op, value }]),
    get: async () => {
      state.queries++;
      if (filters.some((f) => f.op === 'in' && (f.value as unknown[]).length > 30)) throw new Error('in > 30');
      const docs = [...state.docs]
        .filter(([p]) => p.split('/').at(-2) === name)
        .filter(([, d]) => filters.every((f) => (f.op === 'in' ? (f.value as unknown[]).includes(d[f.field]) : d[f.field] === f.value)))
        .map(([p, d]) => ({ id: p.split('/').at(-1), ref: refOf(p), get: (k: string) => d[k] }));
      return { docs };
    },
  });
  return { getFirestore: () => ({ collectionGroup: (name: string) => group(name) }) };
});

import { syncSpeciesThreshold, thresholdChanged } from './thresholdSync';

const oldT = { soilMoistureMin: 40, soilMoistureMax: 70, temperatureMin: 18, temperatureMax: 32, airHumidityMin: 50, airHumidityMax: 80, lightMin: 1000, lightMax: 10000 };
const newT = { ...oldT, soilMoistureMin: 45 };

describe('onSpeciesThresholdUpdated → syncThreshold', () => {
  beforeEach(() => {
    state.docs.clear();
    state.rtdbUpdates = [];
    state.queries = 0;
    // u1: p1 dùng ngưỡng theo loài, p2 dùng ngưỡng riêng; u2: p3 thuộc loài khác.
    state.docs.set('users/u1/plants/p1', { speciesId: 'trau-ba', useSpeciesThresholds: true });
    state.docs.set('users/u1/plants/p2', { speciesId: 'trau-ba', useSpeciesThresholds: false });
    state.docs.set('users/u2/plants/p3', { speciesId: 'lan-y', useSpeciesThresholds: true });
    state.docs.set('devices/d1/nodes/n1', { plantId: 'p1', userId: 'u1' });
    state.docs.set('devices/d1/nodes/n2', { plantId: 'p2', userId: 'u1' });
    state.docs.set('devices/d2/nodes/n1', { plantId: 'p3', userId: 'u2' });
  });

  it('does nothing when the threshold did not change (key order ignored)', async () => {
    const reordered = Object.fromEntries(Object.entries(oldT).reverse());
    expect(thresholdChanged(oldT, reordered)).toBe(false);
    expect(await syncSpeciesThreshold('trau-ba', oldT, reordered)).toBe(0);
    expect(state.queries).toBe(0);
    expect(state.rtdbUpdates).toEqual([]);
  });

  it('writes the new threshold only to nodes of plants that use species thresholds', async () => {
    expect(await syncSpeciesThreshold('trau-ba', oldT, newT)).toBe(1);
    expect(state.rtdbUpdates).toEqual([{ 'devices/d1/nodes/n1/config/thresholds': newT }]);
  });

  it('skips a node of another user that happens to reference the same plant id', async () => {
    state.docs.set('devices/d9/nodes/n1', { plantId: 'p1', userId: 'someone-else' });
    await syncSpeciesThreshold('trau-ba', oldT, newT);
    expect(Object.keys(state.rtdbUpdates[0])).toEqual(['devices/d1/nodes/n1/config/thresholds']);
  });

  it('ignores invalid thresholds and species with no plants', async () => {
    expect(await syncSpeciesThreshold('trau-ba', oldT, { ...newT, temperatureMin: 99 })).toBe(0);
    expect(await syncSpeciesThreshold('khong-ai-trong', oldT, newT)).toBe(0);
    expect(state.rtdbUpdates).toEqual([]);
  });

  it('splits node lookups into chunks of 30 plant ids', async () => {
    for (let i = 0; i < 65; i++) {
      state.docs.set(`users/u1/plants/x${i}`, { speciesId: 'monstera', useSpeciesThresholds: true });
      state.docs.set(`devices/dx/nodes/n${i}`, { plantId: `x${i}`, userId: 'u1' });
    }
    expect(await syncSpeciesThreshold('monstera', oldT, newT)).toBe(65);
    expect(state.queries).toBe(1 + 3); // 1 truy vấn cây + 3 lô node (30 + 30 + 5)
    expect(Object.keys(state.rtdbUpdates[0])).toHaveLength(65);
  });
});
