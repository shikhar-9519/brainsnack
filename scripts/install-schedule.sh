#!/bin/sh
# Installs a launchd agent that runs the generator twice a day.
#
# launchd rather than cron: with StartCalendarInterval a run missed because the
# Mac was asleep fires on wake, whereas cron silently skips it. A laptop closed
# at the scheduled hour is the normal case, not the exception.
set -eu

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="dev.interlude.generate"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$PROJECT_DIR/data/logs"

# 02:00 by default: the rolling five-hour usage window has reset long before
# the working day starts, so generation never competes with real work.
RUN_HOUR="${INTERLUDE_RUN_HOUR:-2}"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

# node must be on PATH for npx; launchd does not inherit your shell profile.
NODE_BIN_DIR="$(dirname "$(command -v node)")"
CLAUDE_BIN_DIR="$(dirname "$(command -v claude 2>/dev/null || echo /opt/homebrew/bin/claude)")"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$PROJECT_DIR/scripts/generate.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$NODE_BIN_DIR:$CLAUDE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$RUN_HOUR</integer>
    <key>Minute</key><integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/generate.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/generate.error.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed $LABEL"
echo "  runs daily at ${RUN_HOUR}:00"
echo "  logs   $LOG_DIR/generate.log"
echo ""
echo "Run once now:     launchctl kickstart gui/$(id -u)/$LABEL"
echo "Check it is live: launchctl print gui/$(id -u)/$LABEL | head -20"
echo "Remove:           launchctl bootout gui/$(id -u)/$LABEL && rm $PLIST"
