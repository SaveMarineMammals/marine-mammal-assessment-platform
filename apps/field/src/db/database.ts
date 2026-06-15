import Dexie, { type EntityTable } from 'dexie';
import type {
  FieldFeedbackEntry,
  StoredAssessment,
  StoredMeasurement,
  SyncQueueEntry,
} from './types.js';

export class FieldDatabase extends Dexie {
  assessments!: EntityTable<StoredAssessment, 'id'>;
  measurements!: EntityTable<StoredMeasurement, 'id'>;
  sync_queue!: EntityTable<SyncQueueEntry, 'id'>;
  feedback!: EntityTable<FieldFeedbackEntry, 'id'>;

  constructor(name = 'mmap-field') {
    super(name);

    this.version(1).stores({
      assessments: 'id, assessment_started_at, sync_status, name, assessment_type',
      measurements: 'id, assessment_id, measurement_type, recorded_at',
      sync_queue: 'id, entity_id, entity_type, status, created_at',
    });

    this.version(2).stores({
      assessments: 'id, assessment_started_at, sync_status, name, assessment_type',
      measurements: 'id, assessment_id, measurement_type, recorded_at',
      sync_queue: 'id, entity_id, entity_type, status, created_at',
      feedback: 'id, created_at, exported',
    });
  }
}

export const db = new FieldDatabase();

/** Test helper — use an isolated in-memory database name per test run. */
export function createTestDatabase(name: string): FieldDatabase {
  return new FieldDatabase(name);
}
