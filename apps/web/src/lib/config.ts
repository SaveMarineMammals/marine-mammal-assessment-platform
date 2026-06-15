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

export function getFieldAppUrl(): string {
  return import.meta.env.VITE_FIELD_APP_URL?.trim() || 'http://localhost:5174';
}

export function getGithubUrl(): string {
  return (
    import.meta.env.VITE_GITHUB_URL?.trim() ||
    'https://github.com/mmap-team/marine-mammal-assessment'
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
}

export interface PublicMeta {
  license: string;
  pseudonymization_enabled: boolean;
  docs: string;
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

async function assertOk(response: Response, label: string): Promise<void> {
  if (response.ok) {
    return;
  }
  if (response.status === 404) {
    throw new Error(
      `${label} not found (404). Rebuild the API container: docker compose up -d --build api`,
    );
  }
  throw new Error(`Failed to load ${label} (${response.status})`);
}

export async function fetchPublicStats(): Promise<PublicDatasetStats> {
  const response = await fetch(apiUrl('/v1/public/stats'));
  await assertOk(response, 'dataset stats');
  return response.json() as Promise<PublicDatasetStats>;
}

export async function fetchPublicAssessments(
  page = 1,
  limit = 10,
): Promise<PublicAssessmentListResponse> {
  const response = await fetch(apiUrl(`/v1/public/assessments?page=${page}&limit=${limit}`));
  await assertOk(response, 'assessments');
  return response.json() as Promise<PublicAssessmentListResponse>;
}

export async function fetchPublicMeta(): Promise<PublicMeta> {
  const response = await fetch(apiUrl('/v1/public/meta'));
  await assertOk(response, 'public metadata');
  return response.json() as Promise<PublicMeta>;
}

export function getExportUrl(format: 'csv' | 'jsonl'): string {
  return apiUrl(`/v1/public/assessments/export?format=${format}`);
}

export function getOpenApiUrl(): string {
  const base = getApiBaseUrl();
  // Dev/preview proxy exposes API Swagger at /openapi (see vite.config.ts).
  return base ? `${base}/docs` : '/openapi';
}
