#!/usr/bin/env bash
# mag-intake: on this Mac, AR Create takes the drop in (it is the magazine's one writer, 2026-10-21);
# on any other machine the original script runs unchanged (~/builds/mag-intake.legacy.sh).
# Installed by AR Create's scripts/install-mag-clients.mjs from editorial/builds-next/mag-intake.sh.
#   mag-intake.sh "Title" "<file in a drop folder>"
set -euo pipefail
if [ "$(uname -s)" != "Darwin" ]; then exec bash "$HOME/builds/mag-intake.legacy.sh" "$@"; fi
[ $# -eq 2 ] || { echo "On this Mac: mag-intake.sh \"Title\" \"<file in a drop folder>\" (AR Create takes it in; voice notes, --lang and --terms are set in AR Create)." >&2; exit 2; }
source "$HOME/builds/mag-intake.config"
dir="$(cd "$(dirname "$2")" && pwd)"; folder=-1; i=0
IFS='|' read -ra drops <<< "$MAG_DROPS"
for d in "${drops[@]}"; do d="$(echo "$d" | sed 's/^ *//;s/ *$//')"; [ "$(cd "$d" 2>/dev/null && pwd)" = "$dir" ] && folder=$i; i=$((i+1)); done
[ "$folder" -ge 0 ] || { echo "AR Create takes in files from a drop folder only: $MAG_DROPS" >&2; exit 2; }
exec node "$HOME/Library/Application Support/i64os/ar-create/service/tools/magazine/mag.mjs" claim "$(basename "$2")" --story "$1" --folder "$folder"
