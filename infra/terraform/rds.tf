locals {
  aurora_name = "${var.project}-aurora"
}

module "aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "~> 8.0"

  name            = local.aurora_name
  engine          = "aurora-mysql"
  engine_version = "8.0.mysql_aurora.3.08.1"
  engine_mode     = "provisioned"
  instance_class  = "db.serverless"

  instances = {
    writer = {}
  }

  vpc_id               = module.vpc.vpc_id
  subnets              = module.vpc.private_subnets
  create_db_subnet_group = true

  serverlessv2_scaling_configuration = {
    min_capacity = 0
    max_capacity = 4
    seconds_until_auto_pause = 900
    auto_pause               = true
  }

  master_username = var.master_username
  database_name   = var.database_name
  manage_master_user_password = true

  apply_immediately = true
  storage_encrypted = true

  backup_retention_period = 1
  skip_final_snapshot     = true

  enable_http_endpoint = true 
}
