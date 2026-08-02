/** Returns true when the server-reported version differs from the running build. */
export function isRemoteVersionNewer(runningVersion: string, remoteVersion: string): boolean {
  return remoteVersion.length > 0 && remoteVersion !== runningVersion;
}

export interface DeployVersionManifest {
  version: string;
}

export function deployVersionUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}version.json`;
}

export async function fetchDeployVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(`${deployVersionUrl()}?ts=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as DeployVersionManifest;
    return typeof body.version === 'string' ? body.version : null;
  } catch {
    return null;
  }
}
