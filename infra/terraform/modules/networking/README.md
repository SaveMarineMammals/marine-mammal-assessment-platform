# networking module

VPC and security groups for RDS and App Runner VPC connector.

## Resources to implement

- `aws_vpc` — `10.0.0.0/16`
- `aws_subnet` — 2 public + 2 private subnets across AZs
- `aws_security_group.rds` — ingress TCP 5432 from `api_connector_sg` only
- `aws_security_group.api_connector` — egress to RDS + HTTPS for S3/AWS APIs
- `aws_apprunner_vpc_connector` — private subnet attachment

## Inputs

| Name          | Type        |
| ------------- | ----------- |
| `name_prefix` | string      |
| `tags`        | map(string) |

## Outputs

| Name                              | Description                      |
| --------------------------------- | -------------------------------- |
| `vpc_id`                          | VPC ID                           |
| `private_subnet_ids`              | Private subnet IDs for RDS       |
| `api_connector_security_group_id` | SG for App Runner connector ENIs |
| `app_runner_vpc_connector_arn`    | VPC connector ARN                |
