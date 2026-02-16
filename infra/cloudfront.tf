# ------------------------------------------------------------------------------
# Route 53 hosted zone (delegate from registrar: update NS records)
# ------------------------------------------------------------------------------
resource "aws_route53_zone" "surf" {
  name = var.domainSurf
}

# ------------------------------------------------------------------------------
# ACM certificate – single cert for orangewhip.surf + *.orangewhip.surf
# CloudFront requires us-east-1
# ------------------------------------------------------------------------------
resource "aws_acm_certificate" "main" {
  provider          = aws.us_east_1
  domain_name       = var.domainSurf
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domainSurf}"
  ]

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  cert_domains = [var.domainSurf, "*.${var.domainSurf}"]

  staging_aliases = [
    "${var.stagingSubdomain}.${var.domainSurf}"
  ]
  production_aliases = [
    var.domainSurf,
    "www.${var.domainSurf}"
  ]
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for domain in local.cert_domains : domain => {
      name   = [for dvo in aws_acm_certificate.main.domain_validation_options : dvo if dvo.domain_name == domain][0].resource_record_name
      record = [for dvo in aws_acm_certificate.main.domain_validation_options : dvo if dvo.domain_name == domain][0].resource_record_value
      type   = [for dvo in aws_acm_certificate.main.domain_validation_options : dvo if dvo.domain_name == domain][0].resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.surf.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# ------------------------------------------------------------------------------
# CloudFront distributions
# ------------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "staging" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Orange Whip staging"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  aliases = local.staging_aliases

  origin {
    domain_name = aws_s3_bucket_website_configuration.websiteStaging.website_endpoint
    origin_id   = "S3-${aws_s3_bucket.websiteStaging.id}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.websiteStaging.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_cloudfront_distribution" "production" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Orange Whip production"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  aliases = local.production_aliases

  origin {
    domain_name = aws_s3_bucket_website_configuration.websiteProduction.website_endpoint
    origin_id   = "S3-${aws_s3_bucket.websiteProduction.id}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.websiteProduction.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ------------------------------------------------------------------------------
# Route 53 records -> CloudFront
# ------------------------------------------------------------------------------
# Staging: stage.orangewhip.surf
resource "aws_route53_record" "staging" {
  zone_id = aws_route53_zone.surf.zone_id
  name    = "${var.stagingSubdomain}.${var.domainSurf}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.staging.domain_name
    zone_id                = aws_cloudfront_distribution.staging.hosted_zone_id
    evaluate_target_health = false
  }
}

# Production: orangewhip.surf
resource "aws_route53_record" "production_apex" {
  zone_id = aws_route53_zone.surf.zone_id
  name    = var.domainSurf
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.production.domain_name
    zone_id                = aws_cloudfront_distribution.production.hosted_zone_id
    evaluate_target_health = false
  }
}

# Production: www.orangewhip.surf
resource "aws_route53_record" "production_www" {
  zone_id = aws_route53_zone.surf.zone_id
  name    = "www.${var.domainSurf}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.production.domain_name
    zone_id                = aws_cloudfront_distribution.production.hosted_zone_id
    evaluate_target_health = false
  }
}

# ------------------------------------------------------------------------------
# MX records (mail forwarding via ClouDNS)
# ------------------------------------------------------------------------------
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.surf.zone_id
  name    = ""
  type    = "MX"
  records = [
    "10 mailforward1.cloudns.net.",
    "20 mailforward1.cloudns.net."
  ]
  ttl = 300
}
