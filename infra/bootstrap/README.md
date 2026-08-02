# Terraform bootstrap (one-time)

Creates remote state storage, the GitHub OIDC role used by CI for `terraform plan` /
`apply`, and (optionally) the public domain + shared ACM certificate for CloudFront.

## Resources

- S3 bucket (versioned, encrypted) for Terraform state
- DynamoDB table for state locking
- GitHub OIDC provider (if not already present in the account)
- IAM role `mmap-terraform-ci` trusted by this repository
- IAM service-linked role `AWSServiceRoleForECS` (account-wide ECS prerequisite)
- **Optional public domain** (`enable_public_domain = true`):
  - Route 53 Domains registration for `public_domain` (default `savemarinemammals.com`)
  - Auto-created public hosted zone
  - ACM certificate in **us-east-1** covering apex + `*.savemarinemammals.com`
  - DNS validation records in the hosted zone

## Run via GitHub Actions (recommended)

1. Configure the **`bootstrap`** environment with admin-only reviewers.
2. Add `AWS_BOOTSTRAP_ACCESS_KEY_ID` and `AWS_BOOTSTRAP_SECRET_ACCESS_KEY` to that environment.
3. Run **Infra bootstrap** (`infra-bootstrap.yml`) as a repository admin.
4. Copy outputs into repository secrets (see [docs/ops/INFRA_PIPELINES.md](../../docs/ops/INFRA_PIPELINES.md)).

## Run locally (alternative)

Requires AWS credentials with permission to create S3, DynamoDB, IAM, Route 53 Domains,
and ACM resources.

```powershell
cd infra/bootstrap
copy terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set github_repository; optionally enable the public domain
terraform init
terraform apply
```

Bootstrap uses **local state** stored in `infra/bootstrap/terraform.tfstate` — back up this
file; it is not stored in S3.

## Public domain (savemarinemammals.com)

Domain registration is **billed** (~$16/yr for `.com`) and **non-refundable**. First apply
can take minutes to hours for registry processing and contact email verification.

1. Copy `terraform.tfvars.example` → `terraform.tfvars` (if needed).
2. Set `enable_public_domain = true` and fill `domain_contact` (admin/registrant/tech use the
   same contact). Phone format: `+[country].[number]` (e.g. `+1.4155551234`).
3. Do **not** commit real contact PII — keep it in local tfvars or CI secrets only.
4. `terraform apply` — resource uses `lifecycle.prevent_destroy` so destroy will not cancel
   the registration accidentally (still: do not remove the domain from AWS casually).
5. Confirm outputs:

```powershell
terraform output public_domain
terraform output -raw hosted_zone_id
terraform output -raw acm_certificate_arn
terraform output name_servers
```

6. Copy `hosted_zone_id` and `acm_certificate_arn` into staging and production
   `terraform.tfvars` with `domain_name = "savemarinemammals.com"` (see environment
   `terraform.tfvars.example` files and [DEPLOYMENT.md](../../docs/ops/DEPLOYMENT.md)).

| Output                | Use                                                  |
| --------------------- | ---------------------------------------------------- |
| `public_domain`       | Root domain string                                   |
| `hosted_zone_id`      | Staging/production CDN Route 53 aliases              |
| `acm_certificate_arn` | CloudFront viewer certificate (shared)               |
| `name_servers`        | Informational (Route 53 Domains already points here) |

## ECS service-linked role

Bootstrap creates `AWSServiceRoleForECS` (`ecs.amazonaws.com`). Staging/production Terraform
reads this role via a data source in the api module; it is not recreated per environment.

If the role already exists in the account (for example after a manual
`aws iam create-service-linked-role`), import it into bootstrap state before re-running apply:

```powershell
cd infra/bootstrap
terraform import aws_iam_service_linked_role.ecs `
  "arn:aws:iam::ACCOUNT_ID:role/aws-service-role/ecs.amazonaws.com/AWSServiceRoleForECS"
terraform apply
```

Replace `ACCOUNT_ID` with your AWS account ID.

## After bootstrap

Remove or rotate bootstrap access keys when no longer needed. Day-to-day Terraform uses
`AWS_TERRAFORM_ROLE_ARN` via OIDC.
