# Local packages — 2.2.6+local.8

All current features are from the reviewed local version. GitHub publishing and
creator notifications remain paused. Historical upstream Windows/macOS links
are different releases and do not include Rick's local changes.

## Linux Debian package

`LRCGET_2.2.6+local.8_amd64.deb` and its `.sha256` file are in Downloads. It upgrades
the installed `lrcget` package and retains `net.lrclib.lrcget` data.

## Linux AppImage

`LRCGET_2.2.6+local.8_amd64.AppImage` is a portable x86-64 Linux package. It uses
the same app identifier/data as the Debian install; it does not add a second
Debian package. Run one version at a time. Download/checksum files are kept in
Downloads and the local server's installer backup.

```bash
sha256sum -c LRCGET_2.2.6+local.8_amd64.AppImage.sha256
chmod +x LRCGET_2.2.6+local.8_amd64.AppImage
./LRCGET_2.2.6+local.8_amd64.AppImage
```

If the host lacks FUSE 2, use `./LRCGET_2.2.6+local.8_amd64.AppImage --appimage-extract-and-run`.
This build uses the current Mint 22 / Ubuntu 24.04 toolchain and requires glibc
2.39 or newer. Bundling does not make it compatible with older glibc releases.
Other distributions need a compatible graphical desktop and runtime baseline;
Startup was smoke-tested on this Linux PC using an isolated Xvfb desktop and
temporary profile. The Select directories screen rendered, and schema 21 was
created under that temporary profile. This does not claim testing on other
distributions.

![AppImage startup with temporary profile](screenshots/current/appimage-startup.png)

## Windows 11 MSI

An actual MSI still requires a Windows builder. The supported build instructions
and version/upgrade logic are in [packaging/windows](../packaging/windows/README.md).
`LRCGET_2.2.6+local.8_windows-source.zip` supplies this exact source plus the build
script; it is a source archive, not an installer.

No MSI has been created or Windows smoke-tested yet. Once a Windows builder is
provided, build and verify it before claiming a Windows installer is ready.
