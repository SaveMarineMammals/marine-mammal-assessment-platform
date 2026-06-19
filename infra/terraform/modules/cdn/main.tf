terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "name_prefix" { type = string }
variable "domain_name" {
  type    = string
  default = ""
}
variable "web_subdomain" { type = string }
variable "field_subdomain" { type = string }
variable "web_bucket_id" { type = string }
variable "field_bucket_id" { type = string }
variable "api_service_url" { type = string }
variable "tags" { type = map(string) }

locals {
  use_custom_domain = var.domain_name != ""
  web_fqdn          = local.use_custom_domain ? "${var.web_subdomain}.${var.domain_name}" : ""
  field_fqdn          = local.use_custom_domain ? "${var.field_subdomain}.${var.domain_name}" : ""
  api_host            = replace(replace(var.api_service_url, "https://", ""), "/", "")
}

resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "${var.name_prefix}-static-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  comment             = "${var.name_prefix} public web"
  default_root_object = "index.html"
  tags                = var.tags

  origin {
    domain_name              = "${var.web_bucket_id}.s3.amazonaws.com"
    origin_id                = "web-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  origin {
    domain_name = local.api_host
    origin_id   = "api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "web-static"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/v1/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api"
    viewer_protocol_policy = "https-only"
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies { forward = "all" }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/openapi*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api"
    viewer_protocol_policy = "https-only"
    compress               = true

    forwarded_values {
      query_string = true
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_cloudfront_distribution" "field" {
  enabled             = true
  comment             = "${var.name_prefix} field PWA"
  default_root_object = "index.html"
  tags                = var.tags

  origin {
    domain_name              = "${var.field_bucket_id}.s3.amazonaws.com"
    origin_id                = "field-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  origin {
    domain_name = local.api_host
    origin_id   = "api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "field-static"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/v1/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api"
    viewer_protocol_policy = "https-only"
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies { forward = "all" }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.web_bucket_id}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

data "aws_iam_policy_document" "field_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.field_bucket_id}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.field.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = var.web_bucket_id
  policy = data.aws_iam_policy_document.web_bucket.json
}

resource "aws_s3_bucket_policy" "field" {
  bucket = var.field_bucket_id
  policy = data.aws_iam_policy_document.field_bucket.json
}

output "web_fqdn" {
  value = local.use_custom_domain ? local.web_fqdn : aws_cloudfront_distribution.web.domain_name
}

output "field_fqdn" {
  value = local.use_custom_domain ? local.field_fqdn : aws_cloudfront_distribution.field.domain_name
}

output "web_url" {
  value = "https://${local.use_custom_domain ? local.web_fqdn : aws_cloudfront_distribution.web.domain_name}"
}

output "field_url" {
  value = "https://${local.use_custom_domain ? local.field_fqdn : aws_cloudfront_distribution.field.domain_name}"
}

output "distribution_ids" {
  value = [
    aws_cloudfront_distribution.web.id,
    aws_cloudfront_distribution.field.id,
  ]
}

output "web_distribution_domain" {
  value = aws_cloudfront_distribution.web.domain_name
}

output "field_distribution_domain" {
  value = aws_cloudfront_distribution.field.domain_name
}
