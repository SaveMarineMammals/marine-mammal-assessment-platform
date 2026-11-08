export function getApiBaseUrl(): string {
  const configured =
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (typeof process !== 'undefined' ? process.env.VITE_API_BASE_URL?.trim() : undefined);
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  // Same-origin requests are proxied to the API in dev/preview (see vite.config.ts).
  return '';
}

export function getDatasetBaseUrl(): string {
  const configured = import.meta.env.VITE_DATASET_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  // Production: CloudFront serves S3 snapshots at /dataset/latest/*.
  // Local docker/dev: fall back to live API public routes when snapshots are absent.
  return '';
}

export function getFieldAppUrl(): string {
  return import.meta.env.VITE_FIELD_APP_URL?.trim() || '/field/app/';
}

export function getGithubUrl(): string {
  return (
    import.meta.env.VITE_GITHUB_URL?.trim() ||
    'https://github.com/SaveMarineMammals/marine-mammal-assessment-platform'
  );
}

export function getDocsUrl(path = ''): string {
  const base = import.meta.env.VITE_WEB_BASE_URL?.trim() || '';
  return `${base}${path}`;
}

export interface PublicDatasetStats {
  total_assessments: number;
  total_measurements: number;
  earliest_assessment: string | null;
  latest_assessment: string | null;
  protocol_versions: string[];
  generated_at?: string;
}

export interface PublicAssessmentListResponse {
  page: number;
  limit: number;
  total: number;
  items: Array<{
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
  }>;
  generated_at?: string;
}

export interface PublicMeta {
  license: string;
  pseudonymization_enabled: boolean;
  docs: string;
  generated_at?: string;
  source?: string;
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

function datasetUrl(path: string): string {
  const base = getDatasetBaseUrl();
  return base ? `${base}${path}` : path;
}

async function assertOk(response: Response, label: string): Promise<void> {
  if (response.ok) {
    return;
  }
  if (response.status === 404) {
    throw new Error(
      `${label} not found (404). If using snapshots, wait for the daily export or trigger dataset-export on the API Lambda.`,
    );
  }
  throw new Error(`Failed to load ${label} (${response.status})`);
}

async function fetchJsonPreferSnapshot<T>(
  snapshotPath: string,
  livePath: string,
  label: string,
): Promise<T> {
  const snapshotResponse = await fetch(datasetUrl(snapshotPath));
  if (snapshotResponse.ok) {
    return snapshotResponse.json() as Promise<T>;
  }
  const liveResponse = await fetch(apiUrl(livePath));
  await assertOk(liveResponse, label);
  return liveResponse.json() as Promise<T>;
}

export async function fetchPublicStats(): Promise<PublicDatasetStats> {
  return fetchJsonPreferSnapshot('/dataset/latest/stats.json', '/v1/public/stats', 'dataset stats');
}

export async function fetchPublicAssessments(
  page = 1,
  limit = 10,
): Promise<PublicAssessmentListResponse> {
  const snapshot = await fetch(datasetUrl('/dataset/latest/assessments.json'));
  if (snapshot.ok) {
    const body = (await snapshot.json()) as PublicAssessmentListResponse;
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const start = (safePage - 1) * safeLimit;
    return {
      page: safePage,
      limit: safeLimit,
      total: body.total ?? body.items?.length ?? 0,
      items: (body.items ?? []).slice(start, start + safeLimit),
      generated_at: body.generated_at,
    };
  }

  const response = await fetch(apiUrl(`/v1/public/assessments?page=${page}&limit=${limit}`));
  await assertOk(response, 'assessments');
  return response.json() as Promise<PublicAssessmentListResponse>;
}

export async function fetchPublicMeta(): Promise<PublicMeta> {
  return fetchJsonPreferSnapshot('/dataset/latest/meta.json', '/v1/public/meta', 'public metadata');
}

export function getExportUrl(format: 'csv' | 'jsonl'): string {
  const extension = format === 'csv' ? 'csv' : 'jsonl';
  return datasetUrl(`/dataset/latest/assessments.${extension}`);
}

export function getOpenApiUrl(): string {
  const base = getApiBaseUrl();
  // Same-origin /api/docs is proxied to the API (vite/nginx/CloudFront).
  return base ? `${base}/api/docs` : '/api/docs';
}
