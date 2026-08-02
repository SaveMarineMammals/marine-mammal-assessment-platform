# Deployment runbook

Operator checklist for promoting MMAP to staging and production on AWS. See [AWS_INFRA.md](AWS_INFRA.md) for architecture and [INFRA_PIPELINES.md](INFRA_PIPELINES.md) for workflow details.

## Prerequisites

- AWS account with Terraform remote state bucket and lock table bootstrapped
- GitHub environment secrets / OIDC role configured (`infra/terraform/modules/github-oidc`)
- Repository variable `TF_INFRA_ENABLED=true`
- **Custom domain (production-ready URLs):** enable `savemarinemammals.com` in bootstrap, then wire
  staging/production (see [Custom domain](#custom-domain-savemarinemammalscom) below). Until then,
  leave `domain_name = ""` to use CloudFront default `*.cloudfront.net` hostnames.

## Custom domain (`savemarinemammals.com`)

Apply order — do not set env `domain_name` until bootstrap ACM is `ISSUED`.

1. **Bootstrap** ([`infra/bootstrap/README.md`](../../infra/bootstrap/README.md)):
   - Set `enable_public_domain = true` and fill `domain_contact` in `terraform.tfvars`
   - `terraform apply` (registers domain, hosted zone, apex + wildcard ACM in us-east-1)
   - Copy outputs: `hosted_zone_id`, `acm_certificate_arn`
2. **Staging** `terraform.tfvars`:
   - `domain_name = "savemarinemammals.com"`, `web_subdomain = "staging"`,
     `enable_apex_redirect = false`, plus zone id and cert ARN from bootstrap
   - Apply → verify `https://staging.savemarinemammals.com`, `/field/app`, `/v1/health`
3. **Production** `terraform.tfvars`:
   - `domain_name = "savemarinemammals.com"`, `web_subdomain = "www"`,
     `enable_apex_redirect = true`, plus the same zone id and cert ARN
   - Apply → verify `https://www.savemarinemammals.com`, apex **301** to www, field path, `/v1`
4. Run `live-verify` against the new `web_url` Terraform outputs

| Environment | Canonical URL                           | Notes                                        |
| ----------- | --------------------------------------- | -------------------------------------------- |
| Staging     | `https://staging.savemarinemammals.com` | Field at `/field/app`                        |
| Production  | `https://www.savemarinemammals.com`     | `https://savemarinemammals.com` → 301 to www |

ACM for CloudFront-integrated use is free. Domain registration is ~$16/yr; hosted zone $0.50/mo.

## Staging deploy

Staging is **ephemeral by default** for cost control: destroy when idle, re-apply when needed. See [AWS_INFRA.md — Ephemeral staging](AWS_INFRA.md#ephemeral-staging). Local Docker covers day-to-day development.

CloudFront is enabled in staging and production via `enable_cdn = true` (see [CloudFront](AWS_INFRA.md#cloudfront-enable_cdn)). A **single** distribution serves the mission site at `/` and the field PWA at `/field/app/`, with same-origin `/v1`. Live API testing can also use `api_service_url` (ECS Express) directly.

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
3. CD applies production Terraform, deploys the app (API runs migrations on container startup), then runs smoke live-verify.
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

| Secret            | Location                                                    | Rotation                                                                 |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| RDS master user   | Secrets Manager (RDS-managed; wired into ECS via Terraform) | Enable RDS secret rotation in AWS; redeploy API after rotation if needed |
| `API_ADMIN_TOKEN` | Secrets Manager                                             | Generate new token; update secret; redeploy API                          |

The database password is **not** stored in Terraform state or GitHub as a plain connection string. ECS injects the RDS JSON secret plus `DB_HOST` / `DB_PORT` / `DB_NAME`; the API normalizes them to a PostgreSQL URL on startup (including migrations).

Never store secrets in the repository or Terraform `.tfvars` committed to git.

## Security remediation

Track open security work in [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md).

## Incident runbooks

For operational failures (sync, database, Terraform, deploy pipeline, local Docker), see [FAILURE_MODES.md](FAILURE_MODES.md) and [runbooks/](runbooks/).
