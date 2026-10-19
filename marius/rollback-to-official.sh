#!/usr/bin/env bash
# Puts the official Superset 1.39.0 back — the release the fork is built from, so it
# reads the data the fork build wrote.
set -u
BACKUP=$(cat "$HOME/CodeProjects/superset/.last-backup-path")
OFFICIAL="$BACKUP/Superset-official-1.39.0.app"
[ -d "$OFFICIAL" ] || { echo "missing $OFFICIAL"; exit 1; }
osascript -e 'tell application "Superset" to quit' || true
main_running() { ps -axo args= | awk '$0=="/Applications/Superset.app/Contents/MacOS/Superset"{f=1} END{exit !f}'; }
for _ in $(seq 1 300); do main_running || break; sleep 1; done
main_running && { echo "Superset is still open; nothing replaced"; exit 1; }
sleep 5

rm -rf /Applications/Superset.app
ditto "$OFFICIAL" /Applications/Superset.app
open /Applications/Superset.app
echo "restored $OFFICIAL"
