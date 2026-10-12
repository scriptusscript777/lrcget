# Current Interface Screenshots

Unchanged guide images were freshly captured from **LRCGET 2.2.2+local.1**
on 2026-10-11 in both light and dark themes, using demonstration data.

The `automatic-lrc-*`, `waveform-marker-times-*`, `waveform-click-play-*`,
`marker-preview-*`, `marker-overlap-*` and `marker-previous-overlap-*` images
come from the native desktop application at 1024x768. An isolated profile uses
an externally created matching LRC/TXT and a generated silent 45-second MP3.
The flat native waveform reflects that silent fixture. Checks verified sidecar
import, both warning directions, preview cancellation, zoom continuity,
playhead advancement, paused position and resume without a jump to zero,
and final-lyric looping through the recording end.

Other images render the current app through its local Vite server with a mocked
Tauri backend and temporary demonstration lyrics/waveform data. Browser checks
covered editor views, forward/backward Follow Lyrics, word spelling and timing,
point zoom, waveform panning/following, untimed text, import confirmation,
export choices and Modified-column layouts. Most browser images use 1280x900;
Modified-column checks also cover maximized and narrow layouts.

These are screenshots of the actual interface, not generated mockups. Captures
were settled after theme/zoom updates. Verification did not change user music,
sidecars or the live lyrics database. Native hover help is not forced open.
Historical screenshots outside this directory remain for old release notes.

`timed-hover-help-*` and `hover-help-settings-*` are fresh 2.2.4 browser captures
of the actual editor/Configuration and shared controller using generated fixture
data. Hover remains quiet by default; F1 explicitly opens the depicted help.
Checks cover saved on/off choice, keyboard access, Cancel/failed Save, restart,
pending timer cancellation, timeout, dynamic controls and disposal. Other unchanged
views retain the 2.2.2 captures described above.

`loop-persistent-navigation-*` are fresh 2.2.5 browser captures using generated
fixture data and the actual editor. Loop remains active after playing the second
sentence; its marker range is 00:03.000–00:06.000. Light/dark captures were checked
alongside navigation, repeat, zoom, tab suspension/restoration and explicit Off.

## Current 2.2.6+local.8 captures

On 2026-10-11 the actual Vue editor was checked again with an isolated mocked
Tauri player and temporary fixture lyrics. Single-word looping, precise Start/End,
10 ms steps, Lead-in/Tail, selection/zoom, lane collapse, Undo, export settings,
read-only word preview and phrase/word loop exclusivity passed. Current captures:

- `selected-word-loop-light.png` and `selected-word-loop-dark.png`: selected word,
  loop control and precision fields.
- `embedded-word-export-light.png` and `embedded-word-export-dark.png`: current Save
  choices, including remembered optional ELRC.
- `embedded-lyrics-settings-light.png` and `embedded-lyrics-settings-dark.png`: current
  embedding Configuration without a duplicate ELRC-default setting.
- `word-playback-preview-*` and `word-preview-loop-zoom-*`: readable follow-along
  and zoom/loop context.
- `appimage-startup.png`: native Linux AppImage using a temporary profile.

These images illustrate tested fixture behavior, not a diagnosis of a personal
recording. Earlier unchanged controls retain their historical capture provenance
above; they are not represented as fresh native screenshots.

The broader browser guide views were also recaptured from 2.2.6+local.8:
`editor-default-*`, `editor-follow-*`, `word-timing-zoom-*`, `point-zoom-*`,
`waveform-navigation-*`, `waveform-follow-*`, `export-options-*`, `lyrics-import-*`
and `untimed-text-*` (18 light/dark captures). The fixture selector was updated
for the current Cancel accessibility label; the full capture run then passed
without save/export writes or browser errors. Native import/marker demonstration
captures retain the older provenance above.

## Current 2.2.6+local.9 captures

`server-lyrics-types-*` show real search components with word-timed, standard
LRC and plain fixtures. Filtering, raw-data application, fallback and explicit
word-end gaps were checked. `enhanced-import-*` show the editor after confirmed
ELRC import with editable words and preserved ends. Both themes use temporary
fixtures and a mocked backend; no personal files or online publication are used.

`debian-startup.png` is the native local.9 executable extracted from the Debian
package, opened with a fresh temporary profile under Xvfb. It verifies the bundled
frontend opens without touching the live lyrics database; no music is configured.

`appimage-startup.png` was refreshed using the native local.9 AppImage and a
separate temporary XDG profile. Production frontend rendering and database startup
passed. Both native startup checks left the installed local.8 profile unchanged.

## Debian 2.2.6+local.10 captures

`word-timing-protected-*` shows timing-only word boxes and an explained unsafe
Sync refusal. `selected-word-loop-*` shows precise fields, independent lane zoom
and word-loop controls with no inline spelling editor. `enhanced-import-*` was
recaptured after real Vue ELRC replacement confirmation. Both themes use mocked
native commands and temporary lyric fixtures, with no personal music writes.
`debian-startup.png` is refreshed from the actual Debian local.10 executable with
an isolated XDG profile. Earlier unchanged screenshots retain their provenance;
AppImage/Windows artifacts and captures were not updated for local.10.

The broader 18 editor/word zoom/navigation/import/export/untimed light/dark guide
views were also refreshed from local.10. `word-preview-loop-zoom-*` was refreshed
with the read-only follow-along and current timing-only lane. The older standalone
`edit-word-*` captures illustrate a retired control and are kept for historical
notes; current guides use protected word timing images instead.

## Debian 2.2.7 captures

`word-sync-confirmed-*` illustrates the gray disabled Sync button after manual
confirmation and the additional Pause/Resume beside Play. `selected-word-loop-*`,
`word-timing-protected-*` and `word-preview-loop-zoom-*` show the current controls.
Browser checks also exercised pause/resume without seeks or lyric mutations while
word Loop stayed on. The broader guide images and enhanced import were refreshed
with mocked native commands and temporary fixtures. Debian startup uses the actual
packaged executable and an isolated temporary profile.

## Recovery maintenance — Debian 2.2.7, version unchanged

`editor-recovery-protected-{light,dark}.png` and
`editor-recovery-restored-{light,dark}.png` show durable unfinished word timing,
selected editor context and an unconfirmed waveform preview. Real Vue components
run against isolated mocked native fixtures; the user's music/library are untouched.
Word timing warning screenshots were refreshed with yellow warning text.
Browser checks also verify the main-window notice and Resume action and a page
reload that does not invoke the old editor's shutdown hooks.

Master reset captures: `master-reset-saved-warning-*`,
`master-reset-timing-warning-*`, `master-reset-cleared-*` and
`master-reset-plain-*`. These captures show the historical icon/warning and Plain-mode
graying from before the feature was removed. See docs/master-reset.md.

Sentence-loop maintenance captures: `selected-sentence-loop-{light,dark}.png`
show the adjacent word/sentence controls and active sentence mode. Current word,
reset and recovery screenshots were refreshed using isolated browser fixtures.

`word-preview-live-edit-{light,dark}.png` shows preview/row parity after a live
word start adjustment without Sync/Save. `recovery-notice-aligned-{light,dark}.png`
uses the actual recovery notice with a fixture debug-icon footprint; normal and
320px layouts were checked. Fixtures use mocked native playback and isolated
browser storage. They do not edit personal music or the installed app profile.

Native-loop maintenance: refreshed light/dark sentence-loop screenshots show
the existing controls after verifying pending waveform bounds and Cancel. Native
repeat precision changes do not add controls or alter export selections.

Current word-follow maintenance: word-follow-off-confirmed-* and word-overlap-off-*
show independent confirmation, Follow off, Reset words and green/red protection
status. Master-reset-* captures are historical; that feature is removed.
