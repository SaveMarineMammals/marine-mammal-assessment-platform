variable "api_service_name" { type = string }
variable "name_prefix" { type = string }
variable "api_service_arn" { type = string }
variable "db_instance_id" { type = string }
variable "health_check_url" { type = string }
variable "tags" { type = map(string) }

resource "aws_cloudwatch_log_group" "api" {
  name              = "/${var.name_prefix}/api"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_metric_alarm" "apprunner_4xx" {
  alarm_name          = "${var.name_prefix}-apprunner-4xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "4xxStatusResponses"
  namespace           = "AWS/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  treat_missing_data  = "notBreaching"
  alarm_description   = "Elevated App Runner 4xx responses"
  tags                = var.tags

  dimensions = {
    ServiceName = var.api_service_name
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.name_prefix}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120
  treat_missing_data  = "notBreaching"
  alarm_description   = "RDS free storage below 5 GiB"
  tags                = var.tags

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-overview"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        properties = {
          markdown = "# ${var.name_prefix}\nHealth check: ${var.health_check_url}"
        }
      },
    ]
  })
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.main.dashboard_name
}

output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}
