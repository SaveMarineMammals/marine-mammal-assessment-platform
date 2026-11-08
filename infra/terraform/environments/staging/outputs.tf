output "database_secret_arn" {
  description = "RDS-managed master user secret ARN (store as GitHub secret DATABASE_SECRET_ARN)"
  value       = module.database.database_url_secret_arn
}

output "database_secret_kms_key_arn" {
  value = module.database.database_secret_kms_key_arn
}

output "db_endpoint" {
  value = module.database.db_endpoint
}

output "db_port" {
  value = module.database.db_port
}

output "db_name" {
  value = module.database.db_name
}

output "enable_cdn" {
  description = "Whether CloudFront distributions are provisioned"
  value       = var.enable_cdn
}

output "web_url" {
  description = "Public site URL (CloudFront when enable_cdn; empty otherwise)"
  value       = var.enable_cdn ? module.cdn[0].web_url : ""
}

output "field_url" {
  description = "Field PWA URL on the same host (.../field/app when enable_cdn)"
  value       = var.enable_cdn ? module.cdn[0].field_url : ""
}

output "api_service_url" {
  description = "Lambda Function URL — primary sync/health entrypoint when enable_cdn is false"
  value       = module.api.service_url
}

output "lambda_function_name" {
  value = module.api.lambda_function_name
}

output "data_bucket" {
  value = module.storage.data_bucket_id
}

output "github_deploy_role_arn" {
  value = module.github_oidc.deploy_role_arn
}

output "web_static_bucket" {
  value = module.storage.web_bucket_id
}

output "field_static_bucket" {
  value = module.storage.field_bucket_id
}

output "web_cloudfront_distribution_id" {
  description = "Empty when enable_cdn is false. Single distribution serves web + field."
  value       = var.enable_cdn ? module.cdn[0].distribution_ids[0] : ""
}

output "field_cloudfront_distribution_id" {
  description = "Deprecated alias of web_cloudfront_distribution_id (single distribution)"
  value       = var.enable_cdn ? module.cdn[0].distribution_ids[0] : ""
}

output "ecs_service_name" {
  description = "Deprecated alias of lambda_function_name (API is Lambda, not ECS)"
  value       = module.api.service_name
}

output "admin_token_secret_arn" {
  value = module.api.admin_token_secret_arn
}
