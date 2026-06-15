import { describe, expect, it } from 'vitest';
import { getBackoffDelayMs, hasExceededMaxAttempts, isReadyForRetry } from './backoff.js';
import type { SyncQueueEntry } from '../db/types.js';

function createEntry(overrides: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    id: 'queue-1',
    entity_type: 'assessment',
    entity_id: 'assessment-1',
    operation: 'upsert',
    payload: {} as SyncQueueEntry['payload'],
    status: 'pending',
    attempts: 0,
    created_at: '2026-03-15T14:00:00.000Z',
    updated_at: '2026-03-15T14:00:00.000Z',
    ...overrides,
  };
}

describe('sync backoff', () => {
  it('calculates exponential backoff delays', () => {
    expect(getBackoffDelayMs(1)).toBe(1_000);
    expect(getBackoffDelayMs(2)).toBe(2_000);
    expect(getBackoffDelayMs(3)).toBe(4_000);
  });

  it('allows pending entries to sync immediately', () => {
    expect(isReadyForRetry(createEntry({ status: 'pending' }))).toBe(true);
  });

  it('waits for backoff before retrying error entries', () => {
    const updatedAt = Date.parse('2026-03-15T14:00:00.000Z');
    const entry = createEntry({
      status: 'error',
      attempts: 2,
      updated_at: '2026-03-15T14:00:00.000Z',
    });

    expect(isReadyForRetry(entry, updatedAt + 1_000)).toBe(false);
    expect(isReadyForRetry(entry, updatedAt + 2_000)).toBe(true);
  });

  it('stops retrying after max attempts', () => {
    const entry = createEntry({ status: 'error', attempts: 5 });
    expect(hasExceededMaxAttempts(entry)).toBe(true);
    expect(isReadyForRetry(entry)).toBe(false);
  });
});
