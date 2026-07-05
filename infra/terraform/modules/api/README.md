# api module

ECR repository and App Runner service for the Fastify sync API.

## Resources to implement

- `aws_ecr_repository` — scan on push
- `aws_iam_role` + policies — Secrets Manager read, S3 data bucket, CloudWatch logs
- `aws_apprunner_service`:
  - Image from ECR (placeholder tag until first CI deploy)
  - VPC connector for RDS access
  - Runtime env: `DATABASE_URL`, `API_ADMIN_TOKEN`, `CORS_ORIGIN`, `S3_BUCKET`, `PORT=3001`
  - Health check: `/v1/health`
  - `auto_deployments_enabled` from variable (true staging, false production)
- `aws_secretsmanager_secret` for `API_ADMIN_TOKEN`

## Inputs

| Name                  | Type         |
| --------------------- | ------------ |
| `name_prefix`         | string       |
| `vpc_connector_arn`   | string       |
| `private_subnet_ids`  | list(string) |
| `api_connector_sg_id` | string       |
| `database_secret_arn` | string       |
| `data_bucket_arn`     | string       |
| `cpu`                 | string       |
| `memory`              | string       |
| `cors_origins`        | list(string) |
| `auto_deployments`    | bool         |
| `tags`                | map(string)  |

## Outputs

| Name                 | Description                   |
| -------------------- | ----------------------------- |
| `ecr_repository_arn` | ECR repo ARN                  |
| `service_arn`        | App Runner service ARN        |
| `service_url`        | HTTPS URL (CloudFront origin) |

## Phase 2 (canary)

Replace App Runner with ECS Fargate + ALB + CodeDeploy; keep ECR and IAM patterns.
