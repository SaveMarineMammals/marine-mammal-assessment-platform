export function getApiBaseUrl(): string {
  const configured =
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (typeof process !== 'undefined' ? process.env.VITE_API_BASE_URL?.trim() : undefined);
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  // Same-origin requests are proxied to the API in dev/preview and Docker (see vite.config.ts / nginx.conf).
  return '';
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

export function getSyncApiUrl(path: string): string {
  return apiUrl(path);
}

export const SYNC_INTERVAL_MS = 60_000;
export const MAX_SYNC_ATTEMPTS = 5;
export const SYNC_BACKOFF_BASE_MS = 1_000;

export function getDocsUrl(): string {
  // Prefer the in-app guide at /help/protocol. This URL is only for optional external links.
  const configured = import.meta.env.VITE_DOCS_URL?.trim();
  if (configured?.startsWith('http')) {
    return configured;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5173/docs/manatee-v1`;
  }
  return 'http://localhost:5173/docs/manatee-v1';
}

export function getApiBaseUrlDisplay(): string {
  const base = getApiBaseUrl();
  return base || 'same origin (/v1 proxied to API)';
}
