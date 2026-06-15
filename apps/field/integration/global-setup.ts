import type { FastifyInstance } from 'fastify';
import { resolveDatabaseUrl } from '../../api/src/cli/database-url.js';
import { createApp } from '../../api/src/app.js';
import { runMigrations } from '../../api/src/db/migrate.js';
import { closePool, getPool } from '../../api/src/db/pool.js';

const TEST_API_HOST = '127.0.0.1';
const TEST_API_PORT = 3099;

let app: FastifyInstance | undefined;

export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
  try {
    resolveDatabaseUrl();
    await getPool().query('SELECT 1');
    await runMigrations();
  } catch {
    process.env.SYNC_INTEGRATION_READY = 'false';
    return;
  }

  app = await createApp({ enableAdminRoutes: false });
  await app.listen({ port: TEST_API_PORT, host: TEST_API_HOST });
  process.env.VITE_API_BASE_URL = `http://${TEST_API_HOST}:${TEST_API_PORT}`;
  process.env.SYNC_INTEGRATION_READY = 'true';

  return async () => {
    await app?.close();
    await closePool();
  };
}
