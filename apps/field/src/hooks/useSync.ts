import { useCallback, useEffect, useState } from 'react';
import {
  isSyncInProgress,
  subscribeSync,
  triggerRetryFailed,
  triggerSync,
} from '../sync/sync-worker.js';
import type { SyncRunResult } from '../sync/types.js';

export function useSync(refreshKey = 0): {
  isSyncing: boolean;
  lastResult: SyncRunResult | null;
  syncNow: () => Promise<SyncRunResult>;
  retryFailed: () => Promise<SyncRunResult>;
} {
  const [isSyncing, setIsSyncing] = useState(isSyncInProgress());
  const [lastResult, setLastResult] = useState<SyncRunResult | null>(null);

  useEffect(() => {
    return subscribeSync((result) => {
      setLastResult(result);
      setIsSyncing(false);
    });
  }, [refreshKey]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    const result = await triggerSync({ force: true });
    setLastResult(result);
    setIsSyncing(false);
    return result;
  }, []);

  const retryFailed = useCallback(async () => {
    setIsSyncing(true);
    const result = await triggerRetryFailed();
    setLastResult(result);
    setIsSyncing(false);
    return result;
  }, []);

  return { isSyncing, lastResult, syncNow, retryFailed };
}
