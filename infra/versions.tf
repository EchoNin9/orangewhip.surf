terraform {
  required_version = ">= 1.0"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "ows-aws-s3-terraform-state"
    key            = "orangewhip/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ows-terraform-state-lock"
    encrypt        = true
  }
}
