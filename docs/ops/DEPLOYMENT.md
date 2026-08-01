# Deployment runbook

Operator checklist for promoting MMAP to staging and production on AWS. See [AWS_INFRA.md](AWS_INFRA.md) for architecture and [INFRA_PIPELINES.md](INFRA_PIPELINES.md) for workflow details.

## Prerequisites

- AWS account with Terraform remote state bucket and lock table bootstrapped
- GitHub environment secrets / OIDC role configured (`infra/terraform/modules/github-oidc`)
- Repository variable `TF_INFRA_ENABLED=true`
- Optional: Route 53 hosted zone + ACM certificate when using a custom `domain_name` (CloudFront default certificate is used when `domain_name` is empty)

## Staging deploy

Staging is **ephemeral by default** for cost control: destroy when idle, re-apply when needed. See [AWS_INFRA.md — Ephemeral staging](AWS_INFRA.md#ephemeral-staging). Local Docker covers day-to-day development.

CloudFront is currently **optional** (`enable_cdn = false`) until the AWS account can create distributions. Live API testing uses `api_service_url` (ECS Express). See [Optional CloudFront](AWS_INFRA.md#optional-cloudfront-enable_cdn).

### Automatic (merge to `main`)

1. Open a PR; required CI gates must pass (quality, CodeQL, build, integration, Terraform plan).
2. Merge to `main`. The **CD** workflow runs quality gates again, then staging Terraform apply → app deploy → full live-verify.
3. If staging verification fails, production is not started.
4. When idle, either hibernate (`pnpm exec tsx scripts/staging-hibernate.ts hibernate`, ~$25/mo floor) or destroy staging infrastructure (~$0/mo; bootstrap remains).

### Manual (feature branch or re-release)

1. Actions → **Release staging** → Run workflow (optional `git_ref`).
2. Cold start is typically 10–20 minutes for a fresh stack.
3. Workflow applies infra, deploys the app, and runs full live-verify.

### What full live-verify covers

`pnpm exec tsx scripts/live-verify.ts staging --mode full`:

- `/v1/health`, `/v1/public/stats` (DB), `/v1/public/meta`
- `POST /v1/sync/batch` with fresh UUIDs + idempotent replay
- Public assessment readback and CSV export containing the synced assessment
- When `enable_cdn = true`: field `version.json` and same-origin `/v1/health`

ALB/task readiness remains `terraform-smoke-test.ts` (retries) before live-verify.

## Production promotion

Production promotes **automatically** after staging full live-verify succeeds on the same CD run (merge to `main`).

1. Prefer completing field UAT ([uat checklist](../uat/manatee-v1-checklist.md)) before merging high-risk changes.
2. Merge to `main` with green PR CI.
3. CD applies production Terraform, deploys the app (migrations before API rollout), then runs smoke live-verify.
4. Smoke mode checks health, DB stats, public read paths, and CSV headers — **no mutating sync** (avoids polluting the public dataset).
5. Update [../data/CHANGELOG.md](../data/CHANGELOG.md) if a dataset snapshot is published.

### Emergency app-only redeploy

Actions → **Deploy AWS** → choose `staging` or `production`. Infra must already exist. Prefer **Release staging** or a fix-forward merge to `main` for normal releases.

## Rollback

| Component          | Rollback action                                                           |
| ------------------ | ------------------------------------------------------------------------- |
| API (ECS Express)  | Redeploy previous ECR image (SHA tag) via **Deploy AWS** / Express update |
| Web / field static | Restore previous S3 version; CloudFront invalidation `/*`                 |
| Database           | Restore RDS snapshot (see below) — **last resort**                        |

## Database backup & restore drill

**Backups:** RDS automated daily snapshots (retention per environment in Terraform).

**Quarterly restore drill:**

1. Restore latest snapshot to a temporary RDS instance in staging VPC.
2. Point a local or staging API at the restored endpoint.
3. Run `pnpm test:integration` against restored DB.
4. Delete temporary instance.
5. Log drill date in this file.

## Monitoring checks after deploy

- [ ] CD **Verify staging (full)** and **Verify production (smoke)** jobs green
- [ ] `/v1/health` and `/v1/public/stats` return 200
- [ ] CloudWatch alarms `mmap-{env}-ecs-cpu-high` and `mmap-{env}-rds-low-storage` in OK state
- [ ] ECS Express service healthy / tasks running (unless hibernated)
- [ ] RDS free storage above threshold
- [ ] Field PWA `version.json` reflects new build when CDN is enabled

## Secrets rotation

| Secret            | Location                                                            | Rotation                                                                 |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| RDS master user   | Secrets Manager (RDS-managed ARN → `DATABASE_SECRET_ARN` in GitHub) | Enable RDS secret rotation in AWS; redeploy API after rotation if needed |
| `API_ADMIN_TOKEN` | Secrets Manager                                                     | Generate new token; update secret; redeploy API                          |

The database password is **not** stored in Terraform state or GitHub as a plain connection string. CI migrations fetch the RDS JSON secret at runtime; the API normalizes it to a PostgreSQL URL.

Never store secrets in the repository or Terraform `.tfvars` committed to git.

## Security remediation

Track open security work in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).

## Incident runbooks

For operational failures (sync, database, Terraform, deploy pipeline, local Docker), see [FAILURE_MODES.md](FAILURE_MODES.md) and [runbooks/](runbooks/).
