# Local packages — 2.2.7

All current features are from the reviewed local version. Final GitHub publishing
and creator notification follow validation and the local backup. Historical upstream Windows/macOS links
are different releases and do not include Rick's local changes.

## Linux Debian package

`LRCGET_2.2.7_amd64.deb` and its `.sha256` file are in Downloads.
It upgrades the existing `lrcget` amd64 package and retains `net.lrclib.lrcget`
data. Installed version remains 2.2.6+local.10 because automatic installation requires
administrator authentication. Close the app before upgrading; see the command in the
[2.2.7 review](reviews/2.2.7.md).

AppImage and Windows updates are deferred at Rick's request. The packages below
are older local.9/local.8 artifacts and do not contain the latest Debian word-timing fixes.

## Linux AppImage

`LRCGET_2.2.6+local.9_amd64.AppImage` is a portable x86-64 Linux package. It uses
the same app identifier/data as the Debian install; it does not add a second
Debian package. Run one version at a time. Download/checksum files are kept in
Downloads and the local server's installer backup.

```bash
sha256sum -c LRCGET_2.2.6+local.9_amd64.AppImage.sha256
chmod +x LRCGET_2.2.6+local.9_amd64.AppImage
./LRCGET_2.2.6+local.9_amd64.AppImage
```

If the host lacks FUSE 2, use `./LRCGET_2.2.6+local.9_amd64.AppImage --appimage-extract-and-run`.
This build uses the current Mint 22 / Ubuntu 24.04 toolchain and requires glibc
2.39 or newer. Bundling does not make it compatible with older glibc releases.
Other distributions need a compatible graphical desktop and runtime baseline;
Startup was smoke-tested on this Linux PC using an isolated Xvfb desktop and
temporary profile. The Select directories screen rendered, and schema 21 was
created under that temporary profile. This does not claim testing on other
distributions.

![AppImage startup with temporary profile](screenshots/current/appimage-startup.png)

## Windows 11 MSI

An earlier local.8 native Windows MSI was built by the manual workflow. Backend validation found
a missing FFmpeg test dependency and a Linux-specific test assertion; these are
corrected locally and await Windows revalidation. The supported build instructions
and version/upgrade logic are in [packaging/windows](../packaging/windows/README.md).
`LRCGET_2.2.6+local.9_windows-source.zip` supplies the older local.9 source plus the build
script; it is a source archive, not an installer.

The first MSI is a diagnostic artifact, not a validated release download. Windows
installation checks and native revalidation must pass before distribution. Windows
11 interactive playback and older-version upgrades remain unverified.

See [building from source](build-from-source.md) for Linux/Windows prerequisites,
locked builds, tests and application identity.

See the [all-platform build matrix and limitations](platform-builds.md) and
[complete code/maintenance guide](developer-guide.md).
