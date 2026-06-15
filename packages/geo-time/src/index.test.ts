import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatLocalTime,
  formatLocalTimeFromTimezone,
  formatLocalTimeShort,
  formatUtcLabel,
  getTimezoneFromCoordinates,
  InvalidCoordinatesError,
  isValidCoordinates,
  parseUtc,
  toUtcIso,
} from './index.js';

const BELIZE_LAT = 17.5043;
const BELIZE_LON = -88.1962;
const SAMPLE_UTC = '2026-03-15T14:22:00.000Z';

describe('UTC helpers', () => {
  it('round-trips UTC ISO strings', () => {
    expect(toUtcIso(parseUtc(SAMPLE_UTC))).toBe(SAMPLE_UTC);
  });

  it('formats UTC labels', () => {
    expect(formatUtcLabel(SAMPLE_UTC)).toBe(`${SAMPLE_UTC} UTC`);
  });

  it('rejects invalid datetimes', () => {
    expect(() => parseUtc('not-a-date')).toThrow('Invalid UTC datetime');
  });
});

describe('isValidCoordinates', () => {
  it('accepts in-range coordinates', () => {
    expect(isValidCoordinates(BELIZE_LAT, BELIZE_LON)).toBe(true);
  });

  it('rejects out-of-range latitude', () => {
    expect(isValidCoordinates(91, 0)).toBe(false);
    expect(isValidCoordinates(-91, 0)).toBe(false);
  });

  it('rejects out-of-range longitude', () => {
    expect(isValidCoordinates(0, 181)).toBe(false);
    expect(isValidCoordinates(0, -181)).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isValidCoordinates(Number.NaN, 0)).toBe(false);
    expect(isValidCoordinates(0, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('getTimezoneFromCoordinates', () => {
  it('returns America/Belize for Belize field coordinates', () => {
    expect(getTimezoneFromCoordinates(BELIZE_LAT, BELIZE_LON)).toBe('America/Belize');
  });

  it('returns America/Belize for approximate Belize coordinates (17.5, -88.2)', () => {
    expect(getTimezoneFromCoordinates(17.5, -88.2)).toBe('America/Belize');
  });

  it('returns a timezone for polar coordinates', () => {
    const timezone = getTimezoneFromCoordinates(78, 15);
    expect(timezone.length).toBeGreaterThan(0);
  });

  it('throws InvalidCoordinatesError for invalid latitude', () => {
    expect(() => getTimezoneFromCoordinates(100, 0)).toThrow(InvalidCoordinatesError);
  });

  it('throws InvalidCoordinatesError for invalid longitude', () => {
    expect(() => getTimezoneFromCoordinates(0, 200)).toThrow(InvalidCoordinatesError);
  });

  it('throws TimezoneLookupError when lookup library fails', async () => {
    vi.resetModules();
    vi.doMock('tz-lookup', () => ({
      default: () => {
        throw new Error('lookup failed');
      },
    }));

    const { getTimezoneFromCoordinates: lookupTimezone } = await import('./timezone.js');
    expect(() => lookupTimezone(BELIZE_LAT, BELIZE_LON)).toThrow(/Timezone lookup failed/);

    vi.doUnmock('tz-lookup');
    vi.resetModules();
  });

  it('throws TimezoneLookupError when lookup returns an empty timezone', async () => {
    vi.resetModules();
    vi.doMock('tz-lookup', () => ({
      default: () => '',
    }));

    const { getTimezoneFromCoordinates: lookupTimezone } = await import('./timezone.js');
    expect(() => lookupTimezone(BELIZE_LAT, BELIZE_LON)).toThrow(/No timezone found/);

    vi.doUnmock('tz-lookup');
    vi.resetModules();
  });
});

describe('formatLocalTimeFromTimezone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats Belize local time from UTC', () => {
    const formatted = formatLocalTimeFromTimezone(SAMPLE_UTC, 'America/Belize', {
      locale: 'en-US',
      hour12: true,
      includeTimeZoneName: false,
    });

    expect(formatted).toContain('Mar');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/8:22/);
  });

  it('appends timezone id when requested', () => {
    const formatted = formatLocalTimeFromTimezone(SAMPLE_UTC, 'America/Belize', {
      includeTimezoneId: true,
      includeTimeZoneName: false,
    });

    expect(formatted).toContain('(America/Belize)');
  });

  it('includes seconds when requested', () => {
    const formatted = formatLocalTimeFromTimezone(SAMPLE_UTC, 'America/Belize', {
      includeSeconds: true,
      includeTimeZoneName: false,
    });

    expect(formatted).toMatch(/8:22:00/);
  });

  it('falls back to UTC label for invalid timezone ids', () => {
    const formatted = formatLocalTimeFromTimezone(SAMPLE_UTC, 'Not/A_Timezone');
    expect(formatted).toBe(`${SAMPLE_UTC} UTC`);
  });

  it('falls back to UTC label when Intl formatting throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl failure');
    });

    expect(formatLocalTimeFromTimezone(SAMPLE_UTC, 'America/Belize')).toBe(`${SAMPLE_UTC} UTC`);
  });
});

describe('formatLocalTime', () => {
  it('formats assessment times using coordinates', () => {
    const formatted = formatLocalTime(SAMPLE_UTC, BELIZE_LAT, BELIZE_LON, {
      locale: 'en-US',
      hour12: true,
      includeTimeZoneName: false,
    });

    expect(formatted).toMatch(/8:22/);
  });

  it('falls back to UTC label when coordinates are invalid', () => {
    expect(formatLocalTime(SAMPLE_UTC, 999, BELIZE_LON)).toBe(`${SAMPLE_UTC} UTC`);
  });
});

describe('formatLocalTimeShort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a compact local time for field UI', () => {
    const formatted = formatLocalTimeShort(SAMPLE_UTC, BELIZE_LAT, BELIZE_LON, {
      locale: 'en-US',
      hour12: true,
      includeTimeZoneName: false,
    });

    expect(formatted).toMatch(/8:22/);
  });

  it('includes seconds when requested', () => {
    const formatted = formatLocalTimeShort(SAMPLE_UTC, BELIZE_LAT, BELIZE_LON, {
      includeSeconds: true,
      includeTimeZoneName: false,
    });

    expect(formatted).toMatch(/8:22:00/);
  });

  it('falls back to UTC label when coordinates are invalid', () => {
    expect(formatLocalTimeShort(SAMPLE_UTC, 999, BELIZE_LON)).toBe(`${SAMPLE_UTC} UTC`);
  });

  it('falls back to UTC label when Intl formatting throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl failure');
    });

    expect(formatLocalTimeShort(SAMPLE_UTC, BELIZE_LAT, BELIZE_LON)).toBe(`${SAMPLE_UTC} UTC`);
  });
});

describe('Belize field workflow example', () => {
  it('displays assessment start time in Belize local time', () => {
    const assessmentStartedAt = '2026-03-15T14:22:00.000Z';
    const timezone = getTimezoneFromCoordinates(BELIZE_LAT, BELIZE_LON);

    expect(timezone).toBe('America/Belize');

    const localDisplay = formatLocalTime(assessmentStartedAt, BELIZE_LAT, BELIZE_LON, {
      locale: 'en-US',
      hour12: true,
      includeTimeZoneName: true,
    });

    expect(localDisplay).toMatch(/8:22/);
    expect(localDisplay).not.toContain(' UTC');
  });
});
