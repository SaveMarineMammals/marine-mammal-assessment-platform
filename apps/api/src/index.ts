import { startServer } from './app.js';
import { runMigrations } from './db/migrate.js';
import { closePool } from './db/pool.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

async function main() {
  if (process.env.DATABASE_URL) {
    await runMigrations();
  }

  await startServer({ port, host });
}

main().catch(async (error: unknown) => {
  console.error(error);
  await closePool();
  process.exit(1);
});

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
