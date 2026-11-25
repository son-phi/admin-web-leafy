import { z } from 'zod';

/** Lý do khóa gợi ý (kịch bản 2.2.5.2 bước 9). "Khác" cho phép ghi thêm chi tiết. */
export const LOCK_REASONS = [
  'Vi phạm điều khoản sử dụng',
  'Spam hoặc lạm dụng hệ thống',
  'Theo yêu cầu của người dùng',
  'Khác',
] as const;

export type AccountStatus = 'active' | 'locked';
export type LockAction = 'LOCK' | 'UNLOCK';

const uid = z.string().min(1).max(128).regex(/^[^/]+$/);

/** Input `setAccountStatus`: khóa bắt buộc có lý do; mở khóa không cần. */
export const SetAccountStatusInput = z
  .object({ uid, action: z.enum(['LOCK', 'UNLOCK']), reason: z.string().trim().max(300).optional() })
  .strict()
  .refine((v) => v.action === 'UNLOCK' || Boolean(v.reason), { message: 'REASON_REQUIRED', path: ['reason'] });
export type SetAccountStatusRequest = z.infer<typeof SetAccountStatusInput>;

export const UserAuthInfoInput = z.object({ uid }).strict();
export type UserAuthInfo = { lastSignInTime: string | null; disabled: boolean };

export const statusAfter = (action: LockAction): AccountStatus => (action === 'LOCK' ? 'locked' : 'active');
