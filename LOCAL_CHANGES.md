# Local Changes

Contributed by **Rick Lidgett** (@scriptusscript777).

Local version: `2.2.0+local.4`, based on upstream tag `2.2.0`.

## Library Refresh

- Opening the application performs an incremental library scan.
- Press **F5**, or select **Refresh library (F5)** from the library menu, to
  scan again without reloading the application.
- Held keys and an active scan cannot start overlapping scans.
- Close open dialogs before refreshing; this protects unsaved editor changes.
- Quick content hashes help detect changes even when size and modification time
  are unchanged.
- Missing directories, incomplete traversal or failed file imports prevent
  missing-track cleanup. A later successful scan can retry.

Refresh does not export lyrics or rewrite music or LRC files. Imported lyrics
remain database-owned: refresh is not an automatic overwrite of imported lyrics
from externally edited sidecars. Export and publish remain explicit actions.

## Lyric Export

The editor selects synced LRC export initially and loads the saved embedded
export preference, subject to the experimental embedding setting. Plain-text
export is not selected by default.

MP3 export replaces stale USLT/SYLT language and description variants. It uses
ID3v2.4 UTF-8 text and millisecond synchronized timestamps. Supplied words and
timing, artwork and unrelated metadata are preserved; audio is not re-encoded.
Installation alone does not update existing tracks.

Player support varies. Embedding does not guarantee lyric display in car
stereos, older Windows players or every Jellyfin client, nor does it verify
alignment against the singer.

## Verification

For this local build:

- 156 frontend tests and 34 Rust tests passed.
- Frontend lint passed with no errors and 78 existing warnings.
- Frontend build, release Rust check and Debian package build passed.
- An isolated Linux desktop test verified startup discovery, actual F5 discovery
  of added audio and a second F5 removing a deleted library entry.

The desktop test used temporary fixtures, not user music or lyric files.
Windows and macOS binaries were not built or tested for these local changes.

## Build and Install

Use the project's documented Tauri/Linux build prerequisites, then:

```bash
npm ci --no-audit --no-fund
npm test
npm run lint
npm run tauri build -- --bundles deb -- -j 4
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

Close the existing application before upgrading to preserve unsaved edits.
The Debian package upgrades the same application, not a second copy.

## Upstream Status

[Pull request #420](https://github.com/tranxuanthang/lrcget/pull/420) proposes
the editor/export and stale embedded-lyrics fixes. It does **not** include this
branch's new F5/startup refresh changes or local version metadata. Submission
does not mean the upstream project has merged or released these changes.
