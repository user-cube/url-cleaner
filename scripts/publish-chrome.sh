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

# Calls the API and leaves its response in $response. On an HTTP error, shows
# the error the API returned (e.g. why a request is forbidden) and stops.
response=$(mktemp)
call() {
  local status
  status=$(curl -sS -o "$response" -w '%{http_code}' -H "$auth" "$@")
  if [ "$status" -ge 400 ]; then
    echo "::error title=Chrome Web Store API returned HTTP $status::$(jq -r '.error.message // empty' "$response" 2>/dev/null)"
    cat "$response"
    echo
    exit 1
  fi
}

call -X POST -H "X-Goog-Upload-Protocol: raw" -H "X-Goog-Upload-File-Name: extension.zip" \
  --data-binary "@$zip" "$api/upload/v2/$item:upload"
state=$(jq -r .uploadState "$response")
upload=$(cat "$response")

# Large uploads are processed asynchronously; wait up to 5 minutes
for _ in $(seq 60); do
  [ "$state" = IN_PROGRESS ] || break
  sleep 5
  call "$api/v2/$item:fetchStatus"
  state=$(jq -r .lastAsyncUploadState "$response")
done

if [ "$state" != SUCCEEDED ]; then
  echo "::error title=Chrome Web Store upload failed::Upload ended in state $state"
  echo "$upload"
  exit 1
fi

call -X POST -H "Content-Type: application/json" \
  -d '{"publishType":"DEFAULT_PUBLISH"}' "$api/v2/$item:publish"
cat "$response"
echo
