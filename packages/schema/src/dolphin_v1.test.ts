import { describe, expect, it } from 'vitest';
import {
  validateDolphinAssessment,
  validateDolphinMeasurement,
  DOLPHIN_V1_PROTOCOL,
  DOLPHIN_V1_VERSION,
} from './dolphin_v1/index.js';

describe('dolphin_v1 stub', () => {
  const assessment = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Dolphin-042',
    assessment_started_at: '2026-03-15T14:22:00.000Z',
    location: { latitude: 17.5, longitude: -88.2 },
    assessment_type: DOLPHIN_V1_PROTOCOL,
    protocol_version: DOLPHIN_V1_VERSION,
    collector_id: '770e8400-e29b-41d4-a716-446655440000',
  };

  it('accepts draft dolphin assessments', () => {
    const result = validateDolphinAssessment(assessment, { mode: 'draft' });
    expect(result.success).toBe(true);
  });

  it('validates body condition measurements', () => {
    const result = validateDolphinMeasurement({
      id: '660e8400-e29b-41d4-a716-446655440001',
      assessment_id: assessment.id,
      measurement_type: 'body_condition',
      recorded_at: '2026-03-15T14:35:00.000Z',
      value: 4,
      unit: 'score',
    });
    expect(result.success).toBe(true);
  });
});
