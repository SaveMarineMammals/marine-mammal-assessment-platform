/** ISO 8601 UTC datetime: Z suffix or explicit +00:00 offset. */
export const UTC_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]00:00)$/;

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function isUtcDateTime(value: string): boolean {
  if (!UTC_DATETIME_PATTERN.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

export function isSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}
