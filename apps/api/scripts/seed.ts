import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDatabaseUrl } from '../src/cli/database-url.js';
import { runMigrations } from '../src/db/migrate.js';
import { closePool } from '../src/db/pool.js';
import { processSyncBatch } from '../src/services/sync-batch.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/schema/fixtures',
);

function loadFixture<T = unknown>(filename: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, filename), 'utf8')) as T;
}

resolveDatabaseUrl();

await runMigrations();

const result = await processSyncBatch({
  assessments: [loadFixture('valid-assessment-complete.json')],
  measurements: [
    loadFixture('valid-measurement-heart-rate.json'),
    loadFixture('valid-measurement-blood-pressure.json'),
    loadFixture('valid-measurement-length.json'),
  ],
});

console.log(`Seed complete. Batch ${result.batch_id}`);
console.log(JSON.stringify(result.results, null, 2));

await closePool();
