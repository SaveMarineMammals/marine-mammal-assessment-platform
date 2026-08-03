import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { captureTerraform, requireArg } from './terraform-lib.js';
import { normalizeHttpsUrl, parseEnvironment } from './live-verify-lib.js';

const environment = parseEnvironment(requireArg(2, 'staging or production'));
const rootDir = `infra/terraform/environments/${environment}`;

if (!existsSync(rootDir)) {
  console.error(`Unknown environment directory: ${rootDir}`);
  process.exit(1);
}

const enableCdn = captureTerraform(['output', '-raw', 'enable_cdn'], { cwd: rootDir });
const fieldUrlRaw =
  enableCdn === 'true' ? captureTerraform(['output', '-raw', 'field_url'], { cwd: rootDir }) : '';

if (!fieldUrlRaw?.trim()) {
  console.error('Field UI verify requires CDN field_url terraform output');
  process.exit(1);
}

const fieldOrigin = normalizeHttpsUrl(fieldUrlRaw);
const baseUrl = fieldOrigin.endsWith('/') ? fieldOrigin : `${fieldOrigin}/`;

console.log(`Field UI verify environment: ${environment}`);
console.log(`Field PWA base URL: ${baseUrl}`);

const testRun = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--config', 'e2e/playwright.config.ts'],
  {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      FIELD_UI_BASE_URL: baseUrl,
      CI: process.env.CI ?? 'true',
    },
  },
);

if (testRun.status !== 0) {
  process.exit(testRun.status ?? 1);
}

console.log(`Field UI verify passed for ${environment}`);
