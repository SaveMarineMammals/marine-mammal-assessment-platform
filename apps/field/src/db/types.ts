import type { ManateeLocation } from '@mmap/schema/manatee_v1';

export type SyncStatus = 'local-only' | 'pending' | 'synced' | 'error';

export type AssessmentLocation = ManateeLocation;

export interface StoredAssessment {
  id: string;
  name: string;
  assessment_started_at: string;
  assessment_ended_at?: string;
  location: AssessmentLocation;
  assessment_type: string;
  protocol_version: string;
  collector_id: string;
  organization?: string;
  campaign?: string;
  notes?: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface StoredMeasurement {
  id: string;
  assessment_id: string;
  measurement_type: string;
  recorded_at: string;
  value: number | { systolic: number; diastolic: number };
  unit: string;
  method?: string;
  notes?: string | null;
  sequence?: number;
}

export type SyncEntityType = 'assessment' | 'measurement';

export type SyncQueueStatus = 'pending' | 'error';

export interface SyncQueueEntry {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: 'upsert';
  payload: StoredAssessment | StoredMeasurement;
  status: SyncQueueStatus;
  attempts: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentWithMeasurements {
  assessment: StoredAssessment;
  measurements: StoredMeasurement[];
}

export interface CreateAssessmentInput {
  name: string;
  location: AssessmentLocation;
  assessment_type?: string;
  protocol_version?: string;
  assessment_started_at?: string;
  organization?: string;
  campaign?: string;
  notes?: string;
  sync_status?: SyncStatus;
}

export interface UpdateAssessmentInput {
  name?: string;
  location?: AssessmentLocation;
  assessment_started_at?: string;
  assessment_ended_at?: string | null;
  organization?: string;
  campaign?: string;
  notes?: string;
  sync_status?: SyncStatus;
}

export interface FieldFeedbackEntry {
  id: string;
  message: string;
  context?: string;
  assessment_id?: string;
  created_at: string;
  exported: boolean;
}
