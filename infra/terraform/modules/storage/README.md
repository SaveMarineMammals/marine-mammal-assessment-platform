# storage module

S3 buckets for static frontends and dataset/attachment object storage.

## Resources to implement

- `aws_s3_bucket.web_static` — web build artifacts; block public access (CloudFront OAC only)
- `aws_s3_bucket.field_static` — field PWA artifacts
- `aws_s3_bucket.data` — private exports/attachments; IAM access from API role only
- Bucket versioning on `data`
- Lifecycle rule: transition old dataset prefixes to Glacier after N days

## Inputs

| Name | Type |
| ---- | ---- |
| `name_prefix` | string |
| `tags` | map(string) |

## Outputs

| Name | Description |
| ---- | ----------- |
| `web_bucket_id` | Web static bucket name |
| `web_bucket_arn` | Web bucket ARN |
| `field_bucket_id` | Field static bucket name |
| `field_bucket_arn` | Field bucket ARN |
| `data_bucket_arn` | Private data bucket ARN |
