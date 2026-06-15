import { describe, expect, it } from 'vitest';
import { validateManateeAssessment } from '@mmap/schema/manatee_v1';
import { getBatchHttpStatus } from './sync-batch.js';

describe('sync batch http status', () => {
  it('returns 207 for mixed success and error results', () => {
    const status = getBatchHttpStatus([
      { entity_type: 'assessment', entity_id: 'a', status: 'synced' },
      { entity_type: 'measurement', entity_id: 'b', status: 'error', error: 'bad' },
    ]);
    expect(status).toBe(207);
  });

  it('returns 400 when all results failed', () => {
    const status = getBatchHttpStatus([
      { entity_type: 'assessment', entity_id: 'a', status: 'error', error: 'bad' },
    ]);
    expect(status).toBe(400);
  });

  it('returns 200 when all results succeeded', () => {
    const status = getBatchHttpStatus([
      { entity_type: 'assessment', entity_id: 'a', status: 'synced' },
    ]);
    expect(status).toBe(200);
  });
});

describe('sync batch validation', () => {
  it('flags invalid assessment payloads before persistence', () => {
    const validation = validateManateeAssessment({ id: 'not-a-uuid', name: '' }, { mode: 'draft' });
    expect(validation.success).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
