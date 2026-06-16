import { API_HEALTH_CHECK_MS, API_HEALTH_CHECK_TIMEOUT_MS, getSyncApiUrl } from '../config.js';

type ApiConnectivityListener = (reachable: boolean) => void;

let apiReachable = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set<ApiConnectivityListener>();

function isDeviceOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function notifyListeners(reachable: boolean): void {
  for (const listener of listeners) {
    listener(reachable);
  }
}

export function getApiReachable(): boolean {
  if (!isDeviceOnline()) {
    return false;
  }
  return apiReachable;
}

export function markApiReachable(reachable: boolean): void {
  const next = isDeviceOnline() ? reachable : false;
  if (apiReachable === next) {
    return;
  }
  apiReachable = next;
  notifyListeners(next);
}

export function subscribeApiConnectivity(listener: ApiConnectivityListener): () => void {
  listeners.add(listener);
  listener(getApiReachable());
  return () => {
    listeners.delete(listener);
  };
}

export async function checkApiReachability(): Promise<boolean> {
  if (!isDeviceOnline()) {
    markApiReachable(false);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_HEALTH_CHECK_TIMEOUT_MS);
    const response = await fetch(getSyncApiUrl('/v1/health'), {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    window.clearTimeout(timeoutId);
    markApiReachable(response.ok);
    return response.ok;
  } catch {
    markApiReachable(false);
    return false;
  }
}

export function startApiConnectivityMonitor(): () => void {
  const handleDeviceOffline = () => markApiReachable(false);
  const handleDeviceOnline = () => {
    checkApiReachability().catch(() => undefined);
  };

  window.addEventListener('offline', handleDeviceOffline);
  window.addEventListener('online', handleDeviceOnline);

  checkApiReachability().catch(() => undefined);

  const intervalId = window.setInterval(() => {
    if (isDeviceOnline()) {
      checkApiReachability().catch(() => undefined);
    }
  }, API_HEALTH_CHECK_MS);

  return () => {
    window.removeEventListener('offline', handleDeviceOffline);
    window.removeEventListener('online', handleDeviceOnline);
    window.clearInterval(intervalId);
  };
}

/** Reset module state between tests. */
export function resetApiConnectivityForTests(): void {
  apiReachable = isDeviceOnline();
  listeners.clear();
}
