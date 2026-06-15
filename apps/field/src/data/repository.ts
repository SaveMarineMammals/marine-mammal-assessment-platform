import { toUtcIso } from '@mmap/geo-time';
import { MANATEE_V1_PROTOCOL, MANATEE_V1_VERSION } from '@mmap/schema/manatee_v1';
import type { FieldDatabase } from '../db/database.js';
import { db as defaultDb } from '../db/database.js';
import { MAX_SYNC_ATTEMPTS } from '../config.js';
import type {
  AssessmentWithMeasurements,
  CreateAssessmentInput,
  FieldFeedbackEntry,
  StoredAssessment,
  StoredMeasurement,
  SyncQueueEntry,
  UpdateAssessmentInput,
} from '../db/types.js';
import { createId, getCollectorId } from '../lib/ids.js';
import { isProtocolSyncable } from '../lib/protocol-registry.js';

function nowUtc(): string {
  return toUtcIso(new Date());
}

export async function enqueueUpsert(
  database: FieldDatabase,
  entityType: SyncQueueEntry['entity_type'],
  payload: StoredAssessment | StoredMeasurement,
): Promise<void> {
  const timestamp = nowUtc();
  const existing = await database.sync_queue.where('entity_id').equals(payload.id).first();

  if (existing) {
    await database.sync_queue.update(existing.id, {
      payload,
      status: 'pending',
      updated_at: timestamp,
    });
    return;
  }

  const entry: SyncQueueEntry = {
    id: createId(),
    entity_type: entityType,
    entity_id: payload.id,
    operation: 'upsert',
    payload,
    status: 'pending',
    attempts: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await database.sync_queue.add(entry);
}

function resolveSyncStatus(
  assessmentType: string,
  protocolVersion: string,
  explicit?: StoredAssessment['sync_status'],
): StoredAssessment['sync_status'] {
  if (explicit) {
    return explicit;
  }
  if (!isProtocolSyncable(assessmentType, protocolVersion)) {
    return 'local-only';
  }
  return 'pending';
}

export async function createAssessment(
  input: CreateAssessmentInput,
  database: FieldDatabase = defaultDb,
): Promise<StoredAssessment> {
  const assessmentType = input.assessment_type ?? MANATEE_V1_PROTOCOL;
  const protocolVersion = input.protocol_version ?? MANATEE_V1_VERSION;
  const timestamp = input.assessment_started_at ?? nowUtc();
  const syncStatus = resolveSyncStatus(assessmentType, protocolVersion, input.sync_status);
  const assessment: StoredAssessment = {
    id: createId(),
    name: input.name.trim(),
    assessment_started_at: timestamp,
    location: input.location,
    assessment_type: assessmentType,
    protocol_version: protocolVersion,
    collector_id: getCollectorId(),
    organization: input.organization?.trim() || undefined,
    campaign: input.campaign?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    sync_status: syncStatus,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await database.assessments.add(assessment);

  if (syncStatus !== 'local-only') {
    await enqueueUpsert(database, 'assessment', assessment);
  }

  return assessment;
}

export async function updateAssessment(
  id: string,
  input: UpdateAssessmentInput,
  database: FieldDatabase = defaultDb,
): Promise<StoredAssessment> {
  const existing = await database.assessments.get(id);
  if (!existing) {
    throw new Error(`Assessment not found: ${id}`);
  }

  const updated: StoredAssessment = {
    ...existing,
    ...input,
    name: input.name?.trim() ?? existing.name,
    assessment_started_at: input.assessment_started_at ?? existing.assessment_started_at,
    assessment_ended_at:
      input.assessment_ended_at === null
        ? undefined
        : (input.assessment_ended_at ?? existing.assessment_ended_at),
    organization: input.organization?.trim() || existing.organization,
    campaign: input.campaign?.trim() || existing.campaign,
    notes: input.notes?.trim() ?? existing.notes,
    updated_at: nowUtc(),
    sync_status: input.sync_status ?? existing.sync_status,
  };

  await database.assessments.put(updated);

  if (isProtocolSyncable(updated.assessment_type, updated.protocol_version)) {
    await enqueueUpsert(database, 'assessment', updated);
  }

  return updated;
}

export async function listAssessments(
  database: FieldDatabase = defaultDb,
): Promise<StoredAssessment[]> {
  const assessments = await database.assessments.toArray();
  return assessments.sort(
    (left, right) =>
      new Date(right.assessment_started_at).getTime() -
      new Date(left.assessment_started_at).getTime(),
  );
}

export async function getAssessmentWithMeasurements(
  id: string,
  database: FieldDatabase = defaultDb,
): Promise<AssessmentWithMeasurements | undefined> {
  const assessment = await database.assessments.get(id);
  if (!assessment) {
    return undefined;
  }

  const measurements = await database.measurements
    .where('assessment_id')
    .equals(id)
    .sortBy('recorded_at');

  return { assessment, measurements };
}

export async function addMeasurement(
  measurement: StoredMeasurement,
  database: FieldDatabase = defaultDb,
): Promise<StoredMeasurement> {
  const assessment = await database.assessments.get(measurement.assessment_id);
  if (!assessment) {
    throw new Error(`Assessment not found: ${measurement.assessment_id}`);
  }

  const stored: StoredMeasurement = {
    ...measurement,
    id: measurement.id || createId(),
  };

  await database.measurements.put(stored);

  if (isProtocolSyncable(assessment.assessment_type, assessment.protocol_version)) {
    await enqueueUpsert(database, 'measurement', stored);
    await database.assessments.update(assessment.id, {
      updated_at: nowUtc(),
      sync_status: 'pending',
    });
  } else {
    await database.assessments.update(assessment.id, {
      updated_at: nowUtc(),
    });
  }

  return stored;
}

export async function addFeedback(
  message: string,
  context?: string,
  assessmentId?: string,
  database: FieldDatabase = defaultDb,
): Promise<FieldFeedbackEntry> {
  const entry: FieldFeedbackEntry = {
    id: createId(),
    message: message.trim(),
    context: context?.trim() || undefined,
    assessment_id: assessmentId,
    created_at: nowUtc(),
    exported: false,
  };

  await database.feedback.add(entry);
  return entry;
}

export async function listFeedback(
  database: FieldDatabase = defaultDb,
): Promise<FieldFeedbackEntry[]> {
  return database.feedback.orderBy('created_at').reverse().toArray();
}

export async function exportFeedbackJson(
  database: FieldDatabase = defaultDb,
): Promise<{ exported_at: string; entries: FieldFeedbackEntry[] }> {
  const entries = await listFeedback(database);
  for (const entry of entries) {
    if (!entry.exported) {
      await database.feedback.update(entry.id, { exported: true });
    }
  }
  return {
    exported_at: nowUtc(),
    entries,
  };
}

export async function getPendingSyncCount(database: FieldDatabase = defaultDb): Promise<number> {
  const entries = await database.sync_queue.toArray();
  return entries.filter(
    (entry) =>
      entry.status === 'pending' ||
      (entry.status === 'error' && entry.attempts < MAX_SYNC_ATTEMPTS),
  ).length;
}

export async function getSyncErrorCount(database: FieldDatabase = defaultDb): Promise<number> {
  return database.sync_queue.where('status').equals('error').count();
}
