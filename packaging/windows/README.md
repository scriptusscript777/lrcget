# Windows 11 x64 MSI build

This folder builds the reviewed local LRCGET source into a Windows MSI. The MSI
has been built on the native Windows runner. The first backend test run exposed
missing FFmpeg and a Linux-specific test assertion; corrected setup awaits
Windows revalidation before distribution. Windows 11 desktop tests remain
required. Tauri’s supported MSI/WiX toolchain requires Windows.

On a Windows 11 x64 PC, install Node.js 22 LTS, Rust (MSVC stable), and Microsoft
Visual Studio Build Tools with **Desktop development with C++** and a Windows
SDK. Enable the Windows VBScript optional feature if WiX reports a VBScript
error. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and
[Windows packaging](https://v2.tauri.app/distribute/windows-installer/).

Extract the source archive, open PowerShell in its folder, and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\packaging\windows\build-msi.ps1
```

The script installs locked frontend dependencies, adds the Windows Rust target,
builds one en-US x64 MSI, and writes the installer plus SHA256 checksum to
Downloads. An optional `-OutputDirectory C:\Packages` changes the destination.
It does not upload anything or install LRCGET on the build PC.

The app remains `net.lrclib.lrcget`, product/binary name LRCGET. The MSI upgrade
GUID matches Tauri's existing LRCGET x64 default and stays fixed. Windows ignores
a fourth version field, so the MSI build version is `patch * 1000 + local`:
app `2.2.6+local.8` becomes MSI `2.2.6008`. Later local revisions advance field
three and therefore support normal upgrades; decimal patch carry is preserved.
The script rejects versions beyond these bounds rather than making invalid MSI
versions. Numeric mapping is tested by `node --test packaging/windows/msi-config.checks.mjs`.

The WebView2 bootstrapper is included; if WebView2 is absent, it downloads the
runtime during installation. This is not a fully offline WebView2 package.

Before distributing the MSI, verify installation and uninstallation on Windows
11, upgrading an existing install without duplicates, and playback, waveform,
word loops, preferences and TXT/LRC/ELRC/ID3 exports. The Linux checks do not
substitute for these Windows checks. Packages are unsigned unless a signing
certificate is configured; no signing certificate is included here.

## Manual Windows build runner

The fork includes `.github/workflows/windows-msi.yml`, triggered manually rather
than on arbitrary pushes. On GitHub, open **Actions → Build and check Windows MSI →
Run workflow**, choose the reviewed release branch, and wait for success. Download
`windows-msi-results`: it contains the MSI, SHA256 and installation logs.
The workflow has read-only repository permissions and does not create a release.

The runner is Windows Server 2025, not a Windows 11 desktop. It runs frontend and
MSI configuration tests, builds with native MSVC/WiX, runs backend tests, and
checks silent installation, same-version reinstall and uninstallation. A failed
run can still upload diagnostic artifacts; only use a package from a successful
run. Desktop playback and an older-version upgrade still need Windows 11 checks.

Linux cross-build prerequisites installed on Rick's PC include `cargo-xwin`,
the Rust `x86_64-pc-windows-msvc` target, and a user-local LLD 18 under
`~/.local/share/lrcget-build-tools/root`. Existing MinGW, wixl, msitools and NSIS
are available, but the supported MSI workflow uses the native Windows toolchain
rather than claiming those Linux tools alone validate this Tauri app.
