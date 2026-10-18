#!/usr/bin/env bash
# Switches the simulator app to another seeded dev user without a Metro
# restart. Sources .env the way the dev stack does, so the token is minted
# against the same database the local API reads.
#
# Usage:
#   apps/mobile/scripts/eas-signin.sh <email-or-user-id>
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
	echo "No .env here — run .superset/setup.sh or .superset/setup.cloud.sh first." >&2
	exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

exec bun apps/mobile/scripts/eas-signin.ts "$@"
