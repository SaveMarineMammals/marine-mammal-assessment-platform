# cdn module

Single CloudFront distribution for the public web site and field PWA, with same-origin `/v1` routing to ECS Express.

## Resources

- `aws_cloudfront_origin_access_control` — S3 origins
- `aws_cloudfront_function.spa_router` — viewer-request SPA fallback for `/` and `/field/app/`
- `aws_cloudfront_distribution.site`:
  - Default → S3 web bucket (`/`, `/app`, `/docs`, …)
  - `/field/app` and `/field/app/*` → S3 field bucket (object keys under `field/app/`)
  - `/v1/*` → ECS Express API origin (HTTPS)
  - `/openapi*` → ECS Express API
- S3 bucket policies granting CloudFront OAC read

When `domain_name` is empty (current default), the distribution uses the **CloudFront default certificate** and a `*.cloudfront.net` hostname. ACM certificates and Route 53 aliases are not provisioned until a custom domain is configured.

Environments may set `enable_cdn = false` to skip this module entirely (account verification / CloudFront create blocked). See [AWS_INFRA.md](../../../../docs/ops/AWS_INFRA.md#optional-cloudfront-enable_cdn).

Preserve same-origin `/v1` routing so field PWA needs no `VITE_API_BASE_URL`. Field Vite `base` is `/field/app/`.

## Inputs

| Name              | Type                                           |
| ----------------- | ---------------------------------------------- |
| `name_prefix`     | string                                         |
| `domain_name`     | string                                         |
| `web_subdomain`   | string                                         |
| `field_subdomain` | string (unused; kept for tfvars compatibility) |
| `web_bucket_id`   | string                                         |
| `field_bucket_id` | string                                         |
| `api_service_url` | string                                         |
| `tags`            | map(string)                                    |

## Outputs

| Name               | Description                                        |
| ------------------ | -------------------------------------------------- |
| `site_url`         | Public site origin (https)                         |
| `web_url`          | Same as `site_url`                                 |
| `field_url`        | `{site_url}/field/app`                             |
| `distribution_ids` | Single CloudFront distribution ID for invalidation |
