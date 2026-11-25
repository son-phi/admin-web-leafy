import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { validateEnvironment } from './shared/environment';

export default defineConfig(({ mode }) => {
  if (mode !== 'test') validateEnvironment(mode, loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    plugins: [react()],
    build: { target: 'es2022' },
    // `npm test`: unit test (không cần emulator). Test trên Emulator chạy bằng `npm run test:emulator`.
    test: { exclude: [...configDefaults.exclude, 'functions/test-emulator/**', 'functions/lib/**'] },
  };
});
