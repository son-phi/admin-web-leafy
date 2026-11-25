// Quản lý tài khoản người dùng (kịch bản 2.2.5.2, biểu đồ 2.3.2.2).
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { SetAccountStatusInput, UserAuthInfoInput, statusAfter, type UserAuthInfo } from '../../shared/accounts.js';
import { stableStringify } from '../../shared/catalog.js';
import { normalizeSearch, searchPrefixes } from '../../shared/normalize.js';
import { OPTIONS, fail, guard, parseOrFail, projectAllowed } from './common.js';

/**
 * Khóa / mở khóa tài khoản:
 * 9a không tự khóa mình; 9b không khóa admin (claim `admin` hoặc `role == 'admin'`);
 * LOCK: disableAccount (`disabled: true`) + thu hồi refresh token; UNLOCK: `disabled: false`;
 * sau đó updateStatus (`users/{uid}.status`) + saveLog (`users/{uid}/lockHistory`) trong một batch.
 * Nếu ghi Firestore thất bại thì hoàn tác trạng thái Auth và báo UPDATE_FAILED (12a).
 */
export const setAccountStatus = onCall(OPTIONS, async (request) => {
  const adminId = guard(request);
  const input = parseOrFail(SetAccountStatusInput.safeParse(request.data));
  if (input.uid === adminId) fail('failed-precondition', 'CANNOT_LOCK_SELF');

  const db = getFirestore();
  const userRef = db.collection('users').doc(input.uid);
  const profile = await userRef.get();
  if (!profile.exists) fail('not-found', 'ACCOUNT_NOT_FOUND');
  if (profile.get('role') === 'admin') fail('failed-precondition', 'CANNOT_LOCK_ADMIN');

  const auth = getAuth();
  let account;
  try {
    account = await auth.getUser(input.uid);
  } catch {
    return fail('not-found', 'ACCOUNT_NOT_FOUND');
  }
  if (account.customClaims?.admin === true) fail('failed-precondition', 'CANNOT_LOCK_ADMIN');

  const status = statusAfter(input.action);
  if (profile.get('status') === status && account.disabled === (input.action === 'LOCK')) {
    return { status, changed: false }; // đã ở trạng thái yêu cầu: không ghi thêm lịch sử
  }

  const wasDisabled = account.disabled;
  try {
    await auth.updateUser(input.uid, { disabled: input.action === 'LOCK' });
    if (input.action === 'LOCK') await auth.revokeRefreshTokens(input.uid);
  } catch (error) {
    logger.error('Không cập nhật được Auth', { uid: input.uid, error: String(error) });
    return fail('internal', 'UPDATE_FAILED');
  }

  try {
    const batch = db.batch();
    batch.update(userRef, { status });
    batch.create(userRef.collection('lockHistory').doc(), {
      userId: input.uid,
      adminId,
      action: input.action,
      reason: input.reason ?? '',
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    logger.error('Không ghi được trạng thái/lịch sử, hoàn tác Auth', { uid: input.uid, error: String(error) });
    await auth.updateUser(input.uid, { disabled: wasDisabled }).catch(() => undefined);
    return fail('internal', 'UPDATE_FAILED');
  }
  return { status, changed: true };
});

/** Thông tin đăng nhập từ Authentication, dùng khi `users.lastLoginAt` trống (bước 6). */
export const getUserAuthInfo = onCall(OPTIONS, async (request): Promise<UserAuthInfo> => {
  guard(request);
  const { uid } = parseOrFail(UserAuthInfoInput.safeParse(request.data));
  try {
    const user = await getAuth().getUser(uid);
    const last = user.metadata.lastSignInTime;
    return { lastSignInTime: last ? new Date(last).toISOString() : null, disabled: user.disabled };
  } catch {
    return fail('not-found', 'ACCOUNT_NOT_FOUND');
  }
});

/**
 * Duy trì trường tìm kiếm của hồ sơ (`searchName`, `searchPrefixes` theo họ tên + email) để tìm tiền tố
 * theo họ tên hoặc email (bước 2). Hồ sơ do app Android ghi nên web không tự thêm được các trường này.
 * Chỉ ghi khi giá trị khác, nên không lặp vô hạn.
 */
export const onUserProfileWritten = onDocumentWritten({ document: 'users/{uid}', region: 'us-central1' }, async (event) => {
  if (!projectAllowed()) return;
  const after = event.data?.after;
  if (!after?.exists) return;
  const fullName = String(after.get('fullName') ?? '');
  const email = String(after.get('email') ?? '');
  const expected = { searchName: normalizeSearch(fullName || email), searchPrefixes: searchPrefixes(fullName, email) };
  const current = { searchName: after.get('searchName'), searchPrefixes: after.get('searchPrefixes') };
  if (stableStringify(current) === stableStringify(expected)) return;
  await after.ref.update(expected);
});
