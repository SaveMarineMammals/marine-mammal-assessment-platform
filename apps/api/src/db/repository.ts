import type { PoolClient } from 'pg';
import type {
  ManateeAssessmentComplete,
  ManateeAssessmentDraft,
  ManateeMeasurement,
} from '@mmap/schema/manatee_v1';
import { query, queryOne } from './pool.js';

export interface AssessmentRow {
  id: string;
  name: string;
  assessment_type: string;
  protocol_version: string;
  assessment_started_at: string;
  assessment_ended_at: string | null;
  latitude: number;
  longitude: number;
  location_accuracy_meters: number | null;
  location_altitude: number | null;
  location_capture_method_note: string | null;
  collector_id: string;
  organization: string | null;
  campaign: string | null;
  notes: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface MeasurementRow {
  id: string;
  assessment_id: string;
  measurement_type: string;
  recorded_at: string;
  value: number | { systolic: number; diastolic: number };
  unit: string;
  method: string | null;
  notes: string | null;
  sequence: number | null;
  created_at: string;
  updated_at: string;
}

export async function upsertAssessment(
  client: PoolClient,
  assessment: ManateeAssessmentDraft | ManateeAssessmentComplete,
): Promise<void> {
  await client.query(
    `
      INSERT INTO assessments (
        id, name, assessment_type, protocol_version,
        assessment_started_at, assessment_ended_at,
        location, location_accuracy_meters, location_altitude, location_capture_method_note,
        collector_id, organization, campaign, notes, sync_status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10, $11,
        $12, $13, $14, $15, $16, COALESCE($17, NOW()), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        assessment_type = EXCLUDED.assessment_type,
        protocol_version = EXCLUDED.protocol_version,
        assessment_started_at = EXCLUDED.assessment_started_at,
        assessment_ended_at = EXCLUDED.assessment_ended_at,
        location = EXCLUDED.location,
        location_accuracy_meters = EXCLUDED.location_accuracy_meters,
        location_altitude = EXCLUDED.location_altitude,
        location_capture_method_note = EXCLUDED.location_capture_method_note,
        collector_id = EXCLUDED.collector_id,
        organization = EXCLUDED.organization,
        campaign = EXCLUDED.campaign,
        notes = EXCLUDED.notes,
        sync_status = EXCLUDED.sync_status,
        updated_at = NOW()
    `,
    [
      assessment.id,
      assessment.name,
      assessment.assessment_type,
      assessment.protocol_version,
      assessment.assessment_started_at,
      assessment.assessment_ended_at ?? null,
      assessment.location.longitude,
      assessment.location.latitude,
      assessment.location.accuracy_meters ?? null,
      assessment.location.altitude ?? null,
      assessment.location.capture_method_note ?? null,
      assessment.collector_id,
      assessment.organization ?? null,
      assessment.campaign ?? null,
      assessment.notes ?? null,
      assessment.sync_status ?? 'synced',
      assessment.created_at ?? null,
    ],
  );
}

export async function upsertMeasurement(
  client: PoolClient,
  measurement: ManateeMeasurement,
): Promise<void> {
  await client.query(
    `
      INSERT INTO measurements (
        id, assessment_id, measurement_type, recorded_at,
        value, unit, method, notes, sequence, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5::jsonb, $6, $7, $8, $9, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        assessment_id = EXCLUDED.assessment_id,
        measurement_type = EXCLUDED.measurement_type,
        recorded_at = EXCLUDED.recorded_at,
        value = EXCLUDED.value,
        unit = EXCLUDED.unit,
        method = EXCLUDED.method,
        notes = EXCLUDED.notes,
        sequence = EXCLUDED.sequence,
        updated_at = NOW()
    `,
    [
      measurement.id,
      measurement.assessment_id,
      measurement.measurement_type,
      measurement.recorded_at,
      JSON.stringify(measurement.value),
      measurement.unit,
      measurement.method ?? null,
      measurement.notes ?? null,
      measurement.sequence ?? null,
    ],
  );
}

export async function getAssessmentById(id: string): Promise<AssessmentRow | undefined> {
  return queryOne<AssessmentRow>(
    `
      SELECT
        id, name, assessment_type, protocol_version,
        assessment_started_at, assessment_ended_at,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        location_accuracy_meters, location_altitude, location_capture_method_note,
        collector_id, organization, campaign, notes, sync_status,
        created_at, updated_at
      FROM assessments
      WHERE id = $1
    `,
    [id],
  );
}

export async function getMeasurementsByAssessmentId(
  assessmentId: string,
): Promise<MeasurementRow[]> {
  return query<MeasurementRow>(
    `
      SELECT
        id, assessment_id, measurement_type, recorded_at,
        value, unit, method, notes, sequence, created_at, updated_at
      FROM measurements
      WHERE assessment_id = $1
      ORDER BY recorded_at ASC
    `,
    [assessmentId],
  );
}

export async function logSyncAudit(
  client: PoolClient,
  entry: {
    batch_id: string;
    entity_type: 'assessment' | 'measurement';
    entity_id: string;
    operation: 'upsert';
    status: 'synced' | 'error';
    error_message?: string;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO sync_audit (
        batch_id, entity_type, entity_id, operation, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      entry.batch_id,
      entry.entity_type,
      entry.entity_id,
      entry.operation,
      entry.status,
      entry.error_message ?? null,
    ],
  );
}

export async function listSyncErrors(limit = 100) {
  return query(
    `
      SELECT id, batch_id, entity_type, entity_id, operation, status, error_message, created_at
      FROM sync_audit
      WHERE status = 'error'
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );
}
