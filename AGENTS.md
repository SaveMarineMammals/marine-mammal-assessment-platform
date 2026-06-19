# AGENTS.md — guide for AI coding agents

This file orients automated agents (Cursor, Copilot, CI bots, etc.) working in the **Marine Mammal Assessment Platform (MMAP)** repository. Follow it together with [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md).

## Project context

**MMAP** is an open-source, **offline-first** platform for marine mammal field assessments. The first protocol is **manatee_v1**, supporting CMARI-style Belize field workflows.

| App / package       | Role                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `apps/field`        | Offline PWA for biologists — IndexedDB, background sync, in-app protocol guide |
| `apps/api`          | Fastify API — sync batch ingestion, public dataset endpoints, PostgreSQL       |
| `apps/web`          | Public mission site, docs, read-only dataset portal                            |
| `packages/schema`   | JSON Schema, Zod validators, form definitions, test fixtures                   |
| `packages/geo-time` | UTC storage and local-time display from capture coordinates                    |

**Data flow:** Field app captures assessments offline → queues sync → POST `/v1/sync/batch` when online → API validates with `@mmap/schema` → PostgreSQL. Public web reads anonymized data via `/v1/public/*`.

**Monorepo:** pnpm workspaces + Turborepo. Root scripts: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm validate`.

## Before you change code

1. Read [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) — **required** for style and testing rules.
2. Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup and commands.
3. Identify which app/package owns the behavior you are changing; keep diffs scoped.
4. Do not commit secrets, `dist/`, or generated field version files.

## Style guide (summary)

Full rules: [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md).

| Rule           | Detail                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Language       | TypeScript, strict mode, ESM                                                                               |
| Imports        | Relative imports use `.js` extension (`NodeNext`)                                                          |
| Formatting     | Prettier — single quotes, semicolons, 100 cols, trailing commas                                            |
| Lint           | ESLint at repo root; prefix unused vars with `_`                                                           |
| Workspace deps | `"workspace:*"` for `@mmap/schema`, `@mmap/geo-time`                                                       |
| Scope          | Minimal diff; match existing patterns; no drive-by refactors                                               |
| Comments       | Only for non-obvious logic; no narrating obvious code                                                      |
| Schema changes | Update JSON Schema, Zod, fixtures, and tests together                                                      |
| Terraform      | `.tf` files must use **LF** line endings (see `.gitattributes`) — CRLF breaks `terraform plan` on Linux CI |

### Formatting (required on every change)

CI runs `pnpm format:check` first in the quality job. **Any edited file must pass Prettier before you finish** — including markdown, YAML, JSON, and TypeScript.

1. After editing, run **`pnpm format`** on the repo (or on paths you touched) to apply fixes.
2. Confirm with **`pnpm format:check`** (must exit 0).
3. Do not leave formatting fixes for the user or CI — unformatted docs and workflows are a common CI failure.

Run before finishing (cross-platform — works in PowerShell, cmd, and bash):

```text
pnpm format
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

Or run the full gate: `pnpm validate` (includes `format:check`, lint, test, build).

If you touch sync, API persistence, or schema ingestion, also run integration tests (PostgreSQL required):

```text
docker compose up -d postgres
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

Or `pnpm validate:integration` after Postgres is up (pass `--database-url` as above if needed).

### Windows (PowerShell and Git Bash)

This repo has **no `.sh` files** and no bash-based git hooks. **Do not** create shell scripts or run bash-only syntax (`./script.sh`, `cp`, heredoc commits, `cat <<EOF`) for validation or tooling. Infrastructure helpers live in `scripts/terraform-*.ts` and run via `pnpm exec tsx` on PowerShell, Git Bash, or CI.

**Git Bash is supported** for all `pnpm` commands. Set non-interactive installs when automating:

```bash
CI=true pnpm install --frozen-lockfile
pnpm validate
```

Root `.npmrc` sets `confirm-modules-purge=false` so `pnpm install` does not block on "Proceed? (Y/n)".

**Never invoke Cursor plugin bash hooks** (for example AWS Deployments `validate-drawio.sh`). That script is external to this repo and can leave Git Bash terminals open on Windows. Use **Mermaid** in markdown for architecture diagrams — do not add `.drawio` files to this repository.

Use **pnpm scripts only** — they invoke Node.js and work natively on Windows:

```powershell
pnpm validate
pnpm --filter @mmap/field test
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

## Automated testing requirements

CI **must pass** before merge. Agents must add or update tests when behavior changes.

### Required CI jobs

- **Lint, format & unit tests** — `format:check`, `lint`, `test`
- **Production build** — `build`
- **API & field sync integration** — `test:integration` with Postgres

### When to write tests

- **Schema / validation changes** → `@mmap/schema` unit tests + fixture updates
- **API routes or sync logic** → `@mmap/api` unit tests; integration tests if DB/HTTP contract changes
- **Field offline/sync/UI data logic** → `@mmap/field` unit tests; integration test if sync path changes
- **Bug fixes** → regression test
- **Docs-only** → no new tests, but run format/lint if applicable

### Conventions

- Unit tests: `src/**/*.test.ts`, Vitest
- Integration tests: `src/**/*.integration.test.ts`
- Use fixtures: `packages/schema/fixtures/` via `loadFixture()`
- Field tests: isolate IndexedDB per test; mock `navigator.onLine` as needed; clean up in `afterEach`
- Do not add trivial tests; do not skip integration tests for sync/API work without explicit instruction

## Architecture constraints

- **Offline-first field app** — Never assume network; UI and repository layers must work offline.
- **Single schema source** — Validation rules live in `@mmap/schema`; API and field must use them.
- **UTC in storage** — Timestamps stored as UTC ISO strings; display local time via `@mmap/geo-time`.
- **Same-origin API in dev** — Leave `VITE_API_BASE_URL` unset; Vite/nginx proxy `/v1`.
- **Ports (local Docker)** — Web 5173, Field 5174, API 3001; web **dev** server uses 5175.

## Common tasks

| Task                 | Location                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| Add assessment field | `packages/schema/schemas/`, form definitions, fixtures, field/API consumers |
| Change sync payload  | `apps/api/src/services/sync-batch.ts`, `apps/field/src/sync/`               |
| Field protocol guide | `docs/protocols/manatee-v1-field-guide.md` (bundled in field app)           |
| Public dataset API   | `apps/api/src/services/public-dataset.ts`                                   |
| CI workflow          | `.github/workflows/ci.yml`                                                  |
| Branch protection    | `.github/rulesets/main-branch-protection.json`                              |

## Git and PR expectations

- Work on feature branches; merge to `main` via PR only.
- Do not create commits unless the user asks.
- PRs need green CI, one non-pusher approval, resolved threads, linear history (squash/rebase merge).
- Update docs when setup or user-visible behavior changes.

## Do not

- Duplicate schema validation in apps instead of using `@mmap/schema`
- Hardcode merge commits or bypass branch rules in instructions to users
- Add heavy dependencies without clear need
- Over-engineer abstractions for one-off logic
- Run web dev server on port 5173 while Docker web is up (cache conflicts)
- Commit `.env`, credentials, or `node_modules/`
- Create or invoke `.sh` / bash scripts — use `pnpm validate` and `pnpm exec tsx scripts/...` instead
- Add `.drawio` files or run plugin hooks like `validate-drawio.sh` — use Mermaid in markdown
- Run long-lived background processes in agent terminals without explicit user request
- Finish a task without running `pnpm format` then `pnpm format:check` on touched files (CI fails on Prettier drift)

## Key documentation

| Document                                               | Purpose                                    |
| ------------------------------------------------------ | ------------------------------------------ |
| [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)   | Full style guide and testing policy        |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)             | Clone, build, test, troubleshoot           |
| [docs/ops/FAILURE_MODES.md](docs/ops/FAILURE_MODES.md) | Incident triage and runbooks (FM-01–FM-05) |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)           | Functional requirements                    |
| [CONTRIBUTING.md](CONTRIBUTING.md)                     | Human contributor workflow                 |
| [README.md](README.md)                                 | Overview and architecture diagram          |

When instructions conflict, **user request** > **this file** > **CODING_STANDARDS.md** > general defaults — but never skip required tests or CI checks for behavioral changes unless the user explicitly accepts that tradeoff.
