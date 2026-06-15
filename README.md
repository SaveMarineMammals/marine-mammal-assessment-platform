# Marine Mammal Assessment Platform (MMAP)

[![CI](https://github.com/SaveMarineMammals/marine-mammal-assessment-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/SaveMarineMammals/marine-mammal-assessment-platform/actions/workflows/ci.yml)

Open-source, offline-first platform for marine mammal field assessments. First implementation: **manatee assessments** supporting the CMARI Belize workflow.

## Mission

Enable researchers worldwide to collect standardized marine mammal health data in the field—even without connectivity—and contribute to a publicly available open dataset.

## Architecture

The platform splits **field capture**, **public access**, and **persistence** into separate apps that share a common schema package.

```mermaid
flowchart TB
  subgraph users [Users]
    Biologist[Field biologist]
    Researcher[Public researcher]
  end

  subgraph host [localhost — Docker Compose]
    subgraph frontends [Static frontends nginx]
      Field["Field PWA<br/>:5174"]
      Web["Public web<br/>:5173"]
    end

    API["Sync & public API<br/>Fastify :3001"]
    PG[("PostgreSQL<br/>PostGIS :5432")]
    MinIO[("MinIO<br/>object storage :9000")]
  end

  subgraph packages [Shared packages]
    Schema["@mmap/schema<br/>validators & registry"]
    GeoTime["@mmap/geo-time<br/>UTC & local time"]
  end

  Biologist --> Field
  Researcher --> Web

  Field -->|"IndexedDB offline queue"| Field
  Field -->|"/v1/sync/batch"| API
  Field -->|"/help/protocol in-app guide"| Field

  Web -->|"/v1/public/* dataset exports"| API
  Web -->|"/docs/* field guide"| Web

  API --> PG
  API --> MinIO

  Field -.-> Schema
  Web -.-> Schema
  API -.-> Schema
  Field -.-> GeoTime
  Web -.-> GeoTime
```

| Component          | Role                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **Field PWA**      | Offline assessment capture, local IndexedDB storage, background sync, in-app protocol guide |
| **Public web**     | Mission site, manatee field guide, read-only dataset portal and CSV export                  |
| **Sync API**       | Validates and persists field uploads; serves public stats/list/export endpoints             |
| **PostgreSQL**     | Canonical assessment and measurement records (PostGIS for location)                         |
| **MinIO**          | Object storage for attachments (future milestones)                                          |
| **@mmap/schema**   | JSON Schema + Zod validators, protocol registry, form definitions                           |
| **@mmap/geo-time** | UTC storage with timezone-aware display at capture coordinates                              |

Frontends proxy `/v1` (and `/openapi` on web) to the API inside Docker, so browsers use same-origin requests without extra CORS configuration.

## Quick start

**New to the codebase?** Follow the step-by-step [Developer guide](docs/DEVELOPMENT.md).

### Prerequisites

- [Docker](https://www.docker.com/) (recommended — runs the full stack)
- [Node.js 20 LTS](https://nodejs.org/) and [pnpm 9](https://pnpm.io/installation) (for local development and tests)

### Full stack (Docker)

```bash
git clone https://github.com/SaveMarineMammals/marine-mammal-assessment-platform.git
cd marine-mammal-assessment
docker compose up -d --build
```

| Service       | URL                                     |
| ------------- | --------------------------------------- |
| Field app     | http://localhost:5174                   |
| Public web    | http://localhost:5173                   |
| API health    | http://localhost:3001/v1/health         |
| API OpenAPI   | http://localhost:3001/docs              |
| PostgreSQL    | `localhost:5432` (user/pass/db: `mmap`) |
| MinIO API     | http://localhost:9000                   |
| MinIO console | http://localhost:9001                   |

Seed demo data for the public dataset:

```bash
pnpm install
pnpm --filter @mmap/api db:seed -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

Verify:

```bash
curl http://localhost:3001/v1/health
curl http://localhost:5173/v1/public/stats
```

### Local development (hot reload)

```bash
pnpm install
docker compose up -d postgres minio api
pnpm --filter @mmap/api db:seed -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
pnpm dev
```

| App   | Dev URL               |
| ----- | --------------------- |
| Field | http://localhost:5174 |
| Web   | http://localhost:5175 |
| API   | http://localhost:3001 |

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for env files, per-package commands, integration tests, and troubleshooting.

## Testing & CI

Every pull request runs [GitHub Actions CI](.github/workflows/ci.yml):

| Job             | Checks                                           |
| --------------- | ------------------------------------------------ |
| **Quality**     | Prettier, ESLint, unit tests (`pnpm test`)       |
| **Build**       | Production build for all packages (`pnpm build`) |
| **Integration** | API sync + field sync path against PostgreSQL    |

Run the same gates locally before opening a PR:

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

## Repository structure

```
marine-mammal-assessment/
├── apps/
│   ├── api/          # Fastify sync & public API
│   ├── field/        # Offline-first field PWA
│   └── web/          # Public mission site
├── packages/
│   ├── schema/       # Assessment schemas and validators
│   └── geo-time/     # UTC storage and local time display
├── docs/             # Requirements, plan, developer guide, protocols
└── .github/          # CI workflow, issue and PR templates
```

## Documentation

| Document                                                | Description                                   |
| ------------------------------------------------------- | --------------------------------------------- |
| [Developer guide](docs/DEVELOPMENT.md)                  | **Start here** — setup, testing, contributing |
| [Documentation index](docs/README.md)                   | All project docs                              |
| [Requirements](docs/REQUIREMENTS.md)                    | Functional and non-functional requirements    |
| [Project Plan](docs/PROJECT_PLAN.md)                    | Milestones M0–M5                              |
| [Field UAT checklist](docs/uat/manatee-v1-checklist.md) | Field acceptance test scenarios               |
| [Contributing](CONTRIBUTING.md)                         | How to contribute                             |

## Environment variables

Copy example files when running apps outside Docker:

| App   | File                      | Notes                                 |
| ----- | ------------------------- | ------------------------------------- |
| API   | `apps/api/.env.example`   | Database, CORS, admin token           |
| Field | `apps/field/.env.example` | Optional API override                 |
| Web   | `apps/web/.env.example`   | Optional API override; field app link |

Docker frontends use same-origin `/v1` proxy by default. Override with Docker build args if needed.

## License

Code: [Apache 2.0](LICENSE)

Data: CC BY 4.0 (recommended for published datasets; see governance docs in later milestones)

## Partners & context

Annual manatee assessment in Belize with Jamal Galves and Clearwater Marine Aquarium Research Institute (CMARI), involving multi-boat coordination, drone localization, onboard medical assessment, and release.
