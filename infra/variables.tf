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

variable "domainInfo" {
  description = "Redirect domain (301 to orangewhip.surf)"
  type        = string
  default     = "orangewhip.info"
}

variable "redirectBucketName" {
  description = "S3 bucket for orangewhip.info redirect"
  type        = string
  default     = "ows-redirect-info"
}

# ------------------------------------------------------------------------------
# Online store (Stripe + Gelato)
# ------------------------------------------------------------------------------
# Secrets are passed in via TF_VAR_* env vars from the deploy workflow
# (GitHub Actions secrets). Defaults are empty so `terraform plan` works
# locally without secrets configured.
variable "stripeSecretKey" {
  description = "Stripe secret key (sk_test_... / sk_live_...). Server-side only."
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripeWebhookSecret" {
  description = "Stripe webhook signing secret (whsec_...) for /stripe-webhook signature verification."
  type        = string
  default     = ""
  sensitive   = true
}

variable "gelatoApiKey" {
  description = "Gelato API key for placing print-on-demand orders."
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripePublishableKey" {
  description = "Stripe publishable key (pk_test_... / pk_live_...). Safe to ship to the browser via config.js."
  type        = string
  default     = ""
}
