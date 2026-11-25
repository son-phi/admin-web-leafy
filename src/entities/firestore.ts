// Tiện ích truy vấn Firestore dùng chung cho các repository bản Firebase.
import {
  collection, documentId, getDocs, limit, orderBy, query, startAfter, Timestamp, where,
  type DocumentData, type Firestore, type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { normalizeSearch } from '../../shared/normalize';
import { PAGE_SIZE, type PageRequest } from './types';

const PREFIX_END = String.fromCharCode(0xf8ff);

type PageOptions = {
  filters?: QueryConstraint[];
  /** Tìm bằng `array-contains` trên mảng tiền tố (nhiều trường) thay vì khoảng giá trị trên `searchName`. */
  prefixArrayField?: string;
  /**
   * Khi KHÔNG tìm kiếm, sắp theo document ID thay vì `searchName` để không bỏ sót tài liệu thiếu `searchName`
   * (vd. hồ sơ người dùng do app Android tạo trước khi trigger bổ sung trường tìm kiếm).
   */
  idOrderWhenBrowsing?: boolean;
};

/** Tìm theo tiền tố đã chuẩn hóa (D8), sắp theo `searchName`, phân trang cursor PAGE_SIZE bản ghi + 1 lookahead. */
export async function fetchPage(db: Firestore, path: string, request: PageRequest, options: PageOptions = {}) {
  const prefix = normalizeSearch(request.search);
  const constraints: QueryConstraint[] = [...(options.filters ?? [])];
  if (prefix && options.prefixArrayField) constraints.push(where(options.prefixArrayField, 'array-contains', prefix));
  else if (prefix) constraints.push(where('searchName', '>=', prefix), where('searchName', '<=', prefix + PREFIX_END));
  if (prefix || !options.idOrderWhenBrowsing) constraints.push(orderBy('searchName'));
  constraints.push(orderBy(documentId()));
  if (request.cursor) constraints.push(startAfter(request.cursor as QueryDocumentSnapshot));
  constraints.push(limit(PAGE_SIZE + 1));
  const snapshot = await getDocs(query(collection(db, path), ...constraints));
  const docs: QueryDocumentSnapshot<DocumentData>[] = snapshot.docs.slice(0, PAGE_SIZE);
  return { docs, cursor: docs.at(-1), more: snapshot.docs.length > PAGE_SIZE };
}

export function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}
