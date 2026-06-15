import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { createTestDatabase, type FieldDatabase } from '../db/database.js';
import { addMeasurement, createAssessment, getPendingSyncCount } from '../data/repository.js';
import { runSync } from './sync-service.js';

const COLLECTOR_ID_KEY = 'mmap-collector-id';
const integrationReady = process.env.SYNC_INTEGRATION_READY === 'true';

describe('sync path integration', () => {
  let database: FieldDatabase;
  let pgClient: pg.Client | undefined;

  beforeAll(async () => {
    if (!integrationReady || !process.env.DATABASE_URL) {
      return;
    }

    pgClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
  });

  beforeEach(async () => {
    if (!integrationReady) {
      return;
    }

    database = createTestDatabase(`mmap-field-sync-path-${crypto.randomUUID()}`);
    localStorage.clear();
    localStorage.setItem(COLLECTOR_ID_KEY, '770e8400-e29b-41d4-a716-446655440000');
    await database.open();
    vi.stubGlobal('navigator', { onLine: true });

    await pgClient?.query('DELETE FROM sync_audit');
    await pgClient?.query('DELETE FROM measurements');
    await pgClient?.query('DELETE FROM assessments');
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (database) {
      await database.delete();
    }
  });

  afterAll(async () => {
    await pgClient?.end();
  });

  it('syncs offline capture through the API into PostgreSQL', async ({ skip }) => {
    if (!integrationReady) {
      skip();
    }

    const assessment = await createAssessment(
      {
        name: 'Sync-Path-E2E',
        location: { latitude: 17.5043, longitude: -88.1962, accuracy_meters: 8.5 },
        organization: 'CMARI',
      },
      database,
    );

    await addMeasurement(
      {
        id: '660e8400-e29b-41d4-a716-446655440010',
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:35:00.000Z',
        value: 52,
        unit: 'bpm',
      },
      database,
    );

    expect(await getPendingSyncCount(database)).toBe(2);

    const result = await runSync(database, { force: true });
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(await database.sync_queue.count()).toBe(0);

    const storedAssessment = await database.assessments.get(assessment.id);
    expect(storedAssessment?.sync_status).toBe('synced');

    const dbAssessment = await pgClient!.query<{ name: string }>(
      'SELECT name FROM assessments WHERE id = $1',
      [assessment.id],
    );
    expect(dbAssessment.rows[0]?.name).toBe('Sync-Path-E2E');

    const dbMeasurements = await pgClient!.query<{ id: string }>(
      'SELECT id FROM measurements WHERE assessment_id = $1',
      [assessment.id],
    );
    expect(dbMeasurements.rows).toHaveLength(1);
  });
});
