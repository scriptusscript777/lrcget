#!/usr/bin/env bash
# Checks freshly built Linux packages on a disposable CI runner:
# Debian identity and checksums, upgrade over the published .deb with the
# user profile kept, launch, installed license files, clean removal, and the
# AppImage launch and license files.
# Usage: check-packages.sh PACKAGE_DIR [PUBLISHED_DEB]
set -euo pipefail

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_OS:-}" != "Linux" ]]; then
    fail "Installation checks are restricted to a disposable Linux CI runner."
fi

pkg_dir=$(realpath "$1")
# apt treats an argument as a local file only with a leading / or ./.
previous=${2:+$(realpath "$2")}
mapfile -t debs < <(find "$pkg_dir" -maxdepth 1 -name '*.deb')
mapfile -t appimages < <(find "$pkg_dir" -maxdepth 1 -name '*.AppImage')
[[ ${#debs[@]} -eq 1 ]] || fail "Expected exactly one .deb, found ${#debs[@]}."
[[ ${#appimages[@]} -eq 1 ]] || fail "Expected exactly one AppImage, found ${#appimages[@]}."
deb=${debs[0]}
appimage=${appimages[0]}
version=$(grep -m1 '^version' src-tauri/Cargo.toml | cut -d'"' -f2)

for file in "$deb" "$appimage"; do
    (cd "$(dirname "$file")" && sha256sum -c "$(basename "$file").sha256" >/dev/null) || fail "Checksum mismatch: $file"
done
pass "checksums"

[[ $(dpkg-deb -f "$deb" Package) == lrcget ]] || fail "Debian package name is not lrcget."
[[ $(dpkg-deb -f "$deb" Architecture) == amd64 ]] || fail "Debian architecture is not amd64."
[[ $(dpkg-deb -f "$deb" Version) == "$version" ]] || fail "Debian version does not match Cargo.toml $version."
pass "Debian identity lrcget/amd64/$version"

# One profile shared by the old and new version, as on a user's computer.
profile=$(mktemp -d)
data_dir="$profile/data/net.lrclib.lrcget"
launch() {
    local log=$1
    shift
    # Waits up to 90 s until the LRCGET window is open and the profile database exists,
    # then confirms the app is still running.
    # NO_AT_BRIDGE avoids GTK waiting on the accessibility bus, absent on CI runners.
    set +e
    # shellcheck disable=SC2016  # the inner script expands its own variables
    NO_AT_BRIDGE=1 XDG_DATA_HOME="$profile/data" XDG_CONFIG_HOME="$profile/config" \
        XDG_CACHE_HOME="$profile/cache" timeout 150 xvfb-run -a bash -c '
            "$@" & app=$!
            for second in $(seq 1 90); do
                sleep 1
                if ! kill -0 "$app" 2>/dev/null; then
                    wait "$app"; echo "LRCGET exited with code $? before opening a window"; exit 3
                fi
                if xwininfo -root -tree 2>/dev/null | grep -q "\"LRCGET\"" \
                    && [ -f "$XDG_DATA_HOME/net.lrclib.lrcget/db.sqlite3" ]; then
                    sleep 3
                    kill -0 "$app" 2>/dev/null || { echo "LRCGET closed right after opening"; exit 3; }
                    echo "LRCGET window opened and profile ready after ${second}s"
                    kill "$app"; exit 0
                fi
            done
            echo "No LRCGET window with a profile after 90s"; kill "$app"; exit 4' _ "$@" >"$log" 2>&1
    local rc=$?
    set -e
    if [[ $rc -ne 0 ]]; then
        cat "$log" >&2
        echo "--- profile contents" >&2
        find "$profile" -maxdepth 4 >&2 || true
        df -h "$profile" /tmp >&2 || true
        fail "$* did not open its window with a profile (code $rc)"
    fi
    grep 'window opened' "$log"
}

if [[ -n "$previous" ]]; then
    sudo apt-get install -y "$previous" >/dev/null
    launch "$pkg_dir/previous-launch.log" /usr/bin/LRCGET
    [[ -f "$data_dir/db.sqlite3" ]] || fail "Published version did not create its profile."
    echo "user data from the published version" >"$data_dir/upgrade-marker"
    pass "published .deb installed and started"
fi

# Same-version rebuilds need --reinstall; a higher version upgrades normally.
installed_version=$(dpkg-query -W -f '${Version}' lrcget 2>/dev/null || true)
if [[ "$installed_version" == "$version" ]]; then
    sudo apt-get install -y --reinstall "$deb" >/dev/null
else
    sudo apt-get install -y "$deb" >/dev/null
fi
[[ $(dpkg-query -W -f '${Version}' lrcget) == "$version" ]] || fail "Installed version is not $version."
extracted=$(mktemp -d)
dpkg-deb -x "$deb" "$extracted"
cmp -s "$extracted/usr/bin/LRCGET" /usr/bin/LRCGET || fail "Installed program is not the new build."
[[ $(dpkg-query -W -f '${binary:Package}\n' 'lrcget*' | wc -l) -eq 1 ]] || fail "More than one lrcget package is installed."
pass "new .deb installed${previous:+ over the published version} as a single package"

launch "$pkg_dir/deb-launch.log" /usr/bin/LRCGET
[[ -f "$data_dir/db.sqlite3" ]] || fail "Installed app did not open its profile."
if [[ -n "$previous" ]]; then
    [[ -f "$data_dir/upgrade-marker" ]] || fail "Upgrade removed the user's profile data."
    pass "user profile kept across the upgrade"
fi
pass "installed app started"

# License files from the repository, exactly as committed (checked before packaging).
for installed in /usr/share/doc/lrcget/copyright /usr/share/doc/lrcget/THIRD_PARTY_NOTICES.md; do
    [[ -f "$installed" ]] || fail "Debian package is missing $installed."
done
cmp -s LICENSE /usr/share/doc/lrcget/copyright || fail "Installed copyright differs from LICENSE."
cmp -s THIRD_PARTY_NOTICES.md /usr/share/doc/lrcget/THIRD_PARTY_NOTICES.md \
    || fail "Installed notices differ from THIRD_PARTY_NOTICES.md."
resource_notices=$(dpkg -L lrcget | grep '/licenses/THIRD_PARTY_NOTICES.md$' || true)
resource_license=$(dpkg -L lrcget | grep '/licenses/LICENSE$' || true)
[[ -n "$resource_notices" && -n "$resource_license" ]] || fail "Debian package lacks the licenses/ folder."
cmp -s THIRD_PARTY_NOTICES.md "$resource_notices" || fail "$resource_notices differs from THIRD_PARTY_NOTICES.md."
cmp -s LICENSE "$resource_license" || fail "$resource_license differs from LICENSE."
pass "license and notices installed in /usr/share/doc/lrcget and ${resource_notices%/*}"

sudo apt-get remove -y lrcget >/dev/null
if dpkg-query -W -f '${Status}' lrcget 2>/dev/null | grep -q 'install ok installed'; then
    fail "lrcget is still installed after removal."
fi
[[ ! -e /usr/bin/LRCGET ]] || fail "Removal left /usr/bin/LRCGET behind."
[[ ! -e /usr/share/applications/LRCGET.desktop ]] || fail "Removal left the desktop entry behind."
[[ ! -e /usr/share/doc/lrcget/THIRD_PARTY_NOTICES.md ]] || fail "Removal left the notices behind."
pass "apt remove uninstalled cleanly (user profile is kept, as documented)"

rm -rf "$profile"
profile=$(mktemp -d)
data_dir="$profile/data/net.lrclib.lrcget"
chmod +x "$appimage"
# CI runners have no FUSE; the AppImage runtime extracts itself instead.
APPIMAGE_EXTRACT_AND_RUN=1 launch "$pkg_dir/appimage-launch.log" "$appimage"
[[ -f "$data_dir/db.sqlite3" ]] || fail "AppImage did not open its profile."
pass "AppImage started"

# The AppImage carries the complete notices, including its bundled system libraries.
appimage_root=$(mktemp -d)
(cd "$appimage_root" && "$appimage" --appimage-extract >/dev/null)
appimage_notices=$(find "$appimage_root/squashfs-root" -path '*/licenses/THIRD_PARTY_NOTICES.md' | head -1)
appimage_license=$(find "$appimage_root/squashfs-root" -path '*/licenses/LICENSE' | head -1)
[[ -n "$appimage_notices" && -n "$appimage_license" ]] || fail "AppImage lacks the licenses/ folder."
cmp -s "$pkg_dir/THIRD_PARTY_NOTICES.md" "$appimage_notices" \
    || fail "AppImage notices differ from the generated release notices."
grep -q '^## AppImage system libraries' "$appimage_notices" \
    || fail "AppImage notices lack its bundled system libraries."
cmp -s LICENSE "$appimage_license" || fail "AppImage LICENSE differs from LICENSE."
rm -rf "$appimage_root"
pass "AppImage contains LICENSE and complete notices including its system libraries"

echo "All Linux package checks passed."
