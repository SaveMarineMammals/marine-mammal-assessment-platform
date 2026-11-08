# CDN module

Single CloudFront distribution for web, field PWA, API, and public dataset snapshots.

## Behaviors

- `/` → web static (S3 OAC)
- `/field/app/*` → field static (S3 OAC)
- `/dataset/latest/*` → data bucket snapshots (S3 OAC)
- `/v1/*` → Lambda Function URL (sync/health/admin)
- `/api/*` → Lambda Function URL (Swagger UI)
- `/openapi*` → 301 rewrite to `/api/docs*`

## Inputs

Requires `api_service_url` (Function URL), `web_bucket_id`, `field_bucket_id`, and `data_bucket_id`.
