variable "name_prefix" {
  type = string
}

variable "tags" {
  type = map(string)
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 4, count.index)
  availability_zone = local.azs[count.index]
  tags              = merge(var.tags, { Name = "${var.name_prefix}-private-${count.index + 1}" })
}

resource "aws_security_group" "api_connector" {
  name        = "${var.name_prefix}-api-connector"
  description = "App Runner VPC connector access to RDS"
  vpc_id      = aws_vpc.main.id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-api-connector" })

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds"
  description = "PostgreSQL access from App Runner connector"
  vpc_id      = aws_vpc.main.id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-rds" })

  ingress {
    description     = "PostgreSQL from App Runner connector"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api_connector.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "${var.name_prefix}-connector"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.api_connector.id]
  tags               = var.tags
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "api_connector_security_group_id" {
  value = aws_security_group.api_connector.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "app_runner_vpc_connector_arn" {
  value = aws_apprunner_vpc_connector.main.arn
}
