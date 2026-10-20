#!/usr/bin/env bash
# Puts back the newest official Superset kept by swap-to-fork.sh. Use the release the
# fork is built from, so it reads the data the fork build wrote.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP=$(cat "$ROOT/.last-backup-path")
OFFICIAL=$(ls -d "$BACKUP"/Superset-official-*.app 2>/dev/null | sort -V | tail -n 1)
[ -d "$OFFICIAL" ] || { echo "no official app kept in $BACKUP"; exit 1; }
osascript -e 'tell application "Superset" to quit' || true
main_running() { ps -axo args= | awk '$0=="/Applications/Superset.app/Contents/MacOS/Superset"{f=1} END{exit !f}'; }
for _ in $(seq 1 300); do main_running || break; sleep 1; done
main_running && { echo "Superset is still open; nothing replaced"; exit 1; }
sleep 5

rm -rf /Applications/Superset.app
ditto "$OFFICIAL" /Applications/Superset.app
open /Applications/Superset.app
echo "restored $OFFICIAL"
