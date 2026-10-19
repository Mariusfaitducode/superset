#!/usr/bin/env bash
# Replaces /Applications/Superset.app with the personal fork build, keeping all data
# (~/.superset and ~/Library/Application Support/Superset are shared by both builds).
#
# Terminals are left alone: the pty-daemon outlives the app by design (that is how
# official updates keep sessions alive), so running agents carry on across the swap.
set -u
NEW_APP=${1:?usage: swap-to-fork.sh /path/to/Superset.app}
BACKUP=$(cat "$HOME/CodeProjects/superset/.last-backup-path")
LOG="$HOME/CodeProjects/superset/marius/swap.log"
exec >>"$LOG" 2>&1
echo "== $(date) swap to $NEW_APP (backup: $BACKUP)"

[ -d "$NEW_APP" ] || { echo "missing $NEW_APP"; exit 1; }

main_running() { ps -axo args= | awk '$0=="/Applications/Superset.app/Contents/MacOS/Superset"{f=1} END{exit !f}'; }

# An official update staged by Squirrel installs itself over /Applications/Superset.app
# when the app quits; drop it first or it overwrites the fork build.
launchctl remove com.superset.desktop.ShipIt 2>/dev/null || true
SHIPIT="$HOME/Library/Caches/com.superset.desktop.ShipIt"
[ -d "$SHIPIT" ] && mv "$SHIPIT" "$BACKUP/ShipIt-staged-$(date +%s)" && echo "staged official update moved aside"

osascript -e 'tell application "Superset" to quit' || true
# Superset may ask to confirm quitting while agents run; give the user time to answer.
for _ in $(seq 1 300); do
  main_running || break
  sleep 1
done
if main_running; then
  echo "Superset is still open; nothing replaced"
  exit 1
fi
sleep 3

# The earlier copy raced live IndexedDB writes; this one is taken with the app closed.
rm -rf "$BACKUP/app-support"
ditto "$HOME/Library/Application Support/Superset" "$BACKUP/app-support"
for db in local.db tanstack-db.sqlite; do
  sqlite3 "$HOME/.superset/$db" ".backup '$BACKUP/dot-superset/$db'"
done
echo "data re-backed up"

rm -rf /Applications/Superset.app
ditto "$NEW_APP" /Applications/Superset.app
xattr -cr /Applications/Superset.app
echo "installed: $(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' /Applications/Superset.app/Contents/Info.plist)"

open /Applications/Superset.app
echo "launched"
