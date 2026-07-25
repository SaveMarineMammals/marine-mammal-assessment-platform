# Deployment runbook

Operator checklist for promoting MMAP to staging and production on AWS. See [AWS_INFRA.md](AWS_INFRA.md) for architecture.

## Prerequisites

- AWS account with Terraform remote state bucket and lock table bootstrapped
- GitHub environment secrets / OIDC role configured (`infra/terraform/modules/github-oidc`)
- Optional: Route 53 hosted zone + ACM certificate when using a custom `domain_name` (CloudFront default certificate is used when `domain_name` is empty)

## Staging deploy

Staging is **ephemeral by default** for cost control: destroy when idle, re-apply when needed. See [AWS_INFRA.md — Ephemeral staging](AWS_INFRA.md#ephemeral-staging). Local Docker covers day-to-day development.

1. Ensure staging infrastructure exists (`terraform apply` or Infra staging manual workflow). Cold start is typically 10–20 minutes.
2. Merge application changes to `main`; CI passes (`pnpm validate` locally if needed).
3. Trigger staging deploy (push to `main` or manual workflow).
4. Verify:
   - `https://field-staging.<domain>/` loads field PWA (or CloudFront default domain if no custom DNS)
   - `https://staging.<domain>/` loads public web
   - `curl https://field-staging.<domain>/v1/health` returns `status: ok`
5. Run smoke sync: field app → create assessment → sync → confirm in API/admin or public list.
6. Check CloudWatch dashboard for 5xx alarms (should be green).
7. When idle, either hibernate (`pnpm exec tsx scripts/staging-hibernate.ts hibernate`, ~$25/mo floor) or destroy staging infrastructure (~$0/mo; bootstrap remains).

## Production promotion

1. Complete staging verification and field UAT sign-off ([uat checklist](../uat/manatee-v1-checklist.md)).
2. Create annotated git tag: `git tag -a v1.0.0 -m "MMAP v1.0.0"` and push tag.
3. GitHub Actions `deploy-aws` runs against production environment (approval gate recommended).
4. Migrations run before API rollout (workflow step).
5. Post-deploy verification (same as staging, production URLs).
6. Update [../data/CHANGELOG.md](../data/CHANGELOG.md) if dataset snapshot published.

## Rollback

| Component          | Rollback action                                                   |
| ------------------ | ----------------------------------------------------------------- |
| API (ECS Express)  | Redeploy previous ECR image tag via `deploy-aws` / Express update |
| Web / field static | Restore previous S3 version; CloudFront invalidation `/*`         |
| Database           | Restore RDS snapshot (see below) — **last resort**                |

## Database backup & restore drill

**Backups:** RDS automated daily snapshots (retention per environment in Terraform).

**Quarterly restore drill:**

1. Restore latest snapshot to a temporary RDS instance in staging VPC.
2. Point a local or staging API at the restored endpoint.
3. Run `pnpm test:integration` against restored DB.
4. Delete temporary instance.
5. Log drill date in this file.

## Monitoring checks after deploy

- [ ] `/v1/health` returns 200 from both CloudFront distributions
- [ ] CloudWatch alarms `mmap-{env}-ecs-cpu-high` and `mmap-{env}-rds-low-storage` in OK state
- [ ] ECS Express service healthy / tasks running (unless hibernated)
- [ ] RDS free storage above threshold
- [ ] Field PWA `version.json` reflects new build (update prompt if applicable)

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
