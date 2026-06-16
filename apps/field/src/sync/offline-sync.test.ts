import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createTestDatabase, type FieldDatabase } from '../db/database.js';
import { addMeasurement, createAssessment, getPendingSyncCount } from '../data/repository.js';
import { resetApiConnectivityForTests } from './api-connectivity.js';
import { runSync } from './sync-service.js';
import { getSyncApiUrl } from '../config.js';

const COLLECTOR_ID_KEY = 'mmap-collector-id';

const server = setupServer();

describe('offline sync flow', () => {
  let database: FieldDatabase;

  beforeEach(async () => {
    server.listen({ onUnhandledRequest: 'error' });
    database = createTestDatabase(`mmap-field-offline-${crypto.randomUUID()}`);
    localStorage.clear();
    localStorage.setItem(COLLECTOR_ID_KEY, '770e8400-e29b-41d4-a716-446655440000');
    await database.open();
    vi.stubGlobal('navigator', { onLine: false });
    resetApiConnectivityForTests();
  });

  afterEach(async () => {
    server.resetHandlers();
    server.close();
    vi.unstubAllGlobals();
    resetApiConnectivityForTests();
    await database.delete();
  });

  it('queues capture while offline and syncs when connectivity returns', async () => {
    const assessment = await createAssessment(
      {
        name: 'Offline-Capture',
        location: { latitude: 17.5043, longitude: -88.1962 },
      },
      database,
    );

    await addMeasurement(
      {
        id: '660e8400-e29b-41d4-a716-446655440099',
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:35:00.000Z',
        value: 48,
        unit: 'bpm',
      },
      database,
    );

    expect(await getPendingSyncCount(database)).toBe(2);

    const offlineResult = await runSync(database, { force: true });
    expect(offlineResult.attempted).toBe(0);
    expect(offlineResult.error).toBe('Device is offline');
    expect(await database.sync_queue.count()).toBe(2);

    server.use(
      http.post(getSyncApiUrl('/v1/sync/batch'), async ({ request }) => {
        const body = (await request.json()) as {
          assessments: Array<{ id: string }>;
          measurements: Array<{ id: string }>;
        };

        return HttpResponse.json({
          batch_id: 'offline-test-batch',
          results: [
            ...body.assessments.map((item) => ({
              entity_type: 'assessment' as const,
              entity_id: item.id,
              status: 'synced' as const,
            })),
            ...body.measurements.map((item) => ({
              entity_type: 'measurement' as const,
              entity_id: item.id,
              status: 'synced' as const,
            })),
          ],
        });
      }),
    );

    vi.stubGlobal('navigator', { onLine: true });

    const onlineResult = await runSync(database, { force: true });
    expect(onlineResult.attempted).toBe(2);
    expect(onlineResult.synced).toBe(2);
    expect(onlineResult.failed).toBe(0);
    expect(await database.sync_queue.count()).toBe(0);

    const storedAssessment = await database.assessments.get(assessment.id);
    expect(storedAssessment?.sync_status).toBe('synced');
  });
});
