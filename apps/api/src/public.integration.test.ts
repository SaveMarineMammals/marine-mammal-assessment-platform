import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import { closePool, getPool } from '../src/db/pool.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/schema/fixtures',
);

function loadFixture<T>(filename: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, filename), 'utf8')) as T;
}

describe('public dataset integration', () => {
  let databaseReady = false;

  beforeAll(async () => {
    if (!hasDatabase) {
      return;
    }

    try {
      await getPool().query('SELECT 1');
      await runMigrations();
      databaseReady = true;
    } catch {
      databaseReady = false;
    }
  });

  beforeEach(async () => {
    if (!databaseReady) {
      return;
    }

    const pool = getPool();
    await pool.query('DELETE FROM sync_audit');
    await pool.query('DELETE FROM measurements');
    await pool.query('DELETE FROM assessments');
  });

  afterAll(async () => {
    if (databaseReady) {
      await closePool();
    }
  });

  it('lists synced assessments and exports CSV after seeding via sync batch', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }

    const app = await createApp({ enableAdminRoutes: false });
    const assessment = loadFixture('valid-assessment-complete.json');
    const measurements = [
      loadFixture('valid-measurement-heart-rate.json'),
      loadFixture('valid-measurement-blood-pressure.json'),
    ];

    await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: { assessments: [assessment], measurements },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/public/assessments?limit=10',
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json<{ total: number; items: Array<{ name: string }> }>();
    expect(listBody.total).toBe(1);
    expect(listBody.items[0]?.name).toBe(assessment.name);

    const exportResponse = await app.inject({
      method: 'GET',
      url: '/v1/public/assessments/export?format=csv',
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(String(exportResponse.body)).toContain('assessment_id');
    expect(String(exportResponse.body)).toContain('heart_rate');

    await app.close();
  });
});
