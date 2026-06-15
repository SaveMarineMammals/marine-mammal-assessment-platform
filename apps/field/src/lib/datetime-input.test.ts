import { describe, expect, it } from 'vitest';
import { datetimeLocalValueToUtc, utcToDatetimeLocalValue } from './datetime-input.js';

describe('datetime-input helpers', () => {
  it('round-trips through datetime-local values in local timezone', () => {
    const utc = '2026-03-15T14:22:00.000Z';
    const localValue = utcToDatetimeLocalValue(utc);
    expect(datetimeLocalValueToUtc(localValue)).toBe(utc);
  });

  it('throws for invalid datetime-local values', () => {
    expect(() => datetimeLocalValueToUtc('')).toThrow('Datetime is required');
    expect(() => datetimeLocalValueToUtc('invalid')).toThrow('Invalid datetime');
  });
});
