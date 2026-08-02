terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 6.23"
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
# Retained for tfvars compatibility; single-hostname CDN no longer uses a field subdomain.
variable "field_subdomain" {
  type    = string
  default = ""
}
variable "web_bucket_id" { type = string }
variable "field_bucket_id" { type = string }
variable "api_service_url" { type = string }
variable "tags" { type = map(string) }

locals {
  use_custom_domain = var.domain_name != ""
  site_fqdn         = local.use_custom_domain ? "${var.web_subdomain}.${var.domain_name}" : ""
  api_host          = replace(replace(var.api_service_url, "https://", ""), "/", "")
  site_host         = local.use_custom_domain ? local.site_fqdn : aws_cloudfront_distribution.site.domain_name
  site_url          = "https://${local.site_host}"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "${var.name_prefix}-static-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "spa_router" {
  name    = "${var.name_prefix}-spa-router"
  runtime = "cloudfront-js-2.0"
  comment = "SPA fallback for web (/) and field PWA (/field/app/)"
  publish = true
  code    = file("${path.module}/spa-router.js")
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  comment             = "${var.name_prefix} web + field PWA"
  default_root_object = "index.html"
  tags                = var.tags

  origin {
    domain_name              = "${var.web_bucket_id}.s3.amazonaws.com"
    origin_id                = "web-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

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
    target_origin_id       = "web-static"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/v1/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api"
    viewer_protocol_policy = "https-only"
    compress               = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  ordered_cache_behavior {
    path_pattern           = "/openapi*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api"
    viewer_protocol_policy = "https-only"
    compress               = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  ordered_cache_behavior {
    path_pattern           = "/field/app"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "field-static"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/field/app/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "field-static"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
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
      values   = [aws_cloudfront_distribution.site.arn]
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
      values   = [aws_cloudfront_distribution.site.arn]
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
  value = local.site_host
}

output "field_fqdn" {
  value = local.site_host
}

output "web_url" {
  value = local.site_url
}

output "field_url" {
  value = "${local.site_url}/field/app"
}

output "site_url" {
  value = local.site_url
}

output "distribution_ids" {
  value = [aws_cloudfront_distribution.site.id]
}

output "web_distribution_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "field_distribution_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}
