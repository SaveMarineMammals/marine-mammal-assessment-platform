# Terraform — MMAP AWS

Environment-specific roots live under `environments/`. Shared modules under `modules/`.

## Providers

- **Default region** (e.g. `us-east-1`): VPC, RDS, ECS Express, S3, most resources
- **Alias `us_east_1`**: reserved for ACM certificates in us-east-1 when custom CloudFront domains are enabled (not required when `domain_name` is empty)

## State

Use separate state keys per environment (configured via `-backend-config` in CI / `scripts/terraform-init.ts`):

| Environment | S3 state key                   |
| ----------- | ------------------------------ |
| staging     | `staging/terraform.tfstate`    |
| production  | `production/terraform.tfstate` |

Each environment root already declares a partial `backend "s3" {}` in `versions.tf`. Prefer `scripts/terraform-init.ts` over copying `backend.tf.example`.

## Line endings

All `*.tf` and `*.tfvars` files must use **LF** line endings (enforced by `.gitattributes`). Windows CRLF causes `Invalid character` errors when Terraform runs on Linux CI.
