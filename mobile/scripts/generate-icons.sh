#!/usr/bin/env bash
#
# Regenerate every app-icon asset from a single source PNG.
#
# Usage:
#   1. Save your icon artwork (square, ideally 1024×1024) to:
#        mobile/assets/pavo-source.png
#   2. From the mobile/ directory run:
#        bash scripts/generate-icons.sh
#   3. Rebuild the app:  npx expo run:ios   (or run:android)
#
# app.json already points at these filenames, so no config change is needed —
# this script only overwrites the existing asset files in place. Uses `sips`,
# which ships with macOS (no extra tooling).

set -euo pipefail

SRC="${1:-assets/pavo-source.png}"

if [ ! -f "$SRC" ]; then
  echo "✗ Source not found: $SRC"
  echo "  Save your icon PNG there first (square, 1024×1024 recommended)."
  exit 1
fi

gen() { # gen <size> <outfile>
  sips -s format png -z "$1" "$1" "$SRC" --out "$2" >/dev/null
  echo "  ✓ $2 (${1}×${1})"
}

echo "Generating icons from $SRC …"
gen 1024 assets/icon.png                    # iOS + store icon
gen 512  assets/android-icon-foreground.png # Android adaptive foreground
gen 512  assets/splash-icon.png             # splash / loading
gen 48   assets/favicon.png                 # web favicon
echo "Done. Rebuild the app to see the new icon."
