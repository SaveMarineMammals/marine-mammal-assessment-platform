environment              = "staging"
aws_region               = "us-east-1"
domain_name              = "savemarinemammals.com"
web_subdomain            = "staging"
hosted_zone_id           = "Z042713427I4Y6PFKIB2N"
acm_certificate_arn      = "arn:aws:acm:us-east-1:963120167952:certificate/92f8d754-08d5-47f2-8d54-5c2dd42a18de"
enable_apex_redirect     = false
enable_cdn               = true
github_repository        = "SaveMarineMammals/marine-mammal-assessment-platform"
db_instance_class        = "db.t4g.micro"
db_backup_retention_days = 7

tags = {
  CostCenter = "mmap-staging"
}
