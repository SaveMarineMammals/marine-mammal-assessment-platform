import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/sync.integration.test.ts', 'src/public.integration.test.ts'],
    setupFiles: ['vitest.integration.setup.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
