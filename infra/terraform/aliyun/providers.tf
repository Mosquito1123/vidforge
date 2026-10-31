provider "alicloud" {
  region = var.region

  # Credentials are read from the environment (recommended):
  #   export ALICLOUD_ACCESS_KEY="..."
  #   export ALICLOUD_SECRET_KEY="..."
  #   export ALICLOUD_REGION="cn-shanghai"
  #
  # Never commit AccessKeys to this repository. In CI use a RAM role or
  # short-lived STS credentials.
}
