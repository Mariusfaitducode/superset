#!/usr/bin/env bash
# Builds the current checkout and installs it as /Applications/Superset.app in one go.
# Terminals survive (see swap-to-fork.sh). Turn off Settings → General → "Confirm before
# quitting" and it runs with no click at all.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/build-marius.log"
APP="$ROOT/apps/desktop/release/mac-arm64/Superset.app"
export PATH="$HOME/.bun/bin:$PATH" NODE_ENV=production

started=$(date +%s)
echo "building $(git -C "$ROOT" rev-parse --abbrev-ref HEAD)@$(git -C "$ROOT" rev-parse --short HEAD), log: $LOG"
(
	cd "$ROOT/apps/desktop"
	bun run prebuild
	CSC_IDENTITY_AUTO_DISCOVERY=false bunx electron-builder --config electron-builder.ts \
		--mac dir --arm64 --publish never -c.mac.notarize=false -c.mac.identity=-
) >"$LOG" 2>&1 || { echo "build failed, see $LOG"; tail -n 20 "$LOG"; exit 1; }
codesign --verify --deep --strict "$APP"
echo "built in $(( $(date +%s) - started ))s"

nohup "$ROOT/marius/swap-to-fork.sh" "$APP" >/dev/null 2>&1 &
echo "installing: Superset will quit and reopen (progress in marius/swap.log)"
