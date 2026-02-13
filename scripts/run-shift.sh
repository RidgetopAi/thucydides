#!/bin/bash
# Polymarket trading shift - triggered by cron
# Runs one Forge instance with the polymarket trading seed
set -euo pipefail

LOCKFILE="/tmp/polymarket-shift.lock"
LOGDIR="$HOME/logs"
LOGFILE="$LOGDIR/polymarket-shifts.log"
FORGE_DIR="$HOME/projects/forge"

mkdir -p "$LOGDIR"

# Prevent overlapping runs
exec 200>"$LOCKFILE"
flock -n 200 || { echo "$(date -Iseconds) SKIP: Previous shift still running" >> "$LOGFILE"; exit 0; }

echo "$(date -Iseconds) START: Polymarket shift" >> "$LOGFILE"

# Environment setup — cron has minimal PATH
export PATH="$HOME/.local/bin:$PATH"

# Add node from nvm (pick the installed version)
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  NODE_DIR=$(ls -1d "$HOME/.nvm/versions/node/"* 2>/dev/null | tail -1)
  [[ -n "$NODE_DIR" ]] && export PATH="$NODE_DIR/bin:$PATH"
fi

# Source profile for ANTHROPIC_API_KEY and any other env vars
# shellcheck disable=SC1090
[[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc" 2>/dev/null || true

cd "$FORGE_DIR"

# Config: single instance, self-assign shift number
# spindlesProxyUrl set to Anthropic API directly (bypasses spindles-proxy, not needed for cron)
CONFIG='{"runName":"trading-v1","totalInstances":1,"project":"thuc","seedPath":"/home/ridgetop/projects/thucydides/seeds/polymarket/trading-v1.md","selfAssignInstance":true,"timeoutMinutes":45,"spindlesProxyUrl":"https://api.anthropic.com"}'

echo "$CONFIG" | node dist/index.js >> "$LOGFILE" 2>&1
EXIT_CODE=$?

echo "$(date -Iseconds) END: Polymarket shift (exit=$EXIT_CODE)" >> "$LOGFILE"
