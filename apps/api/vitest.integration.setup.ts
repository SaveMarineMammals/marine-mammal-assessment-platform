import { resolveDatabaseUrl } from './src/cli/database-url.js';

process.env.API_ADMIN_TOKEN ??= 'dev-admin-token';

try {
  resolveDatabaseUrl();
} catch {
  // Integration tests skip when no database URL is configured.
}
