variable "name_prefix" {
  type = string
}

variable "tags" {
  type = map(string)
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_region" "current" {}

locals {
  azs    = slice(data.aws_availability_zones.available.names, 0, 2)
  region = data.aws_region.current.region
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

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 4, count.index + length(local.azs))
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-public-${count.index + 1}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-public" })

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-private" })
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "api_connector" {
  name        = "${var.name_prefix}-api-connector"
  description = "ECS API tasks access to RDS"
  vpc_id      = aws_vpc.main.id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-api-connector" })

  lifecycle {
    # AWS has no API to update GroupDescription; changing it forces replacement and
    # breaks RDS-attached ENIs during destroy (AuthFailure on DetachNetworkInterface).
    ignore_changes = [description]
  }

  ingress {
    description = "HTTP from VPC (ALB health checks and traffic to API tasks)"
    from_port   = 80
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds"
  description = "PostgreSQL access from ECS API tasks"
  vpc_id      = aws_vpc.main.id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-rds" })

  lifecycle {
    ignore_changes = [description]
  }

  ingress {
    description     = "PostgreSQL from ECS API tasks"
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

# Gateway endpoint only (no hourly charge). Interface PrivateLink endpoints for
# ECR/Logs/Secrets Manager are intentionally omitted — ECS Express tasks run in
# public subnets and reach AWS APIs via the internet gateway (~$58/mo saved).
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${local.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id, aws_route_table.public.id]
  tags              = merge(var.tags, { Name = "${var.name_prefix}-s3" })
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "api_connector_security_group_id" {
  value = aws_security_group.api_connector.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}
