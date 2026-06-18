terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "api_connector_sg_id" { type = string }
variable "rds_security_group_id" {
  type    = string
  default = ""
}
variable "instance_class" { type = string }
variable "backup_retention_days" { type = number }
variable "deletion_protection" { type = bool }
variable "tags" { type = map(string) }

locals {
  rds_sg_id = var.rds_security_group_id != "" ? var.rds_security_group_id : var.api_connector_sg_id
}

resource "aws_kms_key" "database_secret" {
  description             = "${var.name_prefix} RDS master user secret encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-rds-secret" })
}

resource "aws_kms_alias" "database_secret" {
  name          = "alias/${var.name_prefix}-rds-secret"
  target_key_id = aws_kms_key.database_secret.key_id
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = "${var.name_prefix}-db" })
}

resource "aws_db_parameter_group" "main" {
  name   = "${var.name_prefix}-pg16"
  family = "postgres16"
  tags   = var.tags
}

resource "aws_db_instance" "main" {
  identifier     = "${var.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  db_name           = "mmap"
  username          = "mmap"

  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.database_secret.arn

  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name
  vpc_security_group_ids = [local.rds_sg_id]

  publicly_accessible       = false
  multi_az                  = false
  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = var.deletion_protection ? "${var.name_prefix}-final" : null

  storage_encrypted = true
  tags              = merge(var.tags, { Name = "${var.name_prefix}-postgres" })
}

output "db_instance_id" {
  value = aws_db_instance.main.id
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN for the RDS-managed master user secret (JSON payload)"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "database_secret_kms_key_arn" {
  description = "KMS key encrypting the RDS master user secret"
  value       = aws_kms_key.database_secret.arn
}
