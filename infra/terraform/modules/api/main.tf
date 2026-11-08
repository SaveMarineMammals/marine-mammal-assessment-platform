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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

variable "name_prefix" { type = string }
variable "subnet_ids" {
  description = "Private subnets for Lambda→RDS (no public IPs / ALB)"
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
variable "db_instance_id" {
  description = "RDS instance id for optional start-on-demand from Lambda"
  type        = string
}
variable "data_bucket_arn" { type = string }
variable "data_bucket_id" { type = string }
variable "cors_origins" { type = list(string) }
variable "enable_db_auto_stop" {
  description = "After daily export, stop RDS to cut idle compute (resume on next sync/export)"
  type        = bool
  default     = false
}
variable "export_schedule_expression" {
  description = "EventBridge schedule for dataset snapshot export (UTC)"
  type        = string
  default     = "cron(0 8 * * ? *)"
}
variable "tags" { type = map(string) }

# Retained so existing environment modules can keep passing cpu/memory during migration.
variable "cpu" {
  type    = string
  default = "1024"
}
variable "memory" {
  type    = string
  default = "2048"
}
variable "max_task_count" {
  type    = number
  default = 2
}
variable "initial_image_uri" {
  type    = string
  default = ""
}
variable "wait_for_steady_state" {
  type    = bool
  default = false
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "aws_secretsmanager_secret_version" "database" {
  secret_id = var.database_secret_arn
}

resource "random_password" "admin_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "admin_token" {
  name                    = "${var.name_prefix}/api-admin-token"
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

data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder-lambda.zip"

  source {
    content  = <<-EOT
      export const handler = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "bootstrap", service: "mmap-api" }),
      });
    EOT
    filename = "lambda.mjs"
  }

  source {
    content  = "{\"type\":\"module\"}\n"
    filename = "package.json"
  }
}

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-api-lambda"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "lambda" {
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

resource "aws_iam_role_policy" "lambda" {
  name   = "${var.name_prefix}-api-lambda"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_lambda_function" "api" {
  function_name = "${var.name_prefix}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.placeholder.output_path
  # CI owns the real bundle after first deploy.
  source_code_hash = data.archive_file.placeholder.output_base64sha256
  timeout          = 900
  memory_size      = 1024
  architectures    = ["x86_64"]
  tags             = var.tags

  environment {
    variables = {
      NODE_ENV                  = "production"
      CORS_ORIGIN               = join(",", var.cors_origins)
      PUBLIC_PSEUDONYMIZE_NAMES = "false"
      DB_HOST                   = var.db_host
      DB_PORT                   = tostring(var.db_port)
      DB_NAME                   = var.db_name
      DATA_BUCKET               = var.data_bucket_id
      DATABASE_URL              = data.aws_secretsmanager_secret_version.database.secret_string
      API_ADMIN_TOKEN           = random_password.admin_token.result
      MIGRATIONS_DIR            = "/var/task/migrations"
    }
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.api_connector_sg_id]
  }

  depends_on = [
    aws_cloudwatch_log_group.api,
    aws_iam_role_policy.lambda,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_vpc,
  ]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = length(var.cors_origins) > 0 ? var.cors_origins : ["*"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_headers     = ["*"]
    max_age           = 86400
  }
}

resource "aws_lambda_permission" "function_url" {
  statement_id           = "AllowFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_cloudwatch_event_rule" "dataset_export" {
  name                = "${var.name_prefix}-dataset-export"
  description         = "Daily public dataset snapshot export to S3"
  schedule_expression = var.export_schedule_expression
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "dataset_export" {
  rule      = aws_cloudwatch_event_rule.dataset_export.name
  target_id = "api-lambda"
  arn       = aws_lambda_function.api.arn
  input = jsonencode({
    source = "aws.events"
    job    = "dataset-export"
  })
}

resource "aws_lambda_permission" "dataset_export" {
  statement_id  = "AllowEventBridgeDatasetExport"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.dataset_export.arn
}

# Out-of-VPC control Lambda (Python/boto3) can Start/Stop RDS without NAT.
data "archive_file" "db_control" {
  count = var.enable_db_auto_stop ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/db-control-lambda.zip"

  source {
    content  = <<-EOT
      import os
      import boto3

      def handler(event, _context):
          instance_id = os.environ["DB_INSTANCE_ID"]
          action = (event or {}).get("action", "stop")
          client = boto3.client("rds")
          if action == "start":
              client.start_db_instance(DBInstanceIdentifier=instance_id)
          else:
              client.stop_db_instance(DBInstanceIdentifier=instance_id)
          return {"ok": True, "action": action, "id": instance_id}
    EOT
    filename = "handler.py"
  }
}

resource "aws_iam_role" "db_control" {
  count = var.enable_db_auto_stop ? 1 : 0

  name = "${var.name_prefix}-db-control"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "db_control_basic" {
  count = var.enable_db_auto_stop ? 1 : 0

  role       = aws_iam_role.db_control[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "db_control" {
  count = var.enable_db_auto_stop ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "rds:StartDBInstance",
      "rds:StopDBInstance",
      "rds:DescribeDBInstances",
    ]
    resources = [
      "arn:aws:rds:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:db:${var.db_instance_id}",
    ]
  }
}

resource "aws_iam_role_policy" "db_control" {
  count = var.enable_db_auto_stop ? 1 : 0

  name   = "${var.name_prefix}-db-control"
  role   = aws_iam_role.db_control[0].id
  policy = data.aws_iam_policy_document.db_control[0].json
}

resource "aws_lambda_function" "db_control" {
  count = var.enable_db_auto_stop ? 1 : 0

  function_name    = "${var.name_prefix}-db-control"
  role             = aws_iam_role.db_control[0].arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.db_control[0].output_path
  source_code_hash = data.archive_file.db_control[0].output_base64sha256
  timeout          = 60
  tags             = var.tags

  environment {
    variables = {
      DB_INSTANCE_ID = var.db_instance_id
    }
  }
}

resource "aws_cloudwatch_event_rule" "db_auto_start" {
  count = var.enable_db_auto_stop ? 1 : 0

  name                = "${var.name_prefix}-db-auto-start"
  description         = "Start RDS before daily dataset export"
  schedule_expression = "cron(50 7 * * ? *)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "db_auto_start" {
  count = var.enable_db_auto_stop ? 1 : 0

  rule      = aws_cloudwatch_event_rule.db_auto_start[0].name
  target_id = "db-control-start"
  arn       = aws_lambda_function.db_control[0].arn
  input     = jsonencode({ action = "start" })
}

resource "aws_lambda_permission" "db_auto_start" {
  count = var.enable_db_auto_stop ? 1 : 0

  statement_id  = "AllowEventBridgeDbStart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.db_control[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.db_auto_start[0].arn
}

resource "aws_cloudwatch_event_rule" "db_auto_stop" {
  count = var.enable_db_auto_stop ? 1 : 0

  name                = "${var.name_prefix}-db-auto-stop"
  description         = "Stop RDS after daily export window to cut idle instance hours"
  schedule_expression = "cron(30 8 * * ? *)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "db_auto_stop" {
  count = var.enable_db_auto_stop ? 1 : 0

  rule      = aws_cloudwatch_event_rule.db_auto_stop[0].name
  target_id = "db-control-stop"
  arn       = aws_lambda_function.db_control[0].arn
  input     = jsonencode({ action = "stop" })
}

resource "aws_lambda_permission" "db_auto_stop" {
  count = var.enable_db_auto_stop ? 1 : 0

  statement_id  = "AllowEventBridgeDbStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.db_control[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.db_auto_stop[0].arn
}

output "service_url" {
  description = "HTTPS Lambda Function URL (sync/health/admin)"
  value       = trimsuffix(aws_lambda_function_url.api.function_url, "/")
}

output "service_name" {
  value = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  value = aws_lambda_function.api.arn
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "admin_token_secret_arn" {
  value = aws_secretsmanager_secret.admin_token.arn
}

output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

# Compatibility stubs for older deploy secrets / docs that still mention ECS/ECR.
output "ecr_repository_arn" {
  value = ""
}

output "ecr_repository_url" {
  value = ""
}

output "service_arn" {
  value = aws_lambda_function.api.arn
}

output "ecs_execution_role_arn" {
  value = ""
}

output "ecs_infrastructure_role_arn" {
  value = ""
}

output "ecs_task_role_arn" {
  value = aws_iam_role.lambda.arn
}
