#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$repo_dir/dist"
package_file="$build_dir/chessli-1.0.1.zip"

mkdir -p "$build_dir"
rm -f "$package_file"

cd "$repo_dir"
zip -q -r "$package_file" \
  manifest.json \
  background.js \
  content.js \
  lichess-paste.js \
  popup.html \
  popup.css \
  popup.js \
  privacy.html \
  lib \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-128.png

echo "$package_file"
