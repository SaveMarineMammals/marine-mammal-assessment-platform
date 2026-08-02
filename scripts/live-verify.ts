import { existsSync } from 'node:fs';
import { captureTerraform, requireArg } from './terraform-lib.js';
import {
  assertCsvContainsAssessment,
  assertCsvExportHeaders,
  assertHealthBody,
  assertMetaBody,
  assertOkStatus,
  assertStatsBody,
  assertSyncBatchAccepted,
  buildFreshSyncBatch,
  defaultFixturesDir,
  findAssessmentById,
  normalizeHttpsUrl,
  parseEnvironment,
  parseVerifyMode,
  type PublicAssessmentList,
  type VerifyMode,
} from './live-verify-lib.js';

const environment = parseEnvironment(requireArg(2, 'staging or production'));
const mode: VerifyMode = parseVerifyMode(process.argv.slice(2));
const rootDir = `infra/terraform/environments/${environment}`;
const fixturesDir = defaultFixturesDir();

if (!existsSync(rootDir)) {
  console.error(`Unknown environment directory: ${rootDir}`);
  process.exit(1);
}

if (!existsSync(fixturesDir)) {
  console.error(`Fixtures directory not found: ${fixturesDir}`);
  process.exit(1);
}

const apiUrlRaw = captureTerraform(['output', '-raw', 'api_service_url'], { cwd: rootDir });
const enableCdn = captureTerraform(['output', '-raw', 'enable_cdn'], { cwd: rootDir });
const fieldUrl =
  enableCdn === 'true' ? captureTerraform(['output', '-raw', 'field_url'], { cwd: rootDir }) : '';
const webUrl =
  enableCdn === 'true' ? captureTerraform(['output', '-raw', 'web_url'], { cwd: rootDir }) : '';

const apiUrl = normalizeHttpsUrl(apiUrlRaw);

console.log(`Live verify mode: ${mode}`);
console.log(`Environment: ${environment}`);
console.log(`API service URL: ${apiUrl}`);
console.log(`enable_cdn: ${enableCdn}`);

async function fetchJson(path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${apiUrl}${path}`);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function fetchText(path: string): Promise<{ status: number; body: string }> {
  const response = await fetch(`${apiUrl}${path}`);
  return { status: response.status, body: await response.text() };
}

async function postJson(
  path: string,
  payload: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function verifyReadPaths(): Promise<void> {
  console.log('Checking /v1/health …');
  const health = await fetchJson('/v1/health');
  assertOkStatus(health.status, 'GET /v1/health');
  assertHealthBody(health.body);

  console.log('Checking /v1/public/stats …');
  const stats = await fetchJson('/v1/public/stats');
  assertOkStatus(stats.status, 'GET /v1/public/stats');
  assertStatsBody(stats.body);

  console.log('Checking /v1/public/meta …');
  const meta = await fetchJson('/v1/public/meta');
  assertOkStatus(meta.status, 'GET /v1/public/meta');
  assertMetaBody(meta.body);

  console.log('Checking /v1/public/assessments?limit=1 …');
  const list = await fetchJson('/v1/public/assessments?limit=1');
  assertOkStatus(list.status, 'GET /v1/public/assessments');
  if (!list.body || typeof list.body !== 'object') {
    throw new Error('Assessments list response is not an object');
  }

  console.log('Checking CSV export headers …');
  const csv = await fetchText('/v1/public/assessments/export?format=csv');
  assertOkStatus(csv.status, 'GET /v1/public/assessments/export');
  assertCsvExportHeaders(csv.body);
}

async function verifyFullSync(): Promise<void> {
  const { assessmentId, payload } = buildFreshSyncBatch(fixturesDir, {
    assessmentNamePrefix: `live-verify-${environment}`,
  });

  console.log(`POST /v1/sync/batch (assessment ${assessmentId}) …`);
  const first = await postJson('/v1/sync/batch', payload);
  assertSyncBatchAccepted(first.status, first.body, 'First sync batch');
  if (first.status !== 200) {
    throw new Error(`First sync batch expected HTTP 200 for valid fixtures, got ${first.status}`);
  }

  console.log('POST /v1/sync/batch (idempotent replay) …');
  const second = await postJson('/v1/sync/batch', payload);
  assertSyncBatchAccepted(second.status, second.body, 'Idempotent sync batch');
  if (second.status !== 200) {
    throw new Error(`Idempotent sync batch expected HTTP 200, got ${second.status}`);
  }

  console.log('GET /v1/public/assessments readback …');
  const list = await fetchJson('/v1/public/assessments?limit=100');
  assertOkStatus(list.status, 'GET /v1/public/assessments (readback)');
  const parsed = list.body as PublicAssessmentList;
  const found = findAssessmentById(parsed, assessmentId);
  if (!found) {
    throw new Error(`Public assessments list does not include synced id ${assessmentId}`);
  }
  if ((found.measurement_count ?? 0) < 1) {
    throw new Error(`Synced assessment ${assessmentId} has no measurements in public list`);
  }

  console.log('GET CSV export contains synced assessment …');
  const csv = await fetchText('/v1/public/assessments/export?format=csv');
  assertOkStatus(csv.status, 'GET CSV export (readback)');
  assertCsvContainsAssessment(csv.body, assessmentId);
}

async function verifyCdnArtifacts(): Promise<void> {
  if (enableCdn !== 'true') {
    console.log('CDN disabled — skipping field/web version.json checks');
    return;
  }

  const siteOrigin = webUrl?.trim() ? normalizeHttpsUrl(webUrl) : '';
  const fieldOrigin = fieldUrl?.trim() ? normalizeHttpsUrl(fieldUrl) : '';

  if (siteOrigin) {
    const healthUrl = `${siteOrigin}/v1/health`;
    console.log(`Checking same-origin ${healthUrl} …`);
    const health = await fetch(healthUrl);
    if (!health.ok) {
      throw new Error(`Same-origin /v1/health via CDN returned HTTP ${health.status}`);
    }

    console.log(`Checking web ${siteOrigin}/ …`);
    const webRoot = await fetch(`${siteOrigin}/`);
    if (!webRoot.ok) {
      throw new Error(`Web root returned HTTP ${webRoot.status}`);
    }
  } else {
    console.log('Skipping web CDN check (URL empty)');
  }

  if (fieldOrigin) {
    const versionUrl = `${fieldOrigin}/version.json`;
    console.log(`Checking field ${versionUrl} …`);
    const response = await fetch(versionUrl);
    if (!response.ok) {
      throw new Error(`Field version.json returned HTTP ${response.status}`);
    }

    console.log(`Checking field ${fieldOrigin}/ …`);
    const fieldRoot = await fetch(`${fieldOrigin}/`);
    if (!fieldRoot.ok) {
      throw new Error(`Field PWA root returned HTTP ${fieldRoot.status}`);
    }
  } else {
    console.log('Skipping field CDN check (URL empty)');
  }
}

try {
  await verifyReadPaths();
  if (mode === 'full') {
    await verifyFullSync();
  } else {
    console.log('Smoke mode — skipping mutating sync checks');
  }
  await verifyCdnArtifacts();
  console.log(`Live verify (${mode}) passed for ${environment}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Live verify failed: ${message}`);
  process.exit(1);
}
