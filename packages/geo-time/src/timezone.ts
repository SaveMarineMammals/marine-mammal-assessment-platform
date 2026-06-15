import tzlookup from 'tz-lookup';
import { InvalidCoordinatesError, TimezoneLookupError } from './types.js';

const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= MIN_LATITUDE &&
    lat <= MAX_LATITUDE &&
    lon >= MIN_LONGITUDE &&
    lon <= MAX_LONGITUDE
  );
}

/**
 * Resolve an IANA timezone id from WGS84 coordinates.
 *
 * @throws {InvalidCoordinatesError} when latitude or longitude is out of range
 * @throws {TimezoneLookupError} when the lookup library fails
 */
export function getTimezoneFromCoordinates(lat: number, lon: number): string {
  if (!isValidCoordinates(lat, lon)) {
    throw new InvalidCoordinatesError(lat, lon);
  }

  try {
    const timezone = tzlookup(lat, lon);
    if (typeof timezone !== 'string' || timezone.length === 0) {
      throw new TimezoneLookupError(`No timezone found for coordinates (${lat}, ${lon})`);
    }
    return timezone;
  } catch (error) {
    if (error instanceof TimezoneLookupError) {
      throw error;
    }
    throw new TimezoneLookupError(`Timezone lookup failed for coordinates (${lat}, ${lon})`, {
      cause: error,
    });
  }
}
