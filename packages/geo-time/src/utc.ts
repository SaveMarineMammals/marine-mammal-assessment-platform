/** Serialize a Date as an ISO 8601 UTC string. */
export function toUtcIso(date: Date): string {
  return date.toISOString();
}

/** Parse an ISO 8601 UTC string into a Date. */
export function parseUtc(iso: string): Date {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid UTC datetime: ${iso}`);
  }
  return parsed;
}

/** Format a UTC datetime with an explicit UTC label (fallback display). */
export function formatUtcLabel(iso: string): string {
  return `${parseUtc(iso).toISOString()} UTC`;
}
