import { describe, expect, it } from 'vitest';
import { getActiveNavId, getDefaultPageTitle } from './nav-config.js';

describe('nav-config', () => {
  it('maps routes to active nav items', () => {
    expect(getActiveNavId('/')).toBe('assessments');
    expect(getActiveNavId('/assessments/new')).toBe('new');
    expect(getActiveNavId('/assessments/abc-123')).toBe('assessments');
    expect(getActiveNavId('/sync')).toBe('sync');
    expect(getActiveNavId('/settings')).toBe('settings');
  });

  it('provides default page titles', () => {
    expect(getDefaultPageTitle('/')).toBe('Assessments');
    expect(getDefaultPageTitle('/assessments/new')).toBe('New Assessment');
    expect(getDefaultPageTitle('/assessments/abc')).toBe('Assessment');
    expect(getDefaultPageTitle('/sync')).toBe('Sync');
    expect(getDefaultPageTitle('/settings')).toBe('Settings');
  });
});
