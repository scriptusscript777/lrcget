## 2.2.6+local.10 — Debian word timing repairs

Timing-only word boxes; wording is edited through sentence rows. Released drags
keep sentence markers fixed and select their own divider. Sync preserves the next
accepted manual adjustment, rejects unsafe playback without collapsing neighbors,
and advances only after accepted updates. Drag refresh/click, active shortcuts,
Delete, numeric edits and document range validation are guarded. Export freezes
target identity across asynchronous Save; malformed standard-LRC seconds fail
before import replacement. Debian-only update; AppImage/Windows remain deferred.

## Additional 2.2.6+local.8 packages

Linux AppImage plus Windows 11 MSI build tooling/source archive. MSI build awaits
a Windows builder; no Windows installer or Windows validation is claimed.
Upgrade identity and numeric MSI version mapping preserve future local upgrades.

## 2.2.6+local.8

Exclusive phrase/word loops, selected-word precision controls, saved gap handling,
selected target restoration, safe Sync behavior and sticky zoomed word labels.
Fixed Reset submissions; updated tests and illustrated guides.

## 2.2.6+local.7

ELRC is controlled directly by Save’s Word-timed lyrics checkbox; its remembered
choice defaults off. Removed the duplicate Configuration default switch.

# Local Changes

Editing developer and contributor: **Rick Lidgett** (@scriptusscript777).
These modifications build on the original LRCGET project; upstream credits
and the existing license remain unchanged.

Local version: `2.2.6+local.6`, based on upstream tag `2.2.0`.

## MP3 format verification and word preview (2.2.6+local.6)

- Remove experimental/corruption wording from Configuration; keep saved embedding opt-in.
- Native ID3v2.4 embedding preserves comment languages, custom fields and artwork,
  creates missing tags, validates lyric frames before atomic replacement, and rejects NUL text.
- SYLT supports line/word milliseconds, leading word/line whitespace and clear cues.
- Selecting ELRC + Embed adds a distinct ELRC USLT and TXXX LYRICS_ELRC while retaining
  normal USLT. Word timing is used by SYLT; missing timing falls back to line timing.
- Read-only Word preview works with boxes collapsed, Follow Lyrics, gaps, Loop and
  zoom; generated estimates are labeled and never silently saved.
- Actual Kiss Me Goodbye/Joseph originals inspected; writes tested on copies with
  independent Mutagen and compressed-audio hashes. Originals remain unchanged.
- GitHub publication/creator notification remain paused; refresh local install/backups.

## Optional Enhanced LRC export (2.2.6+local.5)

- Export TXT, standard LRC and Enhanced LRC together without deleting another format.
- ELRC is optional/off by default; Configuration/Common saves the default. Editor,
  batch and Download auto-export offer the format. Queues capture submitted choices.
- Preserve saved millisecond word starts, known ends, word silence and sentence gap
  cues. Mixed line-only rows stay line-timed. Missing word timing skips ELRC;
  invalid timing fails only ELRC, preserving existing files and other exports.
- Migration 21 preserves existing settings and documents; preference writes are
  transactional. Sidecars use staged verified replacement and existing safeguards.
- Enhanced import and Jellyfin web karaoke display remain outside this export update.
- GitHub publication remains paused. Update local install and both local Git backups.

## Saved Overlap Setting (2.2.6+local.2)

The overlap checkbox moved to Configuration → Common to avoid accidental clicks
near Loop. Synced shows read-only **Overlap prevention: On/Off** in its previous
location. The saved preference defaults on and persists across editor sessions
and restarts. Cancel, failed saves and failed configuration loads cannot change
it. Schema migration 20 preserves lyrics and existing preferences. Docs and
light/dark screenshots cover both Settings and editor status.

## Marker Confirmation and Standard LRC Gaps (2.2.6)

Moving a waveform marker previews sentence highlighting using the proposed
bounds and normal colors. The existing Sync Sentence Start/End actions confirm
the corresponding moved boundary, or use playback when that boundary is unchanged.
Cancel restores the most recently confirmed pair. Untimed text has provisional
markers and must confirm Start before End. Optional session overlap protection
is on by default; intentional overlap requires opting out.

Standard LRC export adds blank timestamped cues for confirmed gaps of at least
250 ms and confirmed final ends. It avoids duplicate cues and clearing active
overlapping lyrics. Untimed rows stay internal/plain, without invented start
timestamps. Exact ends remain in saved lyricsfile data. Reimported LRC shows its
actual blank timed rows; tiny omitted gaps cannot recover their exact end from
LRC alone. GitHub publication is paused at Rick’s request.

## Documentation

The [documentation index](docs/README.md), [illustrated overview](docs/app-overview.md)
and [practical how-tos](docs/how-to.md) cover the app and these modifications.
The [editing reference](docs/editing-guide.md) details shortcuts and behavior.
This documentation-only update keeps the executable version at .20; no new
installer or changed audio/lyric files are required.

Current guide images were recaptured from .20 in both themes and are stored
under `docs/screenshots/current/`. Historical images remain for old release
notes. Untimed-text examples show the state before timestamps are assigned.

## Playback and Save Corrections (.20)

Rick Lidgett corrected double-click zoom turning off waveform Follow. Both zoom
methods retain the user's Follow choice, including with Loop off. Following
also reacts to viewport changes immediately, not only the next player event.
Manual panning still holds an inspection region; explicit Follow-off stays off.
Markers and pending timestamp previews remain unchanged by zoom/playback.

Startup scans now retain track IDs and saved lyric dates when embedding changes
an audio file's fingerprint at the same path. Existing matching orphaned save
dates can be restored without replacing any lyric content. Ambiguous matches
and recordings outside the duration tolerance are not repaired automatically.

Exports retain staged validation and atomic replacement but no longer keep
rolling backups after a successful save. Only the exact destination's old
`.lrcget.bak` is removed; unrelated backups and user TXT/LRC files are untouched.

## Lyric Modification Column (.19)

Rick Lidgett added a **Modified** column after Lyrics and before the action
buttons in track, album and artist lists. A green badge accompanies the last
explicit lyric-save date and time, displayed in the PC's local timezone.
SQLite stores UTC and keeps this record through restart and F5/rescans.
Imports/scans do not mark songs modified. Unknown historical dates show `--`.
Removing the audio from its directory removes its library row on refresh;
existing orphan lyric preservation remains unchanged.

Lyric content and edit time save in one transaction. A failed save rolls back
both. Virtual rows discard stale async loads and clean up event listeners on
unmount. Shared grid columns align headers and rows in normal/maximized windows;
narrow windows scroll rather than overlapping dates/buttons.

## Native Hover Descriptions (.18)

Rick Lidgett corrected editor help popovers that could remain open after a
click focused a control. Editing descriptions now use native title text,
including Save and Debug, with no popup DOM, focus triggers or overlay layer.
The browser controls the hover delay; a fixed two-second delay is not promised.
Interactive menus are unchanged. Browser regressions cover both themes,
updated descriptions and subsequent editing clicks.

## Marker Visibility and Editing Help (.17)

Rick Lidgett replaced wide double marker borders with single vertical guides.
Start and end use separate upper/lower hit areas, so close timestamps cannot
hide or intercept the other handle. Resyncing an off-screen start reveals it
without discarding zoom. Editing controls use the existing FloatingVue help
system with compact, wrapping hover/focus popovers and plain-text content.
The waveform displays the playhead position to milliseconds. During an active
loop only, the displayed cursor stays within its range while the player's
40ms state updates and asynchronous seek catch up. Normal Play still continues.
This readout precision is not a claim of millisecond audio-device accuracy.

## Continuous Sentence Playback (.16)

Rick Lidgett made sentence Play buttons visible without hover, including valid
zero-time lyrics. Untimed rows retain a disabled Play button until a start is
assigned. Explicit Play selects the clicked sentence, turns off marker looping,
and restores Follow Lyrics after parent selection updates settle. Playback
continues forward and markers follow playing sentences without editing timing.
Timing-edit auditions preserve the chosen Loop behavior; rejected nudges do not
replay. Browser tests cover loop cancellation, continuous playback, marker
selection/following and both themes; unit tests cover zero/untimed button states.

## Initial Sentence Markers (.15)

Rick Lidgett changed default selection to the first nonblank, nonnegative timed
lyric when there is no valid selected row. Intro screen-clear cues and untimed
rows no longer become the default marker target. Existing selections survive
Plain/Synced switching. Untimed-only documents retain editable rows without
inventing timestamps or marker positions. Browser checks verify initial bounds,
selection changes and mode reentry without creating history edits.

Sentence sync, sentence shifts, end nudges and word boundaries now share the
document's marker bounds checks. Playback syncing uses only the recording being
edited and its loaded duration. Invalid/unavailable timing is rejected with
feedback; failed sync-and-advance shortcuts stay on the current line. Word
sync no longer overwrites sentence lead-in when only a later word changes.
Tooltips distinguish syncing start/end, shifting both boundaries and individual
word timing. Playback following updates marker targets without changing times.
Untimed text stays unmarked until its start is assigned; provisional ends are
labeled Inferred end until confirmed. Pending replay actions are invalidated
when the lyric or recording changes. Batched cursor/draft updates prevent stale
modal markers after track switches or in-place document edits.

## Word Editing and Lyric Following (.14)

Rick Lidgett added optional playback-driven lyric selection in the expanded
word lane. Follow Lyrics starts enabled; manual selection pins a line and the
toggle resumes following. Loops, marker previews, word drags, inline edits and
multi-selection block automatic selection. Seeking backward selects the correct
occurrence; blank cues and lyric gaps never select a future line.

Edit word, F2 and right-click open a compact spelling form. Enter applies and
Escape cancels. A correction preserves whitespace and all word timestamps and
is one undoable synced edit. Stale source/timing snapshots, empty words and
multi-word replacements are rejected; explicit split/merge remain separate.
Plain and Synced retain independent working text, and source TXT is untouched.
327 frontend tests and browser checks cover editing/following in both themes.

## Loop Safety Review (.13)

Pending loop initialization is canceled on source/selection changes, explicit
loop-off and editor disposal. A stale asynchronous resume/play cannot seek a
new recording. Repeat-seek errors stop looping and report the player error;
initialization suppresses duplicate repeat seeks. Tests cover canceled awaits,
paused track replacement, seek rejection and disposal. Rick Lidgett maintains
the review fixes; lyric words and committed word timing remain unchanged until Apply.

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
replaced using an atomic rename. Since .20, successful saves leave no rolling
backup. Failed staging
does not replace the original. Symlink/non-file and read-only destinations are
rejected. A size/modification-time change detected during staging aborts export
instead of replacing an external edit; this is not a cross-application file lock.

Embedded export stages one complete audio copy. The original stays unchanged
until replacement; successful saves remove old app-owned backups for that
destination. Keep separate backups when version history is needed.

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

Refresh does not export lyrics or rewrite music or LRC files. On startup and F5, a valid matching `.lrc` upgrades missing or plain lyrics,
even when the audio is unchanged. Its words take precedence over `.txt`. If no
valid LRC exists, matching `.txt` fills missing lyrics. Saved synced lyrics and
instrumental records are protected; existing plain edits are not replaced by TXT. Export and publish remain explicit actions.

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

## Waveform Click Playback (.22)

A single pointer click starts playback at its waveform position, including when
paused or when the editor source must be loaded. Click resolution is briefly
deferred so native click/click/double-click sequences only zoom. Keyboard seeking
retains paused inspection. Marker dragging and source changes cancel pending
pointer actions; zoom/fit/pan leave the audio position and timestamps unchanged.

The playhead holds its requested position through loading and stale seek/resume
updates until the player acknowledges it, with bounded fallback for clamped/end
positions. Play resumes an already active source instead of restarting it.
During playback its CSS position interpolates over the existing 40ms player
updates; reduced-motion preferences disable that interpolation. Follow retains
its existing behavior and explicit off setting.

## Persistent Marker Times (2.2.1+local.1)

The compact waveform header now shows labeled Start and End times for a valid
selected lyric, including off-screen markers. It reuses live drag/draft values
and millisecond formatting rather than adding another timing state. Preview
identifies unconfirmed changes; Cancel restores the saved pair. Inferred ends
retain their tooltip/accessibility description. The old unlabeled preview pair
is replaced, with no additional buttons. Package version advances to 2.2.1 while
the local suffix continues to distinguish this fork from upstream.
The transport clocks are labeled Elapsed and Total; the waveform labels Position
for the precise playhead and View for its visible range.

The selected marker interval has a 10% accent tint behind the waveform. It follows
live previews, clips to the viewport, hides invalid/off-screen ranges and ignores
pointer input. Standing maintenance/version/upgrade requirements are recorded in
AGENTS.md for future updates.

## Neighboring Lyric Warnings and Loop Consistency (2.2.2+local.1)

The live waveform marker pair warns when its start passes the previous lyric end
or its end passes the next lyric start. Warnings use crossed-boundary distances,
skip untimed/malformed neighbors, and use the saved current start for an inferred
previous end. They survive zoom/pan and update with drags/nudges; intentional
overlaps remain allowed. Apply never moves adjacent lyrics; Cancel and selection
changes retain existing draft reset behavior. The final lyric's inferred Loop end
now falls back to known recording duration, matching the waveform. Actionable
recommendations are implemented rather than left as future ideas.

## Timed Hover Help (2.2.3+local.1)

Native browser title popups were outside app timing control. The app now renders
one passive help bubble after a short hover delay and dismisses it two seconds
after appearance, even with a stationary pointer. Leave/re-enter to read again.
Leaving, clicking, scrolling, Escape, resizing, losing window focus or removing
the control dismisses help; pending delays and app/HMR listeners are cleaned up.
Descriptions remain accessible, text is literal, and help never captures input.
This shared frontend behavior is independent of Linux desktop environment.

## Saved Hover-Help Preference (2.2.4+local.1)

Configuration now has a keyboard-accessible Show hover help checkbox, default off.
Migration 19 adds a disabled-by-default saved preference without changing music
or lyrics. Settings saves the preference atomically with the other submitted
fields; omitted values from older callers preserve it. Save uses a snapshot,
prevents duplicate submissions and leaves runtime/saved choices unchanged on
failure. Cancel discards the draft. Startup restores the choice.

F1 requests help for a hovered/focused control even with automatic help off.
Configured shortcuts have priority; held/repeated or modified F1 is ignored.
Opt-in automatic help waits one second, expires after two seconds and hides on
leave/click/scroll/Escape/blur/resize/removal. Turning it off cancels pending help.
Other Linux package formats are paused at Rick's request.

## Persistent Loop Navigation (2.2.5+local.1)

The Loop toggle remains on across lyric selection, sentence/word playback,
waveform seek, pause/resume and zoom. Selected-lyric navigation retargets the
range; waveform seeking retains the current selected range. Untimed/reversed
selections and inactive Plain/instrumental tabs suspend repetition without
resetting the mode. A conditional status explains invalid ranges; the active
Loop button remains usable for turning it off. Source changes, closure and player
failures keep their protective resets. Selection invalidates older asynchronous
resume/replay seeks and errors so navigation cannot jump back to a previous line.

## Pending-marker controls (2.2.6+local.3)

- Per-boundary amber Confirm buttons for pending waveform edits; ordinary Sync keeps its playback behavior.
- Always-visible Cancel restores the last confirmed markers after repeated edits and zoom.
- F1 supports disabled hovered controls and release-only desktop events; Undo/Redo help explains Cancel.
- Word Timing no longer repeats sentence text next to its time range.
- Local release only; GitHub publishing and creator notifications remain paused.

## Pending marker colors (2.2.6+local.4)

Pending markers now change only the original Sync button color to amber. No
Confirm text or button resizing. Cancel and timing behavior remain unchanged.

### 2.2.6+local.8 — complete guides and platform packaging

- Added a complete feature index, troubleshooting guide and Linux/Windows source
  build instructions. Updated how-tos, current versions, links and screenshot provenance.
- Documented a continuous manual word-sync pass using the existing advance behavior;
  no one-click automatic singing alignment has been added. Word-loop Sync remains
  on its selected word. Reset estimates and session Undo are explicitly distinguished.
- Added a manually triggered native Windows MSI build/test workflow with read-only
  repository permissions. It validates configuration/frontend/backend behavior and
  disposable-runner install/reinstall/uninstall, retaining logs and SHA256.
- AppImage startup was rechecked in an isolated Linux profile. Personal music and
  the live lyrics database were not used for packaging tests.
- GitHub publication was reauthorized by Rick, with release updates to be the
  final step after validation and local backup. Windows 11 desktop claims depend
  on actual Windows 11 testing, not merely a Windows Server build.

### 2.2.6+local.9 — word-timed downloads and import

See [release notes](docs/releases/2.2.6-local.9.md) and
[download/import guide](docs/how-to.md#download-and-reopen-word-timed-lyrics).
Server word timing is retained, ordinary LRC/plain data falls back automatically,
and explicit enhanced files can be reopened without losing word ends or gaps.
