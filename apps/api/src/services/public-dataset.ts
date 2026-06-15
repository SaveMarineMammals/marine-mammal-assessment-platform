import { createHash } from 'node:crypto';
import {
  listPublicAssessments,
  streamPublicExportRows,
  type PublicAssessmentFilters,
  type PublicAssessmentRow,
  getPublicDatasetStats,
} from '../db/public-repository.js';

export interface PublicAssessment {
  id: string;
  name: string;
  assessment_type: string;
  protocol_version: string;
  assessment_started_at: string;
  assessment_ended_at: string | null;
  latitude: number;
  longitude: number;
  organization: string | null;
  campaign: string | null;
  measurement_count: number;
}

export interface PublicAssessmentListResponse {
  page: number;
  limit: number;
  total: number;
  items: PublicAssessment[];
}

export interface PublicDatasetStats {
  total_assessments: number;
  total_measurements: number;
  earliest_assessment: string | null;
  latest_assessment: string | null;
  protocol_versions: string[];
}

export function isPublicPseudonymizationEnabled(): boolean {
  const value = process.env.PUBLIC_PSEUDONYMIZE_NAMES?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function pseudonymizeAssessmentName(name: string): string {
  if (!isPublicPseudonymizationEnabled()) {
    return name;
  }

  const hash = createHash('sha256').update(name).digest('hex').slice(0, 8);
  const prefix = name.trim().slice(0, 4) || 'rec';
  return `${prefix}…-${hash}`;
}

function toPublicAssessment(row: PublicAssessmentRow): PublicAssessment {
  return {
    id: row.id,
    name: pseudonymizeAssessmentName(row.name),
    assessment_type: row.assessment_type,
    protocol_version: row.protocol_version,
    assessment_started_at: row.assessment_started_at,
    assessment_ended_at: row.assessment_ended_at,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    organization: row.organization,
    campaign: row.campaign,
    measurement_count: Number(row.measurement_count),
  };
}

export function parseBbox(raw: string | undefined): PublicAssessmentFilters['bbox'] {
  if (!raw?.trim()) {
    return undefined;
  }

  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new Error('bbox must be minLat,minLon,maxLat,maxLon');
  }

  const [minLat, minLon, maxLat, maxLon] = parts;
  return { minLat, minLon, maxLat, maxLon };
}

export async function getPublicAssessments(
  filters: PublicAssessmentFilters,
): Promise<PublicAssessmentListResponse> {
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const { rows, total } = await listPublicAssessments({ ...filters, page, limit });

  return {
    page,
    limit,
    total,
    items: rows.map(toPublicAssessment),
  };
}

export async function getPublicStats(): Promise<PublicDatasetStats> {
  return getPublicDatasetStats();
}

export async function* iteratePublicExportRows(
  filters: PublicAssessmentFilters,
): AsyncGenerator<Record<string, string | number | null>> {
  for await (const row of streamPublicExportRows(filters)) {
    yield {
      assessment_id: row.assessment_id,
      assessment_name: pseudonymizeAssessmentName(row.assessment_name),
      assessment_type: row.assessment_type,
      protocol_version: row.protocol_version,
      assessment_started_at: row.assessment_started_at,
      assessment_ended_at: row.assessment_ended_at,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      organization: row.organization,
      campaign: row.campaign,
      measurement_id: row.measurement_id,
      measurement_type: row.measurement_type,
      recorded_at: row.recorded_at,
      value: typeof row.value === 'object' ? JSON.stringify(row.value) : row.value,
      unit: row.unit,
      method: row.method,
    };
  }
}

export const PUBLIC_EXPORT_COLUMNS = [
  'assessment_id',
  'assessment_name',
  'assessment_type',
  'protocol_version',
  'assessment_started_at',
  'assessment_ended_at',
  'latitude',
  'longitude',
  'organization',
  'campaign',
  'measurement_id',
  'measurement_type',
  'recorded_at',
  'value',
  'unit',
  'method',
] as const;

function escapeCsvValue(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function formatCsvRow(values: Array<string | number | null>): string {
  return `${values.map(escapeCsvValue).join(',')}\n`;
}
