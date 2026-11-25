// Control: quản lý tài khoản (kịch bản 2.2.5.2, biểu đồ 2.3.2.2).
import { SetAccountStatusInput, type LockAction } from '../../shared/accounts';
import type { AccountLockLogRepository, LockLog } from '../entities/AccountLockLogRepository';
import type { PageRequest } from '../entities/types';
import type { UsageCounts, UserRecord, UserRepository } from '../entities/UserRepository';
import type { Callables } from '../services/callables';
import { AppError, MSG, toAppError } from '../utils/messages';
import { validate } from '../utils/validation';

export type AccountDetail = {
  user: UserRecord;
  /** `users.lastLoginAt`, trống thì lấy từ Authentication (getUserAuthInfo). */
  lastLogin: Date | null;
  usage: UsageCounts;
  history: LockLog[];
};

export function createAccountController(users: UserRepository, lockLogs: AccountLockLogRepository, callables: Callables) {
  return {
    /** Bước 3–4: searchUsers(keyword, status) – `request.search`, `request.filter`. */
    async searchUsers(request: PageRequest) {
      try { return await users.getAllUser(request); } catch (e) { throw toAppError(e, 'LOAD_FAILED'); }
    },
    async countPlantsByUser(ids: string[]): Promise<Record<string, number | null>> {
      const entries = await Promise.all(ids.map(async (id) => [id, await users.countPlantsByUser(id).catch(() => null)] as const));
      return Object.fromEntries(entries);
    },
    /** Bước 5–8: getUserDetail + countUsage + getLockHistory (gọi song song). */
    async getAccountDetail(uid: string): Promise<AccountDetail> {
      try {
        const [user, usage, history] = await Promise.all([users.getUserDetail(uid), users.countUsage(uid), lockLogs.getLockHistory(uid)]);
        if (!user) throw new AppError('ACCOUNT_NOT_FOUND');
        let lastLogin = user.lastLoginAt;
        if (!lastLogin) {
          const info = await callables.getUserAuthInfo({ uid }).catch(() => null);
          lastLogin = info?.lastSignInTime ? new Date(info.lastSignInTime) : null;
        }
        return { user, lastLogin, usage, history };
      } catch (e) {
        throw toAppError(e, 'LOAD_FAILED');
      }
    },
    /**
     * Kiểm tra sớm trên web (9a, 9b) trước khi mở hộp xác nhận; callable kiểm tra lại.
     * Trả về thông báo lỗi hoặc null nếu được phép.
     */
    precheck(user: UserRecord, currentUid: string): string | null {
      if (user.id === currentUid) return MSG.CANNOT_LOCK_SELF;
      if (user.role === 'admin') return MSG.CANNOT_LOCK_ADMIN;
      return null;
    },
    /** Bước 12–13: setAccountStatus → STATUS_UPDATED; lỗi → thông báo tương ứng hoặc UPDATE_FAILED (12a). */
    async setAccountStatus(uid: string, action: LockAction, reason?: string) {
      // Không gửi khóa `reason` khi mở khóa: serializer của callable đổi `undefined` thành `null` (bị schema từ chối).
      const raw = action === 'LOCK' ? { uid, action, reason } : { uid, action };
      const { reason: checked, ...rest } = validate(SetAccountStatusInput, raw);
      const input = checked === undefined ? rest : { ...rest, reason: checked };
      try {
        return { ...(await callables.setAccountStatus(input)), message: MSG.STATUS_UPDATED };
      } catch (e) {
        throw toAppError(e, 'UPDATE_FAILED');
      }
    },
  };
}

export type AccountController = ReturnType<typeof createAccountController>;
