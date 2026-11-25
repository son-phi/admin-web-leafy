// Entity: bệnh cây – collection `diseases`.
import { collection, collectionGroup, doc, getCountFromServer, getDoc, query, where, type Firestore } from 'firebase/firestore';
import { DISEASE_FIELDS, fingerprint, pickFields, type Disease } from '../../shared/catalog';
import { fetchPage } from './firestore';
import { mockPage } from './mock/paging';
import type { MockStore } from './mock/store';
import type { Page, PageRequest } from './types';

export type DiseaseRecord = { id: string; data: Disease; fingerprint: string };

export interface DiseaseRepository {
  /** Tìm tiền tố theo tên bệnh; `request.filter` = id loài cây bị ảnh hưởng (array-contains). */
  getAllDiseases(request: PageRequest): Promise<Page<DiseaseRecord>>;
  getDiseaseById(id: string): Promise<DiseaseRecord | null>;
  countDiseases(): Promise<number>;
  /** Số lượt được chẩn đoán (collection group `diagnoses`, đếm bằng aggregation). */
  countDiagnosesByDisease(id: string): Promise<number>;
}

const toRecord = (id: string, raw: Record<string, unknown>): DiseaseRecord => ({
  id, data: pickFields<Disease>(DISEASE_FIELDS, raw), fingerprint: fingerprint(DISEASE_FIELDS, raw),
});

export function createFirebaseDiseaseRepository(db: Firestore): DiseaseRepository {
  return {
    async getAllDiseases(request) {
      const filters = request.filter ? [where('affectedSpeciesIds', 'array-contains', request.filter)] : [];
      const page = await fetchPage(db, 'diseases', request, { filters });
      return { items: page.docs.map((d) => toRecord(d.id, d.data())), cursor: page.cursor, more: page.more };
    },
    async getDiseaseById(id) {
      const snap = await getDoc(doc(db, 'diseases', id));
      return snap.exists() ? toRecord(snap.id, snap.data()) : null;
    },
    async countDiseases() {
      return (await getCountFromServer(collection(db, 'diseases'))).data().count;
    },
    async countDiagnosesByDisease(id) {
      return (await getCountFromServer(query(collectionGroup(db, 'diagnoses'), where('diseaseId', '==', id)))).data().count;
    },
  };
}

export function createMockDiseaseRepository(store: MockStore, assertAdmin: () => void): DiseaseRepository {
  const toMock = (r: MockStore['data']['diseases'][number]) => toRecord(r.id, structuredClone(r.data));
  return {
    async getAllDiseases(request) {
      assertAdmin();
      const rows = request.filter ? store.data.diseases.filter((d) => d.data.affectedSpeciesIds.includes(request.filter!)) : store.data.diseases;
      return mockPage(rows, request, toMock);
    },
    async getDiseaseById(id) {
      assertAdmin();
      const r = store.data.diseases.find((d) => d.id === id);
      return r ? toMock(r) : null;
    },
    async countDiseases() { assertAdmin(); return store.data.diseases.length; },
    async countDiagnosesByDisease(id) { assertAdmin(); return store.data.diagnoses.filter((d) => d.diseaseId === id).length; },
  };
}
