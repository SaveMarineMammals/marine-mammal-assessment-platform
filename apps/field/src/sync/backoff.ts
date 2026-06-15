import { MAX_SYNC_ATTEMPTS, SYNC_BACKOFF_BASE_MS } from '../config.js';
import type { SyncQueueEntry } from '../db/types.js';

export function getBackoffDelayMs(attempts: number): number {
  if (attempts <= 0) {
    return 0;
  }
  return SYNC_BACKOFF_BASE_MS * 2 ** (attempts - 1);
}

export function isReadyForRetry(entry: SyncQueueEntry, now = Date.now()): boolean {
  if (entry.status === 'pending') {
    return true;
  }

  if (entry.status !== 'error' || entry.attempts >= MAX_SYNC_ATTEMPTS) {
    return false;
  }

  const elapsed = now - new Date(entry.updated_at).getTime();
  return elapsed >= getBackoffDelayMs(entry.attempts);
}

export function hasExceededMaxAttempts(entry: SyncQueueEntry): boolean {
  return entry.attempts >= MAX_SYNC_ATTEMPTS;
}
