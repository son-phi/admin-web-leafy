export const PRODUCTION_PROJECT = 'leafyapp-cf95a';

export type EnvironmentKind = 'mock' | 'emulator' | 'dev' | 'production';
export type Environment = { kind: 'mock' } | { kind: Exclude<EnvironmentKind, 'mock'>; projectId: string };

type Env = Record<string, string | undefined>;

function requireConfig(env: Env): string {
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || !env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_AUTH_DOMAIN || !env.VITE_FIREBASE_APP_ID) {
    throw new Error('Thiếu cấu hình Firebase. Chạy npm run dev để dùng mock.');
  }
  return projectId;
}

/**
 * Kiểm tra cấu hình theo mode của Vite. Không bao giờ fallback sang production.
 * - mock: không khởi tạo Firebase.
 * - emulator: chỉ chấp nhận project `demo-*` (Firebase Emulator Suite, không chạm cloud).
 * - development: project dev riêng, phải khớp VITE_DEV_PROJECT_ID và khác production.
 * - production: phải xác nhận đúng project production.
 */
export function validateEnvironment(mode: string, env: Env): Environment {
  if (mode === 'mock') return { kind: 'mock' };
  if (mode !== 'emulator' && mode !== 'development' && mode !== 'production') throw new Error('Môi trường không hợp lệ');
  const projectId = requireConfig(env);

  if (mode === 'emulator') {
    if (!projectId.startsWith('demo-')) throw new Error('Chế độ emulator chỉ dùng project demo-*');
    return { kind: 'emulator', projectId };
  }
  if (mode === 'production') {
    if (projectId !== PRODUCTION_PROJECT || env.VITE_CONFIRM_PRODUCTION !== PRODUCTION_PROJECT) {
      throw new Error('Chưa xác nhận đúng project production');
    }
    if (env.VITE_USE_EMULATORS === 'true') throw new Error('Production không dùng emulator');
    return { kind: 'production', projectId };
  }
  if (projectId === PRODUCTION_PROJECT || projectId !== env.VITE_DEV_PROJECT_ID) {
    throw new Error('Project dev không khớp hoặc trỏ vào production');
  }
  return { kind: 'dev', projectId };
}
