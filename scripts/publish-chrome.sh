#!/usr/bin/env bash
# Uploads an extension zip to the Chrome Web Store and submits it for review,
# through the Chrome Web Store API v2. ACCESS_TOKEN is a short-lived Google
# token with the chromewebstore scope (from google-github-actions/auth).
#
# Usage: ACCESS_TOKEN=... PUBLISHER_ID=... EXTENSION_ID=... publish-chrome.sh <zip>
set -euo pipefail

zip=${1:?usage: publish-chrome.sh <zip>}
: "${ACCESS_TOKEN:?}" "${PUBLISHER_ID:?}" "${EXTENSION_ID:?}"

api=https://chromewebstore.googleapis.com
item="publishers/$PUBLISHER_ID/items/$EXTENSION_ID"
auth="Authorization: Bearer $ACCESS_TOKEN"

upload=$(curl -sS --fail-with-body -X POST -H "$auth" \
  -H "X-Goog-Upload-Protocol: raw" -H "X-Goog-Upload-File-Name: extension.zip" \
  --data-binary "@$zip" "$api/upload/v2/$item:upload")
state=$(jq -r .uploadState <<<"$upload")

# Large uploads are processed asynchronously; wait up to 5 minutes
for _ in $(seq 60); do
  [ "$state" = IN_PROGRESS ] || break
  sleep 5
  state=$(curl -sS --fail-with-body -H "$auth" "$api/v2/$item:fetchStatus" | jq -r .lastAsyncUploadState)
done

if [ "$state" != SUCCEEDED ]; then
  echo "::error title=Chrome Web Store upload failed::Upload ended in state $state"
  echo "$upload"
  exit 1
fi

curl -sS --fail-with-body -X POST -H "$auth" -H "Content-Type: application/json" \
  -d '{"publishType":"DEFAULT_PUBLISH"}' "$api/v2/$item:publish"
echo
