variable "environment" {
  description = "Environment name: staging or production"
  type        = string
}

variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Root domain for custom CloudFront hostnames; leave empty to use *.cloudfront.net URLs"
  type        = string
  default     = ""
}

variable "web_subdomain" {
  description = "Public web hostname prefix when domain_name is set"
  type        = string
  default     = "staging"
}

variable "field_subdomain" {
  description = "Field PWA hostname prefix when domain_name is set"
  type        = string
  default     = "field-staging"
}

variable "github_repository" {
  description = "GitHub repo slug for OIDC deploy role"
  type        = string
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
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
  description = "Optional explicit CORS origins for the API"
  type        = list(string)
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
