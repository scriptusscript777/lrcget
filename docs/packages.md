# Packages and installation — 2.3.0

[Current release](https://github.com/scriptusscript777/lrcget/releases/tag/v2.3.0) is built from the reviewed source and contains the Debian package, AppImage, Windows MSI, checksums and source archives with documentation and images. These are independent
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
Get-FileHash .\LRCGET_2.3.0_x64_en-US.msi -Algorithm SHA256
Get-Content .\LRCGET_2.3.0_x64_en-US.msi.sha256
```

Compare the complete hash. Checksums detect changed downloads; they are not digital
publisher signatures. The Windows MSI has no Authenticode signature; the DEB and
AppImage do not use Windows publisher verification. Windows warning guidance below
applies to the MSI.

## Debian amd64

Close the application, then:

```bash
sha256sum -c LRCGET_2.3.0_amd64.deb.sha256
sudo apt install ./LRCGET_2.3.0_amd64.deb
```

For an already installed 2.3.0 maintenance build use
`sudo apt install --reinstall ./LRCGET_2.3.0_amd64.deb`.
It retains package `lrcget`, architecture amd64 and app identity `net.lrclib.lrcget`.
The release upload does not automatically reinstall the local application.
Requires glibc 2.39+, GTK 3 and WebKitGTK 4.1: Mint 22 / Ubuntu 24.04 baseline.
Other Debian-based desktops and ARM are not automatically compatible.
Uninstall the program with `sudo apt remove lrcget`; user data is kept separately.

![Packaged Debian startup with isolated profile](screenshots/current/debian-startup.png)

## AppImage x64

```bash
sha256sum -c LRCGET_2.3.0_amd64.AppImage.sha256
chmod +x LRCGET_2.3.0_amd64.AppImage
./LRCGET_2.3.0_amd64.AppImage
```

Without FUSE 2 run
`./LRCGET_2.3.0_amd64.AppImage --appimage-extract-and-run`.
The current build requires glibc 2.39+ and a compatible Linux x64 graphical/audio
runtime. Bundling does not remove the glibc baseline. AppImage shares the same user
profile as Debian: run one version at a time. Remove the portable executable to
remove the program; it does not automatically erase lyrics/profile data.

![Packaged AppImage startup with isolated profile](screenshots/current/appimage-startup.png)

## Windows x64 MSI

Download `LRCGET_2.3.0_x64_en-US.msi`, verify the checksum, close an existing LRCGET
instance, and open the installer. Follow Windows installation prompts. Uninstall
through Settings → Apps → Installed apps → LRCGET. Keep backups before upgrades.
The WebView2 bootstrapper is bundled; a missing runtime may need network access.

Application version is 2.3.0; MSI version is 2.3.0000. Publisher metadata is
Rick Lidgett (LRCGET fork), product is LRCGET, and upgrade GUID remains fixed.
This is unsigned metadata, not a verified digital publisher identity. Windows
may warn because the MSI has no digital publisher signature and cannot verify its
publisher. This new independent fork has limited public recognition and does not
yet qualify for a sponsored signing certificate. That warning alone does not mean
malware. Download only from the official LRCGET fork release and verify the
SHA-256 checksum. The 2.3.0 Windows install, repair/reinstall, launch, scan and
uninstall results will be linked here after the final release workflow passes.
Scans and checksums reduce risk but cannot guarantee safety or remove Windows
warnings.
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

The separate package workflows passed on commit `e30ecff` on 2026-10-14. Linux
passed 616 frontend tests, 97 native tests (3 ignored), 18 Python alignment tests
and Ruff. The DEB/AppImage build, AppImage library source/license check, Debian
upgrade, isolated launch, package/license inspection, uninstall and AppImage
checks passed. [Linux workflow](https://github.com/scriptusscript777/lrcget/actions/runs/38621778742).

Windows passed 616 frontend tests, 95 native tests (3 ignored), 18 Python
alignment tests and Ruff. The MSI build, published-installer upgrade, identity
and checksum checks, Defender scans, install, repair/reinstall, launch, license
inspection and uninstall passed. [Windows workflow](https://github.com/scriptusscript777/lrcget/actions/runs/38621779247).

The Release installers workflow reruns both package workflows on the final
documentation-complete commit before publishing the 2.3.0 files.

The illustrated guides and current light/dark UI screenshots are included in the
documentation archive. These checks do not establish all OS, player or
recording-device compatibility. The MSI is unsigned and may still show Windows
publisher or SmartScreen warnings.

[Source builds](build-from-source.md) · [Platform matrix](platform-builds.md) ·
[Illustrated how-tos](how-to.md) · [Developer guide](developer-guide.md)
