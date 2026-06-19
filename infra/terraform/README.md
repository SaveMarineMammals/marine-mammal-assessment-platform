# Terraform — MMAP AWS

Environment-specific roots live under `environments/`. Shared modules under `modules/`.

## Providers

- **Default region** (e.g. `us-east-1`): VPC, RDS, App Runner, S3, most resources
- **Alias `us-east-1`** (same region): ACM certificates used by CloudFront must be in us-east-1

## State

Use separate state keys per environment:

| Environment | S3 state key                   |
| ----------- | ------------------------------ |
| staging     | `staging/terraform.tfstate`    |
| production  | `production/terraform.tfstate` |

Copy `backend.tf.example` to `backend.tf` and fill in your state bucket name.

## Line endings

All `*.tf` and `*.tfvars` files must use **LF** line endings (enforced by `.gitattributes`). Windows CRLF causes `Invalid character` errors when Terraform runs on Linux CI.
