output "terraform_state_bucket" {
  description = "S3 bucket for Terraform remote state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_lock_table" {
  description = "DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_lock.name
}

output "terraform_ci_role_arn" {
  description = "IAM role ARN for GitHub Actions Terraform plan/apply (OIDC)"
  value       = aws_iam_role.terraform_ci.arn
}

output "ecs_service_linked_role_arn" {
  description = "Account-wide AWSServiceRoleForECS required by ECS Express Gateway services"
  value       = aws_iam_service_linked_role.ecs.arn
}

output "github_actions_secrets" {
  description = "Add these as GitHub repository secrets or variables"
  value = {
    AWS_TERRAFORM_ROLE_ARN = aws_iam_role.terraform_ci.arn
    TF_STATE_BUCKET        = aws_s3_bucket.terraform_state.bucket
    TF_LOCK_TABLE          = aws_dynamodb_table.terraform_lock.name
    AWS_REGION             = var.aws_region
  }
}

output "public_domain" {
  description = "Root public domain when enable_public_domain is true; otherwise empty"
  value       = local.manage_public_domain ? var.public_domain : ""
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID for the public domain (copy into staging/production tfvars)"
  value       = local.manage_public_domain ? aws_route53domains_domain.public[0].hosted_zone_id : ""
}

output "name_servers" {
  description = "Authoritative name servers for the public domain hosted zone"
  value       = local.manage_public_domain ? data.aws_route53_zone.public[0].name_servers : []
}

output "acm_certificate_arn" {
  description = "Shared ACM certificate ARN (apex + wildcard) in us-east-1 for CloudFront"
  value       = local.manage_public_domain ? aws_acm_certificate_validation.public[0].certificate_arn : ""
}
