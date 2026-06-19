output "database_secret_arn" {
  description = "RDS-managed master user secret ARN (store as GitHub secret DATABASE_SECRET_ARN)"
  value       = module.database.database_url_secret_arn
}

output "database_secret_kms_key_arn" {
  value = module.database.database_secret_kms_key_arn
}

output "web_url" {
  value = module.cdn.web_url
}

output "field_url" {
  value = module.cdn.field_url
}

output "api_service_url" {
  value = module.api.service_url
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
  value = module.cdn.distribution_ids[0]
}

output "field_cloudfront_distribution_id" {
  value = module.cdn.distribution_ids[1]
}

output "ecr_repository_url" {
  value = module.api.ecr_repository_url
}
