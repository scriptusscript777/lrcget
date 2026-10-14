# Privacy and network behavior

This policy describes Rick Lidgett's enhanced LRCGET fork, version 2.3.0.

## Local work

Library scanning, audio playback, waveform generation, manual timing, estimates,
local saves/exports and unfinished-work recovery run locally. The database stores
selected paths, track metadata, settings and lyric documents in the application
profile. Export/embedding writes only requested destinations. Optional automatic
alignment analyzes audio locally; it does not upload recordings for transcription.
No analytics or advertising service is configured in this fork.

## User-requested network operations

Lyrics search/download sends queries or track title, artist, album and duration
as applicable to the configured LRCLIB-compatible server (default https://lrclib.net).
Publishing sends the chosen lyric document/text/timing and track metadata to that
server and may make them public. Publishing is a separate explicit operation.
Network services can receive the connecting IP, request headers/app version and
submitted data. Avoid search/download/publish if you do not want those requests.
The chosen server controls retention and its own privacy practices; see its
website before sending personal information. This app cannot erase remote records
by deleting a local file.

Optional dependency installation and model downloads require approval. Installation
contacts Python package providers; models use the official Whisper model provider
with checksum verification. Downloads disclose normal connection information to
those providers. Basic editing needs neither these downloads nor an AI engine.
Models and private dependencies are stored in per-user paths, described in the
[alignment guide](audio-alignment.md). MSI installation can contact Microsoft to
obtain WebView2 if the runtime is missing.

## Automatic update check

At each application start LRCGET makes one request to the GitHub API
(`api.github.com`) for the latest release of
[scriptusscript777/lrcget](https://github.com/scriptusscript777/lrcget/releases).
The request contains no library, lyric or account data; GitHub receives normal
connection information such as the IP address and request headers. The reply is
compared with the running version locally. A version chosen with **Skip this
version** is remembered in the application's web profile. Opening **About** makes
the same request. Download links open in your browser only when you choose them.
Source: `src/utils/update-check.js` and `src/composables/update-notifier.js`.

## Retention and removal

Local saved lyrics/database and pending recovery remain until explicitly removed.
A successful save cleans only the current project's completed draft; failed/newer
pending edits stay recoverable. Uninstalling/removing the program does not necessarily
erase user data, exported sidecars or optional engines/model caches. Back them up
before removing them. No automatic upload of the music library or recordings is
part of alignment. Bug reports and screenshots submitted to GitHub are public:
exclude sensitive lyrics/paths, audio, email addresses and credentials.

Contact the fork maintainer through [the fork repository](https://github.com/scriptusscript777/lrcget).
Source network calls are in `src-tauri/src/lrclib/`; optional setup is in
`alignment/` and `src-tauri/src/audio_alignment.rs`.
