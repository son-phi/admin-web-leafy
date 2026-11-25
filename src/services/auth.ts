// Đăng nhập trang quản trị (F0). Chỉ tài khoản có custom claim `admin === true` được giữ phiên;
// tài khoản khác bị đăng xuất ngay với thông báo NOT_ADMIN. Đây chỉ là chặn ở giao diện:
// quyền thật vẫn do Security Rules và Cloud Functions kiểm tra.
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { AppError, MSG, type MsgKey } from '../utils/messages';

export type Session = { uid: string; email: string; displayName: string; admin: true };

export interface AuthService {
  /** Ném AppError (LOGIN_FAILED, ACCOUNT_DISABLED, NOT_ADMIN…) nếu không vào được trang quản trị. */
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** Chỉ phát ra phiên admin; khi bị đăng xuất vì thiếu quyền thì kèm thông báo lỗi. */
  watch(callback: (session: Session | null, error?: string) => void): () => void;
}

/** Ánh xạ mã lỗi Firebase Auth sang thông báo tiếng Việt, không lộ chi tiết kỹ thuật. */
export function authErrorKey(error: unknown): MsgKey {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case 'auth/user-disabled': return 'ACCOUNT_DISABLED';
    case 'auth/too-many-requests': return 'TOO_MANY_ATTEMPTS';
    case 'auth/network-request-failed': return 'NETWORK_ERROR';
    default: return 'LOGIN_FAILED'; // invalid-credential, wrong-password, user-not-found, invalid-email…
  }
}

export function createFirebaseAuth(auth: Auth): AuthService {
  let pendingError = ''; // giữ thông báo sau khi buộc đăng xuất, tới lần đăng nhập kế tiếp

  async function rejectNonAdmin(): Promise<never> {
    pendingError = MSG.NOT_ADMIN;
    await signOut(auth);
    throw new AppError('NOT_ADMIN');
  }

  return {
    async login(email, password) {
      pendingError = '';
      let user;
      try {
        user = (await signInWithEmailAndPassword(auth, email, password)).user;
      } catch (error) {
        throw new AppError(authErrorKey(error));
      }
      const token = await user.getIdTokenResult(true); // làm mới để nhận claim vừa được cấp
      if (token.claims.admin !== true) await rejectNonAdmin();
    },
    async logout() {
      pendingError = '';
      await signOut(auth);
    },
    watch(callback) {
      let generation = 0;
      const unsubscribe = onIdTokenChanged(auth, async (user) => {
        const current = ++generation;
        if (!user) { callback(null, pendingError || undefined); return; }
        try {
          const token = await user.getIdTokenResult();
          if (current !== generation) return;
          if (token.claims.admin !== true) { await rejectNonAdmin().catch(() => undefined); return; }
          callback({ uid: user.uid, email: user.email ?? user.uid, displayName: user.displayName || user.email || user.uid, admin: true });
        } catch {
          if (current === generation) callback(null, 'Không kiểm tra được quyền. Vui lòng đăng nhập lại.');
        }
      }, () => callback(null, 'Lỗi phiên đăng nhập'));
      return () => { generation++; unsubscribe(); };
    },
  };
}

const MOCK_SESSION_KEY = 'leafy-mock-session';
const MOCK_VIEWER = 'viewer@example.test';

/** Mock: email bất kỳ, không cần mật khẩu; viewer@example.test là tài khoản không đủ quyền. */
export function createMockAuth(): AuthService & { current(): Session | null } {
  let session: Session | null = null;
  try {
    const stored = sessionStorage.getItem(MOCK_SESSION_KEY);
    if (stored) session = JSON.parse(stored) as Session;
  } catch { /* không có sessionStorage (test/private mode) */ }
  const listeners = new Set<(s: Session | null) => void>();
  const emit = () => {
    try {
      if (session) sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(MOCK_SESSION_KEY);
    } catch { /* bỏ qua */ }
    listeners.forEach((f) => f(session));
  };
  return {
    current: () => session,
    async login(email) {
      if (email.trim().toLowerCase() === MOCK_VIEWER) {
        session = null;
        emit();
        throw new AppError('NOT_ADMIN');
      }
      session = { uid: 'mock-admin', email: email || 'admin@example.test', displayName: 'Quản trị viên Mock', admin: true };
      emit();
    },
    async logout() { session = null; emit(); },
    watch(callback) {
      listeners.add(callback);
      callback(session);
      return () => { listeners.delete(callback); };
    },
  };
}
