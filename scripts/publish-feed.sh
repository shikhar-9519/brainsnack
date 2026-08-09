#!/bin/sh
# Publishes the reviewed feed: commits data/feed.json and pushes, which trips
# the Pages workflow.
#
# Only feed.json is published. queue.json (unreviewed) and rejected.json stay
# local — nothing reaches readers without passing through the admin console.
set -eu

cd "$(dirname "$0")/.."

if [ ! -f data/feed.json ]; then
  echo "data/feed.json does not exist. Approve some cards first: npm run admin" >&2
  exit 1
fi

CARDS=$(node -p "require('./data/feed.json').cards.length")

if [ "$CARDS" -eq 0 ]; then
  echo "Feed has no cards. Approve some first: npm run admin" >&2
  exit 1
fi

# An untracked file produces no diff, so "no changes" would be indistinguishable
# from "never published" and the first publish would silently no-op.
if git ls-files --error-unmatch data/feed.json >/dev/null 2>&1; then
  if git diff --quiet -- data/feed.json 2>/dev/null && \
     git diff --cached --quiet -- data/feed.json 2>/dev/null; then
    echo "Feed unchanged since the last publish. Nothing to do."
    exit 0
  fi
fi

git add data/feed.json
git commit -m "content: publish feed ($CARDS cards)"
git push

echo ""
echo "Pushed $CARDS cards. The Pages workflow will deploy them shortly."
echo "Watch it: gh run watch  (or the Actions tab)"
