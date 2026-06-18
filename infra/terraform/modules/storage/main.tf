variable "name_prefix" { type = string }
variable "tags" { type = map(string) }

resource "aws_s3_bucket" "web_static" {
  bucket = "${var.name_prefix}-web-static"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-web-static" })
}

resource "aws_s3_bucket" "field_static" {
  bucket = "${var.name_prefix}-field-static"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-field-static" })
}

resource "aws_s3_bucket" "data" {
  bucket = "${var.name_prefix}-data"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-data" })
}

resource "aws_s3_bucket_public_access_block" "web_static" {
  bucket = aws_s3_bucket.web_static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "field_static" {
  bucket = aws_s3_bucket.field_static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web_static" {
  bucket = aws_s3_bucket.web_static.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "field_static" {
  bucket = aws_s3_bucket.field_static.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "web_bucket_id" {
  value = aws_s3_bucket.web_static.id
}

output "web_bucket_arn" {
  value = aws_s3_bucket.web_static.arn
}

output "field_bucket_id" {
  value = aws_s3_bucket.field_static.id
}

output "field_bucket_arn" {
  value = aws_s3_bucket.field_static.arn
}

output "data_bucket_arn" {
  value = aws_s3_bucket.data.arn
}

output "data_bucket_id" {
  value = aws_s3_bucket.data.id
}
