import { validateAssessmentByProtocol, validateMeasurementByProtocol } from '@mmap/schema/protocol';
import type { FieldDatabase } from '../db/database.js';
import { db as defaultDb } from '../db/database.js';
import type { StoredAssessment, StoredMeasurement } from '../db/types.js';
import { enqueueUpsert } from './repository.js';
import {
  createBackupPayload,
  estimateBackupBytes,
  type DuplicateStrategy,
  type ImportResult,
  type MmapFieldBackup,
  type StorageSummary,
} from './backup-types.js';

export {
  BACKUP_VERSION,
  createBackupPayload,
  downloadBackupFile,
  estimateBackupBytes,
  getBackupFilename,
  isMmapFieldBackup,
  parseBackupJson,
  type DuplicateStrategy,
  type ImportResult,
  type MmapFieldBackup,
  type StorageSummary,
} from './backup-types.js';

function validateBackupRecords(backup: MmapFieldBackup): string[] {
  const errors: string[] = [];
  const assessmentIds = new Set<string>();

  for (const assessment of backup.assessments) {
    const result = validateAssessmentByProtocol(assessment.assessment_type, assessment, {
      mode: assessment.assessment_ended_at ? 'complete' : 'draft',
    });
    if (!result.success) {
      errors.push(
        ...result.errors.map(
          (issue) => `Assessment ${assessment.id}: ${issue.path} ${issue.message}`,
        ),
      );
    }
    if (assessmentIds.has(assessment.id)) {
      errors.push(`Duplicate assessment id in backup: ${assessment.id}`);
    }
    assessmentIds.add(assessment.id);
  }

  const assessmentById = new Map(
    backup.assessments.map((assessment) => [assessment.id, assessment]),
  );
  const measurementIds = new Set<string>();
  for (const measurement of backup.measurements) {
    const parent = assessmentById.get(measurement.assessment_id);
    const assessmentType = parent?.assessment_type ?? 'manatee_v1';
    const result = validateMeasurementByProtocol(assessmentType, measurement);
    if (!result.success) {
      errors.push(
        ...result.errors.map(
          (issue) => `Measurement ${measurement.id}: ${issue.path} ${issue.message}`,
        ),
      );
    }
    if (!assessmentIds.has(measurement.assessment_id)) {
      errors.push(
        `Measurement ${measurement.id} references missing assessment ${measurement.assessment_id}`,
      );
    }
    if (measurementIds.has(measurement.id)) {
      errors.push(`Duplicate measurement id in backup: ${measurement.id}`);
    }
    measurementIds.add(measurement.id);
  }

  return errors;
}

export async function exportBackup(database: FieldDatabase = defaultDb): Promise<MmapFieldBackup> {
  const [assessments, measurements] = await Promise.all([
    database.assessments.toArray(),
    database.measurements.toArray(),
  ]);

  return createBackupPayload(assessments, measurements);
}

export async function getStorageSummary(
  database: FieldDatabase = defaultDb,
): Promise<StorageSummary> {
  const [assessmentCount, measurementCount, pendingSyncCount, backup] = await Promise.all([
    database.assessments.count(),
    database.measurements.count(),
    database.sync_queue.where('status').equals('pending').count(),
    exportBackup(database),
  ]);

  return {
    assessmentCount,
    measurementCount,
    pendingSyncCount,
    approximateBytes: estimateBackupBytes(backup),
  };
}

export async function clearAllData(database: FieldDatabase = defaultDb): Promise<void> {
  await database.transaction(
    'rw',
    database.assessments,
    database.measurements,
    database.sync_queue,
    async () => {
      await database.assessments.clear();
      await database.measurements.clear();
      await database.sync_queue.clear();
    },
  );
}

async function upsertAssessment(
  database: FieldDatabase,
  assessment: StoredAssessment,
  strategy: DuplicateStrategy,
): Promise<'imported' | 'replaced' | 'skipped'> {
  const existing = await database.assessments.get(assessment.id);
  if (existing && strategy === 'skip') {
    return 'skipped';
  }

  await database.assessments.put(assessment);
  await enqueueUpsert(database, 'assessment', assessment);
  return existing ? 'replaced' : 'imported';
}

async function upsertMeasurement(
  database: FieldDatabase,
  measurement: StoredMeasurement,
  strategy: DuplicateStrategy,
): Promise<'imported' | 'replaced' | 'skipped'> {
  const existing = await database.measurements.get(measurement.id);
  if (existing && strategy === 'skip') {
    return 'skipped';
  }

  await database.measurements.put(measurement);
  await enqueueUpsert(database, 'measurement', measurement);
  return existing ? 'replaced' : 'imported';
}

export async function importBackup(
  backup: MmapFieldBackup,
  strategy: DuplicateStrategy,
  database: FieldDatabase = defaultDb,
): Promise<ImportResult> {
  const validationErrors = validateBackupRecords(backup);
  if (validationErrors.length > 0) {
    return {
      importedAssessments: 0,
      importedMeasurements: 0,
      skippedAssessments: 0,
      skippedMeasurements: 0,
      replacedAssessments: 0,
      replacedMeasurements: 0,
      errors: validationErrors,
    };
  }

  const result: ImportResult = {
    importedAssessments: 0,
    importedMeasurements: 0,
    skippedAssessments: 0,
    skippedMeasurements: 0,
    replacedAssessments: 0,
    replacedMeasurements: 0,
    errors: [],
  };

  const importedAssessmentIds = new Set<string>();

  await database.transaction(
    'rw',
    database.assessments,
    database.measurements,
    database.sync_queue,
    async () => {
      for (const assessment of backup.assessments) {
        const outcome = await upsertAssessment(database, assessment, strategy);
        if (outcome === 'imported') {
          result.importedAssessments += 1;
          importedAssessmentIds.add(assessment.id);
        } else if (outcome === 'replaced') {
          result.replacedAssessments += 1;
          importedAssessmentIds.add(assessment.id);
        } else {
          result.skippedAssessments += 1;
        }
      }

      for (const measurement of backup.measurements) {
        if (!importedAssessmentIds.has(measurement.assessment_id)) {
          const assessmentExists = await database.assessments.get(measurement.assessment_id);
          if (!assessmentExists) {
            result.skippedMeasurements += 1;
            continue;
          }
        }

        const outcome = await upsertMeasurement(database, measurement, strategy);
        if (outcome === 'imported') {
          result.importedMeasurements += 1;
        } else if (outcome === 'replaced') {
          result.replacedMeasurements += 1;
        } else {
          result.skippedMeasurements += 1;
        }
      }
    },
  );

  return result;
}
