import { existsSync } from 'node:fs';
import { captureTerraform, requireArg } from './terraform-lib.js';

const environment = requireArg(2, 'staging or production');
const rootDir = `infra/terraform/environments/${environment}`;

if (!existsSync(rootDir)) {
  console.error(`Unknown environment: ${environment}`);
  process.exit(1);
}

const apiUrl = captureTerraform(['output', '-raw', 'api_service_url'], { cwd: rootDir });
const fieldUrl = captureTerraform(['output', '-raw', 'field_url'], { cwd: rootDir });

console.log(`API service URL: ${apiUrl}`);
console.log(`Field URL: ${fieldUrl}`);

const healthUrl = `${apiUrl.replace(/\/$/, '')}/`;
const response = await fetch(healthUrl);

if (!response.ok) {
  console.error(`Health check failed: ${healthUrl} returned ${response.status}`);
  process.exit(1);
}

console.log(`App Runner placeholder health check passed at ${healthUrl}`);
console.log(`CloudFront field URL: ${fieldUrl} (available after app deploy publishes /v1/health)`);
