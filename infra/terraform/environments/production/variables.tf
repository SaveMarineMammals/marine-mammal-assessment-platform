variable "environment" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "web_subdomain" {
  type    = string
  default = "www"
}

variable "field_subdomain" {
  type    = string
  default = "field"
}

variable "github_repository" {
  type = string
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "db_backup_retention_days" {
  type    = number
  default = 30
}

variable "api_cpu" {
  type    = string
  default = "1024"
}

variable "api_memory" {
  type    = string
  default = "2048"
}

variable "cors_origins" {
  type    = list(string)
  default = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
