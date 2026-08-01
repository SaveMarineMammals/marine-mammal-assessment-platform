import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertCsvContainsAssessment,
  assertCsvExportHeaders,
  assertHealthBody,
  assertMetaBody,
  assertStatsBody,
  assertSyncBatchAccepted,
  buildFreshSyncBatch,
  findAssessmentById,
  normalizeHttpsUrl,
  parseEnvironment,
  parseVerifyMode,
} from './live-verify-lib.js';

describe('normalizeHttpsUrl', () => {
  it('normalizes bare hosts and double-prefixed URLs', () => {
    expect(normalizeHttpsUrl('example.com/')).toBe('https://example.com');
    expect(normalizeHttpsUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeHttpsUrl('https://https://example.com')).toBe('https://example.com');
  });
});

describe('parseVerifyMode / parseEnvironment', () => {
  it('defaults mode to full and accepts smoke', () => {
    expect(parseVerifyMode([])).toBe('full');
    expect(parseVerifyMode(['--mode', 'smoke'])).toBe('smoke');
    expect(parseVerifyMode(['staging', '--mode', 'full'])).toBe('full');
  });

  it('rejects invalid mode and environment', () => {
    expect(() => parseVerifyMode(['--mode', 'canary'])).toThrow(/Invalid --mode/);
    expect(() => parseEnvironment('dev')).toThrow(/Unknown environment/);
    expect(parseEnvironment('staging')).toBe('staging');
  });
});

describe('buildFreshSyncBatch', () => {
  it('assigns fresh UUIDs and rewrites measurement assessment_id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-verify-'));
    writeFileSync(
      join(dir, 'valid-assessment-complete.json'),
      JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'fixture',
        collector_id: '770e8400-e29b-41d4-a716-446655440000',
      }),
    );
    for (const [file, id] of [
      ['valid-measurement-heart-rate.json', '660e8400-e29b-41d4-a716-446655440001'],
      ['valid-measurement-blood-pressure.json', '660e8400-e29b-41d4-a716-446655440002'],
      ['valid-measurement-length.json', '660e8400-e29b-41d4-a716-446655440003'],
    ] as const) {
      writeFileSync(
        join(dir, file),
        JSON.stringify({
          id,
          assessment_id: '550e8400-e29b-41d4-a716-446655440000',
          measurement_type: 'heart_rate',
        }),
      );
    }

    const { assessmentId, payload } = buildFreshSyncBatch(dir, {
      assessmentNamePrefix: 'unit',
    });

    expect(assessmentId).not.toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(payload.assessments[0]?.id).toBe(assessmentId);
    expect(String(payload.assessments[0]?.name)).toContain(assessmentId.slice(0, 8));
    expect(payload.measurements).toHaveLength(3);
    for (const measurement of payload.measurements) {
      expect(measurement.assessment_id).toBe(assessmentId);
      expect(measurement.id).not.toBe('660e8400-e29b-41d4-a716-446655440001');
    }
  });
});

describe('response assertions', () => {
  it('validates health, stats, meta, and CSV headers', () => {
    expect(() => assertHealthBody({ status: 'ok' })).not.toThrow();
    expect(() => assertHealthBody({ status: 'down' })).toThrow(/Unexpected health/);
    expect(() => assertStatsBody({ total_assessments: 1, total_measurements: 2 })).not.toThrow();
    expect(() => assertStatsBody({ total_assessments: 'x' })).toThrow(/missing/);
    expect(() => assertMetaBody({ license: 'CC BY 4.0' })).not.toThrow();
    expect(() =>
      assertCsvExportHeaders('assessment_id,assessment_name,measurement_type\n'),
    ).not.toThrow();
    expect(() => assertCsvExportHeaders('foo,bar\n')).toThrow(/assessment_id/);
  });

  it('finds assessments and checks CSV contents', () => {
    const item = { id: 'abc', measurement_count: 3 };
    expect(findAssessmentById({ total: 1, items: [item] }, 'abc')).toEqual(item);
    expect(findAssessmentById({ total: 0, items: [] }, 'abc')).toBeUndefined();
    expect(() =>
      assertCsvContainsAssessment('assessment_id,measurement_type\nabc,heart_rate\n', 'abc'),
    ).not.toThrow();
    expect(() => assertSyncBatchAccepted(200, { results: [] }, 'sync')).not.toThrow();
    expect(() => assertSyncBatchAccepted(400, {}, 'sync')).toThrow(/400/);
  });
});
