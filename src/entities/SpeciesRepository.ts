// Entity: loài cây – collection `species` (D1).
import {
  collection, collectionGroup, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where, type Firestore,
} from 'firebase/firestore';
import { SPECIES_FIELDS, fingerprint, pickFields, type Species } from '../../shared/catalog';
import { fetchPage } from './firestore';
import { mockPage } from './mock/paging';
import type { MockStore } from './mock/store';
import type { Page, PageRequest } from './types';

export type SpeciesRecord = { id: string; data: Species; fingerprint: string };
export type SpeciesOption = { id: string; commonName: string };

export interface SpeciesRepository {
  /** Tìm tiền tố theo tên thông thường hoặc tên khoa học (bước 3). */
  getAllSpecies(request: PageRequest): Promise<Page<SpeciesRecord>>;
  getSpeciesById(id: string): Promise<SpeciesRecord | null>;
  /** Danh sách gọn (id, tên) cho bộ chọn loài; danh mục có giới hạn nên tải tối đa 500. */
  getSpeciesList(): Promise<SpeciesOption[]>;
  countSpecies(): Promise<number>;
  /** Số cây người dùng đang trồng thuộc loài (collection group `plants`, đếm bằng aggregation). */
  countPlantsBySpecies(id: string): Promise<number>;
}

const toRecord = (id: string, raw: Record<string, unknown>): SpeciesRecord => ({
  id, data: pickFields<Species>(SPECIES_FIELDS, raw), fingerprint: fingerprint(SPECIES_FIELDS, raw),
});

export function createFirebaseSpeciesRepository(db: Firestore): SpeciesRepository {
  return {
    async getAllSpecies(request) {
      const page = await fetchPage(db, 'species', request, { prefixArrayField: 'searchPrefixes' });
      return { items: page.docs.map((d) => toRecord(d.id, d.data())), cursor: page.cursor, more: page.more };
    },
    async getSpeciesById(id) {
      const snap = await getDoc(doc(db, 'species', id));
      return snap.exists() ? toRecord(snap.id, snap.data()) : null;
    },
    async getSpeciesList() {
      const snap = await getDocs(query(collection(db, 'species'), orderBy('searchName'), limit(500)));
      return snap.docs.map((d) => ({ id: d.id, commonName: String(d.get('commonName') ?? d.id) }));
    },
    async countSpecies() {
      return (await getCountFromServer(collection(db, 'species'))).data().count;
    },
    async countPlantsBySpecies(id) {
      return (await getCountFromServer(query(collectionGroup(db, 'plants'), where('speciesId', '==', id)))).data().count;
    },
  };
}

export function createMockSpeciesRepository(store: MockStore, assertAdmin: () => void): SpeciesRepository {
  const toMock = (r: MockStore['data']['species'][number]) => toRecord(r.id, structuredClone(r.data));
  return {
    async getAllSpecies(request) {
      assertAdmin();
      return mockPage(store.data.species, request, toMock, (r) => [r.data.commonName, r.data.scientificName]);
    },
    async getSpeciesById(id) {
      assertAdmin();
      const r = store.data.species.find((s) => s.id === id);
      return r ? toMock(r) : null;
    },
    async getSpeciesList() {
      assertAdmin();
      return [...store.data.species]
        .sort((a, b) => (a.searchName < b.searchName ? -1 : 1))
        .map((s) => ({ id: s.id, commonName: s.data.commonName }));
    },
    async countSpecies() { assertAdmin(); return store.data.species.length; },
    async countPlantsBySpecies(id) { assertAdmin(); return store.data.plants.filter((p) => p.speciesId === id).length; },
  };
}
