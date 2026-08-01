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

# ECS migration: log group lived in monitoring; api module now owns it.
moved {
  from = module.monitoring.aws_cloudwatch_log_group.api
  to   = module.api.aws_cloudwatch_log_group.api
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

  name_prefix                 = local.name_prefix
  subnet_ids                  = module.networking.public_subnet_ids
  api_connector_sg_id         = module.networking.api_connector_security_group_id
  database_secret_arn         = module.database.database_url_secret_arn
  database_secret_kms_key_arn = module.database.database_secret_kms_key_arn
  db_host                     = module.database.db_endpoint
  db_port                     = module.database.db_port
  db_name                     = module.database.db_name
  data_bucket_arn             = module.storage.data_bucket_arn
  cpu                         = var.api_cpu
  memory                      = var.api_memory
  cors_origins                = local.computed_cors
  max_task_count              = var.environment == "production" ? 4 : 2
  tags                        = local.common_tags
}

module "cdn" {
  count  = var.enable_cdn ? 1 : 0
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

  name_prefix      = local.name_prefix
  api_service_name = module.api.service_name
  db_instance_id   = module.database.db_instance_id
  health_check_url = var.enable_cdn ? "${module.cdn[0].field_url}/v1/health" : "${module.api.service_url}/v1/health"
  tags             = local.common_tags
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name_prefix                 = local.name_prefix
  github_repository           = var.github_repository
  ecr_repository_arn          = module.api.ecr_repository_arn
  web_bucket_arn              = module.storage.web_bucket_arn
  field_bucket_arn            = module.storage.field_bucket_arn
  cloudfront_distribution_ids = var.enable_cdn ? module.cdn[0].distribution_ids : []
  tags                        = local.common_tags
}
