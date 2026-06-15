import { useEffect, useState } from 'react';
import { getPendingSyncCount, getSyncErrorCount } from '../data/repository.js';
import { subscribeSync } from '../sync/sync-worker.js';

export function usePendingSyncCount(refreshKey = 0): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const pending = await getPendingSyncCount();
        if (!cancelled) {
          setCount(pending);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
        }
      }
    }

    refresh().catch(() => undefined);
    const unsubscribe = subscribeSync(() => {
      refresh().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshKey]);

  return count;
}

export function useSyncErrorCount(refreshKey = 0): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const errors = await getSyncErrorCount();
        if (!cancelled) {
          setCount(errors);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
        }
      }
    }

    refresh().catch(() => undefined);
    const unsubscribe = subscribeSync(() => {
      refresh().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshKey]);

  return count;
}
