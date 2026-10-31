output "bucket_name" {
  description = "OSS bucket that stores generated media."
  value       = alicloud_oss_bucket.media.bucket
}

output "oss_public_endpoint" {
  description = "Public OSS endpoint (avoid for cluster-internal traffic)."
  value       = "https://${var.bucket_name}.oss-${var.region}.aliyuncs.com"
}

output "oss_internal_endpoint" {
  description = "Internal endpoint; use from ECS/ACK in the same region."
  value       = "https://${var.bucket_name}.oss-${var.region}-internal.aliyuncs.com"
}

output "cdn_domain" {
  description = "CDN accelerated domain to configure as CDN_DOMAIN."
  value       = "https://${alicloud_cdn_domain_new.media.domain_name}"
}

output "cdn_cname" {
  description = "CNAME target to add at the DNS provider for the CDN domain."
  value       = alicloud_cdn_domain_new.media.cname
}

output "cdn_auth_type" {
  description = "Active CDN URL authentication mode."
  value       = "type_a"
}
