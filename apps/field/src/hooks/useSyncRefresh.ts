import { useEffect } from 'react';
import { subscribeSync } from '../sync/sync-worker.js';

/** Re-run `refresh` whenever a sync batch finishes (manual, periodic, or online). */
export function useSyncRefresh(refresh: () => void | Promise<void>): void {
  useEffect(() => {
    return subscribeSync(() => {
      Promise.resolve(refresh()).catch(() => undefined);
    });
  }, [refresh]);
}
