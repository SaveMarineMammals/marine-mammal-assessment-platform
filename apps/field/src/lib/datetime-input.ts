import { parseUtc, toUtcIso } from '@mmap/geo-time';

/** Convert UTC ISO string to `datetime-local` input value (browser local time). */
export function utcToDatetimeLocalValue(utcIso: string): string {
  const date = parseUtc(utcIso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert `datetime-local` input value to UTC ISO string. */
export function datetimeLocalValueToUtc(localValue: string): string {
  if (!localValue) {
    throw new Error('Datetime is required.');
  }
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid datetime.');
  }
  return toUtcIso(parsed);
}

export function nowDatetimeLocalValue(): string {
  return utcToDatetimeLocalValue(toUtcIso(new Date()));
}
