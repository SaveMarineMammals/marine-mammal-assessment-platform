# Terraform bootstrap (one-time)

Creates remote state storage and the GitHub OIDC role used by CI for `terraform plan` / `apply`.

## Resources

- S3 bucket (versioned, encrypted) for Terraform state
- DynamoDB table for state locking
- GitHub OIDC provider (if not already present in the account)
- IAM role `mmap-terraform-ci` trusted by this repository

## Run via GitHub Actions (recommended)

1. Configure the **`bootstrap`** environment with admin-only reviewers.
2. Add `AWS_BOOTSTRAP_ACCESS_KEY_ID` and `AWS_BOOTSTRAP_SECRET_ACCESS_KEY` to that environment.
3. Run **Infra bootstrap** (`infra-bootstrap.yml`) as a repository admin.
4. Copy outputs into repository secrets (see [docs/ops/INFRA_PIPELINES.md](../../docs/ops/INFRA_PIPELINES.md)).

## Run locally (alternative)

Requires AWS credentials with permission to create S3, DynamoDB, and IAM resources.

```powershell
cd infra/bootstrap
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

Bootstrap uses **local state** stored in `infra/bootstrap/terraform.tfstate` — back up this file; it is not stored in S3.

## After bootstrap

Remove or rotate bootstrap access keys when no longer needed. Day-to-day Terraform uses `AWS_TERRAFORM_ROLE_ARN` via OIDC.
