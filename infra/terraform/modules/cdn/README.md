# cdn module

CloudFront distributions, ACM certificates, and Route 53 records.

## Resources to implement

- `aws_acm_certificate` (provider `aws.us_east_1`) — `*.domain` or per-host certs
- `aws_cloudfront_origin_access_control` — S3 origins
- `aws_cloudfront_distribution.web`:
  - Default → S3 web bucket
  - `/v1/*` → App Runner custom origin (HTTPS)
  - `/openapi*` → App Runner (web only)
- `aws_cloudfront_distribution.field`:
  - Default → S3 field bucket
  - `/v1/*` → App Runner
- `aws_route53_record` — A/AAAA aliases for web + field hostnames
- S3 bucket policies granting CloudFront OAC read

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
| `web_fqdn`         | e.g. `staging.example.org`                           |
| `field_fqdn`       | e.g. `field-staging.example.org`                     |
| `distribution_ids` | list of CloudFront distribution IDs for invalidation |
