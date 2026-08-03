import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureTerraform, requireArg } from './terraform-lib.js';
import { normalizeHttpsUrl, parseEnvironment } from './live-verify-lib.js';

const environment = parseEnvironment(requireArg(2, 'staging or production'));
const rootDir = `infra/terraform/environments/${environment}`;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fieldPkgDir = join(repoRoot, 'apps/field');

if (!existsSync(rootDir)) {
  console.error(`Unknown environment directory: ${rootDir}`);
  process.exit(1);
}

const enableCdn = captureTerraform(['output', '-raw', 'enable_cdn'], { cwd: rootDir });
if (enableCdn !== 'true') {
  console.log('CDN disabled — skipping field UI journey verify');
  process.exit(0);
}

const fieldUrlRaw = captureTerraform(['output', '-raw', 'field_url'], { cwd: rootDir });
const fieldOrigin = fieldUrlRaw?.trim() ? normalizeHttpsUrl(fieldUrlRaw) : '';
if (!fieldOrigin) {
  console.error('field_url Terraform output is empty; cannot run field UI journeys');
  process.exit(1);
}

const baseURL = fieldOrigin.endsWith('/') ? fieldOrigin : `${fieldOrigin}/`;
console.log(`Field UI verify environment: ${environment}`);
console.log(`FIELD_BASE_URL: ${baseURL}`);

// CI installs browsers in _verify-env.yml; locally ensure Chromium is present.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CI) {
  const install = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
    cwd: fieldPkgDir,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (install.error) {
    console.error(install.error.message);
    process.exit(1);
  }
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
  {
    cwd: fieldPkgDir,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      CI: process.env.CI ?? 'true',
      FIELD_BASE_URL: baseURL,
    },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Field UI verify failed for ${environment}`);
  process.exit(result.status ?? 1);
}

console.log(`Field UI verify passed for ${environment}`);
