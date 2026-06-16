import { toUtcIso } from '@mmap/geo-time';
import type { FieldDatabase } from '../db/database.js';
import { db as defaultDb } from '../db/database.js';
import type { StoredAssessment, StoredMeasurement, SyncQueueEntry } from '../db/types.js';
import { getSyncApiUrl } from '../config.js';
import { markApiReachable } from './api-connectivity.js';
import { hasExceededMaxAttempts, isReadyForRetry } from './backoff.js';
import type { SyncBatchResponse, SyncRunResult } from './types.js';

function nowUtc(): string {
  return toUtcIso(new Date());
}

function getAssessmentIdFromEntry(entry: SyncQueueEntry): string {
  if (entry.entity_type === 'assessment') {
    return entry.entity_id;
  }
  return (entry.payload as StoredMeasurement).assessment_id;
}

function toSyncAssessmentPayload(assessment: StoredAssessment): StoredAssessment {
  return {
    ...assessment,
    sync_status: 'pending',
  };
}

function buildBatchPayload(entries: SyncQueueEntry[]): {
  assessments: StoredAssessment[];
  measurements: StoredMeasurement[];
} {
  const assessments: StoredAssessment[] = [];
  const measurements: StoredMeasurement[] = [];

  for (const entry of entries) {
    if (entry.entity_type === 'assessment') {
      assessments.push(toSyncAssessmentPayload(entry.payload as StoredAssessment));
    } else {
      measurements.push(entry.payload as StoredMeasurement);
    }
  }

  return { assessments, measurements };
}

async function refreshAssessmentSyncStatus(
  database: FieldDatabase,
  assessmentId: string,
): Promise<void> {
  const assessment = await database.assessments.get(assessmentId);
  if (!assessment) {
    return;
  }

  const queueEntries = await database.sync_queue.toArray();
  const relatedEntries = queueEntries.filter(
    (entry) => getAssessmentIdFromEntry(entry) === assessmentId,
  );

  if (relatedEntries.length === 0) {
    await database.assessments.update(assessmentId, {
      sync_status: 'synced',
      updated_at: nowUtc(),
    });
    return;
  }

  const hasPermanentError = relatedEntries.some(
    (entry) => entry.status === 'error' && hasExceededMaxAttempts(entry),
  );
  const hasRetryable = relatedEntries.some(
    (entry) =>
      entry.status === 'pending' || (entry.status === 'error' && !hasExceededMaxAttempts(entry)),
  );

  const nextStatus = hasPermanentError ? 'error' : hasRetryable ? 'pending' : 'synced';
  if (assessment.sync_status !== nextStatus) {
    await database.assessments.update(assessmentId, {
      sync_status: nextStatus,
      updated_at: nowUtc(),
    });
  }
}

export async function getSyncableEntries(
  database: FieldDatabase = defaultDb,
  options: { force?: boolean } = {},
): Promise<SyncQueueEntry[]> {
  const entries = await database.sync_queue.toArray();
  const eligible = options.force
    ? entries.filter((entry) => !hasExceededMaxAttempts(entry))
    : entries.filter((entry) => isReadyForRetry(entry));

  return eligible.sort((left, right) => {
    if (left.entity_type === right.entity_type) {
      return left.created_at.localeCompare(right.created_at);
    }
    return left.entity_type === 'assessment' ? -1 : 1;
  });
}

export async function listFailedSyncEntries(
  database: FieldDatabase = defaultDb,
): Promise<SyncQueueEntry[]> {
  const entries = await database.sync_queue.toArray();
  return entries
    .filter((entry) => entry.status === 'error')
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function retryFailedSyncEntries(database: FieldDatabase = defaultDb): Promise<number> {
  const failed = await listFailedSyncEntries(database);
  const timestamp = nowUtc();
  let resetCount = 0;

  for (const entry of failed) {
    await database.sync_queue.update(entry.id, {
      status: 'pending',
      attempts: 0,
      last_error: undefined,
      updated_at: timestamp,
    });
    resetCount += 1;

    const assessmentId = getAssessmentIdFromEntry(entry);
    await database.assessments.update(assessmentId, {
      sync_status: 'pending',
      updated_at: timestamp,
    });
  }

  return resetCount;
}

async function applySyncResults(
  database: FieldDatabase,
  entries: SyncQueueEntry[],
  response: SyncBatchResponse,
): Promise<{ synced: number; failed: number }> {
  const resultByEntityId = new Map(
    response.results.map((result) => [`${result.entity_type}:${result.entity_id}`, result]),
  );
  const timestamp = nowUtc();
  let synced = 0;
  let failed = 0;
  const affectedAssessmentIds = new Set<string>();

  for (const entry of entries) {
    const key = `${entry.entity_type}:${entry.entity_id}`;
    const result = resultByEntityId.get(key);
    affectedAssessmentIds.add(getAssessmentIdFromEntry(entry));

    if (result?.status === 'synced') {
      await database.sync_queue.delete(entry.id);
      synced += 1;
      continue;
    }

    const errorMessage = result?.error ?? 'Sync failed without server details';
    const attempts = entry.attempts + 1;
    await database.sync_queue.update(entry.id, {
      status: 'error',
      attempts,
      last_error: errorMessage,
      updated_at: timestamp,
    });
    failed += 1;
  }

  for (const assessmentId of affectedAssessmentIds) {
    await refreshAssessmentSyncStatus(database, assessmentId);
  }

  return { synced, failed };
}

export async function runSync(
  database: FieldDatabase = defaultDb,
  options: { force?: boolean } = {},
): Promise<SyncRunResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    markApiReachable(false);
    return { attempted: 0, synced: 0, failed: 0, skipped: 0, error: 'Device is offline' };
  }

  const entries = await getSyncableEntries(database, options);
  if (entries.length === 0) {
    return { attempted: 0, synced: 0, failed: 0, skipped: 0 };
  }

  const payload = buildBatchPayload(entries);

  let response: Response;
  try {
    response = await fetch(getSyncApiUrl('/v1/sync/batch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    markApiReachable(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    markApiReachable(false);
    const timestamp = nowUtc();
    for (const entry of entries) {
      const attempts = entry.attempts + 1;
      await database.sync_queue.update(entry.id, {
        status: 'error',
        attempts,
        last_error: message,
        updated_at: timestamp,
      });
      await refreshAssessmentSyncStatus(database, getAssessmentIdFromEntry(entry));
    }
    return {
      attempted: entries.length,
      synced: 0,
      failed: entries.length,
      skipped: 0,
      error: message,
    };
  }

  let body: SyncBatchResponse;
  try {
    body = (await response.json()) as SyncBatchResponse;
  } catch {
    const message = `Sync failed with HTTP ${response.status}`;
    const timestamp = nowUtc();
    for (const entry of entries) {
      const attempts = entry.attempts + 1;
      await database.sync_queue.update(entry.id, {
        status: 'error',
        attempts,
        last_error: message,
        updated_at: timestamp,
      });
      await refreshAssessmentSyncStatus(database, getAssessmentIdFromEntry(entry));
    }
    return {
      attempted: entries.length,
      synced: 0,
      failed: entries.length,
      skipped: 0,
      error: message,
    };
  }

  if (!Array.isArray(body.results)) {
    return {
      attempted: entries.length,
      synced: 0,
      failed: entries.length,
      skipped: 0,
      error: 'Invalid sync response from server',
    };
  }

  const { synced, failed } = await applySyncResults(database, entries, body);
  return {
    attempted: entries.length,
    synced,
    failed,
    skipped: 0,
    error: failed > 0 ? 'Some records failed to sync' : undefined,
  };
}
