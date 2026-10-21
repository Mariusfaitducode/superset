#!/usr/bin/env bash
# Prints what a build is, as JSON for the line at the bottom of Settings: a
# release, merged into marius/main, or work in progress. Uses the remote refs
# as last fetched. FORK_BRANCH names the branch when HEAD is detached (CI).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
repo() { git -C "$ROOT" "$@"; }
dirty=$(repo status --porcelain --untracked-files=no | grep -q . && echo true || echo false)
release=$(repo describe --tags --exact-match --match 'marius-v*' HEAD 2>/dev/null || true)
merged=$(repo merge-base --is-ancestor HEAD origin/marius/main 2>/dev/null && echo true || echo false)
status=wip
[ "$merged" = true ] && status=merged
[ -n "$release" ] && status=release
[ "$dirty" = true ] && status=wip
printf '{"status":"%s","branch":"%s","commit":"%s","dirty":%s,"release":"%s","baseRelease":"%s","latestRelease":"%s","upstream":"%s","builtAt":"%s"}\n' \
	"$status" "${FORK_BRANCH:-$(repo rev-parse --abbrev-ref HEAD)}" "$(repo rev-parse --short HEAD)" "$dirty" "$release" \
	"$(repo describe --tags --match 'marius-v*' --abbrev=0 2>/dev/null || true)" \
	"$(repo tag --list 'marius-v*' --sort=-v:refname | head -n 1)" \
	"$(repo describe --tags --match 'desktop-v*' --abbrev=0)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
