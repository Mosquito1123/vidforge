terraform {
  required_version = ">= 1.6.0"

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.230"
    }
  }

  # Remote state in OSS (recommended for team use). Uncomment and create the
  # state bucket once; credentials come from the environment, never from code.
  #
  # backend "oss" {
  #   bucket = "aivideo-terraform-state"
  #   prefix = "oss-cdn/prod"
  #   region = "cn-shanghai"
  #   encrypt = true
  # }
}
