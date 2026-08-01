import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type VerifyMode = 'full' | 'smoke';
export type VerifyEnvironment = 'staging' | 'production';

export interface SyncBatchPayload {
  assessments: Array<Record<string, unknown>>;
  measurements: Array<Record<string, unknown>>;
}

export interface PublicAssessmentItem {
  id: string;
  name?: string;
  measurement_count?: number;
}

export interface PublicAssessmentList {
  total: number;
  items: PublicAssessmentItem[];
}

/** Express ingress endpoints are full URLs; older module output double-prefixed https://. */
export function normalizeHttpsUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '').replace(/^https?:\/\//i, '');
  return `https://${withoutScheme}`;
}

export function parseVerifyMode(argv: string[]): VerifyMode {
  const modeFlagIndex = argv.indexOf('--mode');
  if (modeFlagIndex === -1) {
    return 'full';
  }

  const value = argv[modeFlagIndex + 1];
  if (value === 'full' || value === 'smoke') {
    return value;
  }

  throw new Error(`Invalid --mode value: ${value ?? '(missing)'}. Use full or smoke.`);
}

export function parseEnvironment(value: string | undefined): VerifyEnvironment {
  if (value === 'staging' || value === 'production') {
    return value;
  }

  throw new Error(`Unknown environment: ${value ?? '(missing)'}. Use staging or production.`);
}

export function defaultFixturesDir(fromImportMetaUrl: string = import.meta.url): string {
  return join(dirname(fileURLToPath(fromImportMetaUrl)), '../packages/schema/fixtures');
}

export function loadJsonFixture<T>(fixturesDir: string, filename: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, filename), 'utf8')) as T;
}

/**
 * Clone assessment + measurement fixtures and assign fresh UUIDs so live runs
 * do not collide with prior smoke data or fixture defaults.
 */
export function buildFreshSyncBatch(
  fixturesDir: string,
  options: { assessmentNamePrefix?: string } = {},
): { assessmentId: string; payload: SyncBatchPayload } {
  const assessment = loadJsonFixture<Record<string, unknown>>(
    fixturesDir,
    'valid-assessment-complete.json',
  );
  const measurements = [
    loadJsonFixture<Record<string, unknown>>(fixturesDir, 'valid-measurement-heart-rate.json'),
    loadJsonFixture<Record<string, unknown>>(fixturesDir, 'valid-measurement-blood-pressure.json'),
    loadJsonFixture<Record<string, unknown>>(fixturesDir, 'valid-measurement-length.json'),
  ];

  const assessmentId = randomUUID();
  const prefix = options.assessmentNamePrefix ?? 'live-verify';
  const name = `${prefix}-${assessmentId.slice(0, 8)}`;

  const freshAssessment: Record<string, unknown> = {
    ...assessment,
    id: assessmentId,
    name,
    collector_id: randomUUID(),
  };

  const freshMeasurements = measurements.map((measurement) => ({
    ...measurement,
    id: randomUUID(),
    assessment_id: assessmentId,
  }));

  return {
    assessmentId,
    payload: {
      assessments: [freshAssessment],
      measurements: freshMeasurements,
    },
  };
}

export function assertOkStatus(status: number, label: string): void {
  if (status < 200 || status >= 300) {
    throw new Error(`${label} failed with HTTP ${status}`);
  }
}

export function assertHealthBody(body: unknown): void {
  if (!body || typeof body !== 'object') {
    throw new Error('Health response is not an object');
  }

  const status = (body as { status?: unknown }).status;
  if (status !== 'ok') {
    throw new Error(`Unexpected health status: ${String(status)}`);
  }
}

export function assertStatsBody(body: unknown): void {
  if (!body || typeof body !== 'object') {
    throw new Error('Stats response is not an object');
  }

  const stats = body as { total_assessments?: unknown; total_measurements?: unknown };
  if (typeof stats.total_assessments !== 'number' || typeof stats.total_measurements !== 'number') {
    throw new Error('Stats response missing total_assessments / total_measurements');
  }
}

export function assertMetaBody(body: unknown): void {
  if (!body || typeof body !== 'object') {
    throw new Error('Meta response is not an object');
  }

  const meta = body as { license?: unknown };
  if (typeof meta.license !== 'string' || meta.license.length === 0) {
    throw new Error('Meta response missing license');
  }
}

export function assertCsvExportHeaders(csv: string): void {
  const headerLine = csv.split(/\r?\n/, 1)[0] ?? '';
  for (const column of ['assessment_id', 'measurement_type'] as const) {
    if (!headerLine.includes(column)) {
      throw new Error(`CSV export header missing column: ${column}`);
    }
  }
}

export function assertCsvContainsAssessment(csv: string, assessmentId: string): void {
  if (!csv.includes(assessmentId)) {
    throw new Error(`CSV export does not contain assessment_id ${assessmentId}`);
  }
  if (!csv.includes('heart_rate')) {
    throw new Error('CSV export does not contain heart_rate measurement_type');
  }
}

export function findAssessmentById(
  list: PublicAssessmentList,
  assessmentId: string,
): PublicAssessmentItem | undefined {
  return list.items.find((item) => item.id === assessmentId);
}

export function assertSyncBatchAccepted(status: number, body: unknown, label: string): void {
  if (status !== 200 && status !== 207) {
    throw new Error(`${label} expected HTTP 200 or 207, got ${status}`);
  }

  if (!body || typeof body !== 'object') {
    throw new Error(`${label} response is not an object`);
  }
}
