environment = "staging"
aws_region  = "us-east-1"
domain_name = ""
# CloudFront blocked until AWS account verification completes — test API via api_service_url.
enable_cdn               = false
github_repository        = "SaveMarineMammals/marine-mammal-assessment-platform"
db_instance_class        = "db.t4g.micro"
db_backup_retention_days = 7

tags = {
  CostCenter = "mmap-staging"
}
