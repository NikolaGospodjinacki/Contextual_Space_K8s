terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # S3 backend for persistent state management
  # The bucket and DynamoDB table must be created before first use:
  #   aws s3 mb s3://contextual-space-terraform-state-<ACCOUNT_ID> --region us-east-1
  #   aws s3api put-bucket-versioning --bucket contextual-space-terraform-state-<ACCOUNT_ID> --versioning-configuration Status=Enabled
  #   aws dynamodb create-table --table-name contextual-space-terraform-lock --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region us-east-1
  backend "s3" {
    bucket         = "contextual-space-terraform-state-871981698300"
    key            = "eks/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "contextual-space-terraform-lock"
  }
}
