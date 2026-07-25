# cdn module

CloudFront distributions for public web and field PWA, with same-origin `/v1` routing to ECS Express.

## Resources

- `aws_cloudfront_origin_access_control` — S3 origins
- `aws_cloudfront_distribution.web`:
  - Default → S3 web bucket
  - `/v1/*` → ECS Express API origin (HTTPS)
  - `/openapi*` → ECS Express API (web only)
- `aws_cloudfront_distribution.field`:
  - Default → S3 field bucket
  - `/v1/*` → ECS Express API
- S3 bucket policies granting CloudFront OAC read

When `domain_name` is empty (current default), distributions use the **CloudFront default certificate** and `*.cloudfront.net` hostnames. ACM certificates and Route 53 aliases are not provisioned until a custom domain is configured.

Environments may set `enable_cdn = false` to skip this module entirely (account verification / CloudFront create blocked). See [AWS_INFRA.md](../../../../docs/ops/AWS_INFRA.md#optional-cloudfront-enable_cdn).

Preserve same-origin `/v1` routing so field PWA needs no `VITE_API_BASE_URL`.

## Inputs

| Name              | Type        |
| ----------------- | ----------- |
| `name_prefix`     | string      |
| `domain_name`     | string      |
| `web_subdomain`   | string      |
| `field_subdomain` | string      |
| `web_bucket_id`   | string      |
| `field_bucket_id` | string      |
| `api_service_url` | string      |
| `tags`            | map(string) |

## Outputs

| Name               | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `web_fqdn`         | Custom FQDN or CloudFront domain name                |
| `field_fqdn`       | Custom FQDN or CloudFront domain name                |
| `distribution_ids` | list of CloudFront distribution IDs for invalidation |
