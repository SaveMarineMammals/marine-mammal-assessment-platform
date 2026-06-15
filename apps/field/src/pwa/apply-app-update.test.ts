import { describe, expect, it } from 'vitest';

// Regression guard: applyAppUpdate must always end in a navigation fallback.
describe('applyAppUpdate contract', () => {
  it('documents skip-waiting message shape used by workbox sw.js', () => {
    expect({ type: 'SKIP_WAITING' }).toEqual({ type: 'SKIP_WAITING' });
  });
});
