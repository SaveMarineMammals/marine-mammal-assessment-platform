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

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID from bootstrap (required when domain_name is set)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "Shared ACM certificate ARN from bootstrap (required when domain_name is set)"
  type        = string
  default     = ""
}

variable "enable_apex_redirect" {
  description = "Add apex alias and 301 redirect to www (production canonical)"
  type        = bool
  default     = true
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

variable "enable_cdn" {
  description = "Provision CloudFront for web/field. Set false until the AWS account can create distributions (e.g. unverified account)."
  type        = bool
  default     = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
