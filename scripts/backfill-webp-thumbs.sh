#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# backfill-webp-thumbs.sh
#
# Scans DynamoDB for MEDIA# items missing thumbnailWebpKey, then invokes the
# ows-thumb Lambda (async) for each image to generate WebP thumbnails.
#
# Usage:
#   ./scripts/backfill-webp-thumbs.sh                   # dry-run (default)
#   ./scripts/backfill-webp-thumbs.sh --execute         # actually invoke
#   AWS_PROFILE=echo9 ./scripts/backfill-webp-thumbs.sh --execute
#
# Requires: aws-cli v2, jq
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TABLE_NAME="${TABLE_NAME:-ows-main}"
BUCKET_NAME="${BUCKET_NAME:-ows-media-452644920012}"
THUMB_FUNCTION="${THUMB_FUNCTION:-ows-thumb}"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-echo9}"

DRY_RUN=true
if [[ "${1:-}" == "--execute" ]]; then
  DRY_RUN=false
fi

AWS="aws --profile $PROFILE --region $REGION"

echo "=== WebP Thumbnail Backfill ==="
echo "Table:    $TABLE_NAME"
echo "Bucket:   $BUCKET_NAME"
echo "Lambda:   $THUMB_FUNCTION"
echo "Profile:  $PROFILE"
echo "Dry run:  $DRY_RUN"
echo ""

# Scan for all MEDIA# items with SK=META that have an s3Key but no thumbnailWebpKey
# We use a FilterExpression to find items missing the thumbnailWebpKey attribute
SCAN_PARAMS=(
  --table-name "$TABLE_NAME"
  --filter-expression "begins_with(PK, :pk) AND SK = :sk AND attribute_exists(s3Key) AND attribute_not_exists(thumbnailWebpKey)"
  --expression-attribute-values '{ ":pk": {"S": "MEDIA#"}, ":sk": {"S": "META"} }'
  --projection-expression "PK, s3Key, mediaType"
)

total=0
processed=0
skipped=0
errors=0
last_key=""

echo "Scanning DynamoDB for media items missing WebP thumbnails..."
echo ""

while true; do
  EXTRA_ARGS=()
  if [[ -n "$last_key" ]]; then
    EXTRA_ARGS+=(--exclusive-start-key "$last_key")
  fi

  RESULT=$($AWS dynamodb scan "${SCAN_PARAMS[@]}" "${EXTRA_ARGS[@]}" --output json 2>&1)

  ITEMS=$(echo "$RESULT" | jq -c '.Items[]' 2>/dev/null || true)

  while IFS= read -r item; do
    [[ -z "$item" ]] && continue
    total=$((total + 1))

    pk=$(echo "$item" | jq -r '.PK.S')
    media_id="${pk#MEDIA#}"
    s3_key=$(echo "$item" | jq -r '.s3Key.S')
    media_type=$(echo "$item" | jq -r '.mediaType.S // "unknown"')

    # Only reprocess images — videos use MediaConvert (separate flow), audio has no thumbnails
    if [[ "$media_type" != "image" ]]; then
      echo "  SKIP  $media_id  type=$media_type  (only images need WebP backfill)"
      skipped=$((skipped + 1))
      continue
    fi

    if [[ "$DRY_RUN" == true ]]; then
      echo "  [DRY] $media_id  s3Key=$s3_key  type=$media_type"
    else
      echo -n "  INVOKE $media_id ... "
      PAYLOAD_FILE=$(mktemp)
      jq -cn \
        --arg mid "$media_id" \
        --arg key "$s3_key" \
        --arg typ "$media_type" \
        --arg bkt "$BUCKET_NAME" \
        '{ mediaId: $mid, s3Key: $key, mediaType: $typ, bucket: $bkt }' > "$PAYLOAD_FILE"

      if $AWS lambda invoke \
        --function-name "$THUMB_FUNCTION" \
        --invocation-type Event \
        --cli-binary-format raw-in-base64-out \
        --payload "file://$PAYLOAD_FILE" \
        /tmp/backfill-invoke-out.json > /dev/null 2>&1; then
        echo "OK"
        processed=$((processed + 1))
      else
        echo "FAILED"
        errors=$((errors + 1))
      fi
      rm -f "$PAYLOAD_FILE"

      # Throttle slightly to avoid Lambda burst limits
      sleep 0.1
    fi
  done <<< "$ITEMS"

  # Check for pagination
  last_key=$(echo "$RESULT" | jq -c '.LastEvaluatedKey // empty' 2>/dev/null || true)
  if [[ -z "$last_key" ]]; then
    break
  fi
done

echo ""
echo "=== Summary ==="
echo "Total items missing WebP:  $total"
echo "Skipped (non-image):       $skipped"
if [[ "$DRY_RUN" == true ]]; then
  echo "Images to process:         $((total - skipped))"
  echo ""
  echo "Run with --execute to invoke the thumb Lambda for each image."
else
  echo "Successfully invoked:      $processed"
  echo "Errors:                    $errors"
  echo ""
  echo "Thumbnails are generated async. Check CloudWatch logs for ows-thumb."
fi
