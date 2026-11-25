// Tải ảnh danh mục lên Storage (uploadImage). Trình duyệt chỉ tải ảnh; ghi Firestore vẫn qua callable (D3).
import { deleteObject, getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, type ImageFolder } from '../../shared/catalog';
import { AppError, toAppError } from '../utils/messages';

export type UploadedImage = { imageUrl: string; imagePath: string };

export interface StorageService {
  uploadImage(folder: ImageFolder, file: File): Promise<UploadedImage>;
  /** Dọn ảnh vừa tải lên khi lưu thất bại; lỗi được bỏ qua. */
  discardImage(path: string): Promise<void>;
}

const EXTENSIONS: Record<(typeof IMAGE_TYPES)[number], string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Kiểm tra phía web: jpg/png/webp, ≤ 5 MB (ngoại lệ 7d). Storage Rules kiểm tra lại. */
export function validateImageFile(file: File): string {
  const ext = EXTENSIONS[file.type as keyof typeof EXTENSIONS];
  if (!ext || file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new AppError('INVALID_IMAGE');
  return ext;
}

const newName = () => crypto.randomUUID().replace(/-/g, '');

export function createFirebaseStorage(storage: FirebaseStorage): StorageService {
  return {
    async uploadImage(folder, file) {
      const ext = validateImageFile(file);
      const imagePath = `${folder}/${newName()}.${ext}`;
      try {
        const target = ref(storage, imagePath);
        await uploadBytes(target, file, { contentType: file.type });
        return { imageUrl: await getDownloadURL(target), imagePath };
      } catch (error) {
        const code = (error as { code?: string }).code;
        throw code === 'storage/unauthorized' ? new AppError('INVALID_IMAGE') : toAppError(error, 'UPDATE_FAILED');
      }
    },
    async discardImage(path) {
      try { await deleteObject(ref(storage, path)); } catch { /* bỏ qua */ }
    },
  };
}

/** Mock: không lưu file thật; dùng ảnh minh họa chung để giao diện vẫn hiển thị. */
export function createMockStorage(): StorageService {
  return {
    async uploadImage(folder, file) {
      const ext = validateImageFile(file);
      const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin;
      return { imageUrl: `${origin}/mock-leaf.svg`, imagePath: `${folder}/${newName()}.${ext}` };
    },
    async discardImage() { /* không có gì để dọn */ },
  };
}
