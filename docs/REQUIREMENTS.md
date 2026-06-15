# Marine Mammal Assessment Platform — Requirements Document

**Version:** 1.0  
**Date:** 2026-06-14  
**Status:** Draft  
**First Implementation:** Manatee Assessment (Belize / CMARI field workflow)

---

## 1. Executive Summary

The Marine Mammal Assessment Platform (MMAP) is an extensible, open-source ecosystem for conducting standardized marine mammal health assessments in the field, collecting structured data offline, and publishing anonymized or consented records to a public dataset.

The first release targets the annual manatee assessment workflow used by Jacob Tindall, Jamal Galves, and the Clearwater Marine Aquarium Research Institute (CMARI) in Belize—a multi-boat, drone-assisted capture, onboard medical assessment, and release process.

---

## 2. Vision and Goals

### 2.1 Vision

Enable researchers, conservationists, and trained volunteers worldwide to run consistent marine mammal assessments, contribute to a shared scientific dataset, and extend the platform for new species and protocols without vendor lock-in.

### 2.2 Primary Goals

| ID  | Goal                               | Success Criteria                                                                  |
| --- | ---------------------------------- | --------------------------------------------------------------------------------- |
| G1  | Standardize field data collection  | Assessments follow a published schema; validation rules are enforced client-side  |
| G2  | Operate fully offline in the field | Complete assessment capture with zero connectivity; no data loss                  |
| G3  | Sync reliably when online          | Conflict-safe upload; user-visible sync status; audit trail                       |
| G4  | Publish open data                  | Public dataset with documented schema, license, and download/API access           |
| G5  | Extensibility                      | New species/protocols added via configuration, not core code forks                |
| G6  | Public mission web presence        | Clear explanation of mission, docs, app links, dataset access, contribution guide |

### 2.3 Non-Goals (v1)

- Real-time multi-user collaboration on a single in-progress assessment
- Automated species identification from imagery
- Integration with proprietary veterinary EMR systems
- Regulatory/compliance certification (HIPAA, etc.)—though PII handling guidelines apply

---

## 3. Stakeholders and Personas

| Persona                       | Role                        | Primary Needs                                                       |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------- |
| Field Biologist               | Conducts onboard assessment | Fast offline entry, minimal taps, GPS capture, timestamped vitals   |
| Boat Captain / Drone Operator | Locates and corrals animals | Optional linkage of capture event to assessment; location context   |
| Data Manager                  | Reviews and publishes data  | Sync monitoring, QA flags, export, public dataset curation          |
| Open Data Consumer            | Researcher / analyst        | Stable schema, CSV/JSON/Parquet downloads, API, changelog           |
| Platform Contributor          | Developer                   | Clear extension points, SDK, schema registry, contribution docs     |
| Public Visitor                | Web user                    | Understand mission, find apps and dataset, learn how to participate |

---

## 4. System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Marine Mammal Assessment Platform               │
├─────────────────────────────────────────────────────────────────────────┤
│  Public Web (mission, docs, dataset portal)                             │
│  Field App (PWA or native — offline-first data collection)              │
│  Sync API + Public Dataset API                                          │
│  Schema Registry (assessment types, measurement definitions)            │
│  Open Dataset Store (object storage + catalog)                          │
└─────────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                         ▲
         │ offline            │ sync when online        │ download/API
         │                    │                         │
    Field devices         Connectivity restored    Researchers / public
    (boats, tablets)      (shore, marina Wi‑Fi)    (web, notebooks, GIS)
```

---

## 5. Functional Requirements

### 5.1 Public Web Front End

| ID     | Requirement                                                                     | Priority |
| ------ | ------------------------------------------------------------------------------- | -------- |
| WEB-01 | Landing page explaining mission, CMARI/Belize context, and open-data commitment | Must     |
| WEB-02 | Links to field app, documentation, GitHub, and public dataset                   | Must     |
| WEB-03 | Assessment protocol documentation (manatee v1) with field workflow diagrams     | Must     |
| WEB-04 | Dataset browser: record counts, schema version, sample records, download links  | Must     |
| WEB-05 | Contributor guide: how to extend schemas, run locally, submit PRs               | Should   |
| WEB-06 | Multi-language support framework (English first)                                | Could    |

### 5.2 Field Data Collection (Manatee Assessment v1)

#### 5.2.1 Assessment Header

| Field                   | Type           | Rules                                                                          | Priority |
| ----------------------- | -------------- | ------------------------------------------------------------------------------ | -------- |
| `name`                  | string         | Required; individual identifier (tag, scar ID, provisional name, or "unknown") | Must     |
| `assessment_started_at` | datetime (UTC) | Required; ISO 8601; set at assessment start                                    | Must     |
| `assessment_ended_at`   | datetime (UTC) | Required before sync; must be ≥ started_at                                     | Must     |
| `location`              | geo point      | Required lat/lon (WGS84); optional accuracy (m), altitude, capture method note | Must     |
| `assessment_type`       | enum           | Default `manatee_v1`; extensible via schema registry                           | Must     |
| `protocol_version`      | semver string  | Locked to schema version used at creation time                                 | Must     |
| `collector_id`          | string (UUID)  | Device/user identifier for provenance                                          | Must     |
| `organization`          | string         | e.g., "CMARI"                                                                  | Should   |
| `campaign`              | string         | e.g., "Belize Manatee Assessment 2026"                                         | Should   |
| `notes`                 | text           | Free-form field notes                                                          | Could    |

#### 5.2.2 Measurements (Repeatable, Timestamped)

Each measurement is an independent reading that may occur at different times during the assessment. Multiple readings of the same type are expected.

| Measurement Type       | Value Type | Unit (canonical)        | Validation (v1)                   | Priority |
| ---------------------- | ---------- | ----------------------- | --------------------------------- | -------- |
| `length`               | decimal    | centimeters (cm)        | > 0; reasonable range 50–400 cm   | Must     |
| `weight`               | decimal    | kilograms (kg)          | > 0; reasonable range 50–600 kg   | Must     |
| `internal_temperature` | decimal    | degrees Celsius (°C)    | 30–40 °C warn outside             | Must     |
| `external_temperature` | decimal    | °C                      | -5–45 °C                          | Must     |
| `blood_pressure`       | composite  | systolic/diastolic mmHg | systolic 40–250, diastolic 20–150 | Must     |
| `heart_rate`           | integer    | beats per minute (bpm)  | 10–200                            | Must     |
| `respiratory_rate`     | integer    | breaths per minute      | 1–60                              | Must     |

**Common measurement record fields:**

| Field              | Type                 | Rules                                                  |
| ------------------ | -------------------- | ------------------------------------------------------ |
| `id`               | UUID                 | Client-generated; stable across sync                   |
| `assessment_id`    | UUID                 | Parent assessment                                      |
| `measurement_type` | enum                 | One of types above                                     |
| `recorded_at`      | datetime (UTC)       | Required; time reading was taken                       |
| `value`            | number or structured | Type-specific                                          |
| `unit`             | string               | Canonical unit; conversions stored at ingest if needed |
| `method`           | string               | Optional (e.g., "rectal probe", "Doppler")             |
| `notes`            | text                 | Optional                                               |
| `sequence`         | integer              | Optional ordering within type                          |

| ID      | Requirement                                                         | Priority |
| ------- | ------------------------------------------------------------------- | -------- |
| DATA-01 | Support unlimited measurements per type per assessment              | Must     |
| DATA-02 | Each measurement stores its own `recorded_at` in UTC                | Must     |
| DATA-03 | Display times in local timezone derived from assessment location    | Must     |
| DATA-04 | Allow draft assessments (in progress) without `assessment_ended_at` | Must     |
| DATA-05 | Soft validation warnings vs hard errors for out-of-range vitals     | Should   |
| DATA-06 | Optional photo attachments linked to assessment or measurement      | Could    |

### 5.3 Offline Mode

| ID     | Requirement                                                           | Priority |
| ------ | --------------------------------------------------------------------- | -------- |
| OFF-01 | All v1 manatee assessment CRUD works without network                  | Must     |
| OFF-02 | Local persistent store survives app restart and device reboot         | Must     |
| OFF-03 | GPS capture works offline (device GPS); manual lat/lon entry fallback | Must     |
| OFF-04 | Queued sync operations with idempotent client IDs                     | Must     |
| OFF-05 | Visible offline indicator and pending sync count                      | Must     |
| OFF-06 | Export local backup (JSON file) for manual recovery                   | Should   |

### 5.4 Sync and Data Pipeline

| ID      | Requirement                                                                             | Priority |
| ------- | --------------------------------------------------------------------------------------- | -------- |
| SYNC-01 | Background sync when connectivity detected                                              | Must     |
| SYNC-02 | Retry with exponential backoff on failure                                               | Must     |
| SYNC-03 | Server accepts upsert by client UUID; duplicate uploads are no-ops                      | Must     |
| SYNC-04 | Sync status per assessment: local-only, pending, synced, error                          | Must     |
| SYNC-05 | Optional authenticated upload (API key or OAuth); anonymous read on public dataset      | Should   |
| SYNC-06 | Conflict policy: server-wins on metadata; append-only for measurements unless same UUID | Must     |
| SYNC-07 | Schema version validated at ingest; reject or quarantine incompatible records           | Must     |

### 5.5 Public Dataset

| ID     | Requirement                                                                              | Priority |
| ------ | ---------------------------------------------------------------------------------------- | -------- |
| PUB-01 | Published dataset with open license (recommend CC BY 4.0)                                | Must     |
| PUB-02 | Bulk download: JSON Lines, CSV, Parquet                                                  | Must     |
| PUB-03 | Read-only REST API with pagination and filters (date range, location bbox, species/type) | Must     |
| PUB-04 | Schema documentation and version changelog                                               | Must     |
| PUB-05 | PII review workflow before publication (names may be pseudonymized)                      | Should   |
| PUB-06 | DOI or persistent identifier for dataset snapshots                                       | Could    |

### 5.6 Extensibility

| ID     | Requirement                                                        | Priority |
| ------ | ------------------------------------------------------------------ | -------- |
| EXT-01 | Assessment types defined in JSON Schema / OpenAPI, not hardcoded   | Must     |
| EXT-02 | Schema registry with versioned manatee_v1 as first entry           | Must     |
| EXT-03 | Field app renders forms dynamically from schema                    | Should   |
| EXT-04 | Plugin hook documentation for custom validators and export formats | Could    |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID      | Requirement                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------- |
| NFR-P01 | Field app: form interactions < 100 ms on mid-range tablet (3-year-old iPad/Android equivalent) |
| NFR-P02 | Sync: upload 50 assessments with 500 measurements in < 30 s on typical LTE                     |
| NFR-P03 | Public dataset API: p95 < 500 ms for paginated queries                                         |

### 6.2 Reliability and Data Integrity

| ID      | Requirement                                                |
| ------- | ---------------------------------------------------------- |
| NFR-R01 | Zero data loss for acknowledged local saves                |
| NFR-R02 | Checksums on sync payloads; server validates before commit |
| NFR-R03 | Daily automated backups of production dataset              |

### 6.3 Security and Privacy

| ID      | Requirement                                                     |
| ------- | --------------------------------------------------------------- |
| NFR-S01 | TLS for all network transport                                   |
| NFR-S02 | No secrets in client bundles; API keys in secure device storage |
| NFR-S03 | Document data governance: what is public vs restricted          |
| NFR-S04 | Rate limiting and abuse protection on public APIs               |

### 6.4 Accessibility and Usability

| ID      | Requirement                                                                         |
| ------- | ----------------------------------------------------------------------------------- |
| NFR-U01 | Field UI usable with wet/gloved hands: large targets, high contrast, minimal typing |
| NFR-U02 | WCAG 2.1 AA for public web site                                                     |
| NFR-U03 | Works in bright sunlight (readable outdoors)                                        |

### 6.5 Operability

| ID      | Requirement                                                                     |
| ------- | ------------------------------------------------------------------------------- |
| NFR-O01 | Infrastructure as code; one-command local dev environment                       |
| NFR-O02 | Structured logging and basic metrics (sync success rate, error types)           |
| NFR-O03 | Open-source license (recommend Apache 2.0 for code, CC BY for docs/data policy) |

---

## 7. Data Model (Logical)

### 7.1 Assessment

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "assessment_type": "manatee_v1",
  "protocol_version": "1.0.0",
  "name": "Belize-2026-014",
  "assessment_started_at": "2026-03-15T14:22:00.000Z",
  "assessment_ended_at": "2026-03-15T15:08:00.000Z",
  "location": {
    "latitude": 17.5043,
    "longitude": -88.1962,
    "accuracy_meters": 8.5
  },
  "organization": "CMARI",
  "campaign": "Belize Manatee Assessment 2026",
  "collector_id": "device-uuid-or-user-id",
  "notes": "Adult female, minor tail scar",
  "created_at": "2026-03-15T14:22:00.000Z",
  "updated_at": "2026-03-15T15:08:00.000Z",
  "sync_status": "synced"
}
```

### 7.2 Measurement

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "assessment_id": "550e8400-e29b-41d4-a716-446655440000",
  "measurement_type": "heart_rate",
  "recorded_at": "2026-03-15T14:35:00.000Z",
  "value": 52,
  "unit": "bpm",
  "method": "Doppler",
  "notes": null
}
```

### 7.3 Blood Pressure (Structured Value)

```json
{
  "measurement_type": "blood_pressure",
  "recorded_at": "2026-03-15T14:40:00.000Z",
  "value": { "systolic": 118, "diastolic": 72 },
  "unit": "mmHg"
}
```

### 7.4 Timezone Display Rule

- **Storage:** All datetimes UTC (ISO 8601 with `Z` suffix or explicit offset).
- **Display:** Convert to local time using IANA timezone derived from `(latitude, longitude)` at display time (e.g., `America/Belize` for Belize field sites).
- **Edge cases:** If timezone lookup fails, display UTC with label; never mutate stored values.

---

## 8. Technical Architecture (Recommended)

| Layer          | Recommendation                                  | Rationale                                                              |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Field app      | Progressive Web App (PWA) with Service Worker   | Offline-first, cross-platform, installable on tablets; single codebase |
| Local store    | IndexedDB via Dexie or similar                  | Structured queries, large payloads, browser-native                     |
| Sync transport | REST + JSON; optional sync batch endpoint       | Simple, debuggable, works through intermittent connectivity            |
| Backend        | Node.js (Fastify) or Python (FastAPI)           | Open-source friendly, strong ecosystem                                 |
| Database       | PostgreSQL + PostGIS                            | Relational integrity, geo queries for public dataset                   |
| Object storage | S3-compatible (MinIO locally, AWS S3 prod)      | Exports, attachments                                                   |
| Public web     | Next.js or Astro static + SSR for dataset pages | SEO, fast mission site                                                 |
| Monorepo       | Turborepo or pnpm workspaces                    | Shared types, schema package, apps                                     |

---

## 9. Acceptance Criteria (Manatee v1 Release)

1. Field user completes full assessment offline including 3+ heart rate readings at different times.
2. After reconnecting, all data syncs without duplication; status shows "synced."
3. Public dataset page lists the record; CSV download includes all measurement rows.
4. Timestamps in UI show Belize local time for Belize coordinates.
5. New developer can add a hypothetical `dolphin_v1` schema entry without modifying core sync logic.
6. Public web explains mission and links to GitHub, app, and dataset.

---

## 10. Risks and Mitigations

| Risk                             | Impact                | Mitigation                                                             |
| -------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| Tablet browser storage limits    | Data loss             | Export backup; periodic sync when possible; native wrapper if needed   |
| GPS inaccuracy on boats          | Bad location data     | Capture accuracy; allow manual correction; flag low-accuracy records   |
| Schema drift across teams        | Incompatible data     | Strict protocol_version; schema registry; ingest validation            |
| Sensitive location data          | Poaching / harassment | Aggregate public releases; delay publication option; governance policy |
| Low connectivity upload failures | Backlog growth        | Robust queue; manual export/import path                                |

---

## 11. Glossary

| Term           | Definition                                                           |
| -------------- | -------------------------------------------------------------------- |
| Assessment     | A single capture-and-exam event for one individual                   |
| Measurement    | One timestamped reading of a vital or morphometric                   |
| Protocol       | Versioned definition of fields and validation for an assessment type |
| Sync           | Upload of locally stored records to central repository               |
| Public dataset | Curated, openly licensed export of submitted assessments             |

---

## 12. References and Inspiration

- CMARI / Jamal Galves Belize manatee program (field workflow context)
- Darwin Core / OBIS patterns for biodiversity data sharing (future alignment)
- Open mHealth schema patterns for extensible health measurements

---

## Document History

| Version | Date       | Author           | Changes                                 |
| ------- | ---------- | ---------------- | --------------------------------------- |
| 1.0     | 2026-06-14 | Initial planning | First draft from stakeholder objectives |
