// Entity thống kê cây trồng (collection group `plants`): getPlantOverview / getPlantStat.
import { Timestamp, collectionGroup, getCountFromServer, query, where, type Firestore, type Query } from 'firebase/firestore';
import { countInBuckets, type Bucket } from '../../utils/groupByPeriod';
import type { MockStore } from '../mock/store';

export type SpeciesCount = { id: string; name: string; count: number };

export interface PlantStat {
  countPlants(): Promise<number>;
  /** Số cây tạo mới theo từng mốc. */
  countPlantByPeriod(list: Bucket[]): Promise<number[]>;
  /** countPlantBySpecies: tổng số cây hiện có theo từng loài trong danh mục (giảm dần). */
  countPlantBySpecies(species: { id: string; commonName: string }[]): Promise<SpeciesCount[]>;
}

const sortDesc = (rows: SpeciesCount[]) => rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

export function createFirebasePlantStat(db: Firestore): PlantStat {
  const plants = collectionGroup(db, 'plants');
  const count = async (q: Query) => (await getCountFromServer(q)).data().count;
  return {
    countPlants: () => count(plants),
    countPlantByPeriod: (list) => Promise.all(list.map((b) =>
      count(query(plants, where('createdAt', '>=', Timestamp.fromDate(b.start)), where('createdAt', '<', Timestamp.fromDate(b.end)))))),
    async countPlantBySpecies(species) {
      const rows = await Promise.all(species.map(async (s) => ({
        id: s.id, name: s.commonName, count: await count(query(plants, where('speciesId', '==', s.id))),
      })));
      return sortDesc(rows);
    },
  };
}

export function createMockPlantStat(store: MockStore, assertAdmin: () => void): PlantStat {
  return {
    async countPlants() { assertAdmin(); return store.data.plants.length; },
    async countPlantByPeriod(list) { assertAdmin(); return countInBuckets(store.data.plants.map((p) => p.createdAt), list); },
    async countPlantBySpecies(species) {
      assertAdmin();
      return sortDesc(species.map((s) => ({ id: s.id, name: s.commonName, count: store.data.plants.filter((p) => p.speciesId === s.id).length })));
    },
  };
}
