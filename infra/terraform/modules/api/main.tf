terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "name_prefix" { type = string }
variable "vpc_connector_arn" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "api_connector_sg_id" { type = string }
variable "database_secret_arn" { type = string }
variable "database_secret_kms_key_arn" {
  type    = string
  default = ""
}
variable "data_bucket_arn" { type = string }
variable "cpu" { type = string }
variable "memory" { type = string }
variable "cors_origins" { type = list(string) }
variable "auto_deployments" { type = bool }
variable "tags" { type = map(string) }

variable "initial_image_uri" {
  description = "Container image used until the application deploy pipeline publishes to ECR"
  type        = string
  default     = "public.ecr.aws/aws-containers/hello-app-runner:latest"
}

variable "initial_image_repository_type" {
  type    = string
  default = "ECR_PUBLIC"
}

locals {
  using_placeholder_image = var.initial_image_repository_type == "ECR_PUBLIC"
  container_port          = local.using_placeholder_image ? "8080" : "3001"
  health_check_path       = local.using_placeholder_image ? "/" : "/v1/health"
}

resource "random_password" "admin_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "admin_token" {
  name = "${var.name_prefix}/api-admin-token"
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "admin_token" {
  secret_id     = aws_secretsmanager_secret.admin_token.id
  secret_string = random_password.admin_token.result
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

resource "aws_iam_role" "apprunner_access" {
  name = "${var.name_prefix}-apprunner-access"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "build.apprunner.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "apprunner_access" {
  name = "${var.name_prefix}-apprunner-access"
  role = aws_iam_role.apprunner_access.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "apprunner_instance" {
  name = "${var.name_prefix}-apprunner-instance"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

data "aws_iam_policy_document" "apprunner_instance" {
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

resource "aws_iam_role_policy" "apprunner_instance" {
  name   = "${var.name_prefix}-apprunner-instance"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.apprunner_instance.json
}

resource "aws_apprunner_service" "api" {
  service_name = "${var.name_prefix}-api"
  tags         = var.tags

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    image_repository {
      image_identifier      = var.initial_image_uri
      image_repository_type = var.initial_image_repository_type

      image_configuration {
        port = local.container_port

        runtime_environment_secrets = {
          DATABASE_URL     = var.database_secret_arn
          API_ADMIN_TOKEN  = aws_secretsmanager_secret.admin_token.arn
        }

        runtime_environment_variables = {
          PORT                   = "3001"
          HOST                   = "0.0.0.0"
          NODE_ENV               = "production"
          CORS_ORIGIN            = join(",", var.cors_origins)
          MINIO_ENDPOINT         = ""
          PUBLIC_PSEUDONYMIZE_NAMES = "false"
        }
      }
    }

    auto_deployments_enabled = var.auto_deployments
  }

  instance_configuration {
    cpu               = var.cpu
    memory            = var.memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = local.health_check_path
    healthy_threshold   = 1
    unhealthy_threshold = 5
    interval            = 10
    timeout             = 5
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = var.vpc_connector_arn
    }
  }

  lifecycle {
    ignore_changes = [
      source_configuration[0].image_repository[0].image_identifier,
    ]
  }
}

output "ecr_repository_arn" {
  value = aws_ecr_repository.api.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "service_arn" {
  value = aws_apprunner_service.api.arn
}

output "service_url" {
  value = "https://${aws_apprunner_service.api.service_url}"
}

output "service_name" {
  value = aws_apprunner_service.api.service_name
}

output "admin_token_secret_arn" {
  value = aws_secretsmanager_secret.admin_token.arn
}
