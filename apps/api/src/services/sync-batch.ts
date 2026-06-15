import { randomUUID } from 'node:crypto';
import {
  validateManateeAssessment,
  validateManateeMeasurement,
  type ManateeAssessmentDraft,
  type ManateeMeasurement,
} from '@mmap/schema/manatee_v1';
import { withTransaction } from '../db/pool.js';
import { logSyncAudit, upsertAssessment, upsertMeasurement } from '../db/repository.js';

export interface SyncBatchRequest {
  assessments?: unknown[];
  measurements?: unknown[];
}

export type SyncEntityType = 'assessment' | 'measurement';

export interface SyncBatchItemResult {
  entity_type: SyncEntityType;
  entity_id: string;
  status: 'synced' | 'error';
  error?: string;
}

export interface SyncBatchResponse {
  batch_id: string;
  results: SyncBatchItemResult[];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getReportedEntityId(raw: unknown, fallbackType: SyncEntityType): string {
  if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string') {
    return raw.id;
  }
  return `unknown-${fallbackType}`;
}

function getAuditEntityId(raw: unknown): string {
  const reported = getReportedEntityId(raw, 'assessment');
  if (isUuid(reported)) {
    return reported;
  }
  return randomUUID();
}

function validateAssessmentRecord(raw: unknown): {
  success: boolean;
  data?: ManateeAssessmentDraft;
  errors: string[];
} {
  const candidate = raw as ManateeAssessmentDraft;
  const mode = candidate?.assessment_ended_at ? 'complete' : 'draft';
  const validation = validateManateeAssessment(raw, { mode });
  if (!validation.success) {
    return {
      success: false,
      errors: validation.errors.map((issue) => `${issue.path}: ${issue.message}`),
    };
  }
  return { success: true, data: validation.data, errors: [] };
}

function validateMeasurementRecord(raw: unknown): {
  success: boolean;
  data?: ManateeMeasurement;
  errors: string[];
} {
  const validation = validateManateeMeasurement(raw);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.errors.map((issue) => `${issue.path}: ${issue.message}`),
    };
  }
  return { success: true, data: validation.data, errors: [] };
}

export async function processSyncBatch(body: SyncBatchRequest): Promise<SyncBatchResponse> {
  const batchId = randomUUID();
  const results: SyncBatchItemResult[] = [];
  const assessments = body.assessments ?? [];
  const measurements = body.measurements ?? [];

  await withTransaction(async (client) => {
    for (const raw of assessments) {
      const reportedEntityId = getReportedEntityId(raw, 'assessment');
      const auditEntityId = getAuditEntityId(raw);
      const validation = validateAssessmentRecord(raw);

      if (!validation.success || !validation.data) {
        const error = validation.errors.join('; ') || 'Invalid assessment';
        await logSyncAudit(client, {
          batch_id: batchId,
          entity_type: 'assessment',
          entity_id: auditEntityId,
          operation: 'upsert',
          status: 'error',
          error_message: error,
        });
        results.push({
          entity_type: 'assessment',
          entity_id: reportedEntityId,
          status: 'error',
          error,
        });
        continue;
      }

      try {
        await upsertAssessment(client, {
          ...validation.data,
          sync_status: validation.data.sync_status ?? 'synced',
        });
        await logSyncAudit(client, {
          batch_id: batchId,
          entity_type: 'assessment',
          entity_id: validation.data.id,
          operation: 'upsert',
          status: 'synced',
        });
        results.push({
          entity_type: 'assessment',
          entity_id: validation.data.id,
          status: 'synced',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upsert assessment';
        await logSyncAudit(client, {
          batch_id: batchId,
          entity_type: 'assessment',
          entity_id: validation.data.id,
          operation: 'upsert',
          status: 'error',
          error_message: message,
        });
        results.push({
          entity_type: 'assessment',
          entity_id: validation.data.id,
          status: 'error',
          error: message,
        });
      }
    }

    for (const raw of measurements) {
      const reportedEntityId = getReportedEntityId(raw, 'measurement');
      const auditEntityId = getAuditEntityId(raw);
      const validation = validateMeasurementRecord(raw);

      if (!validation.success || !validation.data) {
        const error = validation.errors.join('; ') || 'Invalid measurement';
        await logSyncAudit(client, {
          batch_id: batchId,
          entity_type: 'measurement',
          entity_id: auditEntityId,
          operation: 'upsert',
          status: 'error',
          error_message: error,
        });
        results.push({
          entity_type: 'measurement',
          entity_id: reportedEntityId,
          status: 'error',
          error,
        });
        continue;
      }

      try {
        await upsertMeasurement(client, validation.data);
        await logSyncAudit(client, {
          batch_id: batchId,
          entity_type: 'measurement',
          entity_id: validation.data.id,
          operation: 'upsert',
          status: 'synced',
        });
        results.push({
          entity_type: 'measurement',
          entity_id: validation.data.id,
          status: 'synced',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upsert measurement';
        await logSyncAudit(client, {
          batch_id: batchId,
          entity_type: 'measurement',
          entity_id: validation.data.id,
          operation: 'upsert',
          status: 'error',
          error_message: message,
        });
        results.push({
          entity_type: 'measurement',
          entity_id: validation.data.id,
          status: 'error',
          error: message,
        });
      }
    }
  });

  return { batch_id: batchId, results };
}

export function getBatchHttpStatus(results: SyncBatchItemResult[]): number {
  const hasError = results.some((result) => result.status === 'error');
  const hasSuccess = results.some((result) => result.status === 'synced');
  if (hasError && hasSuccess) {
    return 207;
  }
  if (hasError) {
    return 400;
  }
  return 200;
}
