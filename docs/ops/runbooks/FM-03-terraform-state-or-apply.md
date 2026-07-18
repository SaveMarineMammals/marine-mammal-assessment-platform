# FM-03 — Terraform plan/apply failure or state lock

**ID:** FM-03  
**Domain:** Infrastructure  
**Severity:** High

## Context

MMAP infrastructure is managed with Terraform under `infra/terraform/`. Remote state lives in **S3** with locking via **DynamoDB** (`scripts/terraform-init.ts`). CI runs:

| Workflow                    | Behavior                                                                     |
| --------------------------- | ---------------------------------------------------------------------------- |
| `ci.yml` → `terraform-plan` | Plans staging + production on PR/push to `main` when `TF_INFRA_ENABLED=true` |
| `infra-deploy.yml`          | Applies staging → smoke test → production (main only)                        |
| `infra-staging-manual.yml`  | Staging apply from any branch                                                |

Applies use `-auto-approve` via `scripts/terraform-apply.ts`. State keys are isolated: `staging/terraform.tfstate` and `production/terraform.tfstate`.

**Who is affected:** Operators blocked from shipping infra fixes; application deploy may depend on fresh outputs (buckets, CloudFront IDs, secret ARNs).

**What breaks:**

- **State lock** — concurrent apply/plan or crashed runner leaves DynamoDB lock; subsequent runs fail with _Error acquiring the state lock_.
- **Plan/apply errors** — invalid tfvars, AWS API limits, dependency drift, or missing bootstrap secrets.
- **Destroy in plan** — CI posts PR warning; merging without review can delete resources.
- **`TF_INFRA_ENABLED` not true** — Terraform jobs skipped silently.

## Detection

| Signal                                         | Where                          |
| ---------------------------------------------- | ------------------------------ |
| Red **Terraform plan** or **Infra deploy** job | GitHub Actions                 |
| Log: `Error acquiring the state lock`          | Plan/apply logs                |
| PR comment: ⚠️ **Terraform destroy detected**  | `ci.yml` github-script step    |
| `terraform-smoke-test.ts` exit 1 after apply   | `infra-deploy.yml` verify jobs |
| Local: `terraform plan` non-zero exit          | Operator workstation           |

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
   - **Verify staging fails** → smoke test could not reach App Runner URL from Terraform output.

3. **Read the error class**

   | Error pattern                     | Likely cause                         |
   | --------------------------------- | ------------------------------------ |
   | `Error acquiring the state lock`  | Stale lock from parallel/crashed job |
   | `AccessDenied` on S3/DynamoDB/IAM | OIDC role or bootstrap secrets wrong |
   | `InvalidParameterCombination`     | RDS/App Runner module input drift    |
   | Destroy actions in plan           | Resource rename or removed block     |

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

   - Confirm no legitimate apply is running in GitHub Actions (check `infra-deploy` concurrency group).
   - If a job was cancelled mid-apply, force-unlock **only after** verifying no active Terraform process:

     Git Bash:

     ```bash
     terraform -chdir=infra/terraform/environments/staging force-unlock LOCK_ID
     ```

     Replace `LOCK_ID` with the ID from the lock error message (not the full LockID string from DynamoDB unless they match).

   - Re-run failed workflow.

2. **Missing bootstrap / wrong role**

   - Follow [INFRA_PIPELINES.md](../INFRA_PIPELINES.md) one-time setup.
   - Re-run **Infra bootstrap** (admin) if bucket/table missing.
   - Update `AWS_TERRAFORM_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE` from bootstrap outputs.

3. **Apply failure mid-run**

   - Read Terraform error; fix HCL or AWS quota.
   - Run `terraform plan` — Terraform may propose partial completion.
   - For staging-only validation from a feature branch: **Infra staging (manual)** workflow.

4. **Destroy planned unintentionally**

   - Do **not** merge until plan is understood.
   - Use `moved` blocks or `terraform state mv` for renames instead of destroy+create when possible.
   - Production apply only runs from `main` after staging verify — use that gate.

5. **Smoke test failure after apply**

   ```bash
   pnpm exec tsx scripts/terraform-smoke-test.ts staging
   ```

6. **App Runner cleanup after ECS migration (`AccessDenied` on `apprunner:Describe*`)**

   Terraform state may still reference App Runner service and VPC connector resources removed from HCL. The CI role needs `apprunner:*` (included in bootstrap) to read and destroy them.

   - Re-run **Infra bootstrap** so `mmap-terraform-ci` picks up the updated policy, **or** temporarily attach `apprunner:*` to that role in IAM.
   - Re-run staging apply; Terraform should destroy the old App Runner resources.
   - After cleanup succeeds, `apprunner:*` can remain in bootstrap for safety or be removed once state is clean.

7. **Security group delete fails detaching RDS ENI (`AuthFailure` on `DetachNetworkInterface`)**

   Changing `aws_security_group.description` forces replacement. Terraform cannot detach RDS-managed ENIs when destroying the old group — this looks like a permissions error but is not an IAM gap.

   - Networking module SGs use `lifecycle { ignore_changes = [description] }` to avoid accidental replacement.
   - If a failed apply left duplicate SGs, confirm RDS still uses the intended group in the AWS console, remove orphan SGs manually if needed, then re-run apply.

   Smoke test hits ECS Express `api_service_url` root (placeholder image returns 200 on `/` until real API is deployed). If URL is wrong, check `outputs.tf` and module.api `service_url`.

8. **Skipped jobs**

   If Terraform jobs do not appear at all, set `TF_INFRA_ENABLED=true` and ensure PR touches `infra/**` or workflow paths for deploy triggers.

9. **CloudWatch log group already exists (`ResourceAlreadyExistsException`)**

   The ECS migration moved `aws_cloudwatch_log_group.api` from the `monitoring` module to the `api` module. Staging may already have `/mmap-staging/api` in AWS while state still points at the old address (or has no entry).

   - **Preferred:** merge the `moved` block in environment `main.tf` and re-run apply — Terraform rewrites state without recreating the group.
   - **If apply still tries to create:** import the existing group once (PowerShell, with staging credentials):

     ```powershell
     pnpm exec tsx scripts/terraform-init.ts staging
     terraform -chdir=infra/terraform/environments/staging import `
       'module.api.aws_cloudwatch_log_group.api' '/mmap-staging/api'
     ```

     Then re-run apply.

10. **ECS Express service linked role (`Unable to assume the service linked role` / `AWSServiceRoleForECS has been taken`)**

    First ECS use in an account requires the AWS-managed role `AWSServiceRoleForECS`. **Bootstrap** creates and owns this role; the api module only reads it with `data.aws_iam_role.ecs_service_linked`.

    - **New accounts:** re-run **Infra bootstrap** so the role is created before staging apply.
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

11. **`service_url` null / no PUBLIC `ingress_paths`**

    ECS Express in **private subnets** creates an internal ALB with `PRIVATE` ingress only — CloudFront cannot use that origin. The api module uses **public subnets** for `network_configuration` so AWS exposes a `PUBLIC` endpoint. Re-apply after merging; Terraform may replace the Express service when subnets change.

12. **Changing subnet types not supported (`InvalidParameterException`)**

    AWS cannot move an Express service from private to public subnets in place. Terraform must destroy and recreate the service. The module renames the resource (`api` → `express`) to force that on migration; future subnet changes use `replace_triggered_by`.

    If apply still tries an in-place update, replace manually:

    ```powershell
    terraform -chdir=infra/terraform/environments/staging apply `
      -replace='module.api.aws_ecs_express_gateway_service.express' `
      -var-file=terraform.tfvars -auto-approve
    ```

## Verification

- [ ] `terraform plan` exits 0 for staging (and production if applicable)
- [ ] No unexpected `delete` actions in plan summary
- [ ] GitHub **Terraform plan** / **Infra deploy** jobs green
- [ ] `pnpm exec tsx scripts/terraform-smoke-test.ts staging` passes
- [ ] Terraform outputs match GitHub deploy secrets (`database_secret_arn`, bucket names, CloudFront IDs)

## Escalation / when to stop

- **Stop** before `force-unlock` if an apply workflow is still **in progress** — wait or cancel cleanly first.
- **Escalate** if production state may be corrupted — restore state from S3 versioning before further applies ([SECURITY_REMEDIATION.md](../SECURITY_REMEDIATION.md) INF-05).
- **Do not** apply production from a feature branch; use manual staging workflow only.
- Broad IAM on Terraform CI role is a known finding (INF-01) — do not expand `*` policies as a quick fix.

## References

| Resource                    | Path                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Infra pipelines doc         | [INFRA_PIPELINES.md](../INFRA_PIPELINES.md)                                            |
| Terraform composite action  | `.github/actions/terraform/action.yml`                                                 |
| Init / plan / apply scripts | `scripts/terraform-init.ts`, `scripts/terraform-plan.ts`, `scripts/terraform-apply.ts` |
| Progressive deploy workflow | `.github/workflows/infra-deploy.yml`                                                   |
| Manual staging workflow     | `.github/workflows/infra-staging-manual.yml`                                           |
| CI plan job                 | `.github/workflows/ci.yml` (`terraform-plan`)                                          |
| Bootstrap                   | `infra/bootstrap/`, `.github/workflows/infra-bootstrap.yml`                            |
| Operator quick start        | [infra/README.md](../../../infra/README.md)                                            |
| Architecture                | [AWS_INFRA.md](../AWS_INFRA.md)                                                        |
