# github-oidc module

Per-environment IAM deploy role for GitHub Actions. Trusts the **shared** account OIDC
provider created by [bootstrap](../../../bootstrap/README.md) (`token.actions.githubusercontent.com`).

## Permissions

- ECR push to `ecr_repository_arn`
- ECS Express deploy (`UpdateExpressGatewayService`, `DescribeExpressGatewayService`, `PassRole`)
- S3 sync to web/field static buckets
- CloudFront invalidation

## Inputs

| Name                          | Type         |
| ----------------------------- | ------------ |
| `name_prefix`                 | string       |
| `github_repository`           | string       |
| `ecr_repository_arn`          | string       |
| `web_bucket_arn`              | string       |
| `field_bucket_arn`            | string       |
| `cloudfront_distribution_ids` | list(string) |
| `tags`                        | map(string)  |

## Outputs

| Name              | Description      |
| ----------------- | ---------------- |
| `deploy_role_arn` | OIDC deploy role |
