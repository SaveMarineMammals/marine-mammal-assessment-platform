import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import { getAssessmentById, getMeasurementsByAssessmentId } from '../src/db/repository.js';
import { closePool, getPool } from '../src/db/pool.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/schema/fixtures',
);

interface AssessmentFixture {
  id: string;
  name: string;
  protocol_version: string;
  location: { latitude: number; longitude: number };
}

interface MeasurementFixture {
  id: string;
}

function loadFixture<T>(filename: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, filename), 'utf8')) as T;
}

describe('sync integration', () => {
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

  it('posts a batch from fixtures and reads back identical data', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }
    const app = await createApp({ enableAdminRoutes: true });
    const assessment = loadFixture<AssessmentFixture>('valid-assessment-complete.json');
    const measurements = [
      loadFixture<MeasurementFixture>('valid-measurement-heart-rate.json'),
      loadFixture<MeasurementFixture>('valid-measurement-blood-pressure.json'),
      loadFixture<MeasurementFixture>('valid-measurement-length.json'),
    ];

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: { assessments: [assessment], measurements },
    });

    expect(response.statusCode).toBe(200);

    const storedAssessment = await getAssessmentById(assessment.id);
    expect(storedAssessment).toBeDefined();
    expect(storedAssessment?.name).toBe(assessment.name);
    expect(storedAssessment?.protocol_version).toBe(assessment.protocol_version);
    expect(Number(storedAssessment?.latitude)).toBeCloseTo(assessment.location.latitude, 4);
    expect(Number(storedAssessment?.longitude)).toBeCloseTo(assessment.location.longitude, 4);

    const storedMeasurements = await getMeasurementsByAssessmentId(assessment.id);
    expect(storedMeasurements).toHaveLength(3);
    expect(storedMeasurements.map((item) => item.id).sort()).toEqual(
      measurements.map((item) => item.id).sort(),
    );

    const heartRate = storedMeasurements.find((item) => item.measurement_type === 'heart_rate');
    expect(heartRate?.value).toBe(52);

    await app.close();
  });

  it('returns 207 for partial batch failure and logs sync errors', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }
    const app = await createApp({ enableAdminRoutes: true });
    const assessment = loadFixture<AssessmentFixture>('valid-assessment-complete.json');
    const invalidMeasurement = loadFixture('invalid-measurement-wrong-unit.json');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: {
        assessments: [assessment],
        measurements: [loadFixture('valid-measurement-heart-rate.json'), invalidMeasurement],
      },
    });

    expect(response.statusCode).toBe(207);

    const adminResponse = await app.inject({
      method: 'GET',
      url: '/v1/admin/sync-errors',
      headers: { 'x-admin-token': process.env.API_ADMIN_TOKEN ?? 'dev-admin-token' },
    });

    expect(adminResponse.statusCode).toBe(200);
    const body = adminResponse.json<{ errors: Array<{ status: string }> }>();
    expect(body.errors.length).toBeGreaterThan(0);

    await app.close();
  });

  it('is idempotent when posting the same batch twice', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }
    const app = await createApp({ enableAdminRoutes: true });
    const payload = {
      assessments: [loadFixture<AssessmentFixture>('valid-assessment-complete.json')],
      measurements: [loadFixture<MeasurementFixture>('valid-measurement-heart-rate.json')],
    };

    const first = await app.inject({ method: 'POST', url: '/v1/sync/batch', payload });
    const second = await app.inject({ method: 'POST', url: '/v1/sync/batch', payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const assessmentId = payload.assessments[0].id;
    const measurements = await getMeasurementsByAssessmentId(assessmentId);
    expect(measurements).toHaveLength(1);

    await app.close();
  });

  it('rejects an all-error batch with HTTP 400', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }

    const app = await createApp({ enableAdminRoutes: true });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: {
        assessments: [{ id: 'not-a-uuid', name: '' }],
        measurements: [loadFixture('invalid-measurement-wrong-unit.json')],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ results: Array<{ status: string; entity_id: string }> }>();
    expect(body.results.every((result) => result.status === 'error')).toBe(true);
    expect(body.results.some((result) => result.entity_id === 'not-a-uuid')).toBe(true);

    await app.close();
  });

  it('applies server-wins conflict policy for assessment metadata updates', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }

    const app = await createApp({ enableAdminRoutes: true });
    const assessment = loadFixture<AssessmentFixture & { notes?: string }>(
      'valid-assessment-complete.json',
    );

    await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: { assessments: [assessment], measurements: [] },
    });

    const firstStored = await getAssessmentById(assessment.id);
    expect(firstStored?.name).toBe('Belize-2026-014');

    const updatedAssessment = {
      ...assessment,
      name: 'Belize-2026-014-updated',
      notes: 'Server-wins metadata update',
    };

    await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: { assessments: [updatedAssessment], measurements: [] },
    });

    const secondStored = await getAssessmentById(assessment.id);
    expect(secondStored?.name).toBe('Belize-2026-014-updated');
    expect(secondStored?.notes).toBe('Server-wins metadata update');
    expect(new Date(secondStored!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(firstStored!.updated_at).getTime(),
    );

    await app.close();
  });

  it('upserts measurements by UUID without creating duplicates', async ({ skip }) => {
    if (!databaseReady) {
      skip();
    }

    const app = await createApp({ enableAdminRoutes: true });
    const assessment = loadFixture<AssessmentFixture>('valid-assessment-complete.json');
    const measurement = loadFixture<MeasurementFixture & { value: number; assessment_id: string }>(
      'valid-measurement-heart-rate.json',
    );

    await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: { assessments: [assessment], measurements: [measurement] },
    });

    const updatedMeasurement = { ...measurement, value: 60 };
    await app.inject({
      method: 'POST',
      url: '/v1/sync/batch',
      payload: { assessments: [assessment], measurements: [updatedMeasurement] },
    });

    const storedMeasurements = await getMeasurementsByAssessmentId(assessment.id);
    expect(storedMeasurements).toHaveLength(1);
    expect(storedMeasurements[0]?.value).toBe(60);

    await app.close();
  });
});
