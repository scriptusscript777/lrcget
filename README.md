# LRCGET

Utility for mass-downloading LRC synced lyrics for your offline music library.

## Rick Lidgett's Enhanced Build

Editing enhancements and local maintenance by **Rick Lidgett**
([@scriptusscript777](https://github.com/scriptusscript777)).
The original LRCGET project and its authors retain their existing credits.

**Version 2.2.0+local.19** adds waveform and lyric-editing tools, safer exports,
and startup/F5 library refresh. This is an independent fork release, not an
official upstream release.

[Download the Linux amd64 installer](https://github.com/scriptusscript777/lrcget/releases/download/v2.2.0-local.19/LRCGET_2.2.0%2Blocal.19_amd64.deb)
| [Release and checksum](https://github.com/scriptusscript777/lrcget/releases/tag/v2.2.0-local.19)
| [Lyric modification dates](docs/releases/2.2.0-local.19.md)
| [Editing guide](docs/editing-guide.md)
| [Full workflow and feature how-to](docs/editing-guide.md#quick-workflow)
| [Detailed changes](LOCAL_CHANGES.md)

### What's Included

- Zoomable waveform with playback following, paused panning and click-to-seek.
- Double-click a waveform point repeatedly to magnify it for marker editing.
- Wheel/trackpad panning at any playback state, without follow snapping back;
  zoom preserves the visible phrase marker for precise editing.
- Zoom keeps playback follow enabled; pause/play resumes following after manual
  inspection. Placed marker timestamps stay fixed during playback and navigation.
- Selected phrase start/end handles, session undo/redo, 10/25/50/100 ms timing
  steps and phrase looping.
- Entering Synced defaults to the first timed lyric rather than an opening
  blank cue. Existing selections are preserved; untimed rows have no markers.
- Sentence sync/nudge controls update the waveform markers through shared
  timing checks. Follow Lyrics advances both markers; editing/loops pin them.
- Marker preview with explicit Apply Markers / Cancel; confirmed boundaries
  form one undoable edit and stay fixed through playback and zoom.
- Phrase loops audition pending marker previews with zero lead-in/tail by default.
- Direct plain TXT, line-timed TXT and LRC import, with replacement confirmation;
  untimed words become rows you can synchronize manually to the recording.
- Optional word-timing view, collapsed initially, with 1-8x linear zoom,
  playback scrolling and readable highlighting in light/dark themes.
- **Follow Lyrics** advances the word boxes during playback; selecting a line
  pins it for editing. Marker previews and loops keep the selected line fixed.
- Correct a selected word using **Edit word**, F2 or right-click. Enter applies,
  Escape cancels, and Undo restores it; spelling changes preserve timestamps.
- Cleaner word editing without the pink selection bubble; canceled drags do
  not commit timing edits, and keyboard shortcuts respect the active tool.
- Synced LRC export selected by default, optional embedded lyrics, and safer
  sidecar/audio exports with rolling backups. Saving and publishing are explicit.
- Incremental library scanning on opening and F5 refresh without reloading.

### Install This Build

Download the installer and checksum from the release, close LRCGET, then run:

```bash
sha256sum -c LRCGET_2.2.0+local.19_amd64.deb.sha256
sudo apt install ./LRCGET_2.2.0+local.19_amd64.deb
```

The unsigned Debian package upgrades the existing app, not a second copy.
Only Linux amd64 is built/tested for this fork release; Windows/macOS installers
below belong to upstream and do not include these enhancements.
No additional WAV conversion, Whisper or Demucs installation is needed.

### Current Interface

The main phrase editor stays uncluttered; **Word timing** opens the optional
individual-word tools. Pending marker edits show **Apply Markers** and **Cancel**;
the lyric-row timestamps stay unchanged until you apply the pair.

![Follow Lyrics advances the word boxes during playback](docs/screenshots/follow-lyrics-light.png)

![Correct one word without changing its timestamps](docs/screenshots/edit-word-light.png)

![Light theme: pending marker pair with Apply and Cancel](docs/screenshots/marker-preview-light.png)

![Latest build: double-click waveform zoom and marker preview](docs/screenshots/point-zoom-light.png)

![Light theme: phrase editor with word timing collapsed](docs/screenshots/editor-default-light.png)

<details>
<summary>Dark theme and expanded word-timing tools</summary>

![Dark theme: Follow Lyrics](docs/screenshots/follow-lyrics-dark.png)

![Dark theme: direct word correction](docs/screenshots/edit-word-dark.png)

![Dark theme: pending marker pair with Apply and Cancel](docs/screenshots/marker-preview-dark.png)

![Latest build: double-click waveform zoom in dark theme](docs/screenshots/point-zoom-dark.png)

![Latest export menu: LRC, TXT and embedding](docs/screenshots/export-options-dark.png)

![Dark theme: phrase editor with word timing collapsed](docs/screenshots/editor-default-dark.png)

![Light theme: expanded word timing and phrase markers](docs/screenshots/editor-follow-light.png)

![Dark theme: expanded word timing and phrase markers](docs/screenshots/editor-follow-dark.png)

![Zoomed word-timing view](docs/screenshots/word-timing-zoom.png)

![Light theme: zoomed phrase end with manual scrolling](docs/screenshots/waveform-navigation-light.png)

![Dark theme: zoomed phrase end with manual scrolling](docs/screenshots/waveform-navigation-dark.png)

</details>

Screenshots use temporary fixture lyrics and mocked waveform data, not personal
music. These tools aid manual editing; they do not guarantee singer alignment
or lyric display in every player. 366 frontend and 50 Rust tests passed, plus
browser and isolated native Linux checks; existing lint/compiler warnings remain.

## Original Project

LRCGET will scan every files in your chosen directory for music files, then and try to download lyrics to a LRC files having the same name and save them to the same directory as your music files.

LRCGET is the official client of [LRCLIB](https://lrclib.net) service.

## Upstream Downloads

The historical links below are upstream v2.1.0 downloads, not Rick Lidgett's
enhanced build. Visit the [upstream release page](https://github.com/tranxuanthang/lrcget/releases)
for upstream versions and other platforms.

### Windows

EXE installer (recommended): [LRCGET_2.1.0_x64-setup.exe](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET_2.1.0_x64-setup.exe)

MSI installer: [LRCGET_2.1.0_x64_en-US.msi](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET_2.1.0_x64_en-US.msi)

### Linux

Flatpak build (recommended, for most Linux distros):

<a href='https://flathub.org/en/apps/net.lrclib.lrcget'><img width='120' alt='Get LRCGET on Flathub' src='https://flathub.org/api/badge?locale=en'/></a>

Deb packages (for Ubuntu 24.04+ and Linux Mint 22+): [LRCGET_2.1.0_amd64.deb](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET_2.1.0_amd64.deb)

RPM packages (for Fedora, openSUSE, etc.): [LRCGET-2.1.0-1.x86_64.rpm](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET-2.1.0-1.x86_64.rpm)

AppImage (for most Linux distros): [LRCGET_2.1.0_amd64.AppImage](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET_2.1.0_amd64.AppImage)

### macOS

Mac x64 (Intel): [LRCGET_2.1.0_x64.dmg](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET_2.1.0_x64.dmg)

Mac Apple Silicon: [LRCGET_2.1.0_aarch64.dmg](https://github.com/tranxuanthang/lrcget/releases/download/2.1.0/LRCGET_2.1.0_aarch64.dmg)

## Historical Upstream Screenshots

These images show an older upstream interface, not this fork's current editor.

<details>
<summary>View original upstream screenshots</summary>

![01.png](https://raw.githubusercontent.com/tranxuanthang/lrcget/9e0578bd9411fcc024a56d2f1108701751c5ec3a/screenshots/01.png)

![02.png](https://raw.githubusercontent.com/tranxuanthang/lrcget/9e0578bd9411fcc024a56d2f1108701751c5ec3a/screenshots/02.png)

![03.png](https://raw.githubusercontent.com/tranxuanthang/lrcget/9e0578bd9411fcc024a56d2f1108701751c5ec3a/screenshots/03.png)

![04.png](https://raw.githubusercontent.com/tranxuanthang/lrcget/9e0578bd9411fcc024a56d2f1108701751c5ec3a/screenshots/04.png)

</details>

## Donation

Toss a coin to your developer?

**GitHub Sponsors (Recommended - 100% of your support goes to the developer):**

https://github.com/sponsors/tranxuanthang

**Buy Me a Coffee:**

https://www.buymeacoffee.com/thangtran

**Paypal:**

https://paypal.me/tranxuanthang98

**Monero (XMR):**

```
43ZN5qDdGQhPGthFnngD8rjCHYLsEFBcyJjDC1GPZzVxWSfT8R48QCLNGyy6Z9LvatF5j8kSgv23DgJpixJg8bnmMnKm3b7
```

**Litecoin (LTC):**

```
ltc1q7texq5qsp59gclqlwf6asrqmhm98gruvz94a48
```

## Troubleshooting

**Audio cannot be played in Linux (Ubuntu and other distros)**

Try to install `pipewire-alsa` package. For example, in Ubuntu or Debian-based distros:

```
sudo apt install pipewire-alsa
```

**App won't open in Windows 10/11**

If you are using Windows 10 LTSC, or have tried running some scripts to debloat Windows 10 (which will uninstall Microsoft Edge and its webview component), you might have issues as LRCGET depends on WebView2. Reinstalling Microsoft Edge might fix the problem (see issue https://github.com/tranxuanthang/lrcget/issues/45).

**Scrollbar is invisible in Linux (KDE Plasma 5/6)**

The exact cause is still unknown, but it can be fixed by going to System Settings > Appearance > Global Theme > Application Style > Configure GNOME/GTK Application Style... > Change to something other than breeze (Awaita or Default) > Apply (see comment https://github.com/tranxuanthang/lrcget/issues/44#issuecomment-1962998268)

## Contact

If you prefer to contact by email:

[hoangtudevops@protonmail.com](mailto:hoangtudevops@protonmail.com)

## Development

LRCGET is made with [Tauri](https://tauri.app).

To start developing the application, you need to do the [prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) steps according to your operating system.

For example, you need the following components to start the development in Windows:

- Microsoft Visual Studio C++ Build Tools
- Rust 1.81.0 or higher
- NodeJS v16.18.0 or higher

Start the development window with the following command:

```shell
cd lrcget
npm install
npm run tauri dev
```

## Building

Start the build process with the following command:

```shell
cd lrcget
npm install
npm run tauri build
```

Your built binaries are located at:

```
./src-tauri/target/release/
```

For more detailed instruction, follow the [building guide](https://tauri.app/v1/guides/building/) to build the application according to your OS platform.
