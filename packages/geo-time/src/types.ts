/** Options for formatting UTC datetimes in a local timezone. */
export interface FormatLocalTimeOptions {
  /** BCP 47 locale for Intl formatting (default: `en-US`) */
  locale?: string;
  /** Use 12-hour clock (default: `true`) */
  hour12?: boolean;
  /** Include seconds in the formatted time (default: `false`) */
  includeSeconds?: boolean;
  /** Include short timezone name, e.g. CST (default: `true`) */
  includeTimeZoneName?: boolean;
  /** Append IANA timezone id to the formatted string (default: `false`) */
  includeTimezoneId?: boolean;
}

export class TimezoneLookupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TimezoneLookupError';
  }
}

export class InvalidCoordinatesError extends TimezoneLookupError {
  constructor(lat: number, lon: number) {
    super(`Invalid coordinates: latitude ${lat}, longitude ${lon}`);
    this.name = 'InvalidCoordinatesError';
  }
}
