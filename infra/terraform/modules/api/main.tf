terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "name_prefix" { type = string }
variable "subnet_ids" {
  description = "Subnets for ECS Express (public subnets for an internet-facing ALB)"
  type        = list(string)
}
variable "api_connector_sg_id" { type = string }
variable "database_secret_arn" { type = string }
variable "database_secret_kms_key_arn" {
  type    = string
  default = ""
}
variable "db_host" {
  description = "RDS hostname injected as DB_HOST (non-secret)"
  type        = string
  default     = ""
}
variable "db_port" {
  description = "RDS port injected as DB_PORT"
  type        = number
  default     = 5432
}
variable "db_name" {
  description = "Database name injected as DB_NAME"
  type        = string
  default     = "mmap"
}
variable "data_bucket_arn" { type = string }
variable "cpu" { type = string }
variable "memory" { type = string }
variable "cors_origins" { type = list(string) }
variable "max_task_count" {
  type    = number
  default = 2
}
variable "tags" { type = map(string) }

variable "initial_image_uri" {
  description = "Container image used until the application deploy pipeline publishes to ECR"
  type        = string
  default     = "public.ecr.aws/nginx/nginx:latest"
}

variable "wait_for_steady_state" {
  description = "Block until ECS Express deployment is ACTIVE/STABLE (false avoids 30m CI timeout during bootstrap)"
  type        = bool
  default     = false
}

locals {
  using_placeholder_image = startswith(var.initial_image_uri, "public.ecr.aws/")
  container_port          = local.using_placeholder_image ? 80 : 3001
  health_check_path       = local.using_placeholder_image ? "/" : "/v1/health"
  app_port                = local.using_placeholder_image ? "80" : "3001"
}

resource "random_password" "admin_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "admin_token" {
  name = "${var.name_prefix}/api-admin-token"
  # Staging/ephemeral: force-delete on destroy so re-apply is not blocked by the
  # 7–30 day Secrets Manager recovery window (same name cannot be recreated while
  # scheduled for deletion). Production keeps a recovery window for accident recovery.
  recovery_window_in_days = startswith(var.name_prefix, "mmap-production") ? 30 : 0
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "admin_token" {
  secret_id     = aws_secretsmanager_secret.admin_token.id
  secret_string = random_password.admin_token.result
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/${var.name_prefix}/api"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.name_prefix}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = !startswith(var.name_prefix, "mmap-production")

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.name_prefix}-ecs-execution"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_execution" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [
      var.database_secret_arn,
      aws_secretsmanager_secret.admin_token.arn,
    ]
  }

  dynamic "statement" {
    for_each = var.database_secret_kms_key_arn != "" ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
      ]
      resources = [var.database_secret_kms_key_arn]
    }
  }
}

resource "aws_iam_role_policy" "ecs_execution" {
  name   = "${var.name_prefix}-ecs-execution"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution.json
}

resource "aws_iam_role" "ecs_infrastructure" {
  name = "${var.name_prefix}-ecs-infrastructure"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_infrastructure" {
  role       = aws_iam_role.ecs_infrastructure.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices"
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.name_prefix}-ecs-task"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

data "aws_iam_policy_document" "ecs_task" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [
      var.database_secret_arn,
      aws_secretsmanager_secret.admin_token.arn,
    ]
  }

  dynamic "statement" {
    for_each = var.database_secret_kms_key_arn != "" ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
      ]
      resources = [var.database_secret_kms_key_arn]
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.data_bucket_arn,
      "${var.data_bucket_arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name   = "${var.name_prefix}-ecs-task"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task.json
}

# Account-wide prerequisite for ECS Express Gateway services (AWS-managed; not created here).
data "aws_iam_role" "ecs_service_linked" {
  name = "AWSServiceRoleForECS"
}

# Subnet changes force a new Express service (AWS rejects in-place subnet type updates).
resource "terraform_data" "express_subnet_set" {
  input = join(",", sort(var.subnet_ids))
}

moved {
  from = aws_ecs_express_gateway_service.api
  to   = aws_ecs_express_gateway_service.express
}

resource "aws_ecs_express_gateway_service" "express" {
  service_name            = "${var.name_prefix}-api"
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  infrastructure_role_arn = aws_iam_role.ecs_infrastructure.arn
  task_role_arn           = aws_iam_role.ecs_task.arn
  cpu                     = var.cpu
  memory                  = var.memory
  health_check_path       = local.health_check_path
  wait_for_steady_state   = var.wait_for_steady_state
  tags                    = var.tags

  primary_container {
    image          = var.initial_image_uri
    container_port = local.container_port

    aws_logs_configuration {
      log_group           = aws_cloudwatch_log_group.api.name
      log_stream_prefix   = "ecs"
    }

    environment {
      name  = "PORT"
      value = local.app_port
    }

    environment {
      name  = "HOST"
      value = "0.0.0.0"
    }

    # Always attach API runtime config (even with the nginx placeholder image) so the
    # first CI image rollout already has secrets/DB_* available. Nginx ignores them.
    environment {
      name  = "NODE_ENV"
      value = "production"
    }

    environment {
      name  = "CORS_ORIGIN"
      value = join(",", var.cors_origins)
    }

    environment {
      name  = "MINIO_ENDPOINT"
      value = ""
    }

    environment {
      name  = "PUBLIC_PSEUDONYMIZE_NAMES"
      value = "false"
    }

    dynamic "environment" {
      for_each = var.db_host != "" ? [1] : []
      content {
        name  = "DB_HOST"
        value = var.db_host
      }
    }

    dynamic "environment" {
      for_each = var.db_host != "" ? [1] : []
      content {
        name  = "DB_PORT"
        value = tostring(var.db_port)
      }
    }

    dynamic "environment" {
      for_each = var.db_host != "" ? [1] : []
      content {
        name  = "DB_NAME"
        value = var.db_name
      }
    }

    secret {
      name       = "DATABASE_URL"
      value_from = var.database_secret_arn
    }

    secret {
      name       = "API_ADMIN_TOKEN"
      value_from = aws_secretsmanager_secret.admin_token.arn
    }
  }

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = [var.api_connector_sg_id]
  }

  scaling_target {
    auto_scaling_metric       = "AVERAGE_CPU"
    auto_scaling_target_value = 60
    min_task_count            = 1
    max_task_count            = var.max_task_count
  }

  depends_on = [
    aws_iam_role_policy.ecs_execution,
    aws_iam_role_policy.ecs_task,
    aws_iam_role_policy_attachment.ecs_execution,
    aws_iam_role_policy_attachment.ecs_infrastructure,
    data.aws_iam_role.ecs_service_linked,
  ]

  lifecycle {
    replace_triggered_by = [terraform_data.express_subnet_set]
    # CI owns image/port/health/env after the first app deploy (amazon-ecs-deploy-express-service).
    # Ignoring the whole primary_container + health path prevents Terraform from reverting
    # the API image back to the nginx bootstrap placeholder on subsequent applies.
    ignore_changes = [
      primary_container,
      health_check_path,
    ]
  }
}

locals {
  # Express ManagedIngressPath.endpoint is already a full URL (e.g. https://mm-….on.aws).
  ingress_endpoint = coalesce(
    try([for path in aws_ecs_express_gateway_service.express.ingress_paths : path.endpoint if path.access_type == "PUBLIC"][0], null),
    try([for path in aws_ecs_express_gateway_service.express.ingress_paths : path.endpoint if path.access_type == "PRIVATE"][0], null),
    try(aws_ecs_express_gateway_service.express.ingress_paths[0].endpoint, null),
  )
  ingress_host = trimsuffix(
    replace(replace(coalesce(local.ingress_endpoint, ""), "https://", ""), "http://", ""),
    "/",
  )
}

output "ecr_repository_arn" {
  value = aws_ecr_repository.api.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "service_arn" {
  value = aws_ecs_express_gateway_service.express.service_arn
}

output "service_url" {
  description = "HTTPS URL for the Express managed ALB (scheme normalized; endpoint already includes https://)"
  value       = local.ingress_host != "" ? "https://${local.ingress_host}" : null
}

output "service_name" {
  value = aws_ecs_express_gateway_service.express.service_name
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "ecs_infrastructure_role_arn" {
  value = aws_iam_role.ecs_infrastructure.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "admin_token_secret_arn" {
  value = aws_secretsmanager_secret.admin_token.arn
}

output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}
