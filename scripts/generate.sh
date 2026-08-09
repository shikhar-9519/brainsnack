#!/bin/sh
# Wrapper for scheduled runs. launchd starts with a minimal environment, so the
# working directory and PATH have to be established here.
#
# The generator drives the `claude` CLI, which authenticates with the Claude
# subscription already signed in on this machine. No API key is involved.
set -eu

cd "$(dirname "$0")/.."

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found on PATH. Install it or fix PATH in the launchd plist." >&2
  exit 1
fi

# Claude Code refuses to launch inside another Claude Code session.
unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT 2>/dev/null || true

exec npx tsx generator/generate.ts
