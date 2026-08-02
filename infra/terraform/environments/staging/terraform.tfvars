environment = "staging"
aws_region  = "us-east-1"
domain_name = ""
# Empty domain_name → CloudFront default cert / *.cloudfront.net hostnames.
# After bootstrap enable_public_domain apply, set:
#   domain_name         = "savemarinemammals.com"
#   web_subdomain       = "staging"
#   hosted_zone_id      = "<bootstrap output hosted_zone_id>"
#   acm_certificate_arn = "<bootstrap output acm_certificate_arn>"
#   enable_apex_redirect = false
hosted_zone_id           = ""
acm_certificate_arn      = ""
enable_apex_redirect     = false
enable_cdn               = true
github_repository        = "SaveMarineMammals/marine-mammal-assessment-platform"
db_instance_class        = "db.t4g.micro"
db_backup_retention_days = 7

tags = {
  CostCenter = "mmap-staging"
}
