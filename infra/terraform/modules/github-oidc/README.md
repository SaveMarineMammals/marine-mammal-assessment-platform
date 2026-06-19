# github-oidc module

IAM role for GitHub Actions to deploy without long-lived AWS keys.

## Resources to implement

- `aws_iam_openid_connect_provider` — `token.actions.githubusercontent.com` (account-level; skip if exists)
- `aws_iam_role.github_deploy`:
  - Trust: repo `${github_repository}`, subject `ref:refs/tags/v*` (production) and optionally `ref:refs/heads/main` (staging)
- Inline policies:
  - ECR: `GetAuthorizationToken`, push to `ecr_repository_arn`
  - App Runner: `StartDeployment`, `UpdateService` on `app_runner_arn`
  - S3: `PutObject`, `DeleteObject`, `ListBucket` on web + field buckets
  - CloudFront: `CreateInvalidation` on distribution IDs

Output `deploy_role_arn` → GitHub secret `AWS_DEPLOY_ROLE_ARN`.

## Inputs

| Name                          | Type         |
| ----------------------------- | ------------ |
| `name_prefix`                 | string       |
| `github_repository`           | string       |
| `ecr_repository_arn`          | string       |
| `app_runner_arn`              | string       |
| `web_bucket_arn`              | string       |
| `field_bucket_arn`            | string       |
| `cloudfront_distribution_ids` | list(string) |
| `tags`                        | map(string)  |

## Outputs

| Name              | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `deploy_role_arn` | IAM role ARN for `aws-actions/configure-aws-credentials` |
