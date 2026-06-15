import { query, queryOne } from './pool.js';

export interface PublicAssessmentFilters {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  bbox?: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  };
}

export interface PublicAssessmentRow {
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

export interface PublicExportRow {
  assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  protocol_version: string;
  assessment_started_at: string;
  assessment_ended_at: string | null;
  latitude: number;
  longitude: number;
  organization: string | null;
  campaign: string | null;
  measurement_id: string | null;
  measurement_type: string | null;
  recorded_at: string | null;
  value: number | { systolic: number; diastolic: number } | null;
  unit: string | null;
  method: string | null;
}

function buildFilterClause(filters: PublicAssessmentFilters): {
  clause: string;
  params: unknown[];
} {
  const conditions: string[] = ["a.sync_status = 'synced'"];
  const params: unknown[] = [];

  if (filters.from) {
    params.push(filters.from);
    conditions.push(`a.assessment_started_at >= $${params.length}`);
  }

  if (filters.to) {
    params.push(filters.to);
    conditions.push(`a.assessment_started_at <= $${params.length}`);
  }

  if (filters.bbox) {
    params.push(filters.bbox.minLon, filters.bbox.minLat, filters.bbox.maxLon, filters.bbox.maxLat);
    conditions.push(
      `ST_Intersects(a.location, ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326)::geography)`,
    );
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export async function listPublicAssessments(
  filters: PublicAssessmentFilters,
): Promise<{ rows: PublicAssessmentRow[]; total: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;
  const { clause, params } = buildFilterClause(filters);

  const totalRow = await queryOne<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM assessments a
      ${clause}
    `,
    params,
  );

  const rows = await query<PublicAssessmentRow>(
    `
      SELECT
        a.id,
        a.name,
        a.assessment_type,
        a.protocol_version,
        a.assessment_started_at,
        a.assessment_ended_at,
        ST_Y(a.location::geometry) AS latitude,
        ST_X(a.location::geometry) AS longitude,
        a.organization,
        a.campaign,
        COUNT(m.id)::int AS measurement_count
      FROM assessments a
      LEFT JOIN measurements m ON m.assessment_id = a.id
      ${clause}
      GROUP BY a.id
      ORDER BY a.assessment_started_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, limit, offset],
  );

  return {
    rows,
    total: Number(totalRow?.count ?? 0),
  };
}

export async function getPublicDatasetStats(): Promise<{
  total_assessments: number;
  total_measurements: number;
  earliest_assessment: string | null;
  latest_assessment: string | null;
  protocol_versions: string[];
}> {
  const summary = await queryOne<{
    total_assessments: string;
    total_measurements: string;
    earliest_assessment: string | null;
    latest_assessment: string | null;
  }>(
    `
      SELECT
        (SELECT COUNT(*)::text FROM assessments WHERE sync_status = 'synced') AS total_assessments,
        (SELECT COUNT(*)::text FROM measurements) AS total_measurements,
        (SELECT MIN(assessment_started_at) FROM assessments WHERE sync_status = 'synced') AS earliest_assessment,
        (SELECT MAX(assessment_started_at) FROM assessments WHERE sync_status = 'synced') AS latest_assessment
    `,
  );

  const versions = await query<{ protocol_version: string }>(
    `
      SELECT DISTINCT protocol_version
      FROM assessments
      WHERE sync_status = 'synced'
      ORDER BY protocol_version ASC
    `,
  );

  return {
    total_assessments: Number(summary?.total_assessments ?? 0),
    total_measurements: Number(summary?.total_measurements ?? 0),
    earliest_assessment: summary?.earliest_assessment ?? null,
    latest_assessment: summary?.latest_assessment ?? null,
    protocol_versions: versions.map((row) => row.protocol_version),
  };
}

export async function* streamPublicExportRows(
  filters: PublicAssessmentFilters,
): AsyncGenerator<PublicExportRow> {
  const { clause, params } = buildFilterClause(filters);
  const batchSize = 500;
  let offset = 0;

  while (true) {
    const rows = await query<PublicExportRow>(
      `
        SELECT
          a.id AS assessment_id,
          a.name AS assessment_name,
          a.assessment_type,
          a.protocol_version,
          a.assessment_started_at,
          a.assessment_ended_at,
          ST_Y(a.location::geometry) AS latitude,
          ST_X(a.location::geometry) AS longitude,
          a.organization,
          a.campaign,
          m.id AS measurement_id,
          m.measurement_type,
          m.recorded_at,
          m.value,
          m.unit,
          m.method
        FROM assessments a
        LEFT JOIN measurements m ON m.assessment_id = a.id
        ${clause}
        ORDER BY a.assessment_started_at DESC, m.recorded_at ASC NULLS LAST
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, batchSize, offset],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      yield row;
    }

    if (rows.length < batchSize) {
      break;
    }

    offset += batchSize;
  }
}
