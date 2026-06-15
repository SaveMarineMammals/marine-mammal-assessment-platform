CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  assessment_type TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  assessment_started_at TIMESTAMPTZ NOT NULL,
  assessment_ended_at TIMESTAMPTZ,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  location_accuracy_meters DOUBLE PRECISION,
  location_altitude DOUBLE PRECISION,
  location_capture_method_note TEXT,
  collector_id UUID NOT NULL,
  organization TEXT,
  campaign TEXT,
  notes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS measurements (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  value JSONB NOT NULL,
  unit TEXT NOT NULL,
  method TEXT,
  notes TEXT,
  sequence INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurements_assessment_id ON measurements(assessment_id);
CREATE INDEX IF NOT EXISTS idx_measurements_recorded_at ON measurements(recorded_at);
CREATE INDEX IF NOT EXISTS idx_sync_audit_batch_id ON sync_audit(batch_id);
CREATE INDEX IF NOT EXISTS idx_sync_audit_entity ON sync_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_audit_status ON sync_audit(status);
