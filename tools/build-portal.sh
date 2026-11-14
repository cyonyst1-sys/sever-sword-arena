#!/usr/bin/env bash
# Build upload-ready zips for game portals into dist/:
#   dist/sever-web.zip         itch.io, Newgrounds, Game Jolt, Poki pitch (plain HTML5 build)
#   dist/sever-crazygames.zip  CrazyGames (same build plus the CrazyGames SDK script)
# The unzipped folders sit next to them (dist/web, dist/crazygames) for local testing.
# tools/bump-version.sh runs this automatically, so the zips always match the latest build.
cd "$(dirname "$0")/.." || exit 1
set -e
mkdir -p dist && rm -rf dist/* # (empty it rather than delete it: still works while the folder is open in File Explorer)
for target in web crazygames; do
  out="dist/$target"
  mkdir -p "$out"
  cp -r index.html src thumbs vendor "$out/"
  # no version.json, and the stale-page guard is switched off: a portal serves exactly the files uploaded, and
  # portals flag a request for a missing file (CrazyGames: "Missing resource detected")
  sed -i "s#  check: function () {#  check: function () { return Promise.resolve(false); // (portal build: nothing to check)#" "$out/index.html"
  grep -q "portal build: nothing to check" "$out/index.html" || { echo "build-portal: couldn't switch off the version check" >&2; exit 1; }
  if [ "$target" = crazygames ]; then
    sed -i 's#<script src="vendor/peerjs.min.js"></script>#<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n&#' "$out/index.html"
    grep -q crazygames-sdk-v3 "$out/index.html" || { echo "build-portal: couldn't add the CrazyGames SDK tag" >&2; exit 1; }
  fi
done
# zip with forward-slash paths (Compress-Archive on Windows PowerShell writes backslashes, which some portals reject)
powershell -NoProfile -Command '
  Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
  foreach ($t in "web", "crazygames") {
    $src = (Resolve-Path "dist/$t").Path; $zip = Join-Path (Resolve-Path "dist").Path "sever-$t.zip"
    $z = [System.IO.Compression.ZipFile]::Open($zip, "Create")
    Get-ChildItem $src -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($src.Length + 1).Replace("\", "/")
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, "Optimal")
    }
    $z.Dispose()
  }'
ls -la dist/*.zip | awk '{print "build-portal: " $NF " (" int($5/1024) " KB)"}'
