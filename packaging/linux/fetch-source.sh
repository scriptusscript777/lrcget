#!/usr/bin/env bash
# Download the exact Ubuntu source package PACKAGE=VERSION into the current folder.
# Tries apt (deb-src) first; if the mirror no longer lists that version (for example
# after a newer security update), fetches it from Launchpad, which keeps every
# published version, and verifies each file against the SHA-256 sums in its .dsc.
# Usage: fetch-source.sh PACKAGE=VERSION
set -euo pipefail

spec=$1
package=${spec%%=*}
version=${spec#*=}

if apt-get source --download-only "$spec" >/dev/null 2>&1; then
    echo "apt: $spec"
    exit 0
fi

# Debian file names omit the epoch ("2:1.3.4" -> "1.3.4").
file_version=${version#*:}
base="https://launchpad.net/ubuntu/+archive/primary/+sourcefiles/$package/$version"
dsc="${package}_${file_version}.dsc"
curl -fsSL --retry 3 -o "$dsc" "$base/$dsc" || { echo "No source for $spec on Launchpad" >&2; exit 1; }

# Each "Checksums-Sha256" line is: <sha256> <size> <file name>.
mapfile -t entries < <(sed -n '/^Checksums-Sha256:/,/^[A-Za-z-]*:/p' "$dsc" | grep '^ ')
[[ ${#entries[@]} -gt 0 ]] || { echo "No checksums in $dsc" >&2; exit 1; }
for entry in "${entries[@]}"; do
    read -r sum _ name <<<"$entry"
    curl -fsSL --retry 3 -o "$name" "$base/$name"
    echo "$sum  $name" | sha256sum -c --quiet - || { echo "Checksum mismatch: $name" >&2; exit 1; }
done
echo "launchpad: $spec (${#entries[@]} files verified)"
