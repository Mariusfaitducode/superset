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
# What the build is, for the line at the bottom of Settings: a release, merged
# into marius/main, or work in progress. Uses the remote refs as last fetched.
repo() { git -C "$ROOT" "$@"; }
dirty=$(repo status --porcelain --untracked-files=no | grep -q . && echo true || echo false)
release=$(repo describe --tags --exact-match --match 'marius-v*' HEAD 2>/dev/null || true)
merged=$(repo merge-base --is-ancestor HEAD origin/marius/main 2>/dev/null && echo true || echo false)
status=wip
[ "$merged" = true ] && status=merged
[ -n "$release" ] && status=release
[ "$dirty" = true ] && status=wip
FORK_BUILD=$(printf '{"status":"%s","branch":"%s","commit":"%s","dirty":%s,"release":"%s","baseRelease":"%s","latestRelease":"%s","upstream":"%s","builtAt":"%s"}' \
	"$status" "$(repo rev-parse --abbrev-ref HEAD)" "$(repo rev-parse --short HEAD)" "$dirty" "$release" \
	"$(repo describe --tags --match 'marius-v*' --abbrev=0 2>/dev/null || true)" \
	"$(repo tag --list 'marius-v*' --sort=-v:refname | head -n 1)" \
	"$(repo describe --tags --match 'desktop-v*' --abbrev=0)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
export FORK_BUILD
echo "building $FORK_BUILD, log: $LOG"
(
	cd "$ROOT/apps/desktop"
	bun run prebuild
	CSC_IDENTITY_AUTO_DISCOVERY=false bunx electron-builder --config electron-builder.ts \
		--mac dir --arm64 --publish never -c.mac.notarize=false -c.mac.identity=-
) >"$LOG" 2>&1 || { echo "build failed, see $LOG"; tail -n 20 "$LOG"; exit 1; }
codesign --verify --deep --strict "$APP"
echo "built in $(( $(date +%s) - started ))s"

# Own session, so the swap outlives whatever ran this script (an agent's shell gets reaped).
nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' "$ROOT/marius/swap-to-fork.sh" "$APP" </dev/null >/dev/null 2>&1 &
echo "installing: Superset will quit and reopen (progress in marius/swap.log)"
