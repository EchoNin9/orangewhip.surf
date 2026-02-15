#!/usr/bin/env bash
# Verify a media item exists in DynamoDB.
# Usage: ./scripts/verify-media-item.sh <media-id>
# Example: ./scripts/verify-media-item.sh 92bfc996-3652-4b58-97fc-a0734ba05373
# Requires: aws-cli, valid AWS credentials

set -e

MEDIA_ID="${1:?Usage: $0 <media-id>}"
TABLE="${TABLE_NAME:-ows-main}"
REGION="${AWS_REGION:-us-east-1}"

echo "Checking DynamoDB table: $TABLE (region: $REGION)"
echo "Media ID: $MEDIA_ID"
echo ""

aws dynamodb get-item \
  --table-name "$TABLE" \
  --key "{\"PK\":{\"S\":\"MEDIA#${MEDIA_ID}\"},\"SK\":{\"S\":\"META\"}}" \
  --region "$REGION" \
  --output json
