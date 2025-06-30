variable "aws_region"        { type = string }         # リージョン
variable "project"           { type = string }         # aws-quiz 等
variable "database_name"     { type = string }         # awsquiz
variable "master_username"   { type = string }
variable "tag_project"       { type = string }         # Project tag value
variable "tag_owner"         { type = string }         # Owner tag value

# Local value to construct tags map from individual variables
locals {
  tags = {
    Project = var.tag_project
    Owner   = var.tag_owner
  }
}
