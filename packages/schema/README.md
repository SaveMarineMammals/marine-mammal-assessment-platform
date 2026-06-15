# @mmap/schema

Shared JSON Schemas, TypeScript types, and runtime validators for Marine Mammal Assessment Platform (MMAP) protocols.

## Manatee v1 (`manatee_v1`)

The first protocol supports Belize/CMARI-style manatee field assessments:

- **Assessment header** — name, UTC start/end times, WGS84 location, collector provenance
- **Measurements** — timestamped readings for length, weight, temperatures, blood pressure, heart rate, and respiratory rate

Canonical units: `cm`, `kg`, `°C`, `mmHg`, `bpm`, `breaths/min`.

## Usage

```typescript
import {
  validateManateeAssessment,
  validateManateeMeasurement,
  MANATEE_V1_PROTOCOL,
} from '@mmap/schema';

const assessment = validateManateeAssessment(payload, { mode: 'draft' });
if (!assessment.success) {
  console.error(assessment.errors);
}

const measurement = validateManateeMeasurement(payload);
if (measurement.success && measurement.warnings.length > 0) {
  console.warn(measurement.warnings);
}
```

### Validation modes

| Mode       | Use case                                                  |
| ---------- | --------------------------------------------------------- |
| `draft`    | In-progress field capture; `assessment_ended_at` optional |
| `complete` | Before sync/submission; requires `assessment_ended_at`    |

Out-of-range vital readings produce **warnings** by default (DATA-05) but do not block save. Disable with `{ collectWarnings: false }`.

## JSON Schema files

Draft 2020-12 schemas ship with this package:

| File                                         | Export path                                       |
| -------------------------------------------- | ------------------------------------------------- |
| `schemas/manatee_v1/assessment.schema.json`  | `@mmap/schema/manatee_v1/assessment.schema.json`  |
| `schemas/manatee_v1/measurement.schema.json` | `@mmap/schema/manatee_v1/measurement.schema.json` |
| `schemas/manatee_v1/definitions.schema.json` | `@mmap/schema/manatee_v1/definitions.schema.json` |

Runtime AJV validators are available via `validateAssessmentWithJsonSchema` and `validateMeasurementWithJsonSchema`.

## Extending with a new protocol

1. Add JSON Schemas under `schemas/<protocol_id>/` with a shared `definitions.schema.json` where helpful.
2. Create Zod schemas and validators in `src/<protocol_id>/` mirroring the JSON Schema shapes.
3. Register the protocol in `registry.json` with schema paths and a `form-definitions/<protocol>.json` UI definition.
4. Add Zod validators in `src/<protocol_id>/` and wire them in `src/protocol-validator.ts`.

Keep **protocol_version** pinned on each assessment record so ingest can validate against the schema version used at capture time.

## Development

```bash
pnpm --filter @mmap/schema test
pnpm --filter @mmap/schema build
pnpm --filter @mmap/schema lint
```

Fixtures live in `fixtures/` and are exercised by unit tests in `src/index.test.ts`.
