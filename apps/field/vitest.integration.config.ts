import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./integration/global-setup.ts'],
    setupFiles: ['./integration/setup-env.ts', 'fake-indexeddb/auto'],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
