import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDatabaseUrl } from '../apps/api/src/cli/database-url.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

resolveDatabaseUrl();

function runIntegrationTests(app: 'api' | 'field'): void {
  const cwd = join(rootDir, 'apps', app);
  execSync('pnpm exec vitest run --config vitest.integration.config.ts', {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
}

runIntegrationTests('api');
runIntegrationTests('field');
