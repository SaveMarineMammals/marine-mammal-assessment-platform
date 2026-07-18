# monitoring module

CloudWatch alarms and dashboard for MMAP environments.

## Resources

- `aws_cloudwatch_metric_alarm.ecs_cpu` — ECS service CPU threshold
- `aws_cloudwatch_metric_alarm.rds_free_storage` — RDS storage threshold
- `aws_cloudwatch_dashboard` — environment overview

API logs are created in the `api` module (`aws_cloudwatch_log_group`).

## Inputs

| Name               | Type   |
| ------------------ | ------ |
| `name_prefix`      | string |
| `api_service_name` | string |
| `db_instance_id`   | string |
| `health_check_url` | string |
| `tags`             | map    |

## Outputs

| Name             | Description    |
| ---------------- | -------------- |
| `dashboard_name` | Dashboard name |
