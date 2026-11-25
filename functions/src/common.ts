// Tiện ích dùng chung cho mọi Cloud Function quản trị.
import { HttpsError, type CallableRequest, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { requireAdmin } from '../../shared/catalog.js';
import { PRODUCTION_PROJECT } from '../../shared/environment.js';
import { MSG, type MsgKey } from '../../shared/messages.js';

export const OPTIONS = { region: 'us-central1', maxInstances: 3 } as const;

/** Lỗi trả về web: details.code là khóa trong MSG để web hiển thị đúng thông báo. */
export function fail(code: FunctionsErrorCode, key: MsgKey): never {
  throw new HttpsError(code, MSG[key], { code: key });
}

/** Backend này chủ động từ chối production cho tới khi có đợt review riêng. */
export function projectAllowed(): boolean {
  const project = process.env.GCLOUD_PROJECT;
  return Boolean(project) && project !== PRODUCTION_PROJECT && (project!.startsWith('demo-') || project === process.env.ADMIN_DEV_PROJECT_ID);
}

/** Kiểm tra đăng nhập, quyền admin (claim) và project được phép. Trả về UID admin. */
export function guard(request: CallableRequest): string {
  let actor: string;
  try {
    actor = requireAdmin(request.auth);
  } catch (e) {
    fail(e instanceof Error && e.message === 'unauthenticated' ? 'unauthenticated' : 'permission-denied', 'PERMISSION_DENIED');
  }
  if (!projectAllowed()) fail('failed-precondition', 'BACKEND_NOT_ALLOWED');
  return actor;
}

type ParseResult<T> = { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };

/** Validate bằng Zod; lỗi có message là khóa MSG (vd. INVALID_THRESHOLD) thì trả đúng khóa đó. */
export function parseOrFail<T>(result: ParseResult<T>): T {
  if (result.success) return result.data;
  const threshold = result.error.issues.some((i) => i.message === 'INVALID_THRESHOLD');
  return fail('invalid-argument', threshold ? 'INVALID_THRESHOLD' : 'INVALID_INPUT');
}
