import { existsSync } from 'node:fs';
import { captureTerraform, requireArg } from './terraform-lib.js';

const environment = requireArg(2, 'staging or production');
const rootDir = `infra/terraform/environments/${environment}`;

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

const healthUrl = `${apiUrl}/`;
const response = await fetch(healthUrl);

if (!response.ok) {
  console.error(`Health check failed: ${healthUrl} returned ${response.status}`);
  process.exit(1);
}

console.log(`ECS Express health check passed at ${healthUrl}`);
if (fieldUrl) {
  console.log(
    `CloudFront field URL: ${fieldUrl} (same-origin /v1 after app deploy publishes /v1/health)`,
  );
}
