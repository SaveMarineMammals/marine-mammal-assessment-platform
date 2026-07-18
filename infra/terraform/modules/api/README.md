# api module

ECR repository and ECS Express Mode service for the Fastify sync API.

## Resources

- `aws_ecr_repository` — scan on push
- `aws_ecs_express_gateway_service` — Fargate tasks, ALB, auto scaling (AWS-recommended App Runner replacement)
- `aws_iam_role` — ECS execution, infrastructure, and task roles
- `data.aws_iam_role.ecs_service_linked` — verifies `AWSServiceRoleForECS` exists (create once per account via CLI if missing)
- `aws_secretsmanager_secret` for `API_ADMIN_TOKEN`
- `aws_cloudwatch_log_group` — `/mmap-{env}/api`

## Inputs

| Name                          | Type              |
| ----------------------------- | ----------------- |
| `name_prefix`                 | string            |
| `private_subnet_ids`          | list(string)      |
| `api_connector_sg_id`         | string            |
| `database_secret_arn`         | string            |
| `database_secret_kms_key_arn` | string (optional) |
| `data_bucket_arn`             | string            |
| `cpu`                         | string            |
| `memory`                      | string            |
| `cors_origins`                | list(string)      |
| `max_task_count`              | number            |
| `initial_image_uri`           | string            |
| `tags`                        | map(string)       |

## Outputs

| Name                          | Description                           |
| ----------------------------- | ------------------------------------- |
| `ecr_repository_arn`          | ECR repo ARN                          |
| `service_arn`                 | ECS Express service ARN               |
| `service_url`                 | HTTPS ALB URL (CloudFront API origin) |
| `ecs_execution_role_arn`      | Task execution role for CI deploy     |
| `ecs_infrastructure_role_arn` | Express infrastructure role for CI    |

Initial apply uses a public nginx placeholder image until the deploy pipeline publishes the API image to ECR.
