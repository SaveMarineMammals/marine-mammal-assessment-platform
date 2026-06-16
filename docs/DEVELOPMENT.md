# Developer guide

This guide gets you from clone to running tests and opening a pull request. For product context, see [REQUIREMENTS.md](REQUIREMENTS.md) and [PROJECT_PLAN.md](PROJECT_PLAN.md).

## Prerequisites

| Tool                              | Version                         | Purpose                                   |
| --------------------------------- | ------------------------------- | ----------------------------------------- |
| [Node.js](https://nodejs.org/)    | 20 LTS                          | Build, test, local dev servers            |
| [pnpm](https://pnpm.io/)          | 9.x (see root `packageManager`) | Monorepo package manager                  |
| [Docker](https://www.docker.com/) | Latest                          | Full stack, PostgreSQL, integration tests |

Enable pnpm via Corepack (recommended):

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## Clone and install

```bash
git clone https://github.com/SaveMarineMammals/marine-mammal-assessment-platform.git
cd marine-mammal-assessment
pnpm install
```

## Choose your workflow

### Option A — Full stack in Docker (fastest first run)

Runs PostgreSQL, MinIO, API, field PWA, and public web together:

```bash
docker compose up -d --build
```

| Service      | URL                             |
| ------------ | ------------------------------- |
| Field PWA    | http://localhost:5174           |
| Public web   | http://localhost:5173           |
| API health   | http://localhost:3001/v1/health |
| OpenAPI docs | http://localhost:3001/docs      |

Seed demo data for the public dataset portal:

```bash
pnpm --filter @mmap/api db:seed -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

Rebuild after code changes:

```bash
docker compose up -d --build
```

### Option B — Local dev with hot reload

Run infrastructure in Docker, frontends on your machine:

```bash
docker compose up -d postgres minio api
pnpm --filter @mmap/api db:seed -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
pnpm dev
```

| App   | Dev URL               | Notes                                         |
| ----- | --------------------- | --------------------------------------------- |
| Field | http://localhost:5174 | Offline PWA; Vite strict port                 |
| Web   | http://localhost:5175 | Public site (5173 reserved for Docker)        |
| API   | http://localhost:3001 | From Docker, or `pnpm --filter @mmap/api dev` |

Vite dev servers proxy `/v1` to the API. Leave `VITE_API_BASE_URL` unset unless you need a cross-origin API.

Copy env examples when running apps outside Docker:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/field/.env.example apps/field/.env
cp apps/web/.env.example apps/web/.env
```

## Monorepo layout

```
marine-mammal-assessment/
├── apps/
│   ├── api/          # Fastify sync & public dataset API
│   ├── field/        # Offline-first field PWA
│   └── web/          # Public mission site & dataset portal
├── packages/
│   ├── schema/       # JSON Schema, Zod validators, form definitions
│   └── geo-time/     # UTC storage & local-time display
├── docs/             # Requirements, plan, protocols, UAT
└── scripts/          # Cross-app tooling (integration test runner)
```

Workspace packages use `workspace:*` dependencies. Turbo orchestrates `build`, `dev`, `test`, and `lint` across packages.

## Day-to-day commands

Run from the repository root:

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Start field + web dev servers (after packages build) |
| `pnpm test`         | Unit tests in all packages                           |
| `pnpm lint`         | ESLint in all packages                               |
| `pnpm build`        | Production build for all packages                    |
| `pnpm format`       | Auto-format with Prettier                            |
| `pnpm format:check` | Verify formatting (CI gate)                          |
| `pnpm validate`     | All CI quality + build checks in one command         |

Filter to a single package:

```bash
pnpm --filter @mmap/field test
pnpm --filter @mmap/api dev
pnpm --filter @mmap/schema build
```

### API database tasks

```bash
pnpm --filter @mmap/api db:migrate -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
pnpm --filter @mmap/api db:seed -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

Pass `--database-url` (or `-d`) on Windows PowerShell, cmd, and bash. Alternatively set `DATABASE_URL`.

## Testing

### Unit tests

No external services required:

```bash
pnpm test
```

Each package uses Vitest. Field tests generate a dev build version automatically.

### Integration tests

Requires PostgreSQL. Start it with Docker:

```bash
docker compose up -d postgres
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

This runs:

- **API** — sync batch ingestion, public dataset endpoints (migrations applied automatically)
- **Field** — end-to-end sync path against a test API instance on port 3099

Run integration tests for one app:

```bash
pnpm --filter @mmap/api test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
pnpm --filter @mmap/field test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

### What CI runs on every PR

See [.github/workflows/ci.yml](../.github/workflows/ci.yml). Full style and testing policy: [CODING_STANDARDS.md](CODING_STANDARDS.md).

1. **Quality** — Prettier, ESLint, unit tests
2. **Build** — Full monorepo production build
3. **Integration** — API + field sync tests against PostgreSQL

Run the same checks locally before opening a PR:

```bash
pnpm validate
docker compose up -d postgres
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

Or run `pnpm validate:integration` after Postgres is running (with `--database-url` if `DATABASE_URL` is unset).

### Windows (PowerShell)

All checks run through **pnpm** — no bash, Git Bash, or `.sh` scripts are required. Use PowerShell from the repository root:

```powershell
pnpm validate
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

Copy env examples (instead of `cp`):

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/field/.env.example apps/field/.env
Copy-Item apps/web/.env.example apps/web/.env
```

## Contributing workflow

1. Fork and create a branch from `main`.
2. Make focused changes with tests where behavior changes.
3. Run the CI commands above.
4. Open a pull request with a clear description and test plan.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for code style, commit conventions, and community guidelines.

## Common tasks

### Add or change an assessment field

1. Update JSON Schema under `packages/schema/schemas/`.
2. Update Zod validators and form definitions in `packages/schema/`.
3. Add fixtures under `packages/schema/fixtures/` and extend tests.
4. Rebuild schema (`pnpm --filter @mmap/schema build`) — Turbo does this automatically for dependents.

### Update the field protocol guide

Edit `docs/protocols/manatee-v1-field-guide.md`. The field app bundles this markdown for the in-app **Help** (`?`) page at `/help/protocol`.

### Field app version banner

Each build writes a unique semver string to `apps/field/public/version.json`. The field PWA polls this file and prompts when a newer deployment is available.

## Troubleshooting

### Blank page at http://localhost:5173

The browser may be serving a cached Vite dev `index.html` or a stale service worker from an earlier local dev session.

1. DevTools → **Application** → **Service workers** → Unregister for `localhost:5173`.
2. **Storage** → **Clear site data**.
3. Hard refresh (**Ctrl+Shift+R** / **Cmd+Shift+R**).

Or use a private/incognito window. Keep Docker web on **5173** and local web dev on **5175**.

### Field sync not reaching API

- Confirm API is healthy: `curl http://localhost:3001/v1/health`
- In dev, leave `VITE_API_BASE_URL` unset so `/v1` proxies correctly.
- Check CORS origins in `apps/api/.env` include your field dev port (5174).

### Integration tests skipped

If `DATABASE_URL` is missing or PostgreSQL is unreachable, API integration tests skip gracefully. Field sync integration sets `SYNC_INTEGRATION_READY=false` and skips. Ensure Postgres is running and the URL is correct.

### pnpm / Node version mismatch

The root `package.json` specifies `"engines": { "node": ">=20" }` and `"packageManager": "pnpm@9.15.4"`. Use Node 20 LTS and pnpm 9 for parity with CI.
