import { describe, expect, it } from 'vitest';
import { getContentPage } from './lib/content.js';

describe('@mmap/web', () => {
  it('loads home content from markdown', () => {
    const page = getContentPage('home');
    expect(page.title).toBe('Marine Mammal Assessment Platform');
    expect(page.body).toContain('Belize manatee assessment');
  });
});
