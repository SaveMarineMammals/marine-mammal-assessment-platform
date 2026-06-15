# Marine Mammal Assessment Platform — Milestone Prompts

**Version:** 1.0  
**Date:** 2026-06-14

Use these prompts in Cursor (or similar AI coding agents) at the start of each milestone. Customize paths and stack choices if the team diverges from recommendations in `REQUIREMENTS.md`.

**Conventions for all prompts:**

- Reference `docs/REQUIREMENTS.md` and `docs/PROJECT_PLAN.md` as source of truth.
- Prefer minimal, focused diffs; match existing code conventions once established.
- Do not commit secrets; use `.env.example` for configuration templates.

---

## M0 — Foundation & Schema Design

### Prompt M0-A: Repository Bootstrap

```
Context: We are building the Marine Mammal Assessment Platform (MMAP)—an open-source, offline-first system for marine mammal field assessments. Read docs/REQUIREMENTS.md and docs/PROJECT_PLAN.md in this repo.

Objective: Bootstrap the monorepo foundation for milestone M0.

Tasks:
1. Create a pnpm + Turborepo monorepo with packages: schema, geo-time, and apps: api (stub), field (stub), web (stub).
2. Add TypeScript, ESLint, Prettier, Vitest shared config.
3. Add Apache 2.0 LICENSE, README.md with local dev instructions, CONTRIBUTING.md, CODE_OF_CONDUCT.md.
4. Add docker-compose.yml with PostgreSQL (PostGIS), MinIO, and a health-checkable API stub on port 3001.
5. Add GitHub Actions CI: install, lint, test on pull request.

Constraints:
- Node 20 LTS
- All packages use workspace protocol for internal deps
- README must document: clone, pnpm install, docker compose up, pnpm dev

Deliverable: Working `pnpm test` and `pnpm dev` with empty apps that start without error.
```

### Prompt M0-B: Manatee v1 Schema & Validation

```
Context: MMAP milestone M0. See docs/REQUIREMENTS.md sections 5.2, 7, and 8 for the manatee assessment data model.

Objective: Implement packages/schema for manatee_v1.

Tasks:
1. Create JSON Schema (draft 2020-12) for:
   - Assessment header: name, assessment_started_at, assessment_ended_at, location (lat/lon WGS84), assessment_type, protocol_version, collector_id, optional organization/campaign/notes
   - Measurement: id, assessment_id, measurement_type (length, weight, internal_temperature, external_temperature, blood_pressure, heart_rate, respiratory_rate), recorded_at (UTC), value, unit, optional method/notes/sequence
   - Blood pressure value as { systolic, diastolic } in mmHg
2. Export TypeScript types from schema (json-schema-to-typescript or zod-from-json-schema).
3. Implement validators with zod or ajv: required fields, datetime ISO 8601 UTC, reasonable ranges from REQUIREMENTS.md table (warnings vs errors configurable).
4. Add fixture JSON files in packages/schema/fixtures/ matching REQUIREMENTS.md examples.
5. Unit tests: valid fixtures pass; invalid fixtures fail with expected messages.

Constraints:
- All datetimes validated as UTC (Z suffix or +00:00)
- protocol_version semver format enforced
- Canonical units: cm, kg, °C, mmHg, bpm, breaths/min

Deliverable: `pnpm --filter @mmap/schema test` passes; README in package explains extension process.
```

### Prompt M0-C: Geo-Time Utilities

```
Context: MMAP stores all datetimes in UTC but displays local time based on assessment GPS coordinates. See REQUIREMENTS.md section 7.4.

Objective: Implement packages/geo-time.

Tasks:
1. Functions:
   - toUtcIso(date: Date): string
   - parseUtc(iso: string): Date
   - getTimezoneFromCoordinates(lat: number, lon: number): string (IANA, use tz-lookup or geo-tz)
   - formatLocalTime(utcIso: string, lat: number, lon: number, options?): string
   - formatLocalTimeFromTimezone(utcIso: string, timezone: string, options?): string
2. Fallback: if timezone lookup fails, format as UTC with explicit "UTC" label.
3. Unit tests including Belize coordinates (approx 17.5, -88.2) → America/Belize display.
4. Export types and document edge cases (polar regions, ambiguous DST).

Deliverable: Package with 100% test coverage on public API functions.
```

---

## M1 — Offline Field App (Core)

### Prompt M1-A: PWA Shell & Offline Storage

```
Context: MMAP milestone M1. Field biologists use tablets on boats with no connectivity. Read docs/REQUIREMENTS.md sections 5.2, 5.3, and 6.4.

Objective: Scaffold apps/field as an offline-first PWA.

Tasks:
1. Vite + React (or SvelteKit) PWA with vite-plugin-pwa: Service Worker, app manifest, installable.
2. IndexedDB via Dexie with tables: assessments, measurements, sync_queue.
3. Repository/data layer: createAssessment, updateAssessment, addMeasurement, listAssessments, getAssessmentWithMeasurements.
4. All IDs are client-generated UUIDs (crypto.randomUUID).
5. Persist assessment_started_at on create; allow draft without assessment_ended_at.
6. UI shell: header with offline/online indicator, nav between list and detail.
7. Large touch targets (min 48px), high contrast theme for outdoor use.

Constraints:
- Works in airplane mode after first load
- Data survives page refresh and browser restart
- Use @mmap/schema types for in-app models

Deliverable: Can create a named assessment with location and see it in list after restart, offline.
```

### Prompt M1-B: Assessment & Measurement Forms

```
Context: MMAP apps/field exists with offline storage. Implement manatee v1 capture UI per REQUIREMENTS.md section 5.2.2.

Objective: Build assessment create/edit and measurement entry flows.

Tasks:
1. Assessment form: name (required), start/end datetime pickers (store UTC), GPS capture button using navigator.geolocation with accuracy display, manual lat/lon fallback, optional organization/campaign/notes.
2. On save, set assessment_started_at if new; set assessment_ended_at when user marks "Complete Assessment".
3. Measurement panel on assessment detail:
   - Add reading for each type: length, weight, internal_temperature, external_temperature, blood_pressure (systolic/diastolic), heart_rate, respiratory_rate
   - Each reading requires recorded_at (default: now UTC, editable)
   - Support unlimited readings per type; show chronological list grouped by type
4. Display all times in local timezone from assessment coordinates using @mmap/geo-time.
5. Client-side validation from @mmap/schema with inline error messages.
6. Soft warnings for out-of-range vitals (allow save with confirmation).

Constraints:
- No network calls in this milestone
- Blood pressure is one measurement row with structured value
- sequence field auto-increments per type optional

Deliverable: Complete assessment workflow demoable offline with 3+ heart rate readings at different times.
```

### Prompt M1-C: Local Export Backup

```
Context: MMAP field app M1. REQUIREMENTS.md OFF-06 requires optional JSON export for manual recovery.

Objective: Add export/import backup for local data.

Tasks:
1. Export all local assessments and measurements to a single JSON file (download via blob).
2. Import from JSON with duplicate UUID detection (skip or replace user choice).
3. Export filename: mmap-backup-YYYY-MM-DD.json
4. Validate imported data against @mmap/schema before merge.
5. Settings screen with Export, Import, and storage usage summary.

Deliverable: Export → clear IndexedDB → import restores identical data.
```

---

## M2 — Sync API & Data Pipeline

### Prompt M2-A: API & Database

```
Context: MMAP milestone M2. Read REQUIREMENTS.md sections 5.4 and 7. Implement apps/api.

Objective: Build sync API and PostgreSQL persistence.

Tasks:
1. Fastify (or FastAPI if Python preferred) API with OpenAPI docs.
2. PostGIS migrations: assessments table, measurements table, sync_audit log.
3. POST /v1/sync/batch accepts { assessments: [], measurements: [] } with client UUIDs.
4. Upsert logic: idempotent on id; assessment updated_at server-set; measurements append-by-id.
5. Validate each record against @mmap/schema for its protocol_version; return 207 Multi-Status with per-record errors.
6. GET /v1/health, GET /v1/admin/sync-errors (dev only, protected).
7. Docker Compose wiring; seed script with fixture data.

Constraints:
- TLS termination assumed at reverse proxy in prod; plain HTTP OK locally
- Store location as geography(POINT, 4326)
- All timestamps TIMESTAMPTZ in UTC

Deliverable: Integration test posts batch from fixture JSON and reads back identical data.
```

### Prompt M2-B: Field App Sync Queue

```
Context: MMAP field app and API exist. REQUIREMENTS.md SYNC-01 through SYNC-06.

Objective: Implement client sync when connectivity returns.

Tasks:
1. sync_queue table entries: entity_type, entity_id, operation, payload, status, attempts, last_error.
2. On assessment/measurement save, enqueue upsert if not yet synced.
3. Background sync worker triggered on: online event, manual "Sync Now" button, periodic interval when online.
4. Batch upload to POST /v1/sync/batch; update local sync_status: pending → synced | error.
5. Exponential backoff retry (max 5 attempts); surface errors in UI with retry action.
6. Offline indicator shows pending count.
7. Config: VITE_API_BASE_URL in .env.example

Constraints:
- Do not block UI during sync
- Duplicate uploads must not create duplicate DB rows
- Partial batch failure: mark only failed records error state

Deliverable: Airplane mode capture → go online → sync → verify in PostgreSQL via API GET or admin query.
```

### Prompt M2-C: Sync Integration Tests

```
Context: MMAP M2 nearing completion.

Objective: End-to-end and API integration test suite for offline→sync path.

Tasks:
1. Playwright test (or Vitest + MSW + test DB): create assessment offline in field app test harness, mock going online, assert sync completes.
2. API tests: idempotent double POST, invalid schema rejection, conflict policy (same UUID updated_at).
3. Load test script (optional): 50 assessments × 10 measurements sync under 30s locally.
4. Document test commands in root README.

Deliverable: CI runs integration tests on PR; all green.
```

---

## M3 — Public Web & Dataset Portal

### Prompt M3-A: Mission Landing Site

```
Context: MMAP milestone M3. Public web per REQUIREMENTS.md section 5.1.

Objective: Build apps/web marketing and documentation site.

Tasks:
1. Astro or Next.js static site with:
   - Home: mission statement, Belize manatee assessment context (Jacob Tindall, Jamal Galves, CMARI), open-source + open-data values
   - /app: link to field PWA with install instructions
   - /docs: links to protocol documentation
   - /github: repo link
   - Footer: license, contact, contribute CTA
2. Responsive, WCAG 2.1 AA contrast and focus states.
3. Simple brand: ocean/conservation aesthetic, no heavy assets (fast load on marina Wi‑Fi).
4. Content sourced from markdown in apps/web/content/.

Deliverable: `pnpm --filter @mmap/web build` produces deployable static site.
```

### Prompt M3-B: Dataset Portal & Public API

```
Context: MMAP M3. API has synced data. REQUIREMENTS.md section 5.5.

Objective: Public dataset browsing and download.

Tasks:
1. GET /v1/public/assessments?page&limit&from&to&bbox filters (read-only).
2. GET /v1/public/assessments/export?format=csv|jsonl with streaming response.
3. Web pages:
   - /dataset: total records, date range, schema version, license (CC BY 4.0)
   - Download buttons for CSV and JSONL
   - Schema documentation rendered from packages/schema
   - Sample record table (paginated)
4. OpenAPI spec published at /api/docs and linked from web.
5. Pseudonymization note: document that `name` may be truncated/hashed in public export (config flag for now).

Deliverable: Non-authenticated user downloads CSV containing synced test data.
```

### Prompt M3-C: Field Protocol Documentation

```
Context: MMAP M3 documentation workstream.

Objective: Write manatee field protocol guide for CMARI-style workflow.

Tasks:
1. Create docs/protocols/manatee-v1-field-guide.md covering:
   - Pre-capture: multi-boat coordination, drone localization (narrative, no proprietary ops detail)
   - Capture and onboard safety
   - Assessment order: when to record each vital, multiple reading rationale
   - Data entry on tablet: offline mode, sync at dock
   - Mermaid workflow diagram
2. Render in apps/web at /docs/manatee-v1.
3. Link from field app help screen.

Deliverable: Field guide readable by non-developer biologists; reviewed for accuracy placeholders flagged for CMARI advisor.
```

---

## M4 — Extensibility, Validation & Field UAT

### Prompt M4-A: Schema Registry & Dynamic Forms

```
Context: MMAP milestone M4. REQUIREMENTS.md section 5.6 extensibility requirements.

Objective: Replace hardcoded manatee forms with schema-driven renderer.

Tasks:
1. packages/schema/registry.json listing assessment types and protocol versions with JSON Schema paths.
2. Field app loads registry at build time (or runtime fetch with cache).
3. Generic form renderer: text, number, datetime, geo, composite (blood pressure), repeatable measurement sections.
4. Assessment stores assessment_type + protocol_version; forms render from matching schema.
5. Add packages/schema/dolphin_v1.json stub (2–3 fields) to prove extensibility without full dolphin protocol.
6. Test: switch assessment_type in dev menu and see different form.

Constraints:
- manatee_v1 must remain default and fully functional
- No API code changes required for dolphin_v1 stub

Deliverable: Demo video or screenshot set showing manatee_v1 and dolphin_v1 stub forms from same renderer.
```

### Prompt M4-B: Validation UX & Accessibility Hardening

```
Context: MMAP M4 quality pass before field UAT.

Objective: Polish validation and field usability.

Tasks:
1. Distinguish hard errors (block save) vs soft warnings (confirm dialog) per REQUIREMENTS.md ranges.
2. Required field indicators; summary error banner on submit.
3. Increase default font size; optional "glove mode" with larger targets.
4. Screen reader labels on all inputs; keyboard navigation for complete flow.
5. Fix any Lighthouse accessibility score < 90 on field app.

Deliverable: Accessibility audit checklist completed; issues logged and P0/P1 fixed.
```

### Prompt M4-C: UAT Feedback Loop

```
Context: MMAP M4 field user acceptance testing with CMARI workflow advisors.

Objective: Prepare UAT and implement priority fixes.

Tasks:
1. Create docs/uat/manatee-v1-checklist.md: scenarios covering offline capture, multiple vitals, GPS failure fallback, sync, export backup.
2. Add in-app feedback button (stores feedback locally, syncs as optional telemetry endpoint or exports JSON).
3. Triage UAT issues into GitHub issue templates.
4. Implement P0/P1 fixes from simulated UAT (use checklist yourself if advisors unavailable).

Deliverable: Completed checklist with pass/fail; all P0 issues closed.
```

---

## M5 — Launch & Open Dataset v1

### Prompt M5-A: Production Infrastructure

```
Context: MMAP milestone M5 launch. REQUIREMENTS.md section 6 and NFR-O01.

Objective: Production-ready deployment.

Tasks:
1. infra/ with Terraform or Pulumi (or documented Fly.io/Railway setup): API, PostgreSQL, object storage, web static hosting.
2. Staging and production environments; secrets via platform vault (no secrets in repo).
3. HTTPS everywhere; CORS configured for field PWA origin.
4. Database backups daily; restore drill documented.
5. Basic monitoring: uptime check, error rate, sync success metric log aggregation.
6. GitHub Actions deploy on release tag.

Deliverable: Staging URL live; production promotion checklist in docs/ops/DEPLOYMENT.md.
```

### Prompt M5-B: Data Governance & Dataset v1 Snapshot

```
Context: MMAP M5 open dataset release. REQUIREMENTS.md PUB-01, PUB-05, NFR-S03.

Objective: Publish Open Dataset v1.0.0.

Tasks:
1. Write docs/data/DATA_GOVERNANCE.md: license (CC BY 4.0), attribution, PII/location sensitivity, publication delay option.
2. Implement export job producing dataset snapshot in JSONL, CSV, Parquet to object storage.
3. Version snapshot as v1.0.0; changelog in docs/data/CHANGELOG.md.
4. Web /dataset page shows snapshot metadata and citation block (recommended bibtex).
5. Optional: hash manifest for reproducibility.

Deliverable: Public download of v1.0.0 snapshot; citation text on website.
```

### Prompt M5-C: Release & Pilot Support

```
Context: MMAP v1.0.0 release for CMARI Belize manatee assessment pilot.

Objective: Ship v1.0.0 and pilot support materials.

Tasks:
1. CHANGELOG.md and GitHub release v1.0.0 with release notes.
2. docs/pilot/PILOT_RUNBOOK.md: tablet prep, install PWA, pre-trip sync test, export backup procedure, dock-side sync, troubleshooting.
3. Verify all REQUIREMENTS.md section 9 acceptance criteria; file issues for any gap.
4. README badges: build status, license, docs link.
5. Announcement draft for GitHub Discussions / partner email.

Deliverable: Tagged release; pilot team can follow runbook independently.
```

---

## Bonus Prompts (Post-v1)

### Prompt POST-1: Photo Attachments

```
Add optional photo attachments to assessments and measurements in MMAP. Store blobs in MinIO/S3; sync metadata with assessment. Offline: store as IndexedDB blobs; queue upload on sync. Update schema with attachment type. Public dataset excludes photos by default (governance flag).
```

### Prompt POST-2: Capture Event Metadata

```
Extend manatee_v1 schema with optional capture_event: boat_id, drone_observation_id, water_conditions, crew_count. Link assessment to multi-boat workflow. Document in field protocol guide.
```

### Prompt POST-3: OBIS/Darwin Core Export

```
Add export format from public dataset mapping assessment and measurement fields to Darwin Core Event/Occurrence terms for biodiversity data integration. Document field mapping table.
```

---

## How to Use These Prompts

1. Start a **new Cursor chat** per prompt (or per logical task group) to keep context focused.
2. Attach or reference `docs/REQUIREMENTS.md` and the relevant prior package paths.
3. After each prompt, run tests and commit with conventional commits (`feat(schema):`, `feat(field):`, etc.).
4. Update PROJECT_PLAN.md checkboxes in the milestone issue tracker.
5. For field UAT (M4), have advisors run the checklist on actual hardware before M5 deploy.

---

## Document History

| Version | Date       | Changes                             |
| ------- | ---------- | ----------------------------------- |
| 1.0     | 2026-06-14 | Initial milestone prompts for M0–M5 |
