variable "aws_region" {
  description = "AWS region for the Terraform state bucket and lock table"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short project prefix used in resource names"
  type        = string
  default     = "mmap"
}

variable "github_repository" {
  description = "GitHub repository slug (owner/name) allowed to assume the Terraform CI role"
  type        = string
}

variable "state_bucket_name" {
  description = "Optional fixed S3 bucket name; defaults to {project}-terraform-state-{account_id}"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to bootstrap resources"
  type        = map(string)
  default     = {}
}

variable "enable_public_domain" {
  description = "Create a Route 53 hosted zone for public_domain and issue a shared ACM cert (apex + wildcard). Domain must already be registered at an external registrar (e.g. Namecheap)."
  type        = bool
  default     = false
}

variable "public_domain" {
  description = "Root public domain managed by bootstrap (e.g. savemarinemammals.com)"
  type        = string
  default     = "savemarinemammals.com"
}
