environment = "production"
aws_region  = "us-east-1"
domain_name = ""
# Empty domain_name → CloudFront default cert / *.cloudfront.net hostnames.
# After bootstrap enable_public_domain apply, set:
#   domain_name          = "savemarinemammals.com"
#   web_subdomain        = "www"
#   hosted_zone_id       = "<bootstrap output hosted_zone_id>"
#   acm_certificate_arn  = "<bootstrap output acm_certificate_arn>"
#   enable_apex_redirect = true
# Canonical: https://www.savemarinemammals.com ; apex 301 → www
hosted_zone_id           = ""
acm_certificate_arn      = ""
enable_apex_redirect     = true
enable_cdn               = true
github_repository        = "SaveMarineMammals/marine-mammal-assessment-platform"
db_instance_class        = "db.t4g.small"
db_backup_retention_days = 30

tags = {
  CostCenter = "mmap-production"
}
