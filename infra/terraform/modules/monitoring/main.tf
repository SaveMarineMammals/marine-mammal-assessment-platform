variable "api_service_name" { type = string }
variable "name_prefix" { type = string }
variable "db_instance_id" { type = string }
variable "health_check_url" { type = string }
variable "tags" { type = map(string) }

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  alarm_name          = "${var.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_description   = "Elevated ECS API CPU utilization"
  tags                = var.tags

  dimensions = {
    ClusterName = "default"
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
