import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDatabaseUrl } from '../../api/src/cli/database-url.js';

const fieldRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

resolveDatabaseUrl();

execSync('pnpm exec vitest run --config vitest.integration.config.ts', {
  cwd: fieldRoot,
  stdio: 'inherit',
  env: process.env,
});
