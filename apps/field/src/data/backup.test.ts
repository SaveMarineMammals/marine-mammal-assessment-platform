import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CANONICAL_UNITS,
  MANATEE_V1_PROTOCOL,
  MANATEE_V1_VERSION,
  type ManateeMeasurement,
} from '@mmap/schema/manatee_v1';
import { createTestDatabase, type FieldDatabase } from '../db/database.js';
import { addMeasurement, createAssessment } from './repository.js';
import {
  clearAllData,
  exportBackup,
  getBackupFilename,
  getStorageSummary,
  importBackup,
  parseBackupJson,
} from './backup.js';

const COLLECTOR_ID_KEY = 'mmap-collector-id';

describe('field backup', () => {
  let database: FieldDatabase;

  beforeEach(async () => {
    database = createTestDatabase(`mmap-field-backup-${crypto.randomUUID()}`);
    localStorage.clear();
    localStorage.setItem(COLLECTOR_ID_KEY, '770e8400-e29b-41d4-a716-446655440000');
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  async function seedSampleData() {
    const assessment = await createAssessment(
      {
        name: 'Belize-2026-014',
        location: { latitude: 17.5043, longitude: -88.1962, accuracy_meters: 8.5 },
        organization: 'CMARI',
      },
      database,
    );

    const measurements: ManateeMeasurement[] = [
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:35:00.000Z',
        value: 52,
        unit: CANONICAL_UNITS.heart_rate,
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:40:00.000Z',
        value: 48,
        unit: CANONICAL_UNITS.heart_rate,
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        assessment_id: assessment.id,
        measurement_type: 'heart_rate',
        recorded_at: '2026-03-15T14:45:00.000Z',
        value: 50,
        unit: CANONICAL_UNITS.heart_rate,
      },
    ];

    for (const measurement of measurements) {
      await addMeasurement(measurement, database);
    }

    return { assessment, measurements };
  }

  it('exports backup with assessments and measurements', async () => {
    await seedSampleData();
    const backup = await exportBackup(database);

    expect(backup.version).toBe('1.0.0');
    expect(backup.assessments).toHaveLength(1);
    expect(backup.measurements).toHaveLength(3);
    expect(backup.assessments[0]?.assessment_type).toBe(MANATEE_V1_PROTOCOL);
    expect(backup.assessments[0]?.protocol_version).toBe(MANATEE_V1_VERSION);
  });

  it('uses mmap-backup-YYYY-MM-DD.json filename format', () => {
    expect(getBackupFilename(new Date('2026-06-14T12:00:00.000Z'))).toBe(
      'mmap-backup-2026-06-14.json',
    );
  });

  it('restores identical data after export, clear, and import', async () => {
    const { assessment } = await seedSampleData();
    const backup = await exportBackup(database);

    await clearAllData(database);
    expect(await database.assessments.count()).toBe(0);
    expect(await database.measurements.count()).toBe(0);

    const result = await importBackup(backup, 'replace', database);
    expect(result.errors).toHaveLength(0);
    expect(result.importedAssessments).toBe(1);
    expect(result.importedMeasurements).toBe(3);

    const restored = await database.assessments.get(assessment.id);
    expect(restored?.name).toBe('Belize-2026-014');
    expect(await database.measurements.where('assessment_id').equals(assessment.id).count()).toBe(
      3,
    );
  });

  it('skips duplicate records when strategy is skip', async () => {
    await seedSampleData();
    const backup = await exportBackup(database);

    const result = await importBackup(backup, 'skip', database);
    expect(result.errors).toHaveLength(0);
    expect(result.skippedAssessments).toBe(1);
    expect(result.skippedMeasurements).toBe(3);
    expect(await database.assessments.count()).toBe(1);
  });

  it('rejects invalid backup payloads during import', async () => {
    const invalid = parseBackupJson({
      version: '1.0.0',
      exported_at: '2026-06-14T12:00:00.000Z',
      assessments: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: '',
          assessment_started_at: '2026-03-15T14:22:00-05:00',
          location: { latitude: 17.5, longitude: -88.2 },
          assessment_type: MANATEE_V1_PROTOCOL,
          protocol_version: MANATEE_V1_VERSION,
          collector_id: '770e8400-e29b-41d4-a716-446655440000',
          sync_status: 'local-only',
          created_at: '2026-03-15T14:22:00.000Z',
          updated_at: '2026-03-15T14:22:00.000Z',
        },
      ],
      measurements: [],
    });

    const result = await importBackup(invalid, 'replace', database);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(await database.assessments.count()).toBe(0);
  });

  it('reports storage summary counts', async () => {
    await seedSampleData();
    const summary = await getStorageSummary(database);

    expect(summary.assessmentCount).toBe(1);
    expect(summary.measurementCount).toBe(3);
    expect(summary.pendingSyncCount).toBeGreaterThan(0);
    expect(summary.approximateBytes).toBeGreaterThan(0);
  });
});
