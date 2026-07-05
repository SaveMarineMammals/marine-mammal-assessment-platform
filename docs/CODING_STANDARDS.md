# Coding standards and guidelines

This document defines how we write code in the Marine Mammal Assessment Platform (MMAP). It complements [CONTRIBUTING.md](../CONTRIBUTING.md) and [DEVELOPMENT.md](DEVELOPMENT.md).

All contributors and automation (including AI agents) must follow these standards. CI enforces formatting, lint, tests, and build on every pull request.

## Principles

1. **Correctness over cleverness** — Prefer clear, maintainable code that field biologists and researchers can rely on offline.
2. **Shared truth in packages** — Assessment shapes, validation, and time handling live in `@mmap/schema` and `@mmap/geo-time`; apps consume them instead of duplicating rules.
3. **Minimal diffs** — Change only what the task requires; match surrounding style and abstractions.
4. **Test behavior that matters** — Add or update tests when logic, validation, sync, or API contracts change.

## Language and tooling

| Area                   | Standard                                           |
| ---------------------- | -------------------------------------------------- |
| Language               | TypeScript (strict mode) for apps and packages     |
| Module system          | ESM (`"type": "module"`)                           |
| Package manager        | pnpm 9.x (see root `packageManager`)               |
| Node.js                | 20 LTS minimum; CI uses Node 24                    |
| Monorepo orchestration | Turborepo (`pnpm test`, `pnpm lint`, `pnpm build`) |
| Formatter              | Prettier (root `prettier.config.js`)               |
| Linter                 | ESLint flat config (root `eslint.config.js`)       |
| Unit tests             | Vitest                                             |
| API server             | Fastify 5                                          |
| Frontends              | React 19 + Vite 6                                  |

## TypeScript style

### Compiler settings

Packages extend `tsconfig.base.json`:

- `strict: true`
- `noUnusedLocals` / `noUnusedParameters`
- `module` / `moduleResolution`: `NodeNext`

Do not relax strictness locally without team discussion.

### Imports and modules

- Use **`.js` extensions** in relative TypeScript imports (NodeNext resolution), e.g. `import { foo } from './foo.js'`.
- Prefer **named exports**; use default exports only where a framework requires them.
- Internal workspace dependencies use `"workspace:*"` in `package.json`.
- Prefix intentionally unused parameters or variables with `_` (ESLint allows this).

### Types

- Prefer `interface` for object shapes that may be extended; use `type` for unions, aliases, and mapped types.
- Avoid `any`; use `unknown` and narrow when handling external input.
- Share domain types through `@mmap/schema` rather than redefining assessment/measurement shapes in apps.

### Async and errors

- Use `async`/`await`; handle errors at boundaries (API routes, sync, user-facing forms).
- Do not swallow errors silently; log or surface meaningful messages for operators.
- Clean up subscriptions, timers, and listeners in React `useEffect` return functions and test `afterEach` hooks.

## Formatting (Prettier)

Run **`pnpm format`** after every edit (applies Prettier to the whole repo, including markdown and YAML). Then run **`pnpm format:check`** to confirm CI will pass. AI agents must not skip the write step — `format:check` alone does not fix violations.

Human contributors may rely on editor format-on-save using the repo config instead:

| Option          | Value    |
| --------------- | -------- |
| Semicolons      | Yes      |
| Quotes          | Single   |
| Trailing commas | All      |
| Print width     | 100      |
| Indent          | 2 spaces |

CI runs `pnpm format:check`. Do not hand-format to a different style.

Files excluded from Prettier are listed in `.prettierignore` (lockfiles, generated artifacts, GitHub issue templates).

## Linting (ESLint)

- ESLint config lives at the repository root and applies to all packages.
- Run `pnpm lint` from the root (or `pnpm --filter @mmap/<pkg> lint`).
- Fix lint errors; do not disable rules without justification in the PR description.

Current custom rules:

- `@typescript-eslint/no-unused-vars` — error; prefix unused bindings with `_`.

## Naming conventions

| Item                  | Convention                                         | Example                                   |
| --------------------- | -------------------------------------------------- | ----------------------------------------- |
| Files (TS/React)      | kebab-case or descriptive camelCase for components | `sync-service.ts`, `AssessmentList.tsx`   |
| React components      | PascalCase                                         | `SchemaFormRenderer`                      |
| Functions / variables | camelCase                                          | `getSyncableEntries`                      |
| Constants             | UPPER_SNAKE or camelCase for config objects        | `MANATEE_V1_PROTOCOL`, `SYNC_INTERVAL_MS` |
| Types / interfaces    | PascalCase                                         | `FormatLocalTimeOptions`                  |
| Protocol keys         | snake_case with version suffix                     | `manatee_v1`                              |
| Test files            | Same name as module + `.test.ts`                   | `sync-service.test.ts`                    |
| Integration tests     | `.integration.test.ts`                             | `sync-path.integration.test.ts`           |
| JSON Schema files     | snake_case                                         | `assessment.schema.json`                  |

## Project layout conventions

```
apps/
  api/     — Fastify sync & public dataset API; PostgreSQL persistence
  field/   — Offline-first PWA; IndexedDB; background sync
  web/     — Public mission site and dataset portal
packages/
  schema/  — JSON Schema, Zod validators, form definitions, fixtures
  geo-time/ — UTC storage and coordinate-based local time display
docs/      — Requirements, protocols, UAT, this guide
```

### `@mmap/schema`

- JSON Schema files under `packages/schema/schemas/`.
- Zod validators and TypeScript types alongside protocol folders (`manatee_v1/`, `dolphin_v1/`).
- **Fixtures** under `packages/schema/fixtures/` for valid/invalid examples; use `loadFixture()` in tests.
- When adding or changing fields, update schema, validators, fixtures, and tests together.

### `@mmap/api`

- Route handlers stay thin; business logic in `src/services/`.
- Database access in `src/db/`.
- Migrations in `apps/api/migrations/` (SQL, sequential numbering).
- Integration tests require PostgreSQL (`*.integration.test.ts`).

### `@mmap/field`

- Offline-first: assume no network; queue writes to IndexedDB and sync later.
- UI must work on tablets (touch targets, portrait/landscape layouts).
- Protocol guide markdown lives in `docs/protocols/` and is bundled for in-app help.
- Use `@mmap/schema` form definitions for dynamic forms; avoid hardcoding field lists.

### `@mmap/web`

- Content markdown under `apps/web/content/`.
- Public API calls go through same-origin `/v1` proxy in dev and Docker.

## Comments and documentation

- Code should be mostly self-explanatory.
- Comment **why**, not **what**, for non-obvious business rules (sync backoff, protocol edge cases, offline fallbacks).
- Update user-facing docs and README when setup or behavior changes.
- Mark advisor-review placeholders in protocol copy as `[CMARI REVIEW]` where applicable.

## Security and configuration

- Never commit secrets (`.env`, tokens, credentials). Use `.env.example` files as templates.
- Do not commit generated build artifacts (`dist/`, field `src/generated/`, `apps/field/public/version.json`).
- Validate all external input with `@mmap/schema` at API boundaries and before sync upload.

## Automated testing requirements

Testing is **mandatory** for merged work. CI blocks PRs until all checks pass.

### CI gates (required on every PR)

| Job         | Command                                       | Purpose                                     |
| ----------- | --------------------------------------------- | ------------------------------------------- |
| Quality     | `pnpm format:check`, `pnpm lint`, `pnpm test` | Style, lint, unit tests                     |
| Build       | `pnpm build`                                  | Typecheck and production build all packages |
| Integration | `pnpm test:integration` (with PostgreSQL)     | API sync + field sync path                  |

Run locally before opening a PR:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
docker compose up -d postgres
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

### When to add tests

| Change                                      | Required tests                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| New or changed validation / schema rules    | Unit tests in `@mmap/schema`; update fixtures                                        |
| API sync or public endpoints                | Unit tests in `@mmap/api`; integration tests if persistence or HTTP contract changes |
| Field sync, repository, or offline behavior | Unit tests in `@mmap/field`; integration test if end-to-end sync path affected       |
| Bug fix                                     | Regression test covering the fixed behavior                                          |
| Pure refactor (no behavior change)          | Existing tests must still pass; add tests only if coverage was missing               |
| Docs-only change                            | No new tests; still run format/lint if markdown tooling applies                      |

### Unit tests

- Framework: **Vitest** (`vitest.config.ts` per package).
- Location: co-located as `*.test.ts` next to source under `src/`.
- Structure: `describe` / `it`; one logical behavior per test.
- Use fixtures from `packages/schema/fixtures/` for assessment/measurement JSON.
- Field tests: use `fake-indexeddb`, isolated Dexie databases per test, `vi.stubGlobal` for network/online state; clean up in `afterEach`.
- API tests: mock at service boundary where practical; use real DB for integration suites.
- Avoid tests that only assert mocks or trivial getters with no logic.

### Integration tests

- File suffix: `*.integration.test.ts`.
- API: `apps/api/vitest.integration.config.ts` — requires `DATABASE_URL`.
- Field sync path: `apps/field/vitest.integration.config.ts` — spins up test API on port 3099 via global setup.
- Root runner: `pnpm test:integration` runs both suites.
- Do not skip integration tests in CI for sync/API/schema changes without explicit team approval.

### Test quality

- Prefer deterministic tests (fixed UUIDs, frozen timestamps in fixtures).
- Tests must pass in CI on Ubuntu with a fresh `pnpm install --frozen-lockfile`.
- Do not depend on local Docker services for **unit** tests.
- Keep tests fast; long-running load tests belong in optional scripts (e.g. `sync:load-test`), not default CI.

## Pull requests and commits

- Branch from `main`; open a PR (direct pushes to `main` are blocked except bypass users).
- Use conventional commit prefixes when helpful: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- PR description must include a **test plan** (see [.github/pull_request_template.md](../.github/pull_request_template.md)).
- One approval from a non-pusher, resolved review threads, green CI, and linear history are required to merge.

## Related documents

- [DEVELOPMENT.md](DEVELOPMENT.md) — setup and day-to-day commands
- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution workflow
- [REQUIREMENTS.md](REQUIREMENTS.md) — product requirements
- [AGENTS.md](../AGENTS.md) — guide for AI coding agents
