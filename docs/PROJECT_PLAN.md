# Marine Mammal Assessment Platform — Project Plan

**Version:** 1.0  
**Date:** 2026-06-14  
**Target:** Manatee Assessment v1 (offline field collection + public dataset)

> **Implementation status (2026-06):** M0–M4 core deliverables are in place (monorepo, schema, field PWA, sync API, public web, schema-driven forms, CI). M5 (production launch and open dataset v1) remains. See [DEVELOPMENT.md](DEVELOPMENT.md) for contributor setup.

---

## 1. Overview

This plan delivers an open-source marine mammal assessment ecosystem in six milestones over approximately **16–20 weeks** (adjustable for team size). Each milestone produces shippable artifacts, ends with a demo, and includes a recommended Cursor/agent prompt for implementation.

### 1.1 Team Assumptions

| Role                   | FTE     | Notes                       |
| ---------------------- | ------- | --------------------------- |
| Tech lead / full-stack | 0.5–1.0 | Architecture, API, CI       |
| Front-end / PWA        | 0.5–1.0 | Field app + public web      |
| Field advisor (CMARI)  | 0.1     | Protocol validation, UAT    |
| Data steward           | 0.1     | License, publication policy |

### 1.2 Repository Structure (Target)

```
marine-mammal-assessment/
├── apps/
│   ├── web/                 # Public mission site + dataset portal
│   ├── field/               # Offline-first PWA
│   └── api/                 # Sync + public dataset API
├── packages/
│   ├── schema/              # JSON Schema, types, validators
│   ├── ui/                  # Shared components (optional)
│   └── geo-time/            # UTC storage, local display helpers
├── docs/
├── infra/                   # Docker, IaC, deploy configs
└── datasets/                # Sample exports, schema examples
```

---

## 2. Milestone Summary

| #   | Milestone                   | Duration  | Outcome                                        |
| --- | --------------------------- | --------- | ---------------------------------------------- |
| M0  | Foundation & Schema         | 2 weeks   | Repo, CI, manatee_v1 schema, dev environment   |
| M1  | Offline Field App (Core)    | 3 weeks   | Create/edit assessments + measurements offline |
| M2  | Sync API & Pipeline         | 3 weeks   | Reliable upload, PostgreSQL store, sync UI     |
| M3  | Public Web & Dataset Portal | 2 weeks   | Mission site, docs, downloads                  |
| M4  | Extensibility & QA          | 2 weeks   | Schema-driven forms, validation, field UAT     |
| M5  | Launch & Open Dataset v1    | 2–4 weeks | Production deploy, CMARI pilot, public release |

**Total:** 14–16 weeks core + 2–4 weeks launch buffer

---

## 3. Milestone Details

### M0 — Foundation & Schema Design

**Duration:** 2 weeks  
**Depends on:** None

#### Objectives

- Bootstrap monorepo with shared tooling (TypeScript, lint, test, Docker Compose).
- Define and publish `manatee_v1` JSON Schema with all v1 fields and measurement types.
- Implement shared types and validation library consumed by field app and API.
- Document local development setup in README.

#### Deliverables

- [ ] GitHub repository with Apache 2.0 LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md
- [ ] `packages/schema/manatee_v1.json` + generated TypeScript types
- [ ] `packages/geo-time` with UTC helpers and lat/lon → timezone display
- [ ] Docker Compose: PostgreSQL + MinIO + API stub
- [ ] CI: lint, test, schema validation on PR

#### Exit Criteria

- `pnpm test` passes; schema validates sample assessment JSON from REQUIREMENTS.md
- New contributor runs `docker compose up` and sees health check OK

#### Risks

- Over-engineering monorepo → keep packages minimal in M0

---

### M1 — Offline Field App (Core)

**Duration:** 3 weeks  
**Depends on:** M0

#### Objectives

- Build installable PWA for tablet use on boats.
- Implement offline CRUD for assessments and timestamped measurements.
- Capture GPS location; support manual coordinate entry.
- Enforce UTC storage; display local time from assessment coordinates.

#### Deliverables

- [ ] PWA with Service Worker and IndexedDB persistence
- [ ] Assessment list, create, edit, complete flows
- [ ] Measurement entry: all seven types with `recorded_at` per reading
- [ ] Multiple readings per measurement type
- [ ] Offline indicator and local-only sync status
- [ ] Optional JSON export backup

#### Exit Criteria

- Field test script: complete assessment with 5+ measurements across 3 types, airplane mode on, app restart, data intact
- Timestamps display in America/Belize for sample Belize coordinates

#### Risks

- iOS Safari IndexedDB quirks → test early on target tablets

---

### M2 — Sync API & Data Pipeline

**Duration:** 3 weeks  
**Depends on:** M0, M1

#### Objectives

- Implement sync API with idempotent upsert by client UUID.
- Persist assessments and measurements in PostgreSQL (PostGIS for location).
- Build client sync queue with retry and status reporting.
- Add ingest validation against schema version.

#### Deliverables

- [ ] REST endpoints: `POST /sync/assessments`, batch support
- [ ] Database migrations and ERD documentation
- [ ] Field app sync queue: pending → synced / error states
- [ ] Admin CLI or endpoint for sync error inspection
- [ ] Integration tests: offline create → online sync → DB verify

#### Exit Criteria

- 50 assessments sync without duplicates after repeated upload attempts
- Invalid schema version rejected with clear error surfaced in app

#### Risks

- Partial sync failures → implement transactional batch with per-record error reporting

---

### M3 — Public Web & Dataset Portal

**Duration:** 2 weeks  
**Depends on:** M2

#### Objectives

- Launch public-facing site explaining mission and linking resources.
- Expose public dataset: browse metadata, schema docs, bulk download.
- Document manatee field protocol for CMARI-style workflow.

#### Deliverables

- [ ] Landing page: mission, partners, open data commitment
- [ ] `/docs` protocol guide with workflow diagram
- [ ] `/dataset` portal: stats, schema version, CSV/JSONL export
- [ ] Read-only API docs (OpenAPI) for public queries
- [ ] Link to field PWA and GitHub

#### Exit Criteria

- Non-technical visitor can understand project and download sample CSV in < 3 clicks
- Dataset page reflects records synced in M2 integration test

#### Risks

- Scope creep on design → ship content-first; iterate visuals post-launch

---

### M4 — Extensibility, Validation & Field UAT

**Duration:** 2 weeks  
**Depends on:** M1, M2, M3

#### Objectives

- Render field forms from schema registry (manatee_v1 first consumer).
- Add soft/hard validation rules and out-of-range warnings.
- Conduct field user acceptance with CMARI workflow advisors.
- Harden accessibility and outdoor readability.

#### Deliverables

- [ ] Schema registry package with version pinning on assessments
- [ ] Dynamic form renderer for measurement types
- [ ] Validation UX: inline warnings, required field enforcement
- [ ] UAT report with prioritized fixes
- [ ] `dolphin_v1` stub schema proving extensibility (no production data)

#### Exit Criteria

- Adding `dolphin_v1` schema does not require API or sync code changes
- UAT sign-off on core capture flow from field advisor

#### Risks

- Dynamic forms slower than hand-built → benchmark; optimize hot paths

---

### M5 — Launch & Open Dataset v1

**Duration:** 2–4 weeks  
**Depends on:** M4

#### Objectives

- Deploy production infrastructure with monitoring and backups.
- Run CMARI Belize pilot (or simulated pilot with historical data import).
- Publish Open Dataset v1 with license, changelog, and citation guidance.
- Announce open-source release and contribution pathways.

#### Deliverables

- [ ] Production deployment (staging → prod promotion process)
- [ ] Data governance doc: publication policy, pseudonymization rules
- [ ] Dataset snapshot v1.0.0 on public portal
- [ ] Release notes and v1.0.0 git tag
- [ ] Post-launch issue triage process

#### Exit Criteria

- At least one real or validated pilot assessment in public dataset
- 99% sync success rate during pilot week
- All acceptance criteria in REQUIREMENTS.md §9 met

#### Risks

- Connectivity at pilot site → train team on export backup before deployment

---

## 4. Cross-Cutting Workstreams

These run across all milestones:

| Workstream      | Owner        | Activities                                              |
| --------------- | ------------ | ------------------------------------------------------- |
| Security        | Tech lead    | TLS, secrets, API auth design, dependency scanning      |
| Documentation   | All          | Keep docs/ synced with schema and API changes           |
| Testing         | All          | Unit tests per package; E2E for offline→sync path by M2 |
| Data governance | Data steward | License, PII review, location aggregation policy        |
| DevOps          | Tech lead    | CI/CD, environments, backups                            |

---

## 5. Timeline (Gantt-style)

```
Week:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18
M0     ████
M1         ██████
M2               ██████
M3                     ████
M4                         ████
M5                             ████████
UAT / Pilot                              ████
```

---

## 6. Definition of Done (Global)

- Code reviewed and merged to `main`
- Tests pass in CI
- Schema/API changes documented
- No P0/P1 bugs open for the milestone scope
- Demo recorded or notes attached to milestone issue

---

## 7. Post-v1 Roadmap (Out of Scope, Sequenced)

| Phase | Feature                                                        |
| ----- | -------------------------------------------------------------- |
| v1.1  | Photo attachments, capture event linkage (boat/drone metadata) |
| v1.2  | OAuth login, team/org management, private drafts               |
| v1.3  | Additional species protocols (dolphin, seal)                   |
| v2.0  | Federated nodes, OBIS/Darwin Core export, GIS map explorer     |

---

## 8. Success Metrics (90 Days Post-Launch)

| Metric                                   | Target                   |
| ---------------------------------------- | ------------------------ |
| Assessments in public dataset            | ≥ 50 (pilot + community) |
| Offline → sync success rate              | ≥ 98%                    |
| External contributors (PRs)              | ≥ 3                      |
| Dataset downloads                        | ≥ 100                    |
| Field app install retention (pilot team) | 100% continue using      |

---

## Document History

| Version | Date       | Changes              |
| ------- | ---------- | -------------------- |
| 1.0     | 2026-06-14 | Initial project plan |
