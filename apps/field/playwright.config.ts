import { defineConfig, devices } from '@playwright/test';

/** Built field assets are served under /field/app/; trailing slash keeps relative navigations in-app. */
const baseURL = `${(process.env.FIELD_BASE_URL || 'http://127.0.0.1:5174/field/app').replace(/\/$/, '')}/`;

/**
 * Field PWA UI journeys for phone + tablet personas.
 * Set FIELD_BASE_URL to a deployed origin (e.g. staging /field/app) or leave unset for local preview.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: {
        // Samsung Galaxy S24 Ultra-class CSS viewport (portrait browser).
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 3.5,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.FIELD_BASE_URL
    ? undefined
    : {
        // vite preview does not mount dist under /field/app/; serve the built assets that way.
        command: 'node scripts/serve-field-dist.mjs',
        url: 'http://127.0.0.1:5174/field/app/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
