import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, type FieldDatabase } from '../db/database.js';
import { createAssessment, addMeasurement } from '../data/repository.js';
import { getSyncableEntries, runSync } from './sync-service.js';

const COLLECTOR_ID_KEY = 'mmap-collector-id';

describe('sync service', () => {
  let database: FieldDatabase;

  beforeEach(async () => {
    database = createTestDatabase(`mmap-field-sync-test-${crypto.randomUUID()}`);
    localStorage.clear();
    localStorage.setItem(COLLECTOR_ID_KEY, '770e8400-e29b-41d4-a716-446655440000');
    await database.open();
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await database.delete();
  });

  it('uploads pending assessments and measurements then marks them synced', async () => {
    const assessment = await createAssessment(
      { name: 'Sync-Test', location: { latitude: 17.5, longitude: -88.2 } },
      database,
    );

    await addMeasurement(
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:35:00.000Z',
        value: 52,
        unit: 'bpm',
      },
      database,
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        batch_id: 'batch-1',
        results: [
          { entity_type: 'assessment', entity_id: assessment.id, status: 'synced' },
          {
            entity_type: 'measurement',
            entity_id: '660e8400-e29b-41d4-a716-446655440001',
            status: 'synced',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await runSync(database, { force: true });

    expect(result.attempted).toBe(2);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledOnce();

    const queueCount = await database.sync_queue.count();
    expect(queueCount).toBe(0);

    const storedAssessment = await database.assessments.get(assessment.id);
    expect(storedAssessment?.sync_status).toBe('synced');
  });

  it('marks only failed records as error on partial batch failure', async () => {
    const assessment = await createAssessment(
      { name: 'Partial', location: { latitude: 17.5, longitude: -88.2 } },
      database,
    );

    const measurementId = '660e8400-e29b-41d4-a716-446655440002';
    await addMeasurement(
      {
        id: measurementId,
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:35:00.000Z',
        value: 52,
        unit: 'bpm',
      },
      database,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 207,
        json: async () => ({
          batch_id: 'batch-2',
          results: [
            { entity_type: 'assessment', entity_id: assessment.id, status: 'synced' },
            {
              entity_type: 'measurement',
              entity_id: measurementId,
              status: 'error',
              error: 'Invalid unit',
            },
          ],
        }),
      }),
    );

    const result = await runSync(database, { force: true });

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);

    const failedEntry = await database.sync_queue.where('entity_id').equals(measurementId).first();
    expect(failedEntry?.status).toBe('error');
    expect(failedEntry?.last_error).toBe('Invalid unit');
    expect(failedEntry?.attempts).toBe(1);

    const storedAssessment = await database.assessments.get(assessment.id);
    expect(storedAssessment?.sync_status).toBe('pending');
  });

  it('respects backoff for error entries unless forced', async () => {
    await database.sync_queue.add({
      id: 'queue-error',
      entity_type: 'assessment',
      entity_id: 'assessment-error',
      operation: 'upsert',
      payload: {
        id: 'assessment-error',
        name: 'Error',
        assessment_started_at: '2026-03-15T14:00:00.000Z',
        location: { latitude: 1, longitude: 1 },
        assessment_type: 'manatee_v1',
        protocol_version: '1.0.0',
        collector_id: '770e8400-e29b-41d4-a716-446655440000',
        sync_status: 'pending',
        created_at: '2026-03-15T14:00:00.000Z',
        updated_at: '2026-03-15T14:00:00.000Z',
      },
      status: 'error',
      attempts: 1,
      last_error: 'Network error',
      created_at: '2026-03-15T14:00:00.000Z',
      updated_at: new Date().toISOString(),
    });

    const withoutForce = await getSyncableEntries(database);
    expect(withoutForce).toHaveLength(0);

    const withForce = await getSyncableEntries(database, { force: true });
    expect(withForce).toHaveLength(1);
  });

  it('returns early when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await createAssessment(
      { name: 'Offline', location: { latitude: 17.5, longitude: -88.2 } },
      database,
    );

    const result = await runSync(database, { force: true });
    expect(result.attempted).toBe(0);
    expect(result.error).toBe('Device is offline');
  });
});
