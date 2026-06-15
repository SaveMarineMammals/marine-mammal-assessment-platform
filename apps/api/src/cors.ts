/** Comma-separated allowed browser origins, or `*` for any origin. */
export function getCorsOrigins(): string | string[] | boolean {
  const configured = process.env.CORS_ORIGIN?.trim();

  if (configured === '*') {
    return true;
  }

  if (configured) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];
}
