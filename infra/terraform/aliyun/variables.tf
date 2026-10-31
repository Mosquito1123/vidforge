variable "region" {
  description = "Aliyun region for the OSS bucket (keep it close to the cluster)."
  type        = string
  default     = "cn-shanghai"
}

variable "project" {
  description = "Project name used in tags and resource names."
  type        = string
  default     = "aivideo"
}

variable "environment" {
  description = "Deployment environment (dev / staging / prod)."
  type        = string
  default     = "prod"
}

variable "bucket_name" {
  description = "Globally unique OSS bucket name, lowercase."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "bucket_name must be 3-63 chars of lowercase letters, digits and hyphens."
  }
}

variable "cdn_domain" {
  description = "ICP-filed accelerated domain, e.g. cdn.example.com."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.cdn_domain))
    error_message = "cdn_domain must be a bare hostname without scheme or path."
  }
}

variable "cdn_auth_key_a" {
  description = "CDN URL auth type-A primary key. Provide via TF_VAR_cdn_auth_key_a."
  type        = string
  sensitive   = true
}

variable "cdn_auth_key_b" {
  description = "CDN URL auth type-A secondary key, used for rotation."
  type        = string
  sensitive   = true
}

variable "cors_allowed_origins" {
  description = "Origins allowed to upload directly to OSS from the browser."
  type        = list(string)
  default     = ["https://app.example.com"]
}

variable "ssl_certificate_pem" {
  description = "Optional PEM certificate for the CDN domain. Leave empty to configure HTTPS in the console."
  type        = string
  default     = ""
  sensitive   = true
}

variable "ssl_certificate_key" {
  description = "Private key matching ssl_certificate_pem."
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Additional tags applied to taggable resources."
  type        = map(string)
  default     = {}
}
