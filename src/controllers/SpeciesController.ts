// Control: quản lý loài cây (kịch bản 2.2.5.3, biểu đồ 2.3.2.3).
import { SpeciesSchema, type Species } from '../../shared/catalog';
import type { SpeciesRepository } from '../entities/SpeciesRepository';
import type { PageRequest } from '../entities/types';
import type { Callables } from '../services/callables';
import type { StorageService } from '../services/storage';
import { MSG, toAppError } from '../utils/messages';
import { ValidationError } from '../utils/validation';
import { saveWithImage } from './catalogImage';

const rethrowWrite = (error: unknown): never => {
  if (error instanceof ValidationError) throw error;
  throw toAppError(error, 'UPDATE_FAILED');
};

export function createSpeciesController(species: SpeciesRepository, callables: Callables, storage: StorageService) {
  /** validate → uploadImage → saveSpecies (bước 6–8 / 11–14). Ảnh mới bị dọn nếu lưu thất bại. */
  function save(raw: Record<string, unknown>, file: File | null, send: (data: Species) => Promise<{ id: string }>) {
    return saveWithImage({ schema: SpeciesSchema, folder: 'species', storage, raw, file, send }).catch(rethrowWrite);
  }

  return {
    async getAllSpecies(request: PageRequest) {
      try { return await species.getAllSpecies(request); } catch (e) { throw toAppError(e, 'LOAD_FAILED'); }
    },
    async getSpeciesById(id: string) {
      try { return await species.getSpeciesById(id); } catch (e) { throw toAppError(e, 'LOAD_FAILED'); }
    },
    /** Số cây đang trồng theo từng loài trên trang hiện tại (đếm song song, lỗi riêng lẻ hiển thị "—"). */
    async countPlantsBySpecies(ids: string[]): Promise<Record<string, number | null>> {
      const entries = await Promise.all(ids.map(async (id) => [id, await species.countPlantsBySpecies(id).catch(() => null)] as const));
      return Object.fromEntries(entries);
    },
    addSpecies(raw: Record<string, unknown>, file: File | null) {
      return save(raw, file, (data) => callables.saveSpecies({ data }));
    },
    updateSpecies(id: string, raw: Record<string, unknown>, fingerprint: string, file: File | null) {
      return save(raw, file, (data) => callables.saveSpecies({ id, data, fingerprint }));
    },
    /** Bước 15–18: xác nhận ở giao diện → deleteSpecies; còn cây tham chiếu → SPECIES_IN_USE (18a). */
    async deleteSpecies(id: string) {
      try { await callables.deleteSpecies({ id }); } catch (e) { throw toAppError(e, 'UPDATE_FAILED'); }
      return MSG.SPECIES_DELETED;
    },
  };
}

export type SpeciesController = ReturnType<typeof createSpeciesController>;
