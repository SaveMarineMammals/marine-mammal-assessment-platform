import { SYNC_INTERVAL_MS } from '../config.js';
import {
  checkApiReachability,
  getApiReachable,
  startApiConnectivityMonitor,
} from './api-connectivity.js';
import { runSync, retryFailedSyncEntries } from './sync-service.js';
import type { SyncRunResult } from './types.js';

type SyncListener = (result: SyncRunResult) => void;

let syncing = false;
let intervalId: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<SyncListener>();

function notifyListeners(result: SyncRunResult): void {
  for (const listener of listeners) {
    listener(result);
  }
}

export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isSyncInProgress(): boolean {
  return syncing;
}

export async function triggerSync(options: { force?: boolean } = {}): Promise<SyncRunResult> {
  if (syncing) {
    return { attempted: 0, synced: 0, failed: 0, skipped: 0, error: 'Sync already in progress' };
  }

  syncing = true;
  try {
    const result = await runSync(undefined, options);
    notifyListeners(result);
    return result;
  } finally {
    syncing = false;
  }
}

export async function triggerRetryFailed(): Promise<SyncRunResult> {
  await retryFailedSyncEntries();
  return triggerSync({ force: true });
}

export function startSyncWorker(): () => void {
  const stopConnectivityMonitor = startApiConnectivityMonitor();

  const handleOnline = () => {
    checkApiReachability()
      .then((reachable) => {
        if (reachable) {
          triggerSync().catch(() => undefined);
        }
      })
      .catch(() => undefined);
  };

  window.addEventListener('online', handleOnline);
  intervalId = setInterval(() => {
    if (getApiReachable()) {
      triggerSync().catch(() => undefined);
    }
  }, SYNC_INTERVAL_MS);

  if (getApiReachable()) {
    triggerSync().catch(() => undefined);
  }

  return () => {
    stopConnectivityMonitor();
    window.removeEventListener('online', handleOnline);
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };
}
