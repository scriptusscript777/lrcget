# Packages and installation — 2.2.7

[Current release](https://github.com/scriptusscript777/lrcget/releases/tag/v2.2.7-windows-beta.1) contains the current Debian, AppImage, Windows MSI beta,
checksums and source archives with documentation/images. These are independent
fork builds. Original upstream releases contain different code.

**Supported systems:** desktop and laptop computers only: Linux x64 (Debian
package or AppImage; Linux Mint 22 / Ubuntu 24.04 or newer) and Windows 10/11 x64
(MSI). The editor needs a window at least 1024 × 768 and is designed for a mouse
and keyboard. Phones, tablets, Chromebooks, macOS and ARM computers are not
supported, and no mobile version exists.

## Verify downloads

Download the selected package and its adjacent `.sha256` file into the same folder.
On Linux run `sha256sum -c PACKAGE.sha256` with the actual filename. On Windows:

```powershell
Get-FileHash .\LRCGET_2.2.7_x64_en-US.msi -Algorithm SHA256
Get-Content .\LRCGET_2.2.7_x64_en-US.msi.sha256
```

Compare the complete hash. Checksums detect changed downloads; they are not digital
publisher signatures. All three packages are currently unsigned.

## Debian amd64

Close the application, then:

```bash
sha256sum -c LRCGET_2.2.7_amd64.deb.sha256
sudo apt install ./LRCGET_2.2.7_amd64.deb
```

For an already installed 2.2.7 maintenance build use
`sudo apt install --reinstall ./LRCGET_2.2.7_amd64.deb`.
It retains package `lrcget`, architecture amd64 and app identity `net.lrclib.lrcget`.
The release upload does not automatically reinstall the local application.
Requires glibc 2.39+, GTK 3 and WebKitGTK 4.1: Mint 22 / Ubuntu 24.04 baseline.
Other Debian-based desktops and ARM are not automatically compatible.
Uninstall the program with `sudo apt remove lrcget`; user data is kept separately.

![Packaged Debian startup with isolated profile](screenshots/current/debian-startup.png)

## AppImage x64

```bash
sha256sum -c LRCGET_2.2.7_amd64.AppImage.sha256
chmod +x LRCGET_2.2.7_amd64.AppImage
./LRCGET_2.2.7_amd64.AppImage
```

Without FUSE 2 run
`./LRCGET_2.2.7_amd64.AppImage --appimage-extract-and-run`.
The current build requires glibc 2.39+ and a compatible Linux x64 graphical/audio
runtime. Bundling does not remove the glibc baseline. AppImage shares the same user
profile as Debian: run one version at a time. Remove the portable executable to
remove the program; it does not automatically erase lyrics/profile data.

![Packaged AppImage startup with isolated profile](screenshots/current/appimage-startup.png)

## Windows x64 MSI beta

Download `LRCGET_2.2.7_x64_en-US.msi`, verify the checksum, close an existing LRCGET
instance, and open the installer. Follow Windows installation prompts. Uninstall
through Settings → Apps → Installed apps → LRCGET. Keep backups before upgrades.
The WebView2 bootstrapper is bundled; a missing runtime may need network access.

Application version is 2.2.7; MSI version is 2.2.7000. Publisher metadata is
Rick Lidgett (LRCGET fork), product is LRCGET, and upgrade GUID remains fixed.
This is unsigned metadata, not a verified digital publisher identity. Windows
may warn because the MSI has no digital publisher signature and cannot verify its
publisher. This new independent fork has limited public recognition and does not
yet qualify for a sponsored signing certificate. That warning alone does not mean
malware. Download only from the official LRCGET fork release and verify the SHA-256 checksum. Windows Server
2025 CI passed installation, repair reinstall, visible app launch and
uninstallation; Microsoft Defender scans of the MSI and installed payload
reported no threats. Scans and checksums reduce risk but cannot guarantee safety
or remove Windows warnings.
Windows 11 interactive audio/editing, optional alignment setup and upgrades from
older Windows installers remain unverified. SmartScreen or Smart App Control can
warn or block unsigned builds. [Windows signing status](code-signing.md) explains
the current limitation.

## Optional automatic alignment

Basic editing, word estimates and manual sync work without AI. Optional sentence/
word audio alignment needs Python 3.10–3.12 with pip/venv and FFmpeg already available.
An explicit setup installs private pinned PyTorch/Whisper/stable-ts packages; models
need separate consent. The AppImage/MSI does not bundle these large packages/models.
See [alignment setup and failure recovery](audio-alignment.md) and
[Windows prerequisites](../packaging/windows/README.md).

## Verification scope

Runtime packages were built from source commit `a7a8e1c`; final documentation/signing
preparation is included in the release source archives. Linux passed 558 frontend,
88 native (two optional fixtures ignored), 18 Python tests, Ruff/scoped ESLint/Cargo
check and three MSI config checks. Debian/AppImage startup used isolated Xvfb profiles.
Windows passed 558 frontend and 86 native tests (two ignored), setup tests/Ruff and
installer/security checks. [Successful Windows run](https://github.com/scriptusscript777/lrcget/actions/runs/38296288986).
These tests do not establish all OS/player/recording compatibility.

[Source builds](build-from-source.md) · [Platform matrix](platform-builds.md) ·
[Illustrated how-tos](how-to.md) · [Developer guide](developer-guide.md)
