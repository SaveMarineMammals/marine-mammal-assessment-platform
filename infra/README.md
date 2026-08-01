# MMAP infrastructure (AWS)

Terraform layout for staging and production. Full architecture: [docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md).

## Quick start (operators)

1. **Bootstrap** — run [Infra bootstrap](../../.github/workflows/infra-bootstrap.yml) once (admin only). Creates remote state, the Terraform CI OIDC role, and the account-wide `AWSServiceRoleForECS` service-linked role. See [docs/ops/INFRA_PIPELINES.md](../docs/ops/INFRA_PIPELINES.md).
2. **Enable CI** — set repository variable `TF_INFRA_ENABLED=true` and add Terraform secrets from bootstrap outputs.
3. **Deploy** — merge to `main` for progressive CD (staging infra+app+verify → production), or use **Release staging** from a feature branch.

Full architecture: [docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md).

### Local plan / apply (after bootstrap)

```powershell
cd infra/terraform/environments/staging
terraform init -input=false `
  "-backend-config=bucket=<TF_STATE_BUCKET>" `
  "-backend-config=key=staging/terraform.tfstate" `
  "-backend-config=region=us-east-1" `
  "-backend-config=dynamodb_table=<TF_LOCK_TABLE>"
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

4. **First deploy:** after infrastructure exists, merge to `main` (CD) or run **Release staging** / **Deploy AWS** for an app-only push.

### Ephemeral staging (cost control)

Staging API + RDS + VPC are **not** meant to run 24/7. When idle, destroy the staging root only (keeps bootstrap state/OIDC). When needed again, re-apply. Details and measured costs: [docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md#ephemeral-staging).

```powershell
# From infra/terraform/environments/staging (after init as above)
terraform plan -destroy -var-file=terraform.tfvars
terraform destroy -var-file=terraform.tfvars
```

Do not destroy the bootstrap stack (`infra/bootstrap`).

### Optional CloudFront (`enable_cdn`)

Staging and production currently set `enable_cdn = false` so apply succeeds while CloudFront
create is blocked (unverified AWS account). Test the live API with:

```powershell
terraform -chdir=infra/terraform/environments/staging output -raw api_service_url
```

Set `enable_cdn = true` after account verification. Full details:
[docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md#optional-cloudfront-enable_cdn).

### Hibernate staging (keep it provisioned, cut most cost)

When a full teardown is too heavy, scale the API to zero tasks and stop RDS instead. Floor is ~$25/mo (ALB + public IPv4 + RDS storage) versus ~$0/mo when destroyed. Full details and caveats: [docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md#hibernate-staging-scale-to-zero).

```powershell
pnpm exec tsx scripts/staging-hibernate.ts status
pnpm exec tsx scripts/staging-hibernate.ts hibernate
pnpm exec tsx scripts/staging-hibernate.ts resume
```

## Module graph

```
environments/staging|production/main.tf
  ├── module.networking
  ├── module.database      (depends on networking)
  ├── module.storage
  ├── module.api           (depends on networking, database, storage)
  ├── module.cdn           (depends on storage, api)
  ├── module.monitoring    (depends on api, database)
  └── module.github_oidc   (depends on storage, api, cdn)
```

## What is not in Terraform (v1)

- Container image builds (GitHub Actions)
- Application database migrations (CI job before API deploy)
- Field/web static asset uploads (CI sync to S3)

## Local development

Docker Compose remains the local stack — see [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md). Do not point local apps at production RDS.
