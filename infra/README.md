# MMAP infrastructure (AWS)

Terraform layout for staging and production. Full architecture: [docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md).

## Quick start (operators)

1. **Bootstrap** — run [Infra bootstrap](../../.github/workflows/infra-bootstrap.yml) once (admin only). See [docs/ops/INFRA_PIPELINES.md](../docs/ops/INFRA_PIPELINES.md).
2. **Enable CI** — set repository variable `TF_INFRA_ENABLED=true` and add Terraform secrets from bootstrap outputs.
3. **Deploy** — merge infra changes to `main` for progressive staging → production apply, or use **Infra staging (manual)** from a feature branch.

Full architecture: [docs/ops/AWS_INFRA.md](../docs/ops/AWS_INFRA.md).

### Local plan (after bootstrap)

   ```powershell
   terraform init
   terraform plan
   terraform apply
   ```

4. **First deploy:** after infrastructure exists, run the GitHub Actions `deploy-aws` workflow (or push a tag for production).

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
