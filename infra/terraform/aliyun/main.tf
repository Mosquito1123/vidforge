locals {
  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

resource "alicloud_oss_bucket" "media" {
  bucket = var.bucket_name
  acl    = "private"

  # Encrypt at rest with OSS-managed AES-256 keys.
  server_side_encryption_rule {
    sse_algorithm = "AES256"
  }

  versioning {
    status = "Enabled"
  }

  tags = local.common_tags
}

resource "alicloud_oss_bucket_cors" "media" {
  bucket = alicloud_oss_bucket.media.bucket

  cors_rule {
    allowed_origins = var.cors_allowed_origins
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag", "x-oss-request-id"]
    max_age_seconds = 600
  }
}

# ---------------------------------------------------------------------------
# HTTPS certificate (optional; skip when managed in the Aliyun console)
# ---------------------------------------------------------------------------

resource "alicloud_ssl_certificates_service_certificate" "cdn" {
  count = var.ssl_certificate_pem != "" && var.ssl_certificate_key != "" ? 1 : 0

  cert_name = "${var.project}-${var.environment}-cdn"
  cert      = var.ssl_certificate_pem
  key       = var.ssl_certificate_key
}

# ---------------------------------------------------------------------------
# CDN accelerated domain in front of the private bucket
# ---------------------------------------------------------------------------

resource "alicloud_cdn_domain_new" "media" {
  domain_name = var.cdn_domain
  cdn_type    = "video"
  scope       = "domestic"

  sources {
    # OSS origin; CDN uses private-bucket back-to-origin via its service role.
    content  = "${var.bucket_name}.oss-${var.region}.aliyuncs.com"
    type     = "oss"
    port     = 443
    priority = 20
  }

  # URL authentication type A. Both keys are active during rotation.
  config {
    auth_type = "type_a"
    auth_key1 = var.cdn_auth_key_a
    auth_key2 = var.cdn_auth_key_b
    auth_m3u8 = "on"
  }

  dynamic "certificate_config" {
    for_each = length(alicloud_ssl_certificates_service_certificate.cdn) > 0 ? [1] : []

    content {
      cert_type          = "upload"
      cert_name          = alicloud_ssl_certificates_service_certificate.cdn[0].cert_name
      server_certificate = alicloud_ssl_certificates_service_certificate.cdn[0].id
    }
  }
}
