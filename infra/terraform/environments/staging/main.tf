locals {
  name_prefix = "mmap-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = "mmap"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
  computed_cors = length(var.cors_origins) > 0 ? var.cors_origins : compact([
    var.domain_name != "" ? "https://${var.web_subdomain}.${var.domain_name}" : null,
    var.domain_name != "" ? "https://${var.field_subdomain}.${var.domain_name}" : null,
  ])
}

module "networking" {
  source = "../../modules/networking"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

module "database" {
  source = "../../modules/database"

  name_prefix           = local.name_prefix
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  api_connector_sg_id   = module.networking.api_connector_security_group_id
  rds_security_group_id = module.networking.rds_security_group_id
  instance_class        = var.db_instance_class
  backup_retention_days = var.db_backup_retention_days
  deletion_protection   = var.environment == "production"
  tags                  = local.common_tags
}

module "storage" {
  source = "../../modules/storage"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

module "api" {
  source = "../../modules/api"

  name_prefix         = local.name_prefix
  vpc_connector_arn   = module.networking.app_runner_vpc_connector_arn
  private_subnet_ids  = module.networking.private_subnet_ids
  api_connector_sg_id = module.networking.api_connector_security_group_id
  database_secret_arn         = module.database.database_url_secret_arn
  database_secret_kms_key_arn = module.database.database_secret_kms_key_arn
  data_bucket_arn             = module.storage.data_bucket_arn
  cpu                 = var.api_cpu
  memory              = var.api_memory
  cors_origins        = local.computed_cors
  auto_deployments    = var.environment == "staging"
  tags                = local.common_tags
}

module "cdn" {
  source = "../../modules/cdn"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix     = local.name_prefix
  domain_name     = var.domain_name
  web_subdomain   = var.web_subdomain
  field_subdomain = var.field_subdomain
  web_bucket_id   = module.storage.web_bucket_id
  field_bucket_id = module.storage.field_bucket_id
  api_service_url = module.api.service_url
  tags            = local.common_tags
}

module "monitoring" {
  source = "../../modules/monitoring"

  name_prefix       = local.name_prefix
  api_service_arn   = module.api.service_arn
  api_service_name  = module.api.service_name
  db_instance_id    = module.database.db_instance_id
  health_check_url  = "${module.cdn.field_url}/v1/health"
  tags              = local.common_tags
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name_prefix                 = local.name_prefix
  github_repository           = var.github_repository
  ecr_repository_arn          = module.api.ecr_repository_arn
  app_runner_arn              = module.api.service_arn
  web_bucket_arn              = module.storage.web_bucket_arn
  field_bucket_arn            = module.storage.field_bucket_arn
  cloudfront_distribution_ids = module.cdn.distribution_ids
  tags                        = local.common_tags
}
