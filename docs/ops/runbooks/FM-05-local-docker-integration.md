# FM-05 — Docker Compose / integration test environment failure

**ID:** FM-05  
**Domain:** Application (local dev + CI)  
**Severity:** Medium

## Context

Local full stack and integration tests depend on **Docker Compose** (`docker-compose.yml`) and/or the CI **postgres service** (`.github/workflows/ci.yml`).

| Mode              | Services                         | Purpose                             |
| ----------------- | -------------------------------- | ----------------------------------- |
| Full stack        | postgres, minio, api, web, field | End-to-end local demo               |
| Dev hybrid        | postgres, minio, api only        | Hot-reload frontends via `pnpm dev` |
| Integration tests | postgres (local or CI service)   | `pnpm test:integration`             |

Compose uses **healthchecks** — `api` waits for healthy postgres/minio; `web`/`field` wait for healthy api. Postgres image: `postgis/postgis:16-3.4` on port **5432**.

CI integration job sets `DATABASE_URL=postgresql://mmap:mmap@localhost:5432/mmap` and runs the same integration runner as local.

**Who is affected:** Developers blocked from validating sync; PRs fail **API & field sync integration** job; false confidence if tests skip silently.

**What breaks:**

- Docker not running or port **5432/3001/5173/5174** already in use
- Postgres container unhealthy (volume corruption, platform pull issues on Windows)
- API container exits (migration failure, bad env)
- Integration tests skip when `DATABASE_URL` unset and Postgres unreachable
- Port conflict: local web dev on **5173** while Docker web uses **5173** ([DEVELOPMENT.md](../../DEVELOPMENT.md))

## Detection

| Signal                                              | Where                       |
| --------------------------------------------------- | --------------------------- |
| `docker compose ps` shows `unhealthy` or `Exit`     | Local terminal              |
| `connection refused` on 5432                        | migrate / integration tests |
| CI job **API & field sync integration** failed      | GitHub Actions              |
| Tests log: skipped / `SYNC_INTEGRATION_READY=false` | Vitest output               |
| `pnpm validate:integration` exits non-zero          | Local pre-PR check          |

## Prerequisites

- Docker Desktop running (Windows/macOS) or Docker Engine (Linux)
- Node 20+, pnpm 9 (`packageManager` in root `package.json`)
- No conflicting process on ports 5432, 3001, 5173, 5174, 9000

## Diagnosis

1. **Check Docker and compose status**

   Git Bash / PowerShell:

   ```bash
   docker compose ps
   docker compose logs postgres --tail 30
   docker compose logs api --tail 50
   ```

2. **Test Postgres directly**

   ```bash
   docker compose exec postgres pg_isready -U mmap -d mmap
   ```

   Expected: `accepting connections`.

3. **Test API health**

   Git Bash:

   ```bash
   curl -s http://localhost:3001/v1/health
   curl -s http://localhost:5174/v1/health
   ```

4. **Check port conflicts (Windows)**

   PowerShell:

   ```powershell
   Get-NetTCPConnection -LocalPort 5432,3001,5173,5174 -ErrorAction SilentlyContinue |
     Select-Object LocalPort, OwningProcess
   ```

   Git Bash:

   ```bash
   netstat -ano | grep -E '5432|3001|5173|5174'
   ```

5. **Run integration tests with explicit URL**

   Git Bash:

   ```bash
   docker compose up -d postgres
   pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
   ```

   PowerShell:

   ```powershell
   docker compose up -d postgres
   pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
   ```

6. **Compare with CI**

   CI uses the same PostGIS image and credentials as Compose. If local fails but CI passes, suspect local Docker state or port conflict — not application code.

7. **Platform issues (Windows ARM / mixed arch)**

   `docker-compose.yml` pins postgres to `platform: linux/amd64`. On Apple Silicon or ARM Windows, ensure emulation is enabled in Docker Desktop.

## Resolution

1. **Start minimal stack for tests**

   Git Bash / PowerShell:

   ```bash
   docker compose up -d postgres
   ```

   Wait until healthy, then migrate:

   ```bash
   pnpm --filter @mmap/api db:migrate -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
   pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
   ```

2. **Full stack rebuild**

   ```bash
   docker compose down
   docker compose up -d --build
   ```

   For persistent volume issues (corrupt data):

   ```bash
   docker compose down -v
   docker compose up -d --build
   ```

   **Warning:** `-v` deletes local Postgres data.

3. **Port 5432 in use**

   - Stop local PostgreSQL service or other container using 5432.
   - Or change host port in `docker-compose.yml` (not recommended — breaks documented URLs) and pass matching `--database-url`.

4. **API container unhealthy**

   ```bash
   docker compose logs api
   ```

   Common fixes:

   - Postgres not ready — wait and `docker compose restart api`
   - Run migrations against compose DB (API may expect schema on startup for some routes)

5. **Blank page / stale cache on 5173**

   See [DEVELOPMENT.md](../../DEVELOPMENT.md#blank-page-at-httplocalhost5173): unregister service worker, clear site data, use web dev on **5175** instead.

6. **Integration tests skip**

   Always pass `--database-url` or export `DATABASE_URL` before `pnpm test:integration`. CI sets this in workflow env; local shells often omit it.

7. **CI integration failure**

   - Reproduce locally with same command as CI.
   - Fix sync/schema regression; ensure `pnpm --filter @mmap/schema build` precedes API tests (CI does this explicitly).

## Verification

- [ ] `docker compose ps` — postgres (and api if full stack) **healthy**
- [ ] `pg_isready` succeeds
- [ ] `curl http://localhost:3001/v1/health` returns OK
- [ ] `pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap` passes
- [ ] Optional: `pnpm validate:integration` passes after Postgres up
- [ ] Field sync works against Docker API (`http://localhost:5174`, same-origin `/v1`)

## Escalation / when to stop

- **Stop** using `docker compose down -v` on shared dev machines without team coordination — destroys local DB.
- **Escalate** if CI integration fails on `main` for all PRs — likely infrastructure/service container issue in `ci.yml`, not individual laptops.
- Do not point local apps at **production RDS** ([infra/README.md](../../../infra/README.md)).

## References

| Resource                      | Path                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Compose file                  | `docker-compose.yml`                                                                    |
| CI integration job            | `.github/workflows/ci.yml` (`integration`)                                              |
| Developer guide               | [DEVELOPMENT.md](../../DEVELOPMENT.md)                                                  |
| Docker full stack             | [DEVELOPMENT.md](../../DEVELOPMENT.md#option-a--full-stack-in-docker-fastest-first-run) |
| Integration testing           | [DEVELOPMENT.md](../../DEVELOPMENT.md#integration-tests)                                |
| Field sync troubleshooting    | [DEVELOPMENT.md](../../DEVELOPMENT.md#field-sync-not-reaching-api)                      |
| AGENTS.md validation commands | [AGENTS.md](../../../AGENTS.md)                                                         |
| Field nginx proxy             | `apps/field/nginx.conf`                                                                 |
| API Dockerfile                | `apps/api/Dockerfile`                                                                   |
