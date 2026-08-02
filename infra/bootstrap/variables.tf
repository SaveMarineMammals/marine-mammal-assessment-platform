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
  description = "Register public_domain via Route 53 Domains and issue a shared ACM cert (apex + wildcard). Billed and non-refundable."
  type        = bool
  default     = false
}

variable "public_domain" {
  description = "Root public domain managed by bootstrap (e.g. savemarinemammals.com)"
  type        = string
  default     = "savemarinemammals.com"
}

variable "domain_contact" {
  description = "Registrant/admin/tech contact for Route 53 Domains. Required when enable_public_domain is true. Do not commit real PII."
  type = object({
    address_line_1    = string
    address_line_2    = optional(string)
    city              = string
    contact_type      = string
    country_code      = string
    email             = string
    first_name        = string
    last_name         = string
    organization_name = optional(string)
    phone_number      = string
    state             = string
    zip_code          = string
  })
  default   = null
  sensitive = true
}
