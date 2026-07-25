# FM-04 — GitHub Actions deploy pipeline failure

**ID:** FM-04  
**Domain:** Continual deployment  
**Severity:** High

## Context

Application artifacts deploy via **Deploy AWS** (`.github/workflows/deploy-aws.yml`):

1. Build `@mmap/web` and `@mmap/field` static sites
2. `aws s3 sync` to web and field buckets; CloudFront invalidation `/*`
3. Docker build/push API image to ECR (`mmap-{env}-api`, tag = git ref)
4. Fetch `DATABASE_SECRET_ARN` from Secrets Manager → run `pnpm --filter @mmap/api db:migrate`
5. Deploy API to **ECS Express** (`aws-actions/amazon-ecs-deploy-express-service`)

Triggers:

- **Production:** push tag `v*`
- **Staging/production:** manual `workflow_dispatch` with environment choice

Required GitHub **environment** secrets (from Terraform outputs — see [INFRA_PIPELINES.md](../INFRA_PIPELINES.md)):

`AWS_DEPLOY_ROLE_ARN`, `DATABASE_SECRET_ARN`, `WEB_STATIC_BUCKET`, `FIELD_STATIC_BUCKET`, `WEB_CLOUDFRONT_ID`, `FIELD_CLOUDFRONT_ID`, `ECS_SERVICE_NAME`, `ECS_EXECUTION_ROLE_ARN`, `ECS_INFRASTRUCTURE_ROLE_ARN`

**Who is affected:** End users see stale static assets and/or old API; field sync may hit schema mismatch if migrations failed but static deploy succeeded.

**What breaks:**

- `pnpm build` failure (web/field)
- OIDC / IAM — cannot assume deploy role, ECR push denied, S3 sync denied
- Migration failure — DB schema not updated before new API expects new columns
- ECR / ECS Express — image push fails or Express service not updated
- CloudFront — invalidation fails or wrong distribution ID
- Partial success — S3 updated but API/migrations failed → **split-brain** UI vs API
- Staging destroyed or hibernated — deploy cannot reach RDS / Express service

## Detection

| Signal                                     | Where                                 |
| ------------------------------------------ | ------------------------------------- |
| Red **Deploy AWS** workflow                | GitHub Actions → Deploy AWS           |
| Static site new `version.json` but API old | Field update banner vs sync errors    |
| ECR push / docker build errors             | Job log **Build and push API image**  |
| Migration stderr                           | Job log **Run database migrations**   |
| ECS Express deploy action failure          | Job log **Deploy API to ECS Express** |
| CloudFront 404 on new routes               | Missing invalidation or wrong bucket  |

## Prerequisites

- Infrastructure already applied ([INFRA_PIPELINES.md](../INFRA_PIPELINES.md)); staging not destroyed/hibernated unless intentional
- GitHub environment secrets populated from `terraform output`
- AWS deploy role trust for GitHub OIDC (`infra/terraform/modules/github-oidc`)
- For local repro: Docker, AWS CLI, same secrets in a secure shell (operators only)

## Diagnosis

1. **Open failed workflow run and note the failing step**

   ```bash
   gh run list --workflow=deploy-aws.yml --limit 5
   gh run view RUN_ID --log-failed
   ```

2. **Verify GitHub environment secrets exist**

   Settings → Environments → `staging` or `production` → Secrets. Compare to:

   Git Bash:

   ```bash
   terraform -chdir=infra/terraform/environments/staging output
   ```

3. **Test OIDC role (from CI log or locally with assumed role)**

   Common failures: wrong `AWS_DEPLOY_ROLE_ARN`, tag ref not allowed for production OIDC trust (`ref:refs/tags/v*`).

4. **Isolate build failures**

   Git Bash / PowerShell:

   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @mmap/web build
   pnpm --filter @mmap/field build
   pnpm build
   ```

5. **Isolate migration failures**

   PowerShell (mirrors deploy job):

   ```powershell
   $secret = aws secretsmanager get-secret-value `
     --secret-id $env:DATABASE_SECRET_ARN `
     --query SecretString --output text
   $env:DATABASE_URL = $secret
   pnpm --filter @mmap/api db:migrate
   ```

   Git Bash:

   ```bash
   export DATABASE_URL=$(aws secretsmanager get-secret-value \
     --secret-id "$DATABASE_SECRET_ARN" \
     --query SecretString --output text)
   pnpm --filter @mmap/api db:migrate
   ```

6. **Check ECR and ECS Express state**

   ```powershell
   # Repo name from terraform output ecr_repository_url (e.g. mmap-staging-api)
   aws ecr describe-images --repository-name mmap-staging-api --query "sort_by(imageDetails,& imagePushedAt)[-3:]"
   pnpm exec tsx scripts/ecs-express-diagnose.ts mmap-staging-api 963120167952 us-east-1
   pnpm exec tsx scripts/staging-hibernate.ts status
   ```

7. **Verify static deploy**

   ```bash
   aws s3 ls "s3://$WEB_STATIC_BUCKET/" | head
   aws cloudfront get-invalidation --distribution-id "$WEB_CLOUDFRONT_ID" --id "<invalidation-id>"
   ```

## Resolution

1. **Build step failed**

   - Fix code/build errors locally with `pnpm validate`.
   - Re-tag or re-run workflow after merge to main.

2. **AWS credentials / permission denied**

   - Confirm `AWS_DEPLOY_ROLE_ARN` matches `github_deploy_role_arn` output.
   - OIDC module must allow this repo/ref ([AWS_INFRA.md](../AWS_INFRA.md)).
   - Re-run workflow after secret fix.

3. **Migration failed**

   - Fix schema migration SQL in `apps/api` migrations.
   - Resolve DB connectivity ([FM-02-database-connectivity.md](FM-02-database-connectivity.md)).
   - **Do not** deploy new API image until migrations succeed on target DB.
   - If RDS is stopped (hibernated), resume first.

4. **ECR push failed**

   - Confirm the workflow `ECR_REPOSITORY` (`mmap-{env}-api`) matches the Terraform ECR repo from `ecr_repository_url`.
   - Check Dockerfile errors; ensure the ECR repository exists (`module.api`).

5. **ECS Express not updated**

   - Confirm secrets `ECS_SERVICE_NAME`, `ECS_EXECUTION_ROLE_ARN`, `ECS_INFRASTRUCTURE_ROLE_ARN` match Terraform outputs.
   - Re-run **Deploy AWS** after secrets are correct.
   - Diagnose with `scripts/ecs-express-diagnose.ts` if the deployment is stuck ([FM-03](FM-03-terraform-state-or-apply.md) step 13).

6. **Partial deploy (S3 ok, API failed)**

   - Treat as incident: either roll forward (fix API/migrations) or roll back static assets ([DEPLOYMENT.md](../DEPLOYMENT.md#rollback)).
   - Rollback static: restore previous S3 object version + CloudFront invalidation `/*`.
   - Rollback API: redeploy previous ECR image tag via **Deploy AWS** / Express update.

7. **CloudFront stale content**

   ```bash
   aws cloudfront create-invalidation --distribution-id "$FIELD_CLOUDFRONT_ID" --paths "/*"
   aws cloudfront create-invalidation --distribution-id "$WEB_CLOUDFRONT_ID" --paths "/*"
   ```

## Verification

Follow [DEPLOYMENT.md](../DEPLOYMENT.md) post-deploy checks:

- [ ] `curl https://field-staging.<domain>/v1/health` → `"status":"ok"` (after real API image)
- [ ] Field and web URLs load; `version.json` updated on field
- [ ] Smoke sync: create assessment → sync → visible in API
- [ ] CloudWatch `mmap-{env}-ecs-cpu-high` / `mmap-{env}-rds-low-storage` OK
- [ ] ECR contains expected image tag; ECS Express service running that image

## Escalation / when to stop

- **Stop** if migrations partially applied — inspect `schema_migrations` / migration table before re-running.
- **Escalate** if production tag deploy failed after migration succeeded but API rollback needed — coordinate DB compatibility.
- Production deploys should use environment **approval gates** ([SECURITY_REMEDIATION.md](../SECURITY_REMEDIATION.md) INF-09).

## References

| Resource                          | Path                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy workflow                   | `.github/workflows/deploy-aws.yml`                                                                                                                                                   |
| GitHub OIDC module                | `infra/terraform/modules/github-oidc/`                                                                                                                                               |
| Staging outputs (secrets mapping) | `infra/terraform/environments/staging/outputs.tf`                                                                                                                                    |
| Promotion checklist               | [DEPLOYMENT.md](../DEPLOYMENT.md)                                                                                                                                                    |
| Infra prerequisites               | [INFRA_PIPELINES.md](../INFRA_PIPELINES.md)                                                                                                                                          |
| Rollback table                    | [DEPLOYMENT.md](../DEPLOYMENT.md#rollback)                                                                                                                                           |
| ECS Express API module            | `infra/terraform/modules/api/main.tf`                                                                                                                                                |
| External                          | [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) |
