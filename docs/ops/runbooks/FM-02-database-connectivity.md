# FM-02 — PostgreSQL / DATABASE_URL / Secrets Manager connectivity

**ID:** FM-02  
**Domain:** Application + Infrastructure  
**Severity:** Critical

## Context

The API persists sync batches and serves public dataset endpoints through a **PostgreSQL** connection pool (`apps/api/src/db/pool.ts`). Locally and in CI, `DATABASE_URL` is a plain PostgreSQL URL. On AWS:

- RDS uses `manage_master_user_password = true`; credentials live in **Secrets Manager** as JSON.
- App Runner injects that secret into the `DATABASE_URL` environment variable (secret ARN reference in `infra/terraform/modules/api/main.tf`).
- The API and CLI normalize JSON to a connection string via `normalizeDatabaseUrl()` in `apps/api/src/cli/database-url.ts`.
- The **deploy-aws** workflow fetches the same secret for migrations before API rollout.

**Who is affected:** All API consumers — field sync, public web dataset portal, admin routes, and deploy migrations.

**What breaks:**

- Missing or malformed `DATABASE_URL` → pool connection errors; public routes return **503** `{ "error": "Database unavailable" }`.
- RDS unreachable from App Runner (VPC connector, security group) → health may pass but sync/public DB routes fail.
- Wrong `DATABASE_SECRET_ARN` in GitHub → migration step fails during deploy.
- Secret rotation without API redeploy → transient auth failures until tasks restart.

## Detection

| Signal                                          | Where                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `503 Database unavailable`                      | `GET /v1/public/stats`, `/v1/public/assessments`                  |
| Sync batch persistence errors                   | API logs, `sync_audit` with `status: error`                       |
| App Runner service unhealthy                    | AWS Console → App Runner → health check failures                  |
| Deploy job fails at **Run database migrations** | `.github/workflows/deploy-aws.yml`                                |
| CloudWatch alarms                               | `mmap-api-5xx`, RDS storage/CPU ([AWS_INFRA.md](../AWS_INFRA.md)) |
| Local: integration tests skip                   | Missing `DATABASE_URL` or Postgres not running                    |

## Prerequisites

- AWS CLI configured (staging/production) with permission to read Secrets Manager and describe RDS/App Runner
- For local: Docker or native PostgreSQL on port 5432
- GitHub environment secret `DATABASE_SECRET_ARN` matches Terraform output `database_secret_arn`

## Diagnosis

1. **Check API health vs database-backed routes**

   Git Bash:

   ```bash
   curl -s http://localhost:3001/v1/health
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/v1/public/stats
   ```

   Health does **not** require DB; public stats **does**. HTTP 503 on stats with OK health indicates DB connectivity/config issue.

2. **Verify local DATABASE_URL**

   Git Bash:

   ```bash
   echo "$DATABASE_URL"
   pnpm --filter @mmap/api db:migrate -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
   ```

   PowerShell:

   ```powershell
   pnpm --filter @mmap/api db:migrate -- --database-url postgresql://mmap:mmap@localhost:5432/mmap
   ```

3. **Confirm PostgreSQL is accepting connections**

   Git Bash:

   ```bash
   docker compose ps postgres
   docker compose exec postgres pg_isready -U mmap -d mmap
   ```

   PowerShell:

   ```powershell
   docker compose ps postgres
   docker compose exec postgres pg_isready -U mmap -d mmap
   ```

4. **AWS: read RDS secret (operators only)**

   Git Bash:

   ```bash
   aws secretsmanager get-secret-value \
     --secret-id "$DATABASE_SECRET_ARN" \
     --query SecretString --output text | head -c 80
   ```

   PowerShell:

   ```powershell
   aws secretsmanager get-secret-value `
     --secret-id $env:DATABASE_SECRET_ARN `
     --query SecretString --output text
   ```

   Expect JSON with `username`, `password`, `host`, `port`, `dbname`. Do not log full output.

5. **Test normalization locally**

   ```bash
   pnpm exec tsx -e "
   import { normalizeDatabaseUrl } from './apps/api/src/cli/database-url.ts';
   console.log(normalizeDatabaseUrl(process.env.TEST_SECRET_JSON!));
   "
   ```

   Or run unit tests: `pnpm --filter @mmap/api test -- database-url`.

6. **AWS: RDS and network**

   - RDS instance in **private subnets**, `publicly_accessible = false` (`infra/terraform/modules/database/main.tf`).
   - App Runner uses **VPC connector** egress to reach RDS on port 5432.
   - Security group on RDS must allow ingress from `api-connector-sg`.

   ```bash
   aws rds describe-db-instances --query "DBInstances[?DBInstanceIdentifier.contains(@,'mmap')].[DBInstanceStatus,Endpoint.Address]"
   aws apprunner describe-service --service-arn "<service-arn>"
   ```

7. **Compare GitHub secret to Terraform output**

   Git Bash (after local terraform init):

   ```bash
   terraform -chdir=infra/terraform/environments/staging output -raw database_secret_arn
   ```

   Must match GitHub environment secret `DATABASE_SECRET_ARN`.

## Resolution

1. **Local / CI: Postgres not running**

   Git Bash:

   ```bash
   docker compose up -d postgres
   docker compose exec postgres pg_isready -U mmap -d mmap
   export DATABASE_URL=postgresql://mmap:mmap@localhost:5432/mmap
   pnpm --filter @mmap/api db:migrate -- --database-url "$DATABASE_URL"
   ```

   PowerShell:

   ```powershell
   docker compose up -d postgres
   $env:DATABASE_URL = 'postgresql://mmap:mmap@localhost:5432/mmap'
   pnpm --filter @mmap/api db:migrate -- --database-url $env:DATABASE_URL
   ```

2. **Missing DATABASE_URL in API process**

   - Copy `apps/api/.env.example` → `apps/api/.env` for local dev.
   - Docker Compose sets `DATABASE_URL` in `docker-compose.yml` for the `api` service.

3. **Migration failure during deploy**

   - Confirm `DATABASE_SECRET_ARN` in GitHub environment (staging/production).
   - Confirm deploy role can `secretsmanager:GetSecretValue` on that ARN.
   - Re-run failed workflow job after fixing IAM or ARN mismatch.

4. **App Runner cannot reach RDS**

   - Verify VPC connector attached and healthy.
   - Verify RDS security group allows connector SG on **5432**.
   - Check RDS status (storage full, rebooting). Restore from snapshot if corrupted ([DEPLOYMENT.md](../DEPLOYMENT.md#database-backup--restore-drill)).

5. **Secret rotation**

   - After RDS automatic rotation, restart App Runner deployment so tasks pick up new password.
   - Migrations in CI always fetch fresh secret at runtime — no plaintext URL in GitHub.

6. **JSON parse errors in API startup**

   - Ensure App Runner `runtime_environment_secrets.DATABASE_URL` points to the **RDS master user secret ARN**, not the admin token secret.
   - See `infra/terraform/modules/api/main.tf`.

## Verification

- [ ] `pnpm --filter @mmap/api db:migrate` succeeds with resolved URL
- [ ] `GET /v1/public/stats` returns 200 (not 503)
- [ ] `POST /v1/sync/batch` with valid fixture persists (integration test or manual curl)
- [ ] App Runner health check passes on `/v1/health` (after real API image deployed)
- [ ] CloudWatch RDS alarms OK

## Escalation / when to stop

- **Stop** and use RDS snapshot restore if data corruption is suspected — do not run destructive SQL on production.
- **Escalate** if secret, IAM, and security groups are correct but connections still timeout — network/VPC connector issue may need Terraform change ([FM-03](FM-03-terraform-state-or-apply.md)).
- Never commit database passwords or full secret JSON to git ([SECURITY_REMEDIATION.md](../SECURITY_REMEDIATION.md) INF-04, INF-06).

## References

| Resource               | Path                                       |
| ---------------------- | ------------------------------------------ |
| Connection pool        | `apps/api/src/db/pool.ts`                  |
| URL normalization      | `apps/api/src/cli/database-url.ts`         |
| RDS module             | `infra/terraform/modules/database/main.tf` |
| App Runner secrets     | `infra/terraform/modules/api/main.tf`      |
| Deploy migrations step | `.github/workflows/deploy-aws.yml`         |
| Env example            | `apps/api/.env.example`                    |
| Deployment / restore   | [DEPLOYMENT.md](../DEPLOYMENT.md)          |
| Secrets architecture   | [AWS_INFRA.md](../AWS_INFRA.md)            |
