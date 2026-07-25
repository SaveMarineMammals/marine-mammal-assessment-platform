# api module

ECR repository and ECS Express Mode service for the Fastify sync API.

## Resources

- `aws_ecr_repository` — scan on push (`mmap-{env}-api`)
- `aws_ecs_express_gateway_service` — Fargate tasks, managed ALB, auto scaling
- `aws_iam_role` — ECS execution, infrastructure, and task roles
- `data.aws_iam_role.ecs_service_linked` — verifies `AWSServiceRoleForECS` exists (created by [bootstrap](../../../bootstrap/README.md))
- `aws_secretsmanager_secret` for `API_ADMIN_TOKEN`
- `aws_cloudwatch_log_group` — `/{name_prefix}/api` (e.g. `/mmap-staging/api`)

## Inputs

| Name                          | Type              | Notes                                                |
| ----------------------------- | ----------------- | ---------------------------------------------------- |
| `name_prefix`                 | string            |                                                      |
| `subnet_ids`                  | list(string)      | Public subnets for ECS Express (internet-facing ALB) |
| `api_connector_sg_id`         | string            |                                                      |
| `database_secret_arn`         | string            |                                                      |
| `database_secret_kms_key_arn` | string (optional) |                                                      |
| `data_bucket_arn`             | string            |                                                      |
| `cpu`                         | string            | Default env: `1024` (1 vCPU)                         |
| `memory`                      | string            | Default env: `2048` (2 GiB)                          |
| `cors_origins`                | list(string)      |                                                      |
| `max_task_count`              | number            |                                                      |
| `initial_image_uri`           | string            |                                                      |
| `tags`                        | map(string)       |                                                      |

## Outputs

| Name                          | Description                           |
| ----------------------------- | ------------------------------------- |
| `ecr_repository_arn`          | ECR repo ARN                          |
| `service_arn`                 | ECS Express service ARN               |
| `service_name`                | e.g. `mmap-staging-api`               |
| `service_url`                 | HTTPS ALB URL (CloudFront API origin) |
| `ecs_execution_role_arn`      | Task execution role for CI deploy     |
| `ecs_infrastructure_role_arn` | Express infrastructure role for CI    |

Initial apply uses a public nginx placeholder image until the deploy pipeline publishes the API image to ECR. Terraform ignores subsequent image changes (CI updates Express directly).

To cut staging cost without destroying the stack, see `scripts/staging-hibernate.ts` ([AWS_INFRA.md](../../../../docs/ops/AWS_INFRA.md#hibernate-staging-scale-to-zero)).
