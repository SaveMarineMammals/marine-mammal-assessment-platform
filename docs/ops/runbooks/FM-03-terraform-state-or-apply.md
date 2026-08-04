# FM-03 — Terraform plan/apply failure or state lock

**ID:** FM-03  
**Domain:** Infrastructure  
**Severity:** High

## Context

MMAP infrastructure is managed with Terraform under `infra/terraform/`. Remote state lives in **S3** with locking via **DynamoDB** (`scripts/terraform-init.ts`). CI runs:

| Workflow                    | Behavior                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `ci.yml` → `terraform-plan` | Plans staging + production on PRs (after quality + CodeQL) when `TF_INFRA_ENABLED=true` |
| `cd.yml`                    | Progressive staging apply → app → full verify → production apply → app → smoke          |
| `release-staging.yml`       | Staging infra + app + full live-verify from any branch                                  |

Applies use `-auto-approve` via `scripts/terraform-apply.ts`. State keys are isolated: `staging/terraform.tfstate` and `production/terraform.tfstate`. CI plans use `-lock=false` (no DynamoDB lock) and do not share the Actions concurrency group with applies. Apply jobs share `mmap-terraform` so concurrent applies never run in parallel.

**Who is affected:** Operators blocked from shipping infra fixes; application deploy may depend on fresh outputs (buckets, CloudFront IDs, secret ARNs).

**What breaks:**

- **State lock** — concurrent applies or a crashed runner leaves a DynamoDB lock; subsequent applies fail with _Error acquiring the state lock_. CI plans do not take the lock.
- **Plan/apply errors** — invalid tfvars, AWS API limits, dependency drift, or missing bootstrap secrets.
- **Destroy in plan** — CI posts PR warning; merging without review can delete resources.
- **`TF_INFRA_ENABLED` not true** — Terraform jobs skipped silently.

## Detection

| Signal                                              | Where                        |
| --------------------------------------------------- | ---------------------------- |
| Red **Terraform plan** or **CD** terraform job      | GitHub Actions               |
| Log: `Error acquiring the state lock`               | Plan/apply logs              |
| PR comment: ⚠️ **Terraform destroy detected**       | `ci.yml` github-script step  |
| `terraform-smoke-test.ts` / `live-verify.ts` exit 1 | `cd.yml` / `_verify-env.yml` |
| Local: `terraform plan` non-zero exit               | Operator workstation         |

## Prerequisites

- Repository variable `TF_INFRA_ENABLED=true`
- GitHub secrets: `AWS_TERRAFORM_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE`
- Local (optional): Terraform 1.9.x, AWS credentials via OIDC or SSO, `pnpm install`
- Admin access for bootstrap if state bucket/table missing

## Diagnosis

1. **Confirm Terraform CI is enabled**

   GitHub → Settings → Secrets and variables → Actions → Variables → `TF_INFRA_ENABLED` = `true`.

2. **Identify failing job and environment**

   - **Plan only fails** → usually config/provider/permissions; production may still be untouched.
   - **Staging apply fails** → production apply never runs (`needs: staging-apply`).
   - **Verify staging fails** → smoke test could not reach ECS Express `api_service_url` (often ALB **503** = no healthy tasks / hibernated).

3. **Read the error class**

   | Error pattern                                  | Likely cause                                                              |
   | ---------------------------------------------- | ------------------------------------------------------------------------- |
   | `Error acquiring the state lock`               | Stale lock from parallel/crashed job                                      |
   | `AccessDenied` on S3/DynamoDB/IAM              | OIDC role or bootstrap secrets wrong                                      |
   | `kms:TagResource` on `CreateKey`               | `mmap-terraform-ci` missing `kms:*`; re-run bootstrap or patch IAM        |
   | `Credentials could not be loaded` in bootstrap | Local AWS credentials missing or invalid for bootstrap apply              |
   | RDS `master_user_secret` / KMS                 | Customer CMK missing RDS/Secrets Manager key policy (see database module) |
   | `InvalidParameterCombination`                  | RDS/ECS Express module input drift                                        |
   | `FunctionInUse` / `DeleteFunction` 409         | CloudFront function renamed while still associated with a distribution    |
   | Destroy actions in plan                        | Resource rename or removed block                                          |

4. **Inspect lock table (AWS)**

   Git Bash:

   ```bash
   aws dynamodb scan --table-name "$TF_LOCK_TABLE" \
     --query "Items[].{LockID:LockID.S,Info:Info.S}" --output table
   ```

   PowerShell:

   ```powershell
   aws dynamodb scan --table-name $env:TF_LOCK_TABLE `
     --query "Items[].{LockID:LockID.S,Info:Info.S}" --output table
   ```

5. **Reproduce plan locally (staging)**

   PowerShell:

   ```powershell
   pnpm exec tsx scripts/terraform-init.ts `
     infra/terraform/environments/staging `
     YOUR-STATE-BUCKET `
     staging/terraform.tfstate `
     us-east-1 `
     YOUR-LOCK-TABLE

   pnpm exec tsx scripts/terraform-plan.ts infra/terraform/environments/staging terraform.tfvars
   ```

   Git Bash (same args, backslash line continuation optional):

   ```bash
   pnpm exec tsx scripts/terraform-init.ts \
     infra/terraform/environments/staging \
     YOUR-STATE-BUCKET \
     staging/terraform.tfstate \
     us-east-1 \
     YOUR-LOCK-TABLE

   pnpm exec tsx scripts/terraform-plan.ts infra/terraform/environments/staging terraform.tfvars
   ```

6. **Check for destroy warnings on open PRs**

   Review CI comment and `scripts/terraform-plan-summary.ts` output before merge.

## Resolution

1. **Stale state lock**

   - Confirm no legitimate apply is running in GitHub Actions (check the `mmap-terraform` concurrency group — CD terraform apply jobs or Release staging apply).
   - If a job was cancelled mid-apply, force-unlock **only after** verifying no active Terraform process:

     Git Bash:

     ```bash
     terraform -chdir=infra/terraform/environments/staging force-unlock LOCK_ID
     ```

     Replace `LOCK_ID` with the ID from the lock error message (not the full LockID string from DynamoDB unless they match).

   - Re-run failed workflow.

2. **Missing bootstrap / wrong role**

   - Follow [INFRA_PIPELINES.md](../INFRA_PIPELINES.md) one-time setup.
   - Re-apply `infra/bootstrap` locally if bucket/table missing.
   - Update `AWS_TERRAFORM_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE` from bootstrap outputs.

3. **Terraform CI role missing KMS permissions**

   Merging `kms:*` into `infra/bootstrap/main.tf` does **not** update the live IAM role until bootstrap apply succeeds.

   - Re-apply `infra/bootstrap` locally with admin AWS credentials.
   - **Or** manually add `kms:*` to the `ManageProjectInfrastructure` statement on IAM role `mmap-terraform-ci` in the AWS console.
   - Re-run **Release staging** or merge to `main` to trigger **CD**.

4. **Apply failure mid-run**

   - Read Terraform error; fix HCL or AWS quota.
   - Run `terraform plan` — Terraform may propose partial completion.
   - For staging-only validation from a feature branch: **Release staging** workflow.

5. **Destroy planned unintentionally**

   - Do **not** merge until plan is understood.
   - Use `moved` blocks or `terraform state mv` for renames instead of destroy+create when possible.
   - Production apply only runs from `main` after staging full live-verify — use that gate.

6. **CloudFront `FunctionInUse` when deleting a function**

   Renaming `aws_cloudfront_function` (Terraform address **or** AWS `name`) forces destroy+create.
   CloudFront returns **409 FunctionInUse** if delete runs while a distribution still associates the
   old ARN — Terraform does not wait for the distribution update to finish first.

   - Prefer updating function **code** in place; keep the AWS `name` and resource address stable.
   - If an orphan unused function remains in state (e.g. a failed rename left `openapi_redirect`
     while the distribution still uses `openapi_rewrite`), remove it from config so apply can
     destroy the unused function, and keep the in-use function with updated code.
   - Do not `terraform state rm` the in-use function and recreate under a new name in one apply.

7. **Smoke / live-verify failure after apply**

   CD / Release staging **verify** resumes hibernation (`staging-hibernate.ts resume`), runs `terraform-smoke-test.ts` (ALB readiness), then `live-verify.ts` (functional checks). Resume force-new-deploys when `running < desired` so stuck FAILED Express rollouts recover.

   ```powershell
   pnpm exec tsx scripts/staging-hibernate.ts status
   pnpm exec tsx scripts/staging-hibernate.ts resume
   pnpm exec tsx scripts/terraform-smoke-test.ts staging
   pnpm exec tsx scripts/live-verify.ts staging --mode full
   ```

   ALB **503** usually means no healthy tasks. Common causes:

   | Symptom                                                        | Likely cause                                                               | Fix                                                                            |
   | -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
   | Events: `account is currently blocked`                         | AWS account/EC2 verification block (new or flagged accounts)               | Complete verification in the AWS console; then `resume` / force-new-deployment |
   | `desired=1 running=0`, rollout `FAILED` / `SCALE_UP … timeout` | Failed Express rollout left no tasks; desired-count alone does not recover | `staging-hibernate.ts resume` (forces new deployment)                          |
   | Hibernated `min=0 desired=0`                                   | Cost hibernate                                                             | `staging-hibernate.ts resume`                                                  |

   Check diagnose logs from the verify job, or:

   ```powershell
   pnpm exec tsx scripts/ecs-express-diagnose.ts mmap-staging-api ACCOUNT_ID us-east-1
   ```

   Placeholder nginx serves **200** on `/` until the real API image is deployed (`/v1/health`). If the URL is wrong, check `outputs.tf` and module.api `service_url`.

   **Double `https://https://…` / `getaddrinfo EAI_AGAIN https`:** Express `ingress_paths[].endpoint` already includes the scheme. The api module must strip it before adding `https://` (see `local.ingress_host`). Re-apply or refresh outputs after that fix; the smoke test also normalizes a double scheme defensively.

8. **Legacy App Runner resources still in state (`AccessDenied` on `apprunner:Describe*`)**

   Older stacks may still reference App Runner service / VPC connector resources removed from HCL after the ECS Express migration. The Terraform CI role includes `apprunner:*` in bootstrap so apply can destroy leftovers.

   - Re-apply `infra/bootstrap` locally so `mmap-terraform-ci` picks up the policy, **or** temporarily attach `apprunner:*` to that role in IAM.
   - Re-run staging apply; Terraform should destroy the old App Runner resources.
   - After state is clean, `apprunner:*` can remain for safety or be removed from bootstrap.

9. **Security group delete fails detaching RDS ENI (`AuthFailure` on `DetachNetworkInterface`)**

   Changing `aws_security_group.description` forces replacement. Terraform cannot detach RDS-managed ENIs when destroying the old group — this looks like a permissions error but is not an IAM gap.

   - Networking module SGs use `lifecycle { ignore_changes = [description] }` to avoid accidental replacement.
   - If a failed apply left duplicate SGs, confirm RDS still uses the intended group in the AWS console, remove orphan SGs manually if needed, then re-run apply.

10. **Skipped jobs**

If Terraform jobs do not appear at all, set `TF_INFRA_ENABLED=true` and ensure PR touches `infra/**` or workflow paths for deploy triggers.

11. **Secrets Manager name conflict after destroy (`InvalidRequestException` / secret scheduled for deletion)**

Destroying staging schedules `mmap-staging/api-admin-token` for deletion (default recovery window). Re-apply cannot recreate the same name until the window ends or the secret is force-deleted.

- **One-time cleanup** (staging only; permanent — no restore):

  ```powershell
  aws secretsmanager delete-secret `
    --secret-id mmap-staging/api-admin-token `
    --force-delete-without-recovery `
    --region us-east-1
  ```

  List leftovers: `aws secretsmanager list-secrets --include-planned-deletion --region us-east-1`.

- **Prevention:** the api module sets `recovery_window_in_days = 0` for non-production so destroy force-deletes the admin token. Production keeps a 30-day window.

- **KMS:** customer-managed keys use a minimum 7-day deletion window and cannot be force-deleted immediately. A pending key does not block recreate if the alias was destroyed with the stack; if apply fails on `alias/mmap-staging-rds-secret`, wait for the old key to finish deletion or cancel deletion and import that key into state.

12. **CloudWatch log group already exists (`ResourceAlreadyExistsException`)**

    The ECS migration moved `aws_cloudwatch_log_group.api` from the `monitoring` module to the `api` module. Staging may already have `/mmap-staging/api` in AWS while state still points at the old address (or has no entry).

    - **Preferred:** merge the `moved` block in environment `main.tf` and re-run apply — Terraform rewrites state without recreating the group.
    - **If apply still tries to create:** import the existing group once (PowerShell, with staging credentials):

      ```powershell
      pnpm exec tsx scripts/terraform-init.ts staging
      terraform -chdir=infra/terraform/environments/staging import `
        'module.api.aws_cloudwatch_log_group.api' '/mmap-staging/api'
      ```

      Then re-run apply.

13. **ECS Express service linked role (`Unable to assume the service linked role` / `AWSServiceRoleForECS has been taken`)**

    First ECS use in an account requires the AWS-managed role `AWSServiceRoleForECS`. **Bootstrap** creates and owns this role; the api module only reads it with `data.aws_iam_role.ecs_service_linked`.

    - **New accounts:** re-apply `infra/bootstrap` locally so the role is created before staging apply.
    - **Role already exists outside bootstrap state:** import into bootstrap, then apply:

      ```powershell
      cd infra/bootstrap
      terraform import aws_iam_service_linked_role.ecs `
        "arn:aws:iam::ACCOUNT_ID:role/aws-service-role/ecs.amazonaws.com/AWSServiceRoleForECS"
      terraform apply
      ```

    - **Role missing and bootstrap not yet re-run:**

      ```powershell
      aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
      ```

      Then import into bootstrap state as above (or re-run bootstrap after import).

14. **`service_url` null / no PUBLIC `ingress_paths`**

    ECS Express in **private subnets** creates an internal ALB with `PRIVATE` ingress only — CloudFront cannot use that origin. The api module uses **public subnets** for `network_configuration` so AWS exposes a `PUBLIC` endpoint. Re-apply after merging; Terraform may replace the Express service when subnets change.

15. **Changing subnet types / Express service already exists**

    AWS cannot move an Express service from private to public subnets in place. Use a **state move**, then **replace**:

    1. **`moved` block** (in api module) rewrites `aws_ecs_express_gateway_service.api` → `.express` without calling AWS.
    2. If apply fails with **Resource Already Exists** (rename raced ahead of destroy), import the live service, drop stale state, then replace:

       ```powershell
       pnpm exec tsx scripts/terraform-init.ts staging
       terraform -chdir=infra/terraform/environments/staging import `
         'module.api.aws_ecs_express_gateway_service.express' `
         'arn:aws:ecs:us-east-1:ACCOUNT_ID:service/default/mmap-staging-api'
       terraform -chdir=infra/terraform/environments/staging state rm `
         'module.api.aws_ecs_express_gateway_service.api'
       ```

       Skip `state rm` if `api` is not in state. Replace `ACCOUNT_ID` with your AWS account ID.

    3. Recreate on public subnets:

       ```powershell
       terraform -chdir=infra/terraform/environments/staging apply `
         -replace='module.api.aws_ecs_express_gateway_service.express' `
         -var-file=terraform.tfvars -auto-approve
       ```

    Future subnet changes use `replace_triggered_by` on `terraform_data.express_subnet_set`.

16. **ECS Express deployment stuck / Terraform 30m timeout (`tfPENDING`, health never passes)**

    The placeholder **nginx** image is not the problem — health checks use `/` on port **80**, which nginx serves. Common causes:

    | Symptom                            | Likely cause                                       | Fix                                                                                    |
    | ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
    | Deployment `IN_PROGRESS` for hours | ALB target group unhealthy (no ingress on task SG) | Ensure `api_connector` SG allows TCP **80–3001** from the VPC CIDR (networking module) |
    | Tasks never reach `RUNNING`        | Secrets injected before container start            | Placeholder image omits `DATABASE_URL` / `API_ADMIN_TOKEN`; re-apply after merge       |
    | CI fails at exactly **30m**        | `wait_for_steady_state = true`                     | Module default is `false`; smoke test validates `/v1/health` then `/` after apply      |

    **Diagnose** (with AWS credentials):

    ```powershell
    pnpm exec tsx scripts/ecs-express-diagnose.ts mmap-staging-api 963120167952 us-east-1
    ```

    Or in the ECS console: Express service → **Monitor deployment** (target group health, security groups).

    **Unstick** a deployment that has been deploying for >30 minutes:

    1. ECS console → cancel the stuck deployment, **or**
    2. Replace the Express service and re-apply:

       ```powershell
       terraform -chdir=infra/terraform/environments/staging apply `
         -replace='module.api.aws_ecs_express_gateway_service.express' `
         -var-file=terraform.tfvars -auto-approve
       ```

    After a failed create with `wait_for_steady_state = true`, Terraform may not have saved state — import per step 14 if needed, then re-apply with the fixes above.

## Verification

- [ ] `terraform plan` exits 0 for staging (and production if applicable)
- [ ] No unexpected `delete` actions in plan summary
- [ ] GitHub **Terraform plan** / **CD** terraform jobs green
- [ ] `pnpm exec tsx scripts/terraform-smoke-test.ts staging` and `live-verify.ts staging --mode full` pass
- [ ] Terraform outputs match GitHub deploy secrets (`database_secret_arn`, bucket names, CloudFront IDs)

## Escalation / when to stop

- **Stop** before `force-unlock` if an apply workflow is still **in progress** — wait or cancel cleanly first.
- **Escalate** if production state may be corrupted — restore state from S3 versioning before further applies ([SECURITY_REMEDIATION.md](../SECURITY_REMEDIATION.md) INF-05).
- **Do not** apply production from a feature branch; use **Release staging** only.
- Broad IAM on Terraform CI role is a known finding (INF-01) — do not expand `*` policies as a quick fix.

## References

| Resource                    | Path                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Infra pipelines doc         | [INFRA_PIPELINES.md](../INFRA_PIPELINES.md)                                            |
| Terraform composite action  | `.github/actions/terraform/action.yml`                                                 |
| Init / plan / apply scripts | `scripts/terraform-init.ts`, `scripts/terraform-plan.ts`, `scripts/terraform-apply.ts` |
| Progressive CD workflow     | `.github/workflows/cd.yml`                                                             |
| Manual staging release      | `.github/workflows/release-staging.yml`                                                |
| Live verify script          | `scripts/live-verify.ts`                                                               |
| CI plan job                 | `.github/workflows/ci.yml` (`terraform-plan`)                                          |
| Bootstrap                   | `infra/bootstrap/` (local Terraform apply)                                             |
| Operator quick start        | [infra/README.md](../../../infra/README.md)                                            |
| Architecture                | [AWS_INFRA.md](../AWS_INFRA.md)                                                        |
