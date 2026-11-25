import { MSG, isMsgKey, type MsgKey } from '../../shared/messages';

export { MSG, type MsgKey };

/** Lỗi nghiệp vụ mang khóa thông báo trong MSG. */
export class AppError extends Error {
  constructor(public readonly key: MsgKey) {
    super(MSG[key]);
    this.name = 'AppError';
  }
}

/** Chuyển lỗi bất kỳ (callable, Firestore, mạng…) thành AppError; không lộ thông điệp kỹ thuật ra giao diện. */
export function toAppError(error: unknown, fallback: MsgKey): AppError {
  if (error instanceof AppError) return error;
  const details = (error as { details?: { code?: unknown } } | null)?.details;
  if (isMsgKey(details?.code)) return new AppError(details.code);
  return new AppError(fallback);
}

/** Thông báo để hiển thị cho lỗi bất kỳ. */
export function messageOf(error: unknown, fallback: MsgKey = 'LOAD_FAILED'): string {
  if (error instanceof Error && 'fields' in error) return error.message; // ValidationError
  return toAppError(error, fallback).message;
}
