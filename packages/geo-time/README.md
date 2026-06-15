# @mmap/geo-time

UTC storage and local-time display helpers for MMAP field assessments.

All datetimes are **stored in UTC** and **displayed in local time** derived from assessment GPS coordinates (REQUIREMENTS.md §7.4).

## Usage

```typescript
import {
  toUtcIso,
  parseUtc,
  getTimezoneFromCoordinates,
  formatLocalTime,
  formatLocalTimeFromTimezone,
} from '@mmap/geo-time';

const utc = toUtcIso(new Date());

const timezone = getTimezoneFromCoordinates(17.5043, -88.1962);
// → 'America/Belize'

const label = formatLocalTime('2026-03-15T14:22:00.000Z', 17.5043, -88.1962);
// → 'Mar 15, 2026, 8:22 AM CST' (locale-dependent)
```

### Fallback behavior

If coordinate validation, timezone lookup, or `Intl` formatting fails, formatters return an **explicit UTC label** (e.g. `2026-03-15T14:22:00.000Z UTC`). Stored values are never mutated.

```typescript
formatLocalTime('2026-03-15T14:22:00.000Z', 999, -88.1962);
// → '2026-03-15T14:22:00.000Z UTC'
```

## API

| Function                                                  | Description                                   |
| --------------------------------------------------------- | --------------------------------------------- |
| `toUtcIso(date)`                                          | Serialize `Date` → ISO 8601 UTC string        |
| `parseUtc(iso)`                                           | Parse ISO string → `Date` (throws if invalid) |
| `formatUtcLabel(iso)`                                     | Display helper with explicit `UTC` suffix     |
| `getTimezoneFromCoordinates(lat, lon)`                    | IANA timezone via `tz-lookup`                 |
| `formatLocalTime(utcIso, lat, lon, options?)`             | Local display from coordinates                |
| `formatLocalTimeFromTimezone(utcIso, timezone, options?)` | Local display from IANA id                    |
| `formatLocalTimeShort(utcIso, lat, lon, options?)`        | Compact time-only display                     |
| `isValidCoordinates(lat, lon)`                            | WGS84 range check                             |

## Edge cases

| Scenario                | Behavior                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| **Belize field sites**  | `America/Belize` (UTC−6, no DST)                                         |
| **Polar regions**       | Lookup succeeds; `Intl` formats using the resolved Arctic timezone       |
| **Open ocean**          | `tz-lookup` returns the nearest land-based IANA zone                     |
| **DST transitions**     | Handled by `Intl.DateTimeFormat`; stored UTC values unchanged            |
| **Invalid coordinates** | `InvalidCoordinatesError` from lookup; formatters fall back to UTC label |
| **Invalid timezone id** | Formatters fall back to UTC label                                        |

## Development

```bash
pnpm --filter @mmap/geo-time test
pnpm --filter @mmap/geo-time test:coverage
pnpm --filter @mmap/geo-time build
```

Coverage thresholds require 100% on the public API surface.
