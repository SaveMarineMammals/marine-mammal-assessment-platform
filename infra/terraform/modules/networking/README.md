# networking module

VPC and security groups for RDS and ECS API tasks.

## Resources

- `aws_vpc` — 10.0.0.0/16
- `aws_subnet` — private subnets (RDS) and public subnets (ECS Express ALB + tasks)
- `aws_internet_gateway` + public route table — egress for ECS tasks to AWS APIs
- `aws_vpc_endpoint.s3` — free S3 gateway endpoint
- `aws_security_group.api_connector` — ECS task ENIs
- `aws_security_group.rds` — PostgreSQL from API connector SG

Interface VPC endpoints (ECR, Logs, Secrets Manager) are **not** provisioned. Tasks
in public subnets use the internet gateway for AWS API calls, which avoids ~$58/mo
of PrivateLink ENI charges per environment.

## Inputs

| Name          | Type        |
| ------------- | ----------- |
| `name_prefix` | string      |
| `tags`        | map(string) |

## Outputs

| Name                              | Description                     |
| --------------------------------- | ------------------------------- |
| `vpc_id`                          | VPC ID                          |
| `private_subnet_ids`              | Private subnet IDs (RDS)        |
| `public_subnet_ids`               | Public subnet IDs (ECS Express) |
| `api_connector_security_group_id` | SG for ECS API tasks            |
| `rds_security_group_id`           | SG for RDS                      |
