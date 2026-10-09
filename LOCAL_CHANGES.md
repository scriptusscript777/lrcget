# Local Changes

Editing developer and contributor: **Rick Lidgett** (@scriptusscript777).
These modifications build on the original LRCGET project; upstream credits
and the existing license remain unchanged.

Local version: `2.2.0+local.12`, based on upstream tag `2.2.0`.

## Marker Preview Loops (.12)

Phrase loops use released/nudged marker previews before Apply; Cancel restores
committed bounds and stale previews cannot affect other lines. Lead-in/tail
default to zero for exact marker loops, with optional context still available.
Playback outside the current loop seeks back inside it. Editing developer:
Rick Lidgett. The feature how-to and light/dark screenshots are updated.

## Point Zoom (.11)

The current editing guide includes library refresh, source import, plain/synced
mode transitions, line and word editing, configurable shortcuts, loops,
point zoom, marker confirmation, saving/export/publishing, backups and
diagnostics. Point-zoom and export screenshots were refreshed in both themes.

Double-click the waveform to halve the visible time span around that point;
repeat for finer inspection, bounded by the existing minimum span. Single-click
seeking remains available. Inspection holds the view like manual panning,
without modifying markers or pending previews. Pause/play resumes following
unless the user explicitly disabled it. Existing Preview/Apply marker editing,
zoom-out and Fit controls remain unchanged. Editing developer: Rick Lidgett.

## Playback Follow Correction (.10)

Zooming a selected phrase no longer disables playback following. The moving
playhead stays visible as playback crosses zoomed window boundaries. Manual
pan/wheel inspection still suspends follow to avoid snap-back; pause/play
resumes it. An explicit follow-toggle-off choice stays off across pause/play.
Zoom, scrolling and playback never modify marker timestamps. Committed marker
edits remain fixed in the lyric document even while they scroll out of view.
Drag mapping stays frozen until release/cancel, then following can resume.

## Marker Preview and Confirmation (.10)

Dragging or nudging waveform markers now stages a local preview, rather than
immediately editing the lyric document. Apply Markers confirms both timestamps
together as one undoable edit; Cancel discards the preview. Switching the
selected phrase, changing its document/source or closing the editor discards
unconfirmed marker previews. Marker previews remain at fixed recording times
through playback, scrolling and zoom. Save/export still operates on confirmed
document timings; a marker preview must be applied before it can be saved.
Start changes translate word timings once; ends cannot truncate timed words.

## File Import (.10)

Import lyrics file accepts plain TXT and line-timed TXT/LRC using the existing
LRC parser library. Plain text produces untimed rows for manual synchronization.
Timed text preserves timestamps, repeated occurrences and blank clear cues;
rows are ordered chronologically. Existing words/timings require replacement
confirmation. Empty/malformed files and unsupported enhanced word tags/nonzero
offset headers are rejected rather than silently dropping words or ignoring times.
File import reads into the editor only; saving/exporting remains explicit.

## Zoom Navigation Fix (.9)

Manual waveform panning, including wheel/trackpad scrolling over the waveform,
turns off playback following so the view does not snap away from the edit.
The existing follow toggle resumes automatic paging. Zooming with a selected
phrase prioritizes a visible marker unless a visible playhead is inside that phrase;
in .9 it also turned off following (corrected in .10). Wheel scrolling is bounded to the full recording,
supports pixel/line/page units and leaves browser-modified wheel gestures alone.
Navigation is ignored during a marker drag to preserve its frozen geometry.
No lyric timestamps, audio files or export preferences change when navigating.

The timing-step dropdown and loop-context inputs use shared light/dark control
styles and a matching native color scheme so their values/options stay readable.

## Editing Tools

- The Synced tab has undo/redo buttons and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  shortcuts. Ctrl/Cmd+Y also redoes. Inline text fields retain their native undo.
- Up to 100 synchronized-document changes are kept for the current editor
  session. Undo includes text, deletion, blank cues, line and word timing.
  History is not crash recovery and does not survive closing the editor.
- Select a timing step of 10, 25, 50 or 100 ms. Line nudges move the line and its
  word/end timestamps together; end-only controls remain independent.
- Select a timed phrase and enable the repeat button to loop it. Lead-in and
  tail context are adjustable from 0 to 5 seconds. Changing the selected line
  or switching to Plain turns looping off. Pausing pauses playback.
- A save no longer discards edits made while the backend is writing.

Fine timing controls are editing tools, not automatic proof of singer alignment.
Phrase looping follows playback updates and is not a sample-accurate audio loop.

## Waveform

The lyrics editor adds a compact waveform with a time ruler, playback cursor,
zoom/fit controls and horizontal panning when zoomed. Click or use the focused
waveform's arrow keys to seek. It uses the existing player and follows playback
speed and phrase looping. With playback following enabled, the zoomed window
pages forward/backward to keep the cursor visible; manual panning is available
while paused or with following disabled. Progress within a page only updates
the cursor, not the cached peak data.

Selected synced phrases have draggable start/end markers. A completed drag is
one undoable document change; canceled drags do not edit the document. Marker
controls also use the selected timing step with the arrow keys. Seeking alone
does not edit lyrics, and saving/exporting remains explicit.
The selected-word pink bubble is removed; native word tooltips and the existing
word-divider editing controls remain.
Word timing is an optional collapsible view so normal phrase editing stays
uncluttered. Its active-word styling supports both light and dark themes.
Its bounded zoom widens the complete timeline (preserving linear time mapping)
for selecting short words. Playback can scroll the active region into view;
paused inspection and divider drags are not interrupted by following.

Peak extraction uses the existing Symphonia decoder on a background worker.
There is no second player, browser audio decoder, external executable or saved
WAV file. A first preview requires one read/decode pass; later openings reuse
cached peaks. Zoom, seeking, playback and theme changes do not decode again.
Cache invalidation uses canonical file path, size and modification time; tag
changes can also rebuild the preview. Changes that preserve both size and
modification time are not detected. Up to 128 cached previews are retained in
the application's cache directory, with at most 24,000 peaks per preview.
Audio up to four hours is supported. Missing/unsupported audio or unavailable
cache storage never prevents lyric editing or the normal player controls.

The waveform represents the whole mix, not just the singer. It is a manual
editing aid, not vocal detection or proof of synchronization. Peak bins may be
coarser than the editor's 10 ms adjustment step for long recordings.

## Safe Exports

TXT and LRC exports now coexist; neither deletes the other format. Sidecars and
embedded-audio exports are staged in the destination directory, checked, then
replaced using an atomic rename. Existing destinations get one rolling backup
named `<filename>.lrcget.bak` containing the previous version. Failed staging
does not replace the original. Symlink/non-file and read-only destinations are
rejected. A size/modification-time change detected during staging aborts export
instead of replacing an external edit; this is not a cross-application file lock.

Embedded export stages a complete audio copy and retains a complete previous
audio backup. Allow space for both additional copies. Backups are local only;
they are not uploaded or automatically deleted. Restore a backup with the app
closed, keeping another copy of the current file first.

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

- 235 frontend tests and 45 Rust tests passed. New tests cover synced history,
  configurable steps, looping, in-flight saves and export submission handling.
- Rust tests cover failed staging, rolling backups, sidecar coexistence,
  symlink refusal and failed embedding preserving the source.
- Waveform tests cover peak compaction, stereo magnitudes, cache reuse/repair,
  source changes, stale responses, viewport bounds, keyboard/ARIA controls,
  loading/error/retry states and canvas cleanup. A separately run generated
  WAV/MP3/FLAC/Ogg integration test matches existing-player duration, reuses
  caches and confirms unchanged source bytes.
- Frontend lint passed with no errors and 74 existing warnings.
- Frontend build, release Rust check and Debian package build passed.
- An isolated Linux desktop test verified startup discovery, actual F5 discovery
  of added audio and a second F5 removing a deleted library entry. Opening the
  native editor also generated and rendered the waveform from fixture audio.
- Browser interaction tests with a mocked backend verified the editor's timing
  step, undo/redo buttons and shortcuts, and looping commands. Screenshots were
  inspected at 1280x900 and 900x700. This is not an acoustic timing test.
- Browser waveform checks cover visible canvas pixels, paused/keyboard seeking,
  zoom/pan/fit, playback-speed cursor updates and one peak-data request across
  those interactions. The waveform strip also fits a 400px test container.
- Playback-follow and optional word-view checks cover zoomed forward/backward
  paging, source isolation, paused cursors, disclosure, linear word-lane zoom,
  active-region scrolling, cancellation, pointer identity and keyboard undo.
  Active-word contrast and standalone word-lane layout were checked in both
  themes; the full editor was checked at its supported 1024px minimum width.
- Light/dark browser checks verify readable dropdown options and numeric fields
  at a minimum 4.5:1 computed text contrast, with matching native color schemes.

The startup/F5 desktop test used temporary fixtures, not user music or lyric files.
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
branch's F5/startup refresh, safe export, editor tools or local version metadata. Submission
does not mean the upstream project has merged or released these changes.
