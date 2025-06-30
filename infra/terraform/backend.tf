terraform {
backend "s3" {
  # bucket, key, region are set via environment variables or CLI arguments
  encrypt = true
}
}
