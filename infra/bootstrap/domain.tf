# Public hosted zone + shared ACM certificate (apex + wildcard) for CloudFront.
# Domain registration stays at the external registrar (e.g. Namecheap); point NS
# records at the Route 53 name servers from terraform output name_servers.
#
# Enable with enable_public_domain = true.

locals {
  manage_public_domain = var.enable_public_domain
}

resource "aws_route53_zone" "public" {
  count = local.manage_public_domain ? 1 : 0

  name    = var.public_domain
  comment = "MMAP public DNS (${var.public_domain})"

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_acm_certificate" "public" {
  count    = local.manage_public_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name               = var.public_domain
  subject_alternative_names = ["*.${var.public_domain}"]
  validation_method         = "DNS"

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_route53_zone.public]
}

resource "aws_route53_record" "acm_validation" {
  for_each = local.manage_public_domain ? {
    for dvo in aws_acm_certificate.public[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.public[0].zone_id
}

resource "aws_acm_certificate_validation" "public" {
  count    = local.manage_public_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.public[0].arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]

  timeouts {
    create = "60m"
  }

  depends_on = [aws_route53_record.acm_validation]
}
