# Database module

Managed PostgreSQL 16 with PostGIS support (via application migrations).

## Resources

- `aws_kms_key` — encrypts the RDS-managed master user secret (key policy allows RDS and Secrets Manager via `kms:ViaService`)
- `aws_db_subnet_group` — private subnets
- `aws_db_parameter_group` — PostgreSQL 16
- `aws_db_instance` — with **`manage_master_user_password = true`**

RDS creates and rotates the master user secret in **AWS Secrets Manager**. Terraform does **not** store the password in state.

## Secret format

The RDS-managed secret ARN (output `database_url_secret_arn`) contains JSON with credentials only:

```json
{
  "username": "mmap",
  "password": "..."
}
```

ECS Express injects that JSON into the `DATABASE_URL` task secret and sets non-secret `DB_HOST`, `DB_PORT`, and `DB_NAME` from Terraform outputs. The API (`apps/api/src/cli/database-url.ts`) merges them into a PostgreSQL connection string at runtime.

Local development and CI continue to use a plain `DATABASE_URL` connection string (`postgresql://mmap:mmap@localhost:5432/mmap`).

## PostGIS

Enabled in application migrations (`CREATE EXTENSION IF NOT EXISTS postgis`), not only via parameter group.

## Outputs

| Name                          | Description                     |
| ----------------------------- | ------------------------------- |
| `db_instance_id`              | RDS instance identifier         |
| `db_endpoint`                 | RDS hostname (non-secret)       |
| `db_port`                     | RDS port                        |
| `db_name`                     | Initial database name           |
| `database_url_secret_arn`     | RDS-managed Secrets Manager ARN |
| `database_secret_kms_key_arn` | KMS key for the master secret   |

## Migration from Terraform-managed passwords

If upgrading from an older stack that used `random_password`, expect Terraform to **replace** the RDS instance (new master secret). Plan a maintenance window and backup before apply.
