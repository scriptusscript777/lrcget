# Changelog

All notable changes to Rick Lidgett's enhanced LRCGET fork. Each version links
to its detailed, illustrated release notes in [docs/releases](docs/releases/).
The fork is based on upstream [LRCGET](https://github.com/tranxuanthang/lrcget)
2.2.0; for upstream history see its [releases](https://github.com/tranxuanthang/lrcget/releases).

Version numbers follow the main version (2.2.7, 2.2.8 … 2.2.9, then 2.3.0).
Maintenance builds that keep the same version are listed under that version.
When a release is published, add its entry here and its notes in `docs/releases/`.

## 2.3.0

[Release notes](docs/releases/2.3.0.md) · [Download](https://github.com/scriptusscript777/lrcget/releases/tag/v2.3.0)

### Added

- Karaoke display for tracks with valid timed `.lrc` or `.elrc` sidecars. The
  full-screen view follows playback, can switch between sentence and word timing
  when both formats exist, and uses the main player controls.
- Karaoke shuffle and repeat skip tracks without a usable timed lyric sidecar.
- Entering karaoke for the track already playing preserves its playback position
  and play/pause state.
- Illustrated karaoke instructions and current light/dark screenshots.

## 2.2.7

[Release notes](docs/releases/2.2.7.md) · [Download](https://github.com/scriptusscript777/lrcget/releases/tag/v2.2.7-windows-beta.1)

### Added

- Startup update alert: checks this fork's latest GitHub release once at each start
  and offers only the installer that matches the computer (`.deb`, AppImage or `.msi`,
  x64) with install steps. LRCGET never runs an installer itself.
- Windows x64 MSI and Linux AppImage alongside the Debian package, built and
  install/upgrade/uninstall-tested on GitHub Actions.
- Word Sync confirmation: Sync Word turns gray after a manual timing is confirmed
  until another adjustment. Separate Pause/Resume beside word-lane Play.
- Automatic unfinished-work recovery, Resume editing and safe draft cleanup.
- Reset words for one sentence; Loop sentence beside Loop word; native audio-engine
  loops with about 10 ms cursor updates.
- ELRC save offers to fill missing word starts, keeping manual times and gaps.
- Startup/F5 recognize matching `.elrc` before `.lrc` and `.txt`.
- Optional local audio alignment (**Align sentences**, **Align words**) with
  consented Whisper/stable-ts setup; basic editing needs no AI.
- Illustrated how-tos for every main task, update troubleshooting and a
  supported-systems note (desktop Linux x64 and Windows 10/11 x64 only).

### Changed

- About now credits original creator tranxuanthang and Rick Lidgett as the
  maintainer/modifier of this independent fork. About and repository funding
  links point only to the original creator's GitHub Sponsors page; the fork does
  not request donations.

- Follow Lyrics also works in sentence (LRC) mode: the selected sentence and its
  waveform markers follow playback. Sync, clicks and edits hold the selection only
  until the next Play or Resume; opening or closing a word view also resumes it.

- About checks this fork's releases instead of the original project's.
- Master reset was removed; Reset words affects one sentence with Undo.

### Removed

- Inherited upstream publish and WinGet workflows. Releases are built and tested
  by `windows-msi.yml`, `linux-packages.yml` and `release.yml`.

## 2.2.6

- **+local.10** — Word boxes edit timing only; safer drags, Sync and exports. [Notes](docs/releases/2.2.6-local.10.md)
- **+local.9** — Server word timing and Enhanced LRC import. [Notes](docs/releases/2.2.6-local.9.md)
- **+local.8** — Loop word with precise timing steps; AppImage and Windows MSI build tooling. [Notes](docs/releases/2.2.6-local.8.md)
- **+local.7** — Save remembers the Word-timed lyrics (.elrc) choice. [Notes](docs/releases/2.2.6-local.7.md)
- **+local.6** — Word preview and native MP3 embedding (USLT, SYLT, optional TXXX). [Notes](docs/releases/2.2.6-local.6.md)
- **+local.5** — Optional Enhanced LRC (`.elrc`) export. [Notes](docs/releases/2.2.6-local.5.md)
- **+local.4** — Marker color indicator on the original sentence Sync button. [Notes](docs/releases/2.2.6-local.4.md)
- **+local.3** — Pending marker controls. [Notes](docs/releases/2.2.6-local.3.md)
- **+local.2** — Saved overlap-protection setting. [Notes](docs/releases/2.2.6-local.2.md)
- **+local.1** — Local marker and LRC export update. [Notes](docs/releases/2.2.6-local.1.md)

## 2.2.5

- **+local.1** — Loop stays on while navigating within the recording. [Notes](docs/releases/2.2.5-local.1.md)

## 2.2.4

- **+local.1** — Optional hover help, off by default. [Notes](docs/releases/2.2.4-local.1.md)

## 2.2.3

- **+local.1** — Hover help closes after two seconds. [Notes](docs/releases/2.2.3-local.1.md)

## 2.2.2

- **+local.1** — Marker overlap warnings and inferred-end looping. [Notes](docs/releases/2.2.2-local.1.md)

## 2.2.1

- **+local.1** — Persistent Start/End marker times, precise times and clear playback clocks. [Notes](docs/releases/2.2.1-local.1.md)

## 2.2.0 (first fork builds)

- **+local.22** — Clicking the waveform starts playback. [Notes](docs/releases/2.2.0-local.22.md)
- **+local.21** — Automatic external LRC detection. [Notes](docs/releases/2.2.0-local.21.md)
- **+local.20** — Playback and save corrections. [Notes](docs/releases/2.2.0-local.20.md)
- **+local.19** — Lyric modification dates. [Notes](docs/releases/2.2.0-local.19.md)
- **+local.18** — Native hover descriptions. [Notes](docs/releases/2.2.0-local.18.md)
- **+local.17** — Marker help and precise playback display. [Notes](docs/releases/2.2.0-local.17.md)
- **+local.16** — Continuous playback and visible play controls. [Notes](docs/releases/2.2.0-local.16.md)
- **+local.15** — Safe sentence markers and untimed text. [Notes](docs/releases/2.2.0-local.15.md)
- **+local.14** — Lyric following and word editing. [Notes](docs/releases/2.2.0-local.14.md)
- **+local.13** — Loop safety review and complete feature guide. [Notes](docs/releases/2.2.0-local.13.md)
- **+local.12** — Marker preview loops and complete editing guide. [Notes](docs/releases/2.2.0-local.12.md)
- **+local.11** — Precision point zoom. [Notes](docs/releases/2.2.0-local.11.md)
- **+local.10** — Marker preview and lyric file import. [Notes](docs/releases/2.2.0-local.10.md)
- **+local.9** — Precise waveform zoom and scrolling. [Notes](docs/releases/2.2.0-local.9.md)
- **+local.8** — Playback follow and word timing. [Notes](docs/releases/2.2.0-local.8.md)
- **+local.7** — Waveform editing aid. [Notes](docs/releases/2.2.0-local.7.md)
- **+local.6** — First editing enhancements on top of upstream 2.2.0. [Notes](docs/releases/2.2.0-local.6.md)
