import { existsSync } from 'node:fs';
import { captureTerraform, requireArg } from './terraform-lib.js';

const environment = requireArg(2, 'staging or production');
const rootDir = `infra/terraform/environments/${environment}`;

if (!existsSync(rootDir)) {
  console.error(`Unknown environment: ${environment}`);
  process.exit(1);
}

const apiUrl = captureTerraform(['output', '-raw', 'api_service_url'], { cwd: rootDir });
const enableCdn = captureTerraform(['output', '-raw', 'enable_cdn'], { cwd: rootDir });
const fieldUrl =
  enableCdn === 'true' ? captureTerraform(['output', '-raw', 'field_url'], { cwd: rootDir }) : '';

console.log(`API service URL: ${apiUrl}`);
console.log(`enable_cdn: ${enableCdn}`);
if (fieldUrl) {
  console.log(`Field URL: ${fieldUrl}`);
} else {
  console.log('Field URL: (CloudFront disabled — use API service URL for live tests)');
}

const healthUrl = `${apiUrl.replace(/\/$/, '')}/`;
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
