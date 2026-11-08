# API module (Lambda)

Fastify API packaged as AWS Lambda with a public **Function URL**.

## Resources

- `aws_lambda_function.api` — sync, health, admin, and scheduled dataset export
- `aws_lambda_function_url.api` — HTTPS entrypoint (CloudFront `/v1/*` + `/api/*` origin)
- EventBridge rule — daily `dataset-export` job writing `dataset/latest/*` to the data bucket
- Optional `db_control` Lambda + schedules when `enable_db_auto_stop` is true (start before export, stop after)
- Secrets Manager admin token, CloudWatch log group

## Deploy

CI runs `pnpm --filter @mmap/api package:lambda` then
`aws lambda update-function-code` (Terraform ignores code hash after bootstrap placeholder).

## Inputs (selected)

| Name                  | Notes                                              |
| --------------------- | -------------------------------------------------- |
| `subnet_ids`          | Private subnets (RDS access)                       |
| `data_bucket_id`      | Snapshot destination                               |
| `enable_db_auto_stop` | Staging default true; leave false during campaigns |

## Outputs

| Name                     | Notes                        |
| ------------------------ | ---------------------------- |
| `service_url`            | Function URL (no trailing /) |
| `lambda_function_name`   | Deploy target                |
| `admin_token_secret_arn` | Admin route auth             |
