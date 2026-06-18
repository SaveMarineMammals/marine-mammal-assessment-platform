# monitoring module

CloudWatch logs, alarms, and optional synthetics for MMAP.

## Resources to implement

- `aws_cloudwatch_log_group` — `/mmap/{env}/api` (App Runner auto-logs here when configured)
- `aws_cloudwatch_metric_alarm.api_5xx` — App Runner or ALB 5xx threshold
- `aws_cloudwatch_metric_alarm.rds_free_storage` — low free storage
- `aws_cloudwatch_metric_alarm.rds_cpu` — sustained high CPU
- `aws_cloudwatch_dashboard` — health + RDS + request count
- Optional: `aws_synthetics_canary` — GET `health_check_url` every 5 minutes

Custom metric (future): parse API logs for sync batch success/failure counts.

## Inputs

| Name | Type |
| ---- | ---- |
| `name_prefix` | string |
| `api_service_arn` | string |
| `db_instance_id` | string |
| `health_check_url` | string |
| `tags` | map(string) |

## Outputs

| Name | Description |
| ---- | ----------- |
| `dashboard_name` | CloudWatch dashboard name |
