import { describe, expect, it } from 'vitest';
import { getManateeFieldGuide } from './protocol-guide.js';

describe('getManateeFieldGuide', () => {
  it('loads bundled manatee protocol markdown', () => {
    const guide = getManateeFieldGuide();
    expect(guide.title).toBe('Manatee v1 Field Guide');
    expect(guide.body).toContain('Pre-capture coordination');
  });
});
