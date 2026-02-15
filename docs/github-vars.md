# Required GitHub Variables for OWS Deployment

## Overview

The orangewhip.surf CI/CD pipeline uses GitHub Actions with AWS OIDC authentication (no long-lived access keys). You need to set **repository variables** (not secrets) in your GitHub repository settings before the first deployment will succeed.

## Required Variables

Navigate to: **GitHub repo → Settings → Secrets and variables → Actions → Variables tab**

| Variable | Value Source | Example |
|----------|-------------|---------|
| `AWS_ROLE_ARN_STAGING` | Terraform output `githubStagingRoleArn` | `arn:aws:iam::123456789012:role/github-actions-orangewhip-staging` |
| `AWS_ROLE_ARN_PRODUCTION` | Terraform output `githubProductionRoleArn` | `arn:aws:iam::123456789012:role/github-actions-orangewhip-production` |
| `AWS_REGION` | Your AWS region (optional, defaults to `us-east-1`) | `us-east-1` |

## Bootstrap Sequence

The first deployment is a chicken-and-egg problem: CI/CD needs IAM role ARNs, but those are created by Terraform which runs in CI/CD. Follow these steps:

### Step 1: Create Terraform State Backend (Manual, One-Time)

In the AWS Console (or CLI), create:

1. **S3 Bucket:** `ows-aws-s3-terraform-state`
   - Region: `us-east-1`
   - Versioning: Enabled
   - Encryption: AES-256 (SSE-S3)
   - Block all public access: Yes

2. **DynamoDB Table:** `ows-terraform-state-lock`
   - Region: `us-east-1`
   - Partition key: `LockID` (String)
   - Billing: On-demand (PAY_PER_REQUEST)

### Step 2: Run Terraform Locally (One-Time)

From your local machine (with AWS credentials configured):

```bash
cd infra
terraform init
terraform apply -var="githubOrgRepo=EchoNin9/orangewhip.surf"
```

This creates all AWS resources including the GitHub OIDC IAM roles.

### Step 3: Get Role ARNs

After `terraform apply` completes:

```bash
terraform output githubStagingRoleArn
terraform output githubProductionRoleArn
```

### Step 4: Set GitHub Variables

Go to your repo settings and add the three variables listed above.

### Step 5: Update Domain Nameservers

Get the Route 53 nameservers:

```bash
terraform output route53NameserversSurf
```

Update your domain registrar for `orangewhip.surf` to use these nameservers. DNS propagation may take up to 48 hours.

### Step 6: Push to Deploy

```bash
# Staging
git push origin develop

# Production (after staging is verified)
git checkout main
git merge develop
git push origin main
```

## Verifying the Setup

After the first successful deployment:

- **Staging:** https://stage.orangewhip.surf
- **Production:** https://orangewhip.surf
- **API Health:** `curl https://<api-url>/health`

## Terraform Outputs Reference

| Output | Description |
|--------|-------------|
| `githubStagingRoleArn` | IAM role for staging CI/CD |
| `githubProductionRoleArn` | IAM role for production CI/CD |
| `websiteStagingBucket` | S3 bucket for staging frontend |
| `websiteProductionBucket` | S3 bucket for production frontend |
| `cloudfrontStagingId` | CloudFront distribution ID (staging) |
| `cloudfrontProductionId` | CloudFront distribution ID (production) |
| `cognitoUserPoolId` | Cognito User Pool ID |
| `cognitoClientId` | Cognito App Client ID |
| `apiInvokeUrl` | API Gateway invoke URL |
| `route53NameserversSurf` | Nameservers for domain registrar |
| `dynamoTableName` | DynamoDB table name |

## Troubleshooting

### "Error assuming role" in GitHub Actions
- Verify the `AWS_ROLE_ARN_STAGING` / `AWS_ROLE_ARN_PRODUCTION` variables are set correctly
- Ensure the GitHub OIDC provider was created by Terraform
- Check that the trust policy references the correct repo (`EchoNin9/orangewhip.surf`)

### Terraform state errors
- Ensure the `ows-aws-s3-terraform-state` bucket exists in `us-east-1`
- Ensure the `ows-terraform-state-lock` DynamoDB table exists in `us-east-1`

### SSL certificate pending
- ACM certificate validation requires DNS records. After Route 53 is set up and nameservers propagate, Terraform will create validation records automatically.
- Re-run `terraform apply` after nameserver propagation if the cert didn't validate on first run.

### Vercel build error on merge to main
OWS deploys via **AWS** (S3 + CloudFront), not Vercel. If you see a Vercel build failure when merging develop → main, Vercel is still connected to the repo from an earlier setup.

**To remove the Vercel build error:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find the project linked to `orangewhip.surf` (or `EchoNin9/orangewhip.surf`)
3. **Project Settings → Git → Connected Git Repository**
4. Click **Disconnect**

This stops Vercel from attempting builds on push. Production deploys continue via GitHub Actions (main.yml).
