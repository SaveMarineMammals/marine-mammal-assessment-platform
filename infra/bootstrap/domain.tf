# Public domain registration, hosted zone (auto-created by Route 53 Domains),
# and shared ACM certificate (apex + wildcard) for CloudFront custom domains.
#
# Enable with enable_public_domain = true and a filled domain_contact.
# Registration is billed (~$16/yr for .com) and non-refundable.

locals {
  # nonsensitive: enable flag must drive for_each without inheriting domain_contact sensitivity.
  manage_public_domain = nonsensitive(var.enable_public_domain && var.domain_contact != null)
  # Placeholder so expressions type-check when domain_contact is null (count = 0).
  domain_contact = var.domain_contact != null ? var.domain_contact : {
    address_line_1    = ""
    address_line_2    = null
    city              = ""
    contact_type      = "PERSON"
    country_code      = "US"
    email             = ""
    first_name        = ""
    last_name         = ""
    organization_name = null
    phone_number      = ""
    state             = ""
    zip_code          = ""
  }
}

check "public_domain_contact" {
  assert {
    condition     = !var.enable_public_domain || var.domain_contact != null
    error_message = "domain_contact is required when enable_public_domain is true."
  }
}

resource "aws_route53domains_domain" "public" {
  count    = local.manage_public_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name       = var.public_domain
  auto_renew        = true
  transfer_lock     = true
  duration_in_years = 1

  admin_privacy      = true
  registrant_privacy = true
  tech_privacy       = true

  admin_contact {
    address_line_1    = local.domain_contact.address_line_1
    address_line_2    = local.domain_contact.address_line_2
    city              = local.domain_contact.city
    contact_type      = local.domain_contact.contact_type
    country_code      = local.domain_contact.country_code
    email             = local.domain_contact.email
    first_name        = local.domain_contact.first_name
    last_name         = local.domain_contact.last_name
    organization_name = local.domain_contact.organization_name
    phone_number      = local.domain_contact.phone_number
    state             = local.domain_contact.state
    zip_code          = local.domain_contact.zip_code
  }

  registrant_contact {
    address_line_1    = local.domain_contact.address_line_1
    address_line_2    = local.domain_contact.address_line_2
    city              = local.domain_contact.city
    contact_type      = local.domain_contact.contact_type
    country_code      = local.domain_contact.country_code
    email             = local.domain_contact.email
    first_name        = local.domain_contact.first_name
    last_name         = local.domain_contact.last_name
    organization_name = local.domain_contact.organization_name
    phone_number      = local.domain_contact.phone_number
    state             = local.domain_contact.state
    zip_code          = local.domain_contact.zip_code
  }

  tech_contact {
    address_line_1    = local.domain_contact.address_line_1
    address_line_2    = local.domain_contact.address_line_2
    city              = local.domain_contact.city
    contact_type      = local.domain_contact.contact_type
    country_code      = local.domain_contact.country_code
    email             = local.domain_contact.email
    first_name        = local.domain_contact.first_name
    last_name         = local.domain_contact.last_name
    organization_name = local.domain_contact.organization_name
    phone_number      = local.domain_contact.phone_number
    state             = local.domain_contact.state
    zip_code          = local.domain_contact.zip_code
  }

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

  depends_on = [aws_route53domains_domain.public]
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
  zone_id         = aws_route53domains_domain.public[0].hosted_zone_id
}

resource "aws_acm_certificate_validation" "public" {
  count    = local.manage_public_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.public[0].arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

data "aws_route53_zone" "public" {
  count   = local.manage_public_domain ? 1 : 0
  zone_id = aws_route53domains_domain.public[0].hosted_zone_id
}
