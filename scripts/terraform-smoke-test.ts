import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { captureTerraform, requireArg } from './terraform-lib.js';

const environment = requireArg(2, 'staging or production');
const rootDir = `infra/terraform/environments/${environment}`;

/** Total wait ≈ 2 minutes for post-resume / post-apply task registration. */
const MAX_ATTEMPTS = 12;
const RETRY_DELAY_MS = 10_000;

if (!existsSync(rootDir)) {
  console.error(`Unknown environment: ${environment}`);
  process.exit(1);
}

const apiUrlRaw = captureTerraform(['output', '-raw', 'api_service_url'], { cwd: rootDir });
const enableCdn = captureTerraform(['output', '-raw', 'enable_cdn'], { cwd: rootDir });
const fieldUrl =
  enableCdn === 'true' ? captureTerraform(['output', '-raw', 'field_url'], { cwd: rootDir }) : '';

/** Express ingress endpoints are full URLs; older module output double-prefixed https://. */
function normalizeHttpsUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '').replace(/^https?:\/\//i, '');
  return `https://${withoutScheme}`;
}

const apiUrl = normalizeHttpsUrl(apiUrlRaw);

console.log(`API service URL: ${apiUrl}`);
console.log(`enable_cdn: ${enableCdn}`);
if (fieldUrl) {
  console.log(`Field URL: ${fieldUrl}`);
} else {
  console.log('Field URL: (CloudFront disabled — use API service URL for live tests)');
}

/** Real API uses /v1/health; nginx placeholder serves /. */
const healthPaths = ['/v1/health', '/'] as const;

async function probe(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: message };
  }
}

let passedUrl: string | undefined;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  for (const path of healthPaths) {
    const url = `${apiUrl}${path}`;
    const result = await probe(url);
    if (result.ok) {
      passedUrl = url;
      break;
    }
    const detail = result.error ?? `HTTP ${result.status}`;
    console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}: ${url} → ${detail}`);
  }

  if (passedUrl) {
    break;
  }

  if (attempt < MAX_ATTEMPTS) {
    await delay(RETRY_DELAY_MS);
  }
}

if (!passedUrl) {
  console.error(`Health check failed after ${MAX_ATTEMPTS} attempts against ${apiUrl}`);
  console.error('ALB 503 usually means no healthy tasks (hibernated or stuck deployment).');
  if (environment === 'staging') {
    console.error('  pnpm exec tsx scripts/staging-hibernate.ts status');
    console.error('  pnpm exec tsx scripts/staging-hibernate.ts resume');
  }
  console.error(
    '  pnpm exec tsx scripts/ecs-express-diagnose.ts mmap-staging-api ACCOUNT_ID us-east-1',
  );
  process.exit(1);
}

console.log(`ECS Express health check passed at ${passedUrl}`);
if (fieldUrl) {
  console.log(
    `CloudFront field URL: ${fieldUrl} (same-origin /v1 after app deploy publishes /v1/health)`,
  );
}
