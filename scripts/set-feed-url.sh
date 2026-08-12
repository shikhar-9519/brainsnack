#!/bin/sh
# Derives the GitHub Pages URL from the git remote and writes it into
# package.json as the default for brainsnack.feedUrl.
#
# Derived rather than hardcoded so the repo can be forked or renamed without
# shipping someone else's feed URL to every user.
set -eu

cd "$(dirname "$0")/.."

REMOTE=$(git remote get-url origin 2>/dev/null || true)

if [ -z "$REMOTE" ]; then
  echo "No 'origin' remote. Add one first:" >&2
  echo "  git remote add origin git@github.com:<you>/brainsnack.git" >&2
  exit 1
fi

# Handles every remote form, including SSH host aliases from ~/.ssh/config
# (git@github-personal:user/repo.git), which a literal github.com match misses.
PATH_PART=$(printf '%s' "$REMOTE" \
  | sed -e 's#^ssh://##' -e 's#^https\{0,1\}://##' \
  | sed -e 's#^[^/]*@##' \
  | sed -e 's#^[^/:]*[:/]##' \
  | sed -e 's#\.git$##')
OWNER=$(printf '%s' "$PATH_PART" | cut -d/ -f1)
REPO=$(printf '%s' "$PATH_PART" | cut -d/ -f2)

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "Could not parse owner/repo from remote: $REMOTE" >&2
  exit 1
fi

URL="https://$OWNER.github.io/$REPO/feed.json"

# The feed URL default lives in src/constants.ts, not the manifest.
node -e "
  const fs = require('fs');
  const c = fs.readFileSync('src/constants.ts', 'utf8');
  fs.writeFileSync('src/constants.ts',
    c.replace(/export const DEFAULT_FEED_URL =\\s*'[^']*';/,
              \"export const DEFAULT_FEED_URL =\\n  '$URL';\"));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const props = pkg.contributes.configuration.properties;
  pkg.repository = { type: 'git', url: 'https://github.com/$OWNER/$REPO.git' };
  pkg.homepage = 'https://github.com/$OWNER/$REPO#readme';
  pkg.bugs = { url: 'https://github.com/$OWNER/$REPO/issues' };
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "Default feed URL set to:"
echo "  $URL"
echo ""
echo "Still to do once, in the repo settings:"
echo "  Settings -> Pages -> Source: GitHub Actions"
echo ""
echo "Then rebuild so the new default ships: npm run build"
