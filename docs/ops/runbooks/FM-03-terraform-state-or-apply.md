# FM-03 — Terraform plan/apply failure or state lock

**ID:** FM-03  
**Domain:** Infrastructure  
**Severity:** High

## Context

MMAP infrastructure is managed with Terraform under `infra/terraform/`. Remote state lives in **S3** with locking via **DynamoDB** (`scripts/terraform-init.ts`). CI runs:

| Workflow | Behavior |
| -------- | -------- |
| `ci.yml` → `terraform-plan` | Plans staging + production on PR/push to `main` when `TF_INFRA_ENABLED=true` |
| `infra-deploy.yml` | Applies staging → smoke test → production (main only) |
| `infra-staging-manual.yml` | Staging apply from any branch |

Applies use `-auto-approve` via `scripts/terraform-apply.ts`. State keys are isolated: `staging/terraform.tfstate` and `production/terraform.tfstate`.

**Who is affected:** Operators blocked from shipping infra fixes; application deploy may depend on fresh outputs (buckets, CloudFront IDs, secret ARNs).

**What breaks:**

- **State lock** — concurrent apply/plan or crashed runner leaves DynamoDB lock; subsequent runs fail with *Error acquiring the state lock*.
- **Plan/apply errors** — invalid tfvars, AWS API limits, dependency drift, or missing bootstrap secrets.
- **Destroy in plan** — CI posts PR warning; merging without review can delete resources.
- **`TF_INFRA_ENABLED` not true** — Terraform jobs skipped silently.

## Detection

| Signal | Where |
| ------ | ----- |
| Red **Terraform plan** or **Infra deploy** job | GitHub Actions |
| Log: `Error acquiring the state lock` | Plan/apply logs |
| PR comment: ⚠️ **Terraform destroy detected** | `ci.yml` github-script step |
| `terraform-smoke-test.ts` exit 1 after apply | `infra-deploy.yml` verify jobs |
| Local: `terraform plan` non-zero exit | Operator workstation |

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

   | Error pattern | Likely cause |
   | ------------- | ------------ |
   | `Error acquiring the state lock` | Stale lock from parallel/crashed job |
   | `AccessDenied` on S3/DynamoDB/IAM | OIDC role or bootstrap secrets wrong |
   | `InvalidParameterCombination` | RDS/App Runner module input drift |
   | Destroy actions in plan | Resource rename or removed block |

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

   Smoke test hits App Runner `api_service_url` root (placeholder image returns 200 on `/` until real API is deployed). If URL is wrong, check `outputs.tf` and module.api `service_url`.

6. **Skipped jobs**

   If Terraform jobs do not appear at all, set `TF_INFRA_ENABLED=true` and ensure PR touches `infra/**` or workflow paths for deploy triggers.

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

| Resource | Path |
| -------- | ---- |
| Infra pipelines doc | [INFRA_PIPELINES.md](../INFRA_PIPELINES.md) |
| Terraform composite action | `.github/actions/terraform/action.yml` |
| Init / plan / apply scripts | `scripts/terraform-init.ts`, `scripts/terraform-plan.ts`, `scripts/terraform-apply.ts` |
| Progressive deploy workflow | `.github/workflows/infra-deploy.yml` |
| Manual staging workflow | `.github/workflows/infra-staging-manual.yml` |
| CI plan job | `.github/workflows/ci.yml` (`terraform-plan`) |
| Bootstrap | `infra/bootstrap/`, `.github/workflows/infra-bootstrap.yml` |
| Operator quick start | [infra/README.md](../../../infra/README.md) |
| Architecture | [AWS_INFRA.md](../AWS_INFRA.md) |
