import { describe, expect, it } from 'vitest';
import {
  getProtocolVersion,
  getJsonSchemaErrors,
  isUtcDateTime,
  MANATEE_V1_PROTOCOL,
  MANATEE_V1_VERSION,
  validateAssessmentWithJsonSchema,
  validateManateeAssessment,
  validateManateeMeasurement,
  validateMeasurementWithJsonSchema,
} from './index.js';
import { loadFixture } from './test-utils/load-fixture.js';

describe('@mmap/schema protocol metadata', () => {
  it('returns manatee v1 protocol version', () => {
    expect(getProtocolVersion(MANATEE_V1_PROTOCOL)).toBe(MANATEE_V1_VERSION);
  });

  it('returns dolphin stub protocol version', () => {
    expect(getProtocolVersion('dolphin_v1')).toBe('0.1.0');
  });

  it('throws for unknown assessment types', () => {
    expect(() => getProtocolVersion('unknown_v1' as typeof MANATEE_V1_PROTOCOL)).toThrow(
      'Unknown assessment type',
    );
  });
});

describe('UTC datetime primitives', () => {
  it('accepts Z suffix datetimes', () => {
    expect(isUtcDateTime('2026-03-15T14:22:00.000Z')).toBe(true);
  });

  it('accepts explicit +00:00 offset datetimes', () => {
    expect(isUtcDateTime('2026-03-15T14:22:00.000+00:00')).toBe(true);
  });

  it('rejects non-UTC offsets', () => {
    expect(isUtcDateTime('2026-03-15T14:22:00-05:00')).toBe(false);
  });
});

describe('manatee_v1 assessment validation', () => {
  it('accepts a complete assessment fixture in complete mode', () => {
    const fixture = loadFixture('valid-assessment-complete.json');
    const result = validateManateeAssessment(fixture, { mode: 'complete' });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(validateAssessmentWithJsonSchema(fixture)).toBe(true);
  });

  it('accepts a draft assessment without assessment_ended_at', () => {
    const fixture = loadFixture('valid-assessment-draft.json');
    const result = validateManateeAssessment(fixture, { mode: 'draft' });

    expect(result.success).toBe(true);
    expect(result.data?.assessment_ended_at).toBeUndefined();
    expect(validateAssessmentWithJsonSchema(fixture)).toBe(true);
  });

  it('requires assessment_ended_at in complete mode', () => {
    const fixture = loadFixture('valid-assessment-draft.json');
    const result = validateManateeAssessment(fixture, { mode: 'complete' });

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.path === 'assessment_ended_at')).toBe(true);
  });

  it('rejects non-UTC datetimes', () => {
    const fixture = loadFixture('invalid-assessment-non-utc-datetime.json');
    const result = validateManateeAssessment(fixture, { mode: 'draft' });

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.path === 'assessment_started_at')).toBe(true);
    expect(
      getJsonSchemaErrors(fixture, 'assessment').some((message) =>
        message.includes('assessment_started_at'),
      ),
    ).toBe(true);
  });

  it('rejects assessment_ended_at before assessment_started_at', () => {
    const fixture = loadFixture('invalid-assessment-end-before-start.json');
    const result = validateManateeAssessment(fixture, { mode: 'complete' });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'assessment_ended_at',
          code: 'INVALID_ASSESSMENT_WINDOW',
        }),
      ]),
    );
  });
});

describe('manatee_v1 measurement validation', () => {
  it('accepts heart rate fixture', () => {
    const fixture = loadFixture('valid-measurement-heart-rate.json');
    const result = validateManateeMeasurement(fixture);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(validateMeasurementWithJsonSchema(fixture)).toBe(true);
  });

  it('accepts blood pressure fixture with structured value', () => {
    const fixture = loadFixture('valid-measurement-blood-pressure.json');
    const result = validateManateeMeasurement(fixture);

    expect(result.success).toBe(true);
    expect(result.data?.value).toEqual({ systolic: 118, diastolic: 72 });
    expect(validateMeasurementWithJsonSchema(fixture)).toBe(true);
  });

  it('accepts length fixture with canonical unit', () => {
    const fixture = loadFixture('valid-measurement-length.json');
    const result = validateManateeMeasurement(fixture);

    expect(result.success).toBe(true);
    expect(result.data?.unit).toBe('cm');
  });

  it('rejects wrong canonical unit', () => {
    const fixture = loadFixture('invalid-measurement-wrong-unit.json');
    const result = validateManateeMeasurement(fixture);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(validateMeasurementWithJsonSchema(fixture)).toBe(false);
  });

  it('rejects non-positive length values', () => {
    const fixture = loadFixture('invalid-measurement-negative-length.json');
    const result = validateManateeMeasurement(fixture);

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.path === 'value')).toBe(true);
  });

  it('returns range warnings for out-of-range vitals without failing validation', () => {
    const fixture = loadFixture('warning-measurement-heart-rate-low.json');
    const result = validateManateeMeasurement(fixture);

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'value',
          severity: 'warning',
          code: 'RANGE_WARNING',
        }),
      ]),
    );
  });

  it('can disable range warnings', () => {
    const fixture = loadFixture('warning-measurement-heart-rate-low.json');
    const result = validateManateeMeasurement(fixture, { collectWarnings: false });

    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
