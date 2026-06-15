import { resolveDatabaseUrl } from '../src/cli/database-url.js';
import { runMigrations } from '../src/db/migrate.js';
import { closePool } from '../src/db/pool.js';

resolveDatabaseUrl();

await runMigrations();
await closePool();
console.log('Migrations applied.');
