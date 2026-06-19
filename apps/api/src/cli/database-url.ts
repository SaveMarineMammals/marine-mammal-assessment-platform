/** RDS Secrets Manager master user secret JSON shape (partial). */
export interface RdsMasterUserSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

const DATABASE_URL_FLAGS = new Set(['--database-url', '-d']);

export const DATABASE_URL_USAGE =
  'Set DATABASE_URL in the environment (PostgreSQL URL or RDS Secrets Manager JSON), or pass --database-url <url> (or -d <url>).';

function encodePostgresComponent(value: string): string {
  return encodeURIComponent(value);
}

/** Convert a PostgreSQL URL or RDS Secrets Manager JSON secret into a connection string. */
export function normalizeDatabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    return trimmed;
  }

  let parsed: RdsMasterUserSecret;
  try {
    parsed = JSON.parse(trimmed) as RdsMasterUserSecret;
  } catch {
    throw new Error('DATABASE_URL looks like JSON but could not be parsed as an RDS secret.');
  }

  if (!parsed.username || !parsed.password || !parsed.host || !parsed.dbname) {
    throw new Error('DATABASE_URL JSON is missing required RDS secret fields.');
  }

  const port = parsed.port ?? 5432;
  return `postgresql://${encodePostgresComponent(parsed.username)}:${encodePostgresComponent(parsed.password)}@${parsed.host}:${port}/${parsed.dbname}`;
}

export function parseDatabaseUrlFromArgs(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (DATABASE_URL_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`${arg} requires a connection URL. ${DATABASE_URL_USAGE}`);
      }
      return normalizeDatabaseUrl(value);
    }

    if (arg.startsWith('--database-url=')) {
      const value = arg.slice('--database-url='.length);
      if (!value) {
        throw new Error(`--database-url requires a connection URL. ${DATABASE_URL_USAGE}`);
      }
      return normalizeDatabaseUrl(value);
    }
  }

  return undefined;
}

/** Apply --database-url / -d from argv, then return the resolved connection string. */
export function resolveDatabaseUrl(argv: string[] = process.argv): string {
  const fromArg = parseDatabaseUrlFromArgs(argv);
  if (fromArg) {
    process.env.DATABASE_URL = fromArg;
    return fromArg;
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(`DATABASE_URL is not configured. ${DATABASE_URL_USAGE}`);
  }

  const normalized = normalizeDatabaseUrl(url);
  if (normalized !== url) {
    process.env.DATABASE_URL = normalized;
  }
  return normalized;
}
