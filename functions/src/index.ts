import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import {
  DISEASE_FIELDS, DeleteInput, SPECIES_FIELDS, SaveDiseaseInput, SaveSpeciesInput, fingerprint, isImagePath,
  type ImageFolder,
} from '../../shared/catalog.js';
import type { MsgKey } from '../../shared/messages.js';
import { normalizeSearch, searchPrefixes } from '../../shared/normalize.js';
import { OPTIONS, fail, guard, parseOrFail, projectAllowed } from './common.js';
import { syncSpeciesThreshold } from './thresholdSync.js';

initializeApp();

export { fail };
export { getUserAuthInfo, onUserProfileWritten, setAccountStatus } from './accounts.js';

/** Xóa ảnh danh mục trên Storage (deleteImage). Chỉ xóa trong đúng thư mục; lỗi không làm hỏng thao tác chính. */
async function deleteImage(folder: ImageFolder, path: string) {
  if (!path || !isImagePath(folder, path)) return;
  try {
    await getStorage().bucket().file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    logger.warn('Không xóa được ảnh cũ', { path, error: String(error) });
  }
}

type UniqueRule = { field: string; value: string; key: MsgKey };
type CatalogConfig = {
  collection: ImageFolder;
  fields: readonly string[];
  searchFields: (data: Record<string, unknown>) => Record<string, unknown>;
  unique: (data: Record<string, unknown>) => UniqueRule[];
  /** Kiểm tra tham chiếu trong transaction (vd. loài cây được chọn phải tồn tại). */
  references?: (data: Record<string, unknown>) => { collection: string; ids: string[]; key: MsgKey };
};

/**
 * Thêm/sửa danh mục trong một transaction: đọc bản hiện tại + kiểm tra trùng → kiểm tra fingerprint → ghi.
 * Ảnh cũ (khi đổi ảnh) chỉ bị xóa sau khi commit thành công.
 */
async function saveCatalog(actor: string, config: CatalogConfig, id: string | undefined, data: Record<string, unknown>, expected: string | undefined) {
  const imagePath = String(data.imagePath ?? '');
  if (imagePath && !isImagePath(config.collection, imagePath)) fail('invalid-argument', 'INVALID_IMAGE');

  const db = getFirestore();
  const collection = db.collection(config.collection);
  const ref = id ? collection.doc(id) : collection.doc();
  let oldImagePath = '';
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (id) {
      if (!snap.exists) fail('not-found', 'NOT_FOUND');
      if (expected !== fingerprint(config.fields, snap.data() ?? {})) fail('aborted', 'CONFLICT');
      oldImagePath = String(snap.get('imagePath') ?? '');
    }
    for (const rule of config.unique(data)) {
      const duplicates = await tx.get(collection.where(rule.field, '==', rule.value).limit(2));
      if (duplicates.docs.some((d) => d.id !== ref.id)) fail('already-exists', rule.key);
    }
    const refs = config.references?.(data);
    if (refs?.ids.length) {
      const docs = await tx.getAll(...refs.ids.map((rid) => db.collection(refs.collection).doc(rid)));
      if (docs.some((d) => !d.exists)) fail('failed-precondition', refs.key);
    }
    const now = FieldValue.serverTimestamp();
    const doc = { ...data, ...config.searchFields(data), updatedAt: now, updatedBy: actor };
    if (id) tx.update(ref, doc);
    else tx.create(ref, { ...doc, createdAt: now });
  });
  if (oldImagePath && oldImagePath !== imagePath) await deleteImage(config.collection, oldImagePath);
  return { id: ref.id };
}

const SPECIES_CONFIG: CatalogConfig = {
  collection: 'species',
  fields: SPECIES_FIELDS,
  searchFields: (d) => ({
    searchName: normalizeSearch(String(d.commonName)),
    // Tìm tiền tố theo tên thông thường HOẶC tên khoa học (kịch bản 2.2.5.3 bước 3).
    searchPrefixes: searchPrefixes(String(d.commonName), String(d.scientificName)),
  }),
  unique: (d) => [
    { field: 'searchName', value: normalizeSearch(String(d.commonName)), key: 'SPECIES_EXISTS' }, // 7c
    { field: 'aiLabel', value: String(d.aiLabel), key: 'LABEL_USED' }, // 7e – checkAiLabel
  ],
};

const DISEASE_CONFIG: CatalogConfig = {
  collection: 'diseases',
  fields: DISEASE_FIELDS,
  searchFields: (d) => ({ searchName: normalizeSearch(String(d.nameVi)) }),
  // checkDuplicate: trùng tên bệnh (sau chuẩn hóa) hoặc trùng mã nhãn → DISEASE_EXISTS (7b).
  unique: (d) => [
    { field: 'searchName', value: normalizeSearch(String(d.nameVi)), key: 'DISEASE_EXISTS' },
    { field: 'aiLabel', value: String(d.aiLabel), key: 'DISEASE_EXISTS' },
  ],
  references: (d) => ({ collection: 'species', ids: [...new Set(d.affectedSpeciesIds as string[])], key: 'SPECIES_NOT_FOUND' }),
};

export const saveSpecies = onCall(OPTIONS, async (request) => {
  const actor = guard(request);
  const input = parseOrFail(SaveSpeciesInput.safeParse(request.data));
  return saveCatalog(actor, SPECIES_CONFIG, input.id, input.data, input.fingerprint);
});

/** Xóa loài cây: từ chối nếu còn cây người dùng tham chiếu (18a); kiểm tra và xóa trong cùng transaction. */
export const deleteSpecies = onCall(OPTIONS, async (request) => {
  guard(request);
  const { id } = parseOrFail(DeleteInput.safeParse(request.data));
  const db = getFirestore();
  const ref = db.collection('species').doc(id);
  let imagePath = '';
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail('not-found', 'NOT_FOUND');
    const inUse = await tx.get(db.collectionGroup('plants').where('speciesId', '==', id).limit(1)); // countPlantsBySpecies > 0
    if (!inUse.empty) fail('failed-precondition', 'SPECIES_IN_USE');
    imagePath = String(snap.get('imagePath') ?? '');
    tx.delete(ref);
  });
  await deleteImage('species', imagePath);
  return { ok: true };
});

export const saveDisease = onCall(OPTIONS, async (request) => {
  const actor = guard(request);
  const input = parseOrFail(SaveDiseaseInput.safeParse(request.data));
  return saveCatalog(actor, DISEASE_CONFIG, input.id, input.data, input.fingerprint);
});

/** Xóa bệnh cây và ảnh. KHÔNG sửa các lượt chẩn đoán cũ (`diagnoses`) – kịch bản 2.2.5.4 bước 14. */
export const deleteDisease = onCall(OPTIONS, async (request) => {
  guard(request);
  const { id } = parseOrFail(DeleteInput.safeParse(request.data));
  const db = getFirestore();
  const ref = db.collection('diseases').doc(id);
  let imagePath = '';
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail('not-found', 'NOT_FOUND');
    imagePath = String(snap.get('imagePath') ?? '');
    tx.delete(ref);
  });
  await deleteImage('diseases', imagePath);
  return { ok: true };
});

/**
 * Trigger đồng bộ ngưỡng (D5): chạy khi tài liệu loài cây được sửa; chỉ làm việc khi `threshold` thay đổi.
 * Ghi RTDB cho node của các cây `useSpeciesThresholds == true`; cây dùng ngưỡng riêng không bị đổi.
 */
export const onSpeciesThresholdUpdated = onDocumentUpdated({ document: 'species/{speciesId}', region: 'us-central1' }, async (event) => {
  if (!projectAllowed()) {
    logger.warn('Bỏ qua đồng bộ ngưỡng: project backend chưa được cho phép');
    return;
  }
  const change = event.data;
  if (!change) return;
  await syncSpeciesThreshold(event.params.speciesId, change.before.get('threshold'), change.after.get('threshold'));
});
