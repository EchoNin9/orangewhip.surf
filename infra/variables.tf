variable "awsRegion" {
  description = "AWS region for resources."
  type        = string
  default     = "us-east-1"
}

variable "githubOrgRepo" {
  description = "GitHub org/repo for OIDC trust (e.g. EchoNin9/orangewhip.surf)."
  type        = string
}

variable "terraformStateBucket" {
  description = "S3 bucket name for Terraform state."
  type        = string
  default     = "ows-aws-s3-terraform-state"
}

variable "terraformStateLockTable" {
  description = "DynamoDB table name for Terraform state locking."
  type        = string
  default     = "ows-terraform-state-lock"
}

variable "websiteStagingBucket" {
  description = "S3 bucket name for staging frontend."
  type        = string
  default     = "ows-website-staging"
}

variable "websiteProductionBucket" {
  description = "S3 bucket name for production frontend."
  type        = string
  default     = "ows-website-production"
}

variable "dynamoTableName" {
  description = "DynamoDB table name (single table for shows, media, updates, press, users, etc.)."
  type        = string
  default     = "ows-main"
}

variable "cognitoUserPoolName" {
  description = "Cognito User Pool name."
  type        = string
  default     = "ows-user-pool"
}

variable "cognitoAppClientName" {
  description = "Cognito User Pool App Client name (frontend)."
  type        = string
  default     = "ows-web"
}

variable "cognitoDomainPrefix" {
  description = "Cognito hosted UI domain prefix (e.g. ows-auth). Empty to skip domain."
  type        = string
  default     = "ows-auth"
}

variable "lambdaApiFunctionName" {
  description = "Lambda function name for the API handler."
  type        = string
  default     = "ows-api"
}

variable "apiGatewayName" {
  description = "API Gateway HTTP API name."
  type        = string
  default     = "ows-api"
}

variable "mediaBucketName" {
  description = "S3 bucket name for user uploads (audio, video, images)."
  type        = string
  default     = "ows-media-452644920012"
}

# ------------------------------------------------------------------------------
# Custom domain (Route 53 + CloudFront)
# ------------------------------------------------------------------------------
variable "domainSurf" {
  description = "Primary domain (orangewhip.surf)."
  type        = string
  default     = "orangewhip.surf"
}

variable "stagingSubdomain" {
  description = "Subdomain for staging (e.g. stage)."
  type        = string
  default     = "stage"
}
