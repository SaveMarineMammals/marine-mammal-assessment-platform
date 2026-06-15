import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MANATEE_V1_PROTOCOL,
  MANATEE_V1_VERSION,
  type ManateeMeasurement,
} from '@mmap/schema/manatee_v1';
import { createTestDatabase, type FieldDatabase } from '../db/database.js';
import {
  addMeasurement,
  createAssessment,
  getAssessmentWithMeasurements,
  getPendingSyncCount,
  listAssessments,
  updateAssessment,
} from './repository.js';

const COLLECTOR_ID_KEY = 'mmap-collector-id';

describe('field repository', () => {
  let database: FieldDatabase;

  beforeEach(async () => {
    database = createTestDatabase(`mmap-field-test-${crypto.randomUUID()}`);
    localStorage.clear();
    localStorage.setItem(COLLECTOR_ID_KEY, '770e8400-e29b-41d4-a716-446655440000');
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('creates a draft assessment with UTC start time and pending sync status', async () => {
    const assessment = await createAssessment(
      {
        name: 'Belize-2026-014',
        location: { latitude: 17.5043, longitude: -88.1962, accuracy_meters: 8.5 },
        organization: 'CMARI',
      },
      database,
    );

    expect(assessment.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(assessment.name).toBe('Belize-2026-014');
    expect(assessment.assessment_type).toBe(MANATEE_V1_PROTOCOL);
    expect(assessment.protocol_version).toBe(MANATEE_V1_VERSION);
    expect(assessment.assessment_started_at.endsWith('Z')).toBe(true);
    expect(assessment.assessment_ended_at).toBeUndefined();
    expect(assessment.sync_status).toBe('pending');
    expect(assessment.collector_id).toBe('770e8400-e29b-41d4-a716-446655440000');
  });

  it('lists assessments newest first', async () => {
    const older = await createAssessment(
      { name: 'Older', location: { latitude: 1, longitude: 1 } },
      database,
    );
    const newer = await createAssessment(
      { name: 'Newer', location: { latitude: 2, longitude: 2 } },
      database,
    );

    await database.assessments.update(older.id, {
      assessment_started_at: '2026-03-15T14:00:00.000Z',
    });
    await database.assessments.update(newer.id, {
      assessment_started_at: '2026-03-15T16:00:00.000Z',
    });

    const assessments = await listAssessments(database);
    expect(assessments.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  it('updates an assessment and enqueues sync', async () => {
    const created = await createAssessment(
      { name: 'Draft', location: { latitude: 17.5, longitude: -88.2 } },
      database,
    );

    const updated = await updateAssessment(
      created.id,
      {
        assessment_ended_at: '2026-03-15T15:08:00.000Z',
        notes: 'Released safely',
      },
      database,
    );

    expect(updated.assessment_ended_at).toBe('2026-03-15T15:08:00.000Z');
    expect(updated.notes).toBe('Released safely');

    const pending = await getPendingSyncCount(database);
    expect(pending).toBe(1);

    const queueEntry = await database.sync_queue.toArray();
    expect(queueEntry[0]?.entity_type).toBe('assessment');
    expect(queueEntry[0]?.entity_id).toBe(created.id);
  });

  it('adds a measurement linked to an assessment', async () => {
    const assessment = await createAssessment(
      { name: 'Vitals', location: { latitude: 17.5, longitude: -88.2 } },
      database,
    );

    const measurement: ManateeMeasurement = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      assessment_id: assessment.id,
      measurement_type: 'heart_rate',
      recorded_at: '2026-03-15T14:35:00.000Z',
      value: 52,
      unit: 'bpm',
      method: 'Doppler',
    };

    await addMeasurement(measurement, database);

    const result = await getAssessmentWithMeasurements(assessment.id, database);
    expect(result?.measurements).toHaveLength(1);
    expect(result?.measurements[0]?.value).toBe(52);

    const pending = await getPendingSyncCount(database);
    expect(pending).toBe(2);
  });

  it('keeps dolphin stub assessments local-only without sync queue entries', async () => {
    const assessment = await createAssessment(
      {
        name: 'Dolphin demo',
        location: { latitude: 17.5, longitude: -88.2 },
        assessment_type: 'dolphin_v1',
        protocol_version: '0.1.0',
      },
      database,
    );

    expect(assessment.sync_status).toBe('local-only');

    await addMeasurement(
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        assessment_id: assessment.id,
        measurement_type: 'body_condition',
        recorded_at: '2026-03-15T14:35:00.000Z',
        value: 3,
        unit: 'score',
      },
      database,
    );

    expect(await getPendingSyncCount(database)).toBe(0);
  });

  it('persists data across database reopen (simulated restart)', async () => {
    const dbName = database.name;
    const created = await createAssessment(
      { name: 'Persisted', location: { latitude: 17.5043, longitude: -88.1962 } },
      database,
    );
    await database.close();

    const reopened = createTestDatabase(dbName);
    await reopened.open();

    const listed = await listAssessments(reopened);
    expect(listed.some((item) => item.id === created.id)).toBe(true);

    await reopened.delete();
  });

  it('throws when updating a missing assessment', async () => {
    await expect(updateAssessment('missing-id', { name: 'Nope' }, database)).rejects.toThrow(
      'Assessment not found',
    );
  });
});
