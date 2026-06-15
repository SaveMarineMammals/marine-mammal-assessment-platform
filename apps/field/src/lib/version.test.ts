import { describe, expect, it } from 'vitest';
import { isSemverVersion } from '../lib/version.js';

describe('generate-build-version format', () => {
  it('accepts production-style build metadata', () => {
    expect(isSemverVersion('0.0.0+a1b2c3d.20250614.230912')).toBe(true);
  });

  it('accepts dev build metadata', () => {
    expect(isSemverVersion('0.0.0+dev.20250614.230912')).toBe(true);
  });
});
