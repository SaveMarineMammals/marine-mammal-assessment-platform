import { describe, expect, it } from 'vitest';
import { MANATEE_V1_PROTOCOL, getProtocolVersion } from '@mmap/schema/manatee_v1';
import { APP_VERSION, isSemverVersion } from './lib/version.js';

describe('@mmap/field', () => {
  it('loads shared schema package for field models', () => {
    expect(getProtocolVersion(MANATEE_V1_PROTOCOL)).toBe('1.0.0');
  });

  it('exposes a semver-compatible build version', () => {
    expect(isSemverVersion(APP_VERSION)).toBe(true);
    expect(APP_VERSION).toMatch(/\+/);
  });
});
