# Use default credential chain (env vars in CI, AWS_PROFILE locally).
provider "aws" {
  region = var.awsRegion
}

# ACM for CloudFront must be in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

# ------------------------------------------------------------------------------
# GitHub OIDC provider (for Actions to assume IAM roles without long-lived keys)
# ------------------------------------------------------------------------------
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

# ------------------------------------------------------------------------------
# IAM role: GitHub Actions – Staging (development branch)
# ------------------------------------------------------------------------------
data "aws_iam_policy_document" "githubStagingAssume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.githubOrgRepo}:ref:refs/heads/develop"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "githubStaging" {
  name               = "github-actions-orangewhip-staging"
  assume_role_policy = data.aws_iam_policy_document.githubStagingAssume.json
}

# ------------------------------------------------------------------------------
# IAM role: GitHub Actions – Production (main branch)
# ------------------------------------------------------------------------------
data "aws_iam_policy_document" "githubProductionAssume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.githubOrgRepo}:ref:refs/heads/main"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "githubProduction" {
  name               = "github-actions-orangewhip-production"
  assume_role_policy = data.aws_iam_policy_document.githubProductionAssume.json
}

# ------------------------------------------------------------------------------
# Policy: Terraform state (S3 + DynamoDB lock) – shared by both roles
# ------------------------------------------------------------------------------
data "aws_iam_policy_document" "terraformState" {
  statement {
    sid    = "TerraformStateS3"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = [
      "arn:aws:s3:::${var.terraformStateBucket}",
      "arn:aws:s3:::${var.terraformStateBucket}/*"
    ]
  }
  statement {
    sid    = "TerraformStateLock"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem"
    ]
    resources = [
      "arn:aws:dynamodb:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:table/${var.terraformStateLockTable}"
    ]
  }
}

resource "aws_iam_policy" "terraformState" {
  name   = "ows-terraform-state"
  policy = data.aws_iam_policy_document.terraformState.json
}

resource "aws_iam_role_policy_attachment" "githubStagingTfState" {
  role       = aws_iam_role.githubStaging.name
  policy_arn = aws_iam_policy.terraformState.arn
}

resource "aws_iam_role_policy_attachment" "githubProductionTfState" {
  role       = aws_iam_role.githubProduction.name
  policy_arn = aws_iam_policy.terraformState.arn
}

# ------------------------------------------------------------------------------
# Policy: Full deploy (S3, DynamoDB, Cognito, Lambda, API GW, CloudFront, etc.)
# Shared by staging & production roles.
# ------------------------------------------------------------------------------
data "aws_iam_policy_document" "deploy" {
  # S3 – website buckets & media bucket
  statement {
    sid    = "S3Buckets"
    effect = "Allow"
    actions = [
      "s3:*"
    ]
    resources = [
      "arn:aws:s3:::${var.websiteStagingBucket}",
      "arn:aws:s3:::${var.websiteStagingBucket}/*",
      "arn:aws:s3:::${var.websiteProductionBucket}",
      "arn:aws:s3:::${var.websiteProductionBucket}/*",
      "arn:aws:s3:::${var.mediaBucketName}",
      "arn:aws:s3:::${var.mediaBucketName}/*"
    ]
  }

  # DynamoDB
  statement {
    sid    = "DynamoDB"
    effect = "Allow"
    actions = ["dynamodb:*"]
    resources = [
      "arn:aws:dynamodb:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:table/${var.dynamoTableName}",
      "arn:aws:dynamodb:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:table/${var.dynamoTableName}/index/*"
    ]
  }

  # Cognito (user-pool-scoped actions)
  statement {
    sid    = "Cognito"
    effect = "Allow"
    actions = ["cognito-idp:*"]
    resources = [
      "arn:aws:cognito-idp:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:userpool/*"
    ]
  }

  # Cognito (domain-level actions that require resource "*")
  statement {
    sid    = "CognitoDomain"
    effect = "Allow"
    actions = [
      "cognito-idp:DescribeUserPoolDomain",
      "cognito-idp:CreateUserPoolDomain",
      "cognito-idp:DeleteUserPoolDomain",
    ]
    resources = ["*"]
  }

  # Lambda
  statement {
    sid    = "Lambda"
    effect = "Allow"
    actions = ["lambda:*"]
    resources = [
      "arn:aws:lambda:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:function:ows-*",
      "arn:aws:lambda:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:layer:ows-*",
      "arn:aws:lambda:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:layer:ows-*:*"
    ]
  }

  # API Gateway
  statement {
    sid    = "APIGateway"
    effect = "Allow"
    actions = ["apigateway:*"]
    resources = ["arn:aws:apigateway:${var.awsRegion}::/*"]
  }

  # IAM (create/manage Lambda roles, pass roles)
  statement {
    sid    = "IAM"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:PassRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:CreateOpenIDConnectProvider",
      "iam:GetOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint",
      "iam:TagOpenIDConnectProvider",
      "iam:UntagOpenIDConnectProvider"
    ]
    resources = ["*"]
  }

  # CloudWatch Logs
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = ["logs:*"]
    resources = [
      "arn:aws:logs:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:*"
    ]
  }

  # CloudFront
  statement {
    sid    = "CloudFront"
    effect = "Allow"
    actions = ["cloudfront:*"]
    resources = ["*"]
  }

  # ACM
  statement {
    sid    = "ACM"
    effect = "Allow"
    actions = ["acm:*"]
    resources = ["*"]
  }

  # Route 53
  statement {
    sid    = "Route53"
    effect = "Allow"
    actions = ["route53:*"]
    resources = ["*"]
  }

  # EventBridge (for MediaConvert completion events)
  statement {
    sid    = "EventBridge"
    effect = "Allow"
    actions = ["events:*"]
    resources = ["*"]
  }

  # MediaConvert
  statement {
    sid    = "MediaConvert"
    effect = "Allow"
    actions = ["mediaconvert:*"]
    resources = ["*"]
  }

  # STS (needed by Terraform)
  statement {
    sid       = "STS"
    effect    = "Allow"
    actions   = ["sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "deploy" {
  name   = "ows-deploy"
  policy = data.aws_iam_policy_document.deploy.json
}

resource "aws_iam_role_policy_attachment" "githubStagingDeploy" {
  role       = aws_iam_role.githubStaging.name
  policy_arn = aws_iam_policy.deploy.arn
}

resource "aws_iam_role_policy_attachment" "githubProductionDeploy" {
  role       = aws_iam_role.githubProduction.name
  policy_arn = aws_iam_policy.deploy.arn
}

# ------------------------------------------------------------------------------
# S3 buckets: website hosting (staging & production)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "websiteStaging" {
  bucket = var.websiteStagingBucket
}

resource "aws_s3_bucket_public_access_block" "websiteStaging" {
  bucket = aws_s3_bucket.websiteStaging.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "websiteStagingPublicRead" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.websiteStaging.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "websiteStaging" {
  bucket = aws_s3_bucket.websiteStaging.id
  policy = data.aws_iam_policy_document.websiteStagingPublicRead.json
}

resource "aws_s3_bucket_website_configuration" "websiteStaging" {
  bucket = aws_s3_bucket.websiteStaging.id

  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket" "websiteProduction" {
  bucket = var.websiteProductionBucket
}

resource "aws_s3_bucket_public_access_block" "websiteProduction" {
  bucket = aws_s3_bucket.websiteProduction.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "websiteProductionPublicRead" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.websiteProduction.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "websiteProduction" {
  bucket = aws_s3_bucket.websiteProduction.id
  policy = data.aws_iam_policy_document.websiteProductionPublicRead.json
}

resource "aws_s3_bucket_website_configuration" "websiteProduction" {
  bucket = aws_s3_bucket.websiteProduction.id

  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

# ------------------------------------------------------------------------------
# S3 media bucket (user uploads: audio, video, images; presigned PUT/GET)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "media" {
  bucket = var.mediaBucketName
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
  }
}

# ------------------------------------------------------------------------------
# DynamoDB single table (shows, media, updates, press, venues, users, categories)
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "main" {
  name         = var.dynamoTableName
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "entityType"
    type = "S"
  }
  attribute {
    name = "entitySk"
    type = "S"
  }
  attribute {
    name = "categoryId"
    type = "S"
  }
  attribute {
    name = "groupName"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "dateField"
    type = "S"
  }

  # List all entities of a type: query byEntity where entityType = SHOW/MEDIA/UPDATE/PRESS
  global_secondary_index {
    name            = "byEntity"
    hash_key        = "entityType"
    range_key       = "entitySk"
    projection_type = "ALL"
  }

  # Filter by category: query byCategory where categoryId = <id>
  global_secondary_index {
    name            = "byCategory"
    hash_key        = "categoryId"
    range_key       = "entitySk"
    projection_type = "ALL"
  }

  # Query group members: query byGroup where groupName = <name>
  global_secondary_index {
    name            = "byGroup"
    hash_key        = "groupName"
    range_key       = "userId"
    projection_type = "ALL"
  }

  # Sort shows/updates by date: query byDate where dateField = <date>
  global_secondary_index {
    name            = "byDate"
    hash_key        = "dateField"
    range_key       = "entitySk"
    projection_type = "ALL"
  }
}

# ------------------------------------------------------------------------------
# Cognito User Pool (auth for admin / manager / editor / band roles)
# ------------------------------------------------------------------------------
resource "aws_cognito_user_pool" "main" {
  name = var.cognitoUserPoolName

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }
  schema {
    name                = "preferred_username"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_LINK"
    email_subject        = "Orange Whip - Verify your email"
    email_message        = "Please click the link to verify your email: {##Verify Email##}. Code: {####}"
  }

  mfa_configuration = "OFF"

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  lifecycle {
    ignore_changes = [schema]
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = var.cognitoAppClientName
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  read_attributes  = ["email", "email_verified", "preferred_username"]
  write_attributes = ["email", "preferred_username"]
}

resource "aws_cognito_user_pool_domain" "main" {
  count        = length(var.cognitoDomainPrefix) > 0 ? 1 : 0
  domain       = var.cognitoDomainPrefix
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Full access to every area of the site"
  precedence   = 1
}

resource "aws_cognito_user_group" "manager" {
  name         = "manager"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Manage most content and settings"
  precedence   = 2
}

resource "aws_cognito_user_group" "editor" {
  name         = "editor"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Create and edit shows, updates, press"
  precedence   = 3
}

resource "aws_cognito_user_group" "band" {
  name         = "band"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Add and edit media, create updates"
  precedence   = 4
}

# ------------------------------------------------------------------------------
# Lambda API handler
# ------------------------------------------------------------------------------
data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/../src/lambda"
  output_path = "${path.module}/build/api.zip"
  excludes    = ["**/__pycache__/**", "**/*.pyc"]
}

# Pillow layer for image processing / dimension validation
resource "null_resource" "pillow_layer" {
  triggers = {
    requirements = file("${path.module}/layer_requirements.txt")
  }
  provisioner "local-exec" {
    command     = "mkdir -p build/layer/python/lib/python3.12/site-packages && python3 -m pip install -r ${path.module}/layer_requirements.txt -t build/layer/python/lib/python3.12/site-packages --quiet && cd build/layer && zip -r ../pillow_layer.zip python"
    working_dir = path.module
  }
}

resource "aws_lambda_layer_version" "pillow" {
  filename            = "${path.module}/build/pillow_layer.zip"
  layer_name          = "ows-pillow-layer"
  compatible_runtimes = ["python3.12"]
  depends_on          = [null_resource.pillow_layer]
}

resource "aws_iam_role" "lambdaApi" {
  name = "ows-api-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambdaApi" {
  name   = "ows-api-lambda"
  role   = aws_iam_role.lambdaApi.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:BatchGetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [aws_dynamodb_table.main.arn, "${aws_dynamodb_table.main.arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.media.arn
      },
      {
        Effect   = "Allow"
        Action   = [
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListGroups"
        ]
        Resource = [aws_cognito_user_pool.main.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:${var.awsRegion}::foundation-model/amazon.nova-micro-*"
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.thumb.arn
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  filename         = data.archive_file.api.output_path
  function_name    = var.lambdaApiFunctionName
  role             = aws_iam_role.lambdaApi.arn
  handler          = "api.handler.handler"
  source_code_hash = data.archive_file.api.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 512
  layers           = [aws_lambda_layer_version.pillow.arn]

  environment {
    variables = {
      TABLE_NAME           = aws_dynamodb_table.main.name
      MEDIA_BUCKET         = aws_s3_bucket.media.id
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      THUMB_FUNCTION_NAME  = aws_lambda_function.thumb.function_name
    }
  }
}

# ------------------------------------------------------------------------------
# Thumbnail Lambda (S3 trigger + MediaConvert completion)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "mediaconvert" {
  name = "ows-mediaconvert-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "mediaconvert.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "mediaconvert" {
  name   = "ows-mediaconvert-s3"
  role   = aws_iam_role.mediaconvert.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.media.arn}/*"
    }]
  })
}

resource "aws_iam_role" "lambdaThumb" {
  name = "ows-thumb-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambdaThumb" {
  name   = "ows-thumb-lambda"
  role   = aws_iam_role.lambdaThumb.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.awsRegion}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:CopyObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.main.arn
      },
      {
        Effect   = "Allow"
        Action   = ["mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:DescribeEndpoints"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.mediaconvert.arn
        Condition = {
          StringEquals = { "iam:PassedToService" = "mediaconvert.amazonaws.com" }
        }
      }
    ]
  })
}

resource "aws_lambda_function" "thumb" {
  filename         = data.archive_file.api.output_path
  function_name    = "ows-thumb"
  role             = aws_iam_role.lambdaThumb.arn
  handler          = "thumb.handler.handler"
  source_code_hash = data.archive_file.api.output_base64sha256
  runtime          = "python3.12"
  timeout          = 120

  environment {
    variables = {
      TABLE_NAME            = aws_dynamodb_table.main.name
      MEDIA_BUCKET          = aws_s3_bucket.media.id
      MEDIACONVERT_ROLE_ARN = aws_iam_role.mediaconvert.arn
    }
  }
}

resource "aws_lambda_permission" "thumb_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumb.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.media.arn
}

resource "aws_s3_bucket_notification" "media" {
  bucket = aws_s3_bucket.media.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.thumb.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "media/image/"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.thumb.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "media/video/"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.thumb.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "media/audio/"
  }

  depends_on = [aws_lambda_permission.thumb_s3]
}

resource "aws_cloudwatch_event_rule" "mediaconvert_complete" {
  name           = "ows-mediaconvert-complete"
  description    = "MediaConvert job state change"
  event_bus_name = "default"

  event_pattern = jsonencode({
    source      = ["aws.mediaconvert"]
    detail-type = ["MediaConvert Job State Change"]
    detail      = { status = ["COMPLETE", "ERROR"] }
  })
}

resource "aws_cloudwatch_event_target" "thumb" {
  rule      = aws_cloudwatch_event_rule.mediaconvert_complete.name
  target_id = "ThumbLambda"
  arn       = aws_lambda_function.thumb.arn
}

resource "aws_lambda_permission" "thumb_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumb.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.mediaconvert_complete.arn
}

# ------------------------------------------------------------------------------
# API Gateway HTTP API
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "main" {
  name          = var.apiGatewayName
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Authorization", "Content-Type", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
    expose_headers    = []
    allow_credentials = false
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.awsRegion}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

# --- Public routes (no auth) ---

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Shows: public list
resource "aws_apigatewayv2_route" "showsGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /shows"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Updates: public list (visible only)
resource "aws_apigatewayv2_route" "updatesGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /updates"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Updates: pinned update for front page
resource "aws_apigatewayv2_route" "updatesPinnedGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /updates/pinned"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Press: public list
resource "aws_apigatewayv2_route" "pressGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /press"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Media: public browse
resource "aws_apigatewayv2_route" "mediaGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /media"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Categories: public list
resource "aws_apigatewayv2_route" "categoriesGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /categories"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Venues: public list
resource "aws_apigatewayv2_route" "venuesGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /venues"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Embed: API-key gated public content for embedding
resource "aws_apigatewayv2_route" "embedShowsGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /embed/shows"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "embedUpdatesGet" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /embed/updates"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# --- Authenticated routes (JWT required) ---

# Current user info
resource "aws_apigatewayv2_route" "me" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /me"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Profile
resource "aws_apigatewayv2_route" "profileGet" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /profile"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "profilePut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /profile"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Shows: CRUD (editor+)
resource "aws_apigatewayv2_route" "showsPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /shows"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "showsPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /shows"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "showsDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /shows"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Venues: CRUD (editor+)
resource "aws_apigatewayv2_route" "venuesPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /venues"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "venuesPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /venues"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Updates: CRUD (editor/band+)
resource "aws_apigatewayv2_route" "updatesPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /updates"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "updatesPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /updates"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "updatesDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /updates"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Press: CRUD (editor+)
resource "aws_apigatewayv2_route" "pressPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /press"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "pressPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /press"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "pressDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /press"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Media: CRUD + uploads (band+)
resource "aws_apigatewayv2_route" "mediaGetAll" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /media/all"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "mediaPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /media"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "mediaPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /media"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "mediaDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /media"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "mediaUpload" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /media/upload"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "mediaImportFromUrl" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /media/import-from-url"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "mediaThumbnailUpload" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /media/thumbnail-upload"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Categories: CRUD (manager+)
resource "aws_apigatewayv2_route" "categoriesPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /categories"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "categoriesPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /categories"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "categoriesDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /categories"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Groups: self-service membership
resource "aws_apigatewayv2_route" "groupsList" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /groups"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "meGroupsJoin" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /me/groups"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "meGroupsLeave" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /me/groups/{groupName}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Admin: users & group management
resource "aws_apigatewayv2_route" "adminUsersGet" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/users"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminUserGroupsGet" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/users/{username}/groups"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminUserGroupsPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /admin/users/{username}/groups"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminUserDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /admin/users/{username}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminUserGroupsDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /admin/users/{username}/groups/{groupName}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminGroupsGet" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/groups"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminGroupsPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /admin/groups"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminGroupsPut" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /admin/groups/{name}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminGroupsDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /admin/groups/{name}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Admin: API keys for embedding
resource "aws_apigatewayv2_route" "adminApiKeysGet" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /admin/api-keys"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminApiKeysPost" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /admin/api-keys"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "adminApiKeysDelete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /admin/api-keys"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# OPTIONS routes for CORS preflight
resource "aws_apigatewayv2_route" "showsOptions" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /shows"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "mediaOptions" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /media"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "updatesOptions" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /updates"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "pressOptions" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /press"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "venuesOptions" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "OPTIONS /venues"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apiGateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
