# Build from source — 2.2.6+local.8

The source ZIP/tar.gz contains the application, locked dependencies, license,
documentation, screenshots and packaging scripts. Build products, dependencies,
personal music and the live lyrics database are excluded. Source archives do not
contain installers; download the matching installer separately.

## Linux x64

Use a compatible Linux desktop, Node.js 22 and stable Rust with the native target.
Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for
your distribution, plus ALSA development headers for audio. On Mint 22 / Ubuntu
24.04 the native dependencies include:

```bash
sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libasound2-dev ffmpeg
```

From the extracted source directory:

```bash
npm ci
npm test
node --test packaging/windows/msi-config.checks.mjs
cd src-tauri
cargo test --locked
cd ..
npm run tauri -- build --bundles deb,appimage
```

Packages are written beneath `src-tauri/target/release/bundle/`. Build/checksum
them before distribution. Building on a newer distribution can raise the minimum
glibc requirement; the current AppImage requires glibc 2.39+. Tauri's AppImage
build downloads its packaging tools. Network access is also needed to resolve
locked frontend/Rust dependencies on a new machine.

FFmpeg is required by the native audio-preservation integration tests, not by
the installed application. On Windows, the verification workflow installs it
through Chocolatey before running those tests.

For development, use `npm run tauri dev`; `npm run dev` alone serves the frontend
and does not supply the native backend. Never use a real music profile for
destructive automated testing. See the architecture documents and `AGENTS.md`
for repository conventions.

## Windows x64

Follow [Windows packaging](../packaging/windows/README.md). Use native MSVC, the
Windows SDK and WiX through Tauri. The manual GitHub workflow performs Windows
build/tests without automatically publishing a release. Linux MinGW is not a
replacement for the Tauri MSVC target. MSI installation tests are restricted to
disposable Windows runners; do not run them against your personal installation.

## Verification and identity

The app's version is in `src-tauri/Cargo.toml`; `package.json` is the frontend
package and is not the release version. Keep the identifier `net.lrclib.lrcget`,
Linux package `lrcget`, product name and fixed Windows upgrade identity when
making an in-place fork upgrade. Never claim Windows 11 desktop verification
from a Linux or Windows Server build alone.

Original authors and the MIT license remain credited. See [feature index](features.md)
for behavior and [technical history](../LOCAL_CHANGES.md) for the fork's changes.

See the [all-platform build matrix and limitations](platform-builds.md) and
[complete code/maintenance guide](developer-guide.md).
