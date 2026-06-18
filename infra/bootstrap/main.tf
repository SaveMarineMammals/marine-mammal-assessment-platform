locals {
  account_id        = data.aws_caller_identity.current.account_id
  state_bucket_name = var.state_bucket_name != "" ? var.state_bucket_name : "${var.project_name}-terraform-state-${local.account_id}"
  common_tags = merge(var.tags, {
    Project   = var.project_name
    Component = "terraform-bootstrap"
    ManagedBy = "terraform"
  })
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = local.state_bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_lock" {
  name         = "${var.project_name}-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = local.common_tags
}

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    "6938fd4d98bab03fa09104f2c",
  ]
}

data "aws_iam_policy_document" "terraform_ci_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repository}:*",
      ]
    }
  }
}

resource "aws_iam_role" "terraform_ci" {
  name               = "${var.project_name}-terraform-ci"
  assume_role_policy = data.aws_iam_policy_document.terraform_ci_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "terraform_ci" {
  statement {
    sid    = "TerraformState"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.terraform_state.arn,
      "${aws_s3_bucket.terraform_state.arn}/*",
    ]
  }

  statement {
    sid    = "TerraformLock"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = [aws_dynamodb_table.terraform_lock.arn]
  }

  statement {
    sid    = "ManageProjectInfrastructure"
    effect = "Allow"
    actions = [
      "acm:*",
      "apprunner:*",
      "cloudfront:*",
      "cloudwatch:*",
      "ec2:*",
      "ecr:*",
      "iam:*",
      "logs:*",
      "rds:*",
      "route53:*",
      "s3:*",
      "secretsmanager:*",
      "sns:*",
    ]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region, "us-east-1"]
    }
  }
}

resource "aws_iam_role_policy" "terraform_ci" {
  name   = "${var.project_name}-terraform-ci"
  role   = aws_iam_role.terraform_ci.id
  policy = data.aws_iam_policy_document.terraform_ci.json
}
