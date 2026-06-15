---
title: Documentation
description: Protocol guides, schema references, and API links.
---

## Protocol guides

- [Manatee v1 field guide](/docs/manatee-v1) — CMARI-style capture workflow for biologists

## Schema

- Protocol: `manatee_v1` version `1.0.0`
- JSON Schema package: `@mmap/schema` in the monorepo
- Measurement types: length, weight, internal/external temperature, blood pressure, heart rate, respiratory rate

## API

- OpenAPI docs: linked from the [dataset portal](/dataset)
- Sync endpoint (authenticated field clients): `POST /v1/sync/batch`
- Public read API: `GET /v1/public/assessments`

## Contributing

See the repository [Contributing guide](https://github.com/SaveMarineMammals/marine-mammal-assessment-platform/blob/main/CONTRIBUTING.md) for local setup, tests, and pull request expectations.
