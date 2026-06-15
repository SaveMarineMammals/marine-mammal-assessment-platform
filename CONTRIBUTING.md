# Contributing to MMAP

Thank you for your interest in the Marine Mammal Assessment Platform!

## Getting started

1. Read the [Developer guide](docs/DEVELOPMENT.md) for clone, install, Docker, and local dev setup.
2. Skim [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for product context.
3. Check open issues or open a discussion before large changes.

## Development workflow

1. Fork and clone the repository.
2. Create a feature branch from `main`.
3. Make changes with tests where behavior changes.
4. Run the same checks CI runs (see below).
5. Open a pull request — the [PR template](.github/pull_request_template.md) includes a test plan checklist.

## Pre-merge checks

CI must pass on every pull request. Run these locally from the repository root:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

If you changed sync, API, or schema behavior, also run integration tests (requires PostgreSQL):

```bash
docker compose up -d postgres
pnpm test:integration -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
```

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for the full pipeline.

## Code style

- TypeScript for application and package code.
- ESLint and Prettier configs at the repository root.
- Use workspace protocol (`workspace:*`) for internal package dependencies.
- Keep changes focused; prefer small, reviewable pull requests.

## Commit messages

Use clear, descriptive commit messages. Conventional prefixes are encouraged:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` tooling or maintenance
- `test:` tests only

## Pull requests

- Ensure all CI jobs pass (format, lint, unit tests, build, integration).
- Update documentation when behavior or setup changes.
- Link related issues when applicable.

## Community

Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) in all project interactions.

## Questions

Open a GitHub Discussion or issue for questions about architecture, field protocols, or contribution scope.
