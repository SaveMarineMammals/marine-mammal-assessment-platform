import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';

function resolveMigrationsDir(): string {
  const fromEnv = process.env.MIGRATIONS_DIR?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.env.LAMBDA_TASK_ROOT?.trim()) {
    return join(process.env.LAMBDA_TASK_ROOT.trim(), 'migrations');
  }
  return join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(resolveMigrationsDir())
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [
      filename,
    ]);
    if (applied.rowCount && applied.rowCount > 0) {
      continue;
    }

    const sql = readFileSync(join(resolveMigrationsDir(), filename), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
  }
}
