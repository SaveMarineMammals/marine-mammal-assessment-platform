import type { FormatLocalTimeOptions } from './types.js';
import { formatUtcLabel, parseUtc } from './utc.js';
import { getTimezoneFromCoordinates } from './timezone.js';

function buildFormatter(
  timezone: string,
  options: FormatLocalTimeOptions = {},
): Intl.DateTimeFormat {
  const {
    locale = 'en-US',
    hour12 = true,
    includeSeconds = false,
    includeTimeZoneName = true,
  } = options;

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    timeZoneName: includeTimeZoneName ? 'short' : undefined,
    hour12,
  });
}

/**
 * Format a UTC ISO string in the given IANA timezone.
 * Falls back to an explicit UTC label when the timezone is invalid.
 */
export function formatLocalTimeFromTimezone(
  utcIso: string,
  timezone: string,
  options: FormatLocalTimeOptions = {},
): string {
  const date = parseUtc(utcIso);

  try {
    const formatted = buildFormatter(timezone, options).format(date);
    if (options.includeTimezoneId) {
      return `${formatted} (${timezone})`;
    }
    return formatted;
  } catch {
    return formatUtcLabel(utcIso);
  }
}

/**
 * Format a UTC ISO string in the local timezone derived from assessment coordinates.
 * Falls back to an explicit UTC label when coordinates or timezone lookup fail.
 */
export function formatLocalTime(
  utcIso: string,
  lat: number,
  lon: number,
  options: FormatLocalTimeOptions = {},
): string {
  try {
    const timezone = getTimezoneFromCoordinates(lat, lon);
    return formatLocalTimeFromTimezone(utcIso, timezone, options);
  } catch {
    return formatUtcLabel(utcIso);
  }
}

/** Format only the local time portion (no date) for compact field UI display. */
export function formatLocalTimeShort(
  utcIso: string,
  lat: number,
  lon: number,
  options: FormatLocalTimeOptions = {},
): string {
  try {
    const timezone = getTimezoneFromCoordinates(lat, lon);
    const date = parseUtc(utcIso);
    const formatter = new Intl.DateTimeFormat(options.locale ?? 'en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      second: options.includeSeconds ? '2-digit' : undefined,
      timeZoneName: options.includeTimeZoneName === false ? undefined : 'short',
      hour12: options.hour12 ?? true,
    });
    return formatter.format(date);
  } catch {
    return formatUtcLabel(utcIso);
  }
}
