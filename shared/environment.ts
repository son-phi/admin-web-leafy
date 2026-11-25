export const PRODUCTION_PROJECT = 'leafyapp-cf95a';
export function validateEnvironment(mode: string, env: Record<string,string|undefined>) {
  if(mode === 'mock') return {kind:'mock' as const};
  if(mode !== 'development' && mode !== 'production') throw new Error('Môi trường không hợp lệ');
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || !env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_AUTH_DOMAIN || !env.VITE_FIREBASE_APP_ID) throw new Error('Thiếu cấu hình Firebase. Chạy npm run dev để dùng mock.');
  if(mode === 'production') {
    if(projectId !== PRODUCTION_PROJECT || env.VITE_CONFIRM_PRODUCTION !== PRODUCTION_PROJECT) throw new Error('Chưa xác nhận đúng project production');
    if(env.VITE_USE_EMULATORS === 'true') throw new Error('Production không dùng emulator');
  } else if(projectId === PRODUCTION_PROJECT || projectId !== env.VITE_DEV_PROJECT_ID) throw new Error('Project dev không khớp hoặc trỏ vào production');
  return {kind: mode === 'production' ? 'production' as const : 'dev' as const, projectId};
}
