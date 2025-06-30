terraform {
backend "s3" {
  bucket = "aws-quiz-tfstate"
  key    = "aurora/terraform.tfstate"
  region = "ap-northeast-1"
  encrypt = true
}
}
