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

# caffeinate -i holds off idle sleep for as long as the generator runs. Without
# it the machine sleeps a minute after the 23:00 start, the claude process is
# suspended mid-call, and the run dies on wake when the call timeout fires
# against a clock that stopped counting.
#
# -i covers idle sleep only. Closing the lid still sleeps the machine, and no
# amount of caffeinate prevents that.
exec caffeinate -i npx tsx generator/generate.ts
