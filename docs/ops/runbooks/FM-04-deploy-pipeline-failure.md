# FM-04 — GitHub Actions deploy pipeline failure

**ID:** FM-04  
**Domain:** Continual deployment  
**Severity:** High

## Context

Application artifacts deploy via **Deploy AWS** (`.github/workflows/deploy-aws.yml`):

1. Build `@mmap/web` and `@mmap/field` static sites
2. `aws s3 sync` to web and field buckets; CloudFront invalidation `/*`
3. Docker build/push API image to ECR (`mmap-api` repo, tag = git ref)
4. Fetch `DATABASE_SECRET_ARN` from Secrets Manager → run `pnpm --filter @mmap/api db:migrate`
5. Deploy API to App Runner (**currently a TODO stub** in workflow)

Triggers:

- **Production:** push tag `v*`
- **Staging/production:** manual `workflow_dispatch` with environment choice

Required GitHub **environment** secrets (from Terraform outputs — see [INFRA_PIPELINES.md](../INFRA_PIPELINES.md)):

`AWS_DEPLOY_ROLE_ARN`, `DATABASE_SECRET_ARN`, `WEB_STATIC_BUCKET`, `FIELD_STATIC_BUCKET`, `WEB_CLOUDFRONT_ID`, `FIELD_CLOUDFRONT_ID`

**Who is affected:** End users see stale static assets and/or old API; field sync may hit schema mismatch if migrations failed but static deploy succeeded.

**What breaks:**

- `pnpm build` failure (web/field)
- OIDC / IAM — cannot assume deploy role, ECR push denied, S3 sync denied
- Migration failure — DB schema not updated before new API expects new columns
- ECR/App Runner — image push fails or service not updated (workflow TODO)
- CloudFront — invalidation fails or wrong distribution ID
- Partial success — S3 updated but API/migrations failed → **split-brain** UI vs API

## Detection

| Signal                                     | Where                                 |
| ------------------------------------------ | ------------------------------------- |
| Red **Deploy AWS** workflow                | GitHub Actions → Deploy AWS           |
| Static site new `version.json` but API old | Field update banner vs sync errors    |
| ECR push / docker build errors             | Job log **Build and push API image**  |
| Migration stderr                           | Job log **Run database migrations**   |
| `TODO: wire App Runner` only message       | API never rolled out after image push |
| CloudFront 404 on new routes               | Missing invalidation or wrong bucket  |

## Prerequisites

- Infrastructure already applied ([INFRA_PIPELINES.md](../INFRA_PIPELINES.md))
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

6. **Check ECR and App Runner state**

   ```bash
   aws ecr describe-images --repository-name mmap-api --query 'sort_by(imageDetails,& imagePushedAt)[-3:]'
   aws apprunner list-services --query "ServiceSummaryList[?contains(ServiceName,'mmap')]"
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

4. **ECR push failed**

   - Check disk space on runner (rare), Dockerfile errors, ECR repository exists (`module.api`).

5. **App Runner not updated (known gap)**

   Workflow step is currently:

   ```text
   TODO: wire App Runner update-service + start-deployment using Terraform outputs
   ```

   Manual rollout until wired:

   ```bash
   aws apprunner start-deployment --service-arn "<service-arn>"
   ```

   Or update service image via AWS console after ECR push. Track INF-07 (auto-deploy policy).

6. **Partial deploy (S3 ok, API failed)**

   - Treat as incident: either roll forward (fix API/migrations) or roll back static assets ([DEPLOYMENT.md](../DEPLOYMENT.md#rollback)).
   - Rollback static: restore previous S3 object version + CloudFront invalidation `/*`.
   - Rollback API: redeploy previous ECR tag via App Runner `StartDeployment`.

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
- [ ] CloudWatch `mmap-api-5xx` alarm OK
- [ ] ECR contains expected image tag; App Runner running that tag

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
| App Runner module                 | `infra/terraform/modules/api/main.tf`                                                                                                                                                |
| External                          | [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) |
