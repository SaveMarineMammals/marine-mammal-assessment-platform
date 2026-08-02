import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';
import { DATABASE_URL_USAGE, normalizeDatabaseUrl } from '../cli/database-url.js';

let pool: Pool | null = null;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(`DATABASE_URL is not configured. ${DATABASE_URL_USAGE}`);
  }
  return normalizeDatabaseUrl(url);
}

/** Build `pg` pool options; RDS URLs encrypt without requiring the Amazon CA bundle in-image. */
export function buildPoolConfig(connectionString: string = getDatabaseUrl()): PoolConfig {
  const wantsTls =
    /[?&]sslmode=require\b/i.test(connectionString) ||
    /\.rds\.amazonaws\.com\b/i.test(connectionString);

  return {
    connectionString,
    ...(wantsTls ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}
