variable "aws_region"        { type = string }         # リージョン
variable "project"           { type = string }         # aws-quiz 等
variable "database_name"     { type = string }         # awsquiz
variable "master_username"   { type = string }
variable "tags"              { type = map(string) }
