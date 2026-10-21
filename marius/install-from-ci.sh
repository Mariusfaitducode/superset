#!/usr/bin/env bash
# Installs a fork build made on GitHub (.github/workflows/marius-build.yml),
# without building anything on this Mac. Needs `gh` logged in.
#
#   marius/install-from-ci.sh                     # the latest release
#   marius/install-from-ci.sh marius-v1.39.0-3    # that release
#   marius/install-from-ci.sh build/next          # latest green build of a build/ branch
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=Mariusfaitducode/superset
TARGET=${1:-}
DIR="$HOME/Downloads/superset-fork-build"
rm -rf "$DIR" && mkdir -p "$DIR"

if [ -z "$TARGET" ] || [[ "$TARGET" == marius-v* ]]; then
	TAG=${TARGET:-$(gh release list -R "$REPO" --limit 20 --json tagName,isLatest -q '.[] | select(.isLatest) | .tagName')}
	echo "downloading release $TAG"
	gh release download "$TAG" -R "$REPO" -p '*.zip' -D "$DIR"
else
	RUN=$(gh run list -R "$REPO" -w "Fork build" -b "$TARGET" -s success -L 1 --json databaseId -q '.[0].databaseId')
	[ -n "$RUN" ] || { echo "no successful build on $TARGET yet"; exit 1; }
	echo "downloading build $RUN of $TARGET"
	gh run download "$RUN" -R "$REPO" -n superset-app -D "$DIR"
fi

ZIP=$(ls "$DIR"/*.zip | head -n 1)
ditto -x -k "$ZIP" "$DIR"
xattr -cr "$DIR/Superset.app"
codesign --verify --deep --strict "$DIR/Superset.app"

# Own session, so the swap outlives whatever ran this script.
nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' "$ROOT/marius/swap-to-fork.sh" "$DIR/Superset.app" </dev/null >/dev/null 2>&1 &
echo "installing: Superset will quit and reopen, click Quit (progress in marius/swap.log)"
