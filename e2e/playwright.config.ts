import { defineConfig } from '@playwright/test';

const baseURL = (() => {
  const raw = process.env.FIELD_UI_BASE_URL?.trim();
  if (!raw) {
    return 'http://localhost:5174/';
  }
  return raw.endsWith('/') ? raw : `${raw}/`;
})();

export default defineConfig({
  testDir: './field-ui',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: process.env.FIELD_UI_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @mmap/field dev',
        url: 'http://localhost:5174/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'phone-portrait',
      use: {
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        viewport: { width: 834, height: 1194 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        viewport: { width: 1194, height: 834 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
