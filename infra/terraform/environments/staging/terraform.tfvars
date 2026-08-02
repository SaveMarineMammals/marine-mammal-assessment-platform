environment = "staging"
aws_region  = "us-east-1"
domain_name = ""
# Empty domain_name → CloudFront default cert / *.cloudfront.net hostnames (no ACM/Route53).
enable_cdn               = true
github_repository        = "SaveMarineMammals/marine-mammal-assessment-platform"
db_instance_class        = "db.t4g.micro"
db_backup_retention_days = 7

tags = {
  CostCenter = "mmap-staging"
}
