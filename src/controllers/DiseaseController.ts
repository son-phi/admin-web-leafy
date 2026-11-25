// Control: quản lý bệnh cây (kịch bản 2.2.5.4, biểu đồ 2.3.2.4).
import { DiseaseSchema, type Disease } from '../../shared/catalog';
import type { DiseaseRepository } from '../entities/DiseaseRepository';
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

export function createDiseaseController(diseases: DiseaseRepository, species: SpeciesRepository, callables: Callables, storage: StorageService) {
  /** validate → uploadImage → saveDisease (bước 6–8 / 11–14). Ảnh mới bị dọn nếu lưu thất bại. */
  function save(raw: Record<string, unknown>, file: File | null, send: (data: Disease) => Promise<{ id: string }>) {
    return saveWithImage({ schema: DiseaseSchema, folder: 'diseases', storage, raw, file, send }).catch(rethrowWrite);
  }

  return {
    /** Bước 3: tìm theo tên bệnh, lọc theo loài cây bị ảnh hưởng (`request.filter`). */
    async getAllDiseases(request: PageRequest) {
      try { return await diseases.getAllDiseases(request); } catch (e) { throw toAppError(e, 'LOAD_FAILED'); }
    },
    async getDiseaseById(id: string) {
      try { return await diseases.getDiseaseById(id); } catch (e) { throw toAppError(e, 'LOAD_FAILED'); }
    },
    /** getSpeciesList: nạp loài cây cho bộ lọc và ô "Loài cây thường mắc". */
    async getSpeciesList() {
      try { return await species.getSpeciesList(); } catch (e) { throw toAppError(e, 'LOAD_FAILED'); }
    },
    /** Số lượt chẩn đoán cho các bệnh trên trang hiện tại; lỗi riêng lẻ hiển thị "—". */
    async countDiagnosesByDisease(ids: string[]): Promise<Record<string, number | null>> {
      const entries = await Promise.all(ids.map(async (id) => [id, await diseases.countDiagnosesByDisease(id).catch(() => null)] as const));
      return Object.fromEntries(entries);
    },
    addDisease(raw: Record<string, unknown>, file: File | null) {
      return save(raw, file, (data) => callables.saveDisease({ data }));
    },
    updateDisease(id: string, raw: Record<string, unknown>, fingerprint: string, file: File | null) {
      return save(raw, file, (data) => callables.saveDisease({ id, data, fingerprint }));
    },
    /** Bước 15–18: giao diện đã xác nhận (và cảnh báo 18a nếu có mã nhãn) → deleteDisease. */
    async deleteDisease(id: string) {
      try { await callables.deleteDisease({ id }); } catch (e) { throw toAppError(e, 'UPDATE_FAILED'); }
      return MSG.DISEASE_DELETED;
    },
  };
}

export type DiseaseController = ReturnType<typeof createDiseaseController>;
