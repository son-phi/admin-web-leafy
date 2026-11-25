import type { ZodType } from 'zod';
import type { ImageFolder } from '../../shared/catalog';
import type { StorageService } from '../services/storage';
import { validateImageFile } from '../services/storage';
import { MSG } from '../utils/messages';
import { ValidationError, validate } from '../utils/validation';

// Giá trị tạm để validate các trường khác trước khi tải ảnh (ảnh thật được gán sau khi tải lên).
const PLACEHOLDER = { imageUrl: 'https://placeholder.invalid/image.png' };

type Options<T> = {
  schema: ZodType<T>;
  folder: ImageFolder;
  storage: StorageService;
  raw: Record<string, unknown>;
  /** File ảnh mới; null = giữ ảnh hiện có (khi sửa). */
  file: File | null;
  send: (data: T) => Promise<{ id: string }>;
};

/**
 * Luồng lưu danh mục có ảnh: validate (7a/7b) → kiểm tra ảnh (7d) → uploadImage → callable.
 * Nếu callable thất bại (trùng tên, xung đột…), xóa ảnh vừa tải để không để lại file mồ côi.
 */
export async function saveWithImage<T>({ schema, folder, storage, raw, file, send }: Options<T>) {
  let fieldErrors: Record<string, string> = {};
  try {
    validate(schema, file ? { ...raw, ...PLACEHOLDER, imagePath: `${folder}/placeholder.png` } : raw);
  } catch (e) {
    if (!(e instanceof ValidationError)) throw e;
    if (e.key) throw e; // lỗi cấp biểu mẫu (ngưỡng không hợp lệ)
    fieldErrors = e.fields;
  }
  if (!file && !raw.imageUrl) fieldErrors = { ...fieldErrors, imageUrl: MSG.IMAGE_REQUIRED };
  if (file) {
    try { validateImageFile(file); } catch { fieldErrors = { ...fieldErrors, imageUrl: MSG.INVALID_IMAGE }; }
  }
  if (Object.keys(fieldErrors).length) {
    throw new ValidationError(fieldErrors, fieldErrors.imageUrl === MSG.INVALID_IMAGE ? 'INVALID_IMAGE' : undefined);
  }

  const uploaded = file ? await storage.uploadImage(folder, file) : null;
  try {
    return await send(validate(schema, uploaded ? { ...raw, ...uploaded } : raw));
  } catch (error) {
    if (uploaded) await storage.discardImage(uploaded.imagePath);
    throw error;
  }
}
