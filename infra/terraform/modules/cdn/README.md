# cdn module

Single CloudFront distribution for the public web site and field PWA, with same-origin `/v1`
routing to ECS Express.

## Resources

- `aws_cloudfront_origin_access_control` — S3 origins
- `aws_cloudfront_function.spa_router` — viewer-request SPA fallback for `/` and `/field/app/`;
  optional apex → canonical host 301 redirect
- `aws_cloudfront_function.openapi_rewrite` — viewer-request rewrite `/openapi*` → `/docs*` so
  same-origin Swagger UI matches local nginx/Vite (API serves docs at `/docs`)
- `aws_cloudfront_response_headers_policy.security` — HSTS and baseline headers when a custom
  domain is configured
- `aws_cloudfront_distribution.site`:
  - Default → S3 web bucket (`/`, `/app`, `/docs`, …)
  - `/field/app` and `/field/app/*` → S3 field bucket (object keys under `field/app/`)
  - `/v1/*` → ECS Express API origin (HTTPS)
  - `/openapi*` → ECS Express API (URI rewritten to `/docs*` before origin)
- Route 53 alias `A`/`AAAA` records when `domain_name` is set
- S3 bucket policies granting CloudFront OAC read

## Custom domain

When `domain_name` is empty, the distribution uses the **CloudFront default certificate** and a
`*.cloudfront.net` hostname.

When `domain_name` is set (e.g. `savemarinemammals.com`):

| Input                  | Role                                                      |
| ---------------------- | --------------------------------------------------------- |
| `web_subdomain`        | Canonical host = `{web_subdomain}.{domain_name}`          |
| `hosted_zone_id`       | Bootstrap hosted zone (required)                          |
| `acm_certificate_arn`  | Shared ACM cert apex + wildcard from bootstrap (required) |
| `enable_apex_redirect` | Also alias the apex and 301 to the canonical host         |

**Staging:** `staging.savemarinemammals.com` (`enable_apex_redirect = false`).

**Production:** `www.savemarinemammals.com` canonical; `savemarinemammals.com` → 301 to www
(`enable_apex_redirect = true`).

Field PWA stays on the same host at `/field/app/`.

Environments may set `enable_cdn = false` to skip this module entirely (account verification /
CloudFront create blocked). See [AWS_INFRA.md](../../../../docs/ops/AWS_INFRA.md#cloudfront-enable_cdn).

Preserve same-origin `/v1` routing so field PWA needs no `VITE_API_BASE_URL`. Field Vite `base`
is `/field/app/`.

## Inputs

| Name                   | Type                                           |
| ---------------------- | ---------------------------------------------- |
| `name_prefix`          | string                                         |
| `domain_name`          | string                                         |
| `web_subdomain`        | string                                         |
| `field_subdomain`      | string (unused; kept for tfvars compatibility) |
| `hosted_zone_id`       | string                                         |
| `acm_certificate_arn`  | string                                         |
| `enable_apex_redirect` | bool                                           |
| `web_bucket_id`        | string                                         |
| `field_bucket_id`      | string                                         |
| `api_service_url`      | string                                         |
| `tags`                 | map(string)                                    |

## Outputs

| Name               | Description                                        |
| ------------------ | -------------------------------------------------- |
| `site_url`         | Public site origin (https)                         |
| `web_url`          | Same as `site_url` (canonical host when custom)    |
| `field_url`        | `{site_url}/field/app`                             |
| `distribution_ids` | Single CloudFront distribution ID for invalidation |
