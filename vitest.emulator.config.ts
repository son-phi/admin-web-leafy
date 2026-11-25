// Chạy TOÀN BỘ test (unit + rules + callable/trigger thật) trên Firebase Emulator Suite.
// Dùng qua `npm run test:emulator` (firebase emulators:exec khởi động emulator sạch rồi chạy vitest).
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'functions/src/**/*.test.ts', 'functions/test-emulator/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'functions/lib/**'],
    fileParallelism: false, // các file emulator dùng chung dữ liệu emulator
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
