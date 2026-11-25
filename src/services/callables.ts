// Mọi thao tác ghi đi qua Cloud Functions callable (D3). Bản mock mô phỏng cùng quy tắc trên localStorage.
import { httpsCallable, type Functions } from 'firebase/functions';
import {
  DISEASE_FIELDS, DeleteInput, SPECIES_FIELDS, SaveDiseaseInput, SaveSpeciesInput, fingerprint, isImagePath,
  type ImageFolder, type SaveDiseaseRequest, type SaveSpeciesRequest,
} from '../../shared/catalog';
import { normalizeSearch } from '../../shared/normalize';
import {
  SetAccountStatusInput, UserAuthInfoInput, statusAfter,
  type AccountStatus, type SetAccountStatusRequest, type UserAuthInfo,
} from '../../shared/accounts';
import type { MockCatalog, MockStore } from '../entities/mock/store';
import { AppError, toAppError, type MsgKey } from '../utils/messages';

export type SaveResult = { id: string };

export interface Callables {
  saveSpecies(input: SaveSpeciesRequest): Promise<SaveResult>;
  deleteSpecies(input: { id: string }): Promise<void>;
  saveDisease(input: SaveDiseaseRequest): Promise<SaveResult>;
  deleteDisease(input: { id: string }): Promise<void>;
  setAccountStatus(input: SetAccountStatusRequest): Promise<{ status: AccountStatus; changed: boolean }>;
  getUserAuthInfo(input: { uid: string }): Promise<UserAuthInfo>;
}

export function createFirebaseCallables(functions: Functions): Callables {
  const call = <I, O>(name: string) => async (input: I): Promise<O> => {
    try {
      return (await httpsCallable<I, O>(functions, name)(input)).data;
    } catch (error) {
      throw toAppError(error, 'UPDATE_FAILED');
    }
  };
  const deleteSpecies = call<{ id: string }, unknown>('deleteSpecies');
  const deleteDisease = call<{ id: string }, unknown>('deleteDisease');
  return {
    saveSpecies: call<SaveSpeciesRequest, SaveResult>('saveSpecies'),
    deleteSpecies: async (input) => { await deleteSpecies(input); },
    saveDisease: call<SaveDiseaseRequest, SaveResult>('saveDisease'),
    deleteDisease: async (input) => { await deleteDisease(input); },
    setAccountStatus: call<SetAccountStatusRequest, { status: AccountStatus; changed: boolean }>('setAccountStatus'),
    getUserAuthInfo: call<{ uid: string }, UserAuthInfo>('getUserAuthInfo'),
  };
}

type Unique<T> = { value: (data: T) => string; key: MsgKey };

/** Mock cùng quy tắc với Functions: whitelist, đường dẫn ảnh, trùng tên/mã nhãn, fingerprint, đang được dùng. */
export function createMockCallables(store: MockStore, requireAdmin: () => string): Callables {
  function save<T extends Record<string, unknown>>(
    rows: MockCatalog<T>[], folder: ImageFolder, fields: readonly string[], name: (d: T) => string, unique: Unique<T>[],
    input: { id?: string; data: T; fingerprint?: string },
  ): SaveResult {
    const actor = requireAdmin();
    const imagePath = String(input.data.imagePath ?? '');
    if (imagePath && !isImagePath(folder, imagePath)) throw new AppError('INVALID_IMAGE');
    const existing = input.id ? rows.find((r) => r.id === input.id) : undefined;
    if (input.id) {
      if (!existing) throw new AppError('NOT_FOUND');
      if (input.fingerprint !== fingerprint(fields, existing.data)) throw new AppError('CONFLICT');
    }
    for (const rule of unique) {
      if (rows.some((r) => r.id !== input.id && rule.value(r.data) === rule.value(input.data))) throw new AppError(rule.key);
    }
    const now = Date.now();
    const searchName = normalizeSearch(name(input.data));
    if (existing) {
      Object.assign(existing, { data: input.data, searchName, updatedAt: now, updatedBy: actor });
      store.save();
      return { id: existing.id };
    }
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    rows.push({ id, data: input.data, searchName, createdAt: now, updatedAt: now, updatedBy: actor });
    store.save();
    return { id };
  }

  function parse<T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }): T {
    if (result.success) return result.data;
    throw new AppError(result.error.issues.some((i) => i.message === 'INVALID_THRESHOLD') ? 'INVALID_THRESHOLD' : 'INVALID_INPUT');
  }

  return {
    async saveSpecies(raw) {
      const input = parse(SaveSpeciesInput.safeParse(raw));
      return save(store.data.species, 'species', SPECIES_FIELDS, (d) => d.commonName, [
        { value: (d) => normalizeSearch(d.commonName), key: 'SPECIES_EXISTS' },
        { value: (d) => d.aiLabel, key: 'LABEL_USED' },
      ], input);
    },
    async deleteSpecies(raw) {
      requireAdmin();
      const { id } = parse(DeleteInput.safeParse(raw));
      const index = store.data.species.findIndex((s) => s.id === id);
      if (index < 0) throw new AppError('NOT_FOUND');
      if (store.data.plants.some((p) => p.speciesId === id)) throw new AppError('SPECIES_IN_USE');
      store.data.species.splice(index, 1);
      store.save();
    },
    async saveDisease(raw) {
      const input = parse(SaveDiseaseInput.safeParse(raw));
      if (input.data.affectedSpeciesIds.some((id) => !store.data.species.some((s) => s.id === id))) {
        requireAdmin();
        throw new AppError('SPECIES_NOT_FOUND');
      }
      return save(store.data.diseases, 'diseases', DISEASE_FIELDS, (d) => d.nameVi, [
        { value: (d) => normalizeSearch(d.nameVi), key: 'DISEASE_EXISTS' },
        { value: (d) => d.aiLabel, key: 'DISEASE_EXISTS' },
      ], input);
    },
    async deleteDisease(raw) {
      requireAdmin();
      const { id } = parse(DeleteInput.safeParse(raw));
      const index = store.data.diseases.findIndex((d) => d.id === id);
      if (index < 0) throw new AppError('NOT_FOUND');
      store.data.diseases.splice(index, 1); // lượt chẩn đoán cũ giữ nguyên
      store.save();
    },
    async setAccountStatus(raw) {
      const adminId = requireAdmin();
      const input = parse(SetAccountStatusInput.safeParse(raw));
      if (input.uid === adminId) throw new AppError('CANNOT_LOCK_SELF');
      const user = store.data.users.find((u) => u.id === input.uid);
      if (!user) throw new AppError('ACCOUNT_NOT_FOUND');
      if (user.role === 'admin') throw new AppError('CANNOT_LOCK_ADMIN');
      const status = statusAfter(input.action);
      if (user.status === status) return { status, changed: false };
      user.status = status;
      store.data.lockHistory.push({
        id: crypto.randomUUID(), userId: user.id, adminId, action: input.action, reason: input.reason ?? '', createdAt: Date.now(),
      });
      store.save();
      return { status, changed: true };
    },
    async getUserAuthInfo(raw) {
      requireAdmin();
      const { uid } = parse(UserAuthInfoInput.safeParse(raw));
      const user = store.data.users.find((u) => u.id === uid);
      if (!user) throw new AppError('ACCOUNT_NOT_FOUND');
      return { lastSignInTime: null, disabled: user.status === 'locked' };
    },
  };
}
