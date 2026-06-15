const DATABASE_URL_FLAGS = new Set(['--database-url', '-d']);

export const DATABASE_URL_USAGE =
  'Set DATABASE_URL in the environment, or pass --database-url <url> (or -d <url>).';

export function parseDatabaseUrlFromArgs(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (DATABASE_URL_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`${arg} requires a connection URL. ${DATABASE_URL_USAGE}`);
      }
      return value;
    }

    if (arg.startsWith('--database-url=')) {
      const value = arg.slice('--database-url='.length);
      if (!value) {
        throw new Error(`--database-url requires a connection URL. ${DATABASE_URL_USAGE}`);
      }
      return value;
    }
  }

  return undefined;
}

/** Apply --database-url / -d from argv, then return the resolved connection string. */
export function resolveDatabaseUrl(argv: string[] = process.argv): string {
  const fromArg = parseDatabaseUrlFromArgs(argv);
  if (fromArg) {
    process.env.DATABASE_URL = fromArg;
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(`DATABASE_URL is not configured. ${DATABASE_URL_USAGE}`);
  }

  return url;
}
