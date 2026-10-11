# LRCGET Frontend Architecture

## Architecture Overview

Vue 3 frontend in Tauri webview. Handles UI, playback, library browsing, lyric editing, and backend communication. Session state only; persistence in Rust/SQLite.

Local build 2.2.0+local.13: the lyrics editor defaults to synced LRC export
selected and loads the saved embedding preference when optional embedding
is enabled. Disabled embedding cannot be submitted, and publishing still requires confirmation.
The library performs an incremental quick-hash scan on every opening. F5 invokes the same
refresh action, captures native webview reload, ignores held/repeated keys while
scanning, and refuses refresh with an open modal to protect unsaved editing.
Startup/F5 can upgrade Plain to Synced from a valid matching external LRC;
missing lyrics fall back to matching TXT. Saved synced lyrics stay protected.
The header menu displays the shortcut. Scans do not export or rewrite music files.
The synced editor keeps bounded session undo/redo snapshots via `useLyricHistory`.
Timing steps (10/25/50/100 ms) apply to line, end and bulk controls; line nudges
shift word/end timing by the same actual displacement. Phrase-loop controls
use the selected line's boundaries and playback updates with seek deduplication.
Loop stays enabled across selection changes; inactive tabs suspend repetition. Native undo
in editable fields is not intercepted. Save completion preserves in-flight edits.
Timing-step and loop-context fields reuse shared `.select`/`.input` theme styles
with explicit light/dark native color schemes for readable controls and options.

**Tech Stack**: Vue 3 (`<script setup>`), Vite, Tailwind CSS, Vue Final Modal, Floating Vue, Vue Toastification, TanStack Vue Virtual, CodeMirror, `unplugin-icons` + Iconify Material Design Icons (`@iconify-json/mdi`).

**Code Quality**: ESLint with Vue plugin + Prettier for formatting. Run `npm run lint` to check, `npm run format` to format.

**Core Patterns**:
| Pattern | Implementation |
|---------|---------------|
| Shell + modals | Main workspace + modal tasks (no router) |
| Composable state | Module-level refs, no store library |
| Backend-owned persistence | State from Rust commands, minimal client caching |
| Event-driven updates | Backend pushes scan/playback events |
| Virtualized lists | `@tanstack/vue-virtual` for large libraries |

## Project Structure

```
src/
├── App.vue                 # Root shell
├── main.js                 # Entry: plugins, Tailwind import
├── style.css               # Tailwind + custom classes
├── assets/                 # Static images
├── components/
│   ├── common/             # Reusable controls
│   ├── icons/              # Custom icons
│   ├── library/            # Library views + lyric edit/search
│   └── now-playing/        # Playback controls
├── composables/            # Shared state (player, downloader, search, edit)
└── utils/                  # Helpers (lyrics, durations, linting)
```

## State Management

Module-level ref composables (singletons by design):

| Composable               | Purpose                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGlobalState()`       | `isHotkey`, `themeMode`, `lrclibInstance`                                                                                                                                                                     |
| `usePlayer()`            | `playingTrack`, `status`, `duration`, `progress`, `volume`. Supports both library tracks (with `id`) and file-based tracks (with `file_path`). Listens to `player-state` events                               |
| `useDownloader()`        | Download queue, progress. Loop started by App.vue at boot                                                                                                                                                     |
| `useExporter()`          | Mass export queue, progress; each queued track retains submitted formats. Used by ExportViewer modal                                                                                                          |
| `useSearchLibrary()`     | Shared search text and track-centric filters; used by Tracks, Albums, and Artists tabs                                                                                                                        |
| `useSearchLyrics()`      | Search modal state                                                                                                                                                                                            |
| `useEditLyricsV2()`      | Edit lyrics modal state                                                                                                                                                                                       |
| `useLibraryNavigation()` | Cross-tab navigation: clicking an album/artist name in `TrackItem.vue` or `NowPlaying.vue` switches to the Albums/Artists tab and opens the corresponding entity via `AlbumList`/`ArtistList` exposed methods |

**Boot Flow**: `main.js` → Vue app init → `App.vue` checks `get_init()` → shows `ChooseDirectory.vue` (setup) or `Library.vue` (main). Loads config, applies theme, starts downloader loop.

## UI Architecture

**Main Shells**:

- `ChooseDirectory.vue` - Setup: folder picker, persists via `set_directories`, emits to trigger library view
- `Library.vue` - Header + tabbed panes (Tracks/Albums/Artists/MyLrclib) + `NowPlaying.vue`. Manages scan lifecycle (`scan-progress`, `scan-complete`, `scan_library`)
- `NowPlaying.vue` - Persistent bottom panel. Track metadata, seek/play/volume/speed, lyrics. Keyboard shortcuts (space/enter/arrows) disabled when typing or via `isHotkey` state

**Modals**: `Config.vue`, `About.vue`, `DownloadViewer.vue`

**Common Components**:

- `BaseModal.vue` — Reusable modal wrapper using Vue Final Modal with consistent styling
- `ConfirmModal.vue` — Simple confirmation modal for user actions (e.g., confirming close on unsaved changes)

## Library & Lyrics System

**Library Browsing**:

- Search via `useSearchLibrary()`; shared search text across Tracks/Albums/Artists tabs
- `MiniSearch.vue` with context-aware placeholder; filter dropdown hidden for Albums/Artists
- All tabs use virtualized lists (`@tanstack/vue-virtual`) with IDs only
- Clickable album/artist names in track rows and the NowPlaying panel navigate to the respective tab and open the entity detail view (`AlbumTrackList`/`ArtistTrackList`)

**Lyrics Workflows**:

| Aspect                 | Details                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display**            | `LyricsViewer.vue` (synced) / `PlainLyricsViewer.vue`. Click to `seek()`                                                                              |
| **Search**             | `SearchLyrics.vue` + `Preview.vue` for LRCLIB lookup; word-level highlight when available                                                             |
| **Normalization**      | `normalizeLrclibLyrics()` derives plain/synced/instrumental from `lyricsfile` when LRCLIB omits direct fields                                         |
| **Edit/Publish**       | `EditLyricsV2.vue` + `useEditLyricsV2Publish.js` + `useEditLyricsV2Export.js`. For detailed editor behavior, see **Edit/Publish Details** below.      |
| **Keyboard Shortcuts** | `KeyboardShortcutsModal.vue` + shared registry in `composables/edit-lyrics-v2/shortcutRegistry.js`. See **Keyboard Shortcuts Details** below.         |
| **Mass Export**        | `LibraryHeader.vue` → `ExportViewer.vue` → `useExporter()` queue → `export_track_lyrics` per track                                                    |
| **My LRCLIB**          | User workflows (preview, edit, publish, flag) in `my-lrclib/`                                                                                         |
| **Track Association**  | My LRCLIB edit flow: `prepare_lrclib_lyricsfile()` → `AssociateTrackModal.vue` → `EditLyricsV2.vue` with `trackId: null` (temporary association only) |

### Download and Export preferences

`Library.vue` mounts one `DownloadOptionsPopup.vue` for the library-wide button and the album/artist row and detail Download actions. `useDownloadOptions()` owns the shared draft, hydration, submission, and queue preparation. `useDownloadTrigger()` captures an immutable target ID/name and the clicked anchor; row triggers hold no separate popup or preference state. Scrolling outside the popup, recycling/unmounting its trigger, Escape, or dismissal clears the draft. Late hydration or hide events from an older target cannot change the new session. Only confirmation saves preferences and queues tracks for the captured target with the confirmed filters. The manual Export popup stays separate. `useExportPreferences()` (`composables/export-preferences.js`) provides one reactive source backed by `get_config` / scoped `set_export_preferences` commands. Both popups load drafts on opening and save only on submission; dismissing discards drafts. No browser storage is used. Popup styling is scoped to `DownloadOptionsPopup.vue` and manual Export in `LibraryHeader.vue`: theme-aware error text, readable disabled actions, darker accent action backgrounds for text contrast, and viewport-bounded scrolling.

The Download popup also drafts the three existing Configuration “Download lyrics for” choices above a separator and the auto-export controls. `utils/download-filter.js` matches Configuration’s skip-flag mapping (plain-flag precedence), and submission saves those existing flags with export preferences in one scoped update. Queue filters use the captured submission, not returned/re-read config. Configuration remains available and refreshes from `get_config` before opening. The popup contains controls and actionable errors without explanatory export copy.

Shared fields are `export_txt`, `export_lrc`, `export_elrc`, and `export_embedded`. `auto_export_enabled` belongs only to Download. Download updates applicable format choices when enabled; turning it off preserves all formats. Manual Export does not update the toggle. Both popups show the embedded choice under the saved `try_embed_lyrics` gate and preserve its remembered value when disabled. Defaults: auto-export off, LRC selected, TXT/embedded off. Automatic export accepts embed-only batches when the gate is enabled; at least one effective format is required.

`downloader.js` queues `{ trackId, autoExport }` entries; `autoExport` is an immutable TXT/LRC/ELRC/embedded snapshot or null. The album/artist row actions (`AlbumItem.vue`, `ArtistItem.vue`) and detail actions (`AlbumTrackList.vue`, `ArtistTrackList.vue`) use the same popup and snapshots as Download All. Scope queries use `get_album_track_ids` / `get_artist_track_ids` with the submitted skip flags; library-wide queries retain their existing presence filters. Single-track Download, Apply, and editor saves are unchanged. `export.js` queues `{ trackId, formats }` with immutable ordered TXT/LRC/ELRC/embedded selections. Subsequent submissions cannot mutate queued batches.

`download_lyrics` still returns a string. Post-save export failures are appended to that string and stay on the existing green success/FOUND log path in `DownloadViewer.vue`. No reporting UI or retry flow is added. The shared writers atomically replace selected targets and retain the other sidecars; individual failures preserve their original destinations.

### Edit/Publish Details

`EditLyricsV2.vue` combines CodeMirror plain editing and synced editing with a word timing lane.

The header Import lyrics file action reads TXT/LRC using the existing backend
`read_text_file` command. `lyrics-import.js` classifies plain versus line-timed
text with `lrc-kit`, preserves repeated timestamps/blank clear cues and rejects
malformed/mixed rows, enhanced word tags and nonzero offsets instead of dropping
data. Plain TXT becomes untimed synced rows for manual synchronization; timed
TXT/LRC retains its imported positions. Replacement requires confirmation.
An import-session/source/document snapshot invalidates delayed responses after
edits, track changes or closing; concurrent reads are blocked. Import does not
write/export/publish files. Confirmation text/actions use readable light/dark
colors and apply-marker confirmation remains a separate local-draft action.

- Props/context: `audioSource` (playback source), `lyricsfile` (editing target), `trackId` (save behavior)
- Instrumental mode: toggle via `PlainLyricsEmptyState.vue` / `SyncedLyricsEmptyState.vue`
- Publish/export: handled by `useEditLyricsV2Publish.js` and `useEditLyricsV2Export.js`
- Synced lines: multi-line selection via drag and Ctrl/Cmd+click, with floating bulk rewind/forward/delete toolbar
- Synced line nudge shortcuts: `Left`/`Right` adjust selected line start by `-/+100ms`; `Shift+Left`/`Shift+Right` adjust selected line end by `-/+100ms`
- End timestamp visibility: in synced rows, the end timestamp pill stays visible even without hover when it differs from the next line's start timestamp (helps surface gaps/overlaps), and color-codes direction (`before` = gap, `after` = overlap)
- Player bar: playback speed control (`0.5x`-`2.0x`)
- Waveform: `EditLyricsV2Waveform.vue` is a compact canvas strip below the existing transport. `useAudioWaveform` requests backend-owned `get_audio_waveform` data once per source/mount (explicit retry on error), invalidates stale responses, and keeps no shared JS cache. `waveform-viewport.js` owns bounded zoom/pan, time/pixel mapping, and max-peak pixel aggregation. Resize/DPR and theme changes redraw static peaks/ruler; playback only moves a CSS playhead. Zoom anchors at a visible playhead or the window midpoint; a native range pans while paused. Click and isolated slider keyboard controls emit seconds without changing lyric timestamps. `useWaveformPlayback` hides wrong-track/loading progress, loads the editor source before seeking, and awaits `usePlayer.seek(target, { preservePaused })` for toast errors; pointer seeks explicitly request playback while keyboard inspection preserves pause, including its first queued seek. A shallow pending-seek record holds the chosen cursor through load/resume updates until position acknowledgement (250ms tolerance), with a one-second recovery timer; source changes, errors and disposal cancel pending work. Play resumes a matching active source, including a stale playing state, rather than reloading it. Native click/click/double-click sequences cancel the deferred pointer seek so zoom does not start paused audio. The playhead interpolates left over 40ms only during playback and respects reduced motion. Canvas RAF and resize/theme observers are disposed on unmount. Component tests use an in-memory Vue renderer for keyboard/ARIA controls, loading/error/retry states, minute-rollover formatting, and canvas cleanup.
- Line status: each synced line row shows a tiny word-sync status dot
- Word timing: timing-only boxes, selected divider dragging, guarded `Z` playback sync/advance, precise Start/End fields and unchanged sentence markers
- Word timing disclosure defaults collapsed; only expanded lanes mount and bind word hotkeys. Expanded word bindings take precedence over conflicting phrase actions, while history/save retain priority. A native zoom range uniformly enlarges the whole horizontal timeline from 1x to 8x (default 2x), preserving linear drag mapping and limiting layout size even for 1ms words. Selected boundaries scroll into view; guarded matching playback follows only when not manually inspecting or pending/actively dragging. Paused matching cursors/highlights remain visible with no automatic scrolling; wrong-source progress is hidden. Pointer identity is enforced; cancellation, blur, synchronous document/word changes, collapse, and unmount discard drag previews and remove listeners. Pointer-down freezes geometry and grab offset before threshold. Segmentation generations invalidate stale selection/unmount responses and prevent requests after disposal. Disclosure, zoom, and scrolling never persist timings or write files.
- Waveform follow: enabled by default with a compact toggle; pages forward/backward only for the matching active playing source, including loops. Paused panning stays manual. Progress within a page (including the final duration) retains viewport identity and does not redraw peaks.
- Time readouts: `EditLyricsV2PlayerBar` labels its recording clocks Elapsed/Total (`hh:mm:ss`); waveform Position uses milliseconds while View identifies the visible range. Start/End describe the selected lyric, independent of playback position.
- Neighbor warnings: the parent supplies the previous lyric and next start. `waveformNeighborWarnings` derives crossed-boundary distances from the live pair, using the saved selected start for a previous inferred end and skipping untimed/invalid neighbors. A conditional wrapping note persists through zoom/pan, with optional default-on confirmation protection and without changing existing neighboring timestamps. Final-line Loop falls back to a known positive recording duration when no explicit/next end exists.
- Waveform navigation: manual range/wheel/trackpad panning temporarily disables follow, so playback cannot undo inspection. A pending manual-inspection flag restores follow on pause/play, but explicit toggle choices clear that flag and remain respected. Zoom preserves the follow setting and prioritizes a visible playhead inside the selected phrase, then a visible start/end marker, then the visible phrase interior; an entirely off-screen selection is brought back around its start. Wheel deltas support pixel/line/page units, preserve modified browser gestures and use the plot width for linear mapping. Zoom/pan/fit are ignored during marker drags; navigation never emits document edits or seeks. Committed marker times remain in the document regardless of viewport/playhead movement.
- Waveform lyric markers: selected synced line start/end are pointer-captured sliders with Arrow/Home/End controls using the timing step (Shift multiplies by ten). A compact persistent Start/End row displays the selected marker times in milliseconds, including off-screen markers. It uses the same live drag/draft values as the marker lines, labels unconfirmed edits Preview, and describes inferred ends through hover/accessibility text. Invalid ranges hide the row; untimed selections use provisional markers. A decorative 10% tint spans the preview pair clipped against the viewport; entirely off-screen ranges hide it, and pointer-events none preserves seeking/marker input. Preview is local; release stages a draft and only the corresponding sentence Sync action commits through the document API/history. Pointer cancellation/lost capture discard only the active drag; Cancel/Escape outside a drag, source/selection/document changes and unmount discard the pending pair. Start changes shift word timestamps while keeping the lyric end fixed; end changes cannot truncate words. Bounds allow word ends exactly equal to the lyric end. Neighbors and overlaps are untouched, and an implicit end uses the next start or audio duration until explicitly edited.
- Loop safety (.13): operation counters cancel stale asynchronous initialization/replay on source/selection changes, loop-off and scope disposal. Selection preserves the mode; inactive/invalid ranges suspend it. Watchers do not seek during initialization; failed repeat seeks disable looping and report through the parent's toast callback. Track replacement is observed even while paused. Word highlighting uses committed word timings; sentence highlighting follows live marker bounds.
- Preview loops (.12): `preview-markers` publishes valid released/nudged drafts with line identity/index to the parent. Playback uses that range only for the current selected line; null or stale previews fall back to committed bounds. Lead-in/tail default to zero. Range changes reset seek acknowledgement, and out-of-range playing positions seek back inside. No preview changes saved lyric data; active pointer drags do not emit new loop ranges.
- Point zoom (.11): double-click maps the pointer through the current viewport and halves its span around that anchor. It shares minimum-span bounds and manual-inspection follow behavior with navigation. Single-click seeking remains; drag-time navigation and invalid pointer geometry are ignored. Zoom cannot change marker/document timestamps.
- Marker confirmation (.10): drag release/keyboard nudges stage a component-local start/end draft. The historical Apply Markers control emitted `update-markers` with both milliseconds, original line identity/index and duration; `updateWaveformMarkers` rejects stale or invalid pairs, shifts word timings once and records one history snapshot. Cancel discards the pair; a canceled drag restores the pre-drag draft. Source/selection/document changes and unmount discard unconfirmed drafts. Save/export never sees a pending draft. Bounds validate the virtual shifted-word line and the proposed end; navigation/follow cannot mutate draft timestamps.
- Narrow word segments retain timed hover descriptions, active highlighting and divider drag timestamps; no hint bubble is rendered beneath selected dividers. Active words use a mutually exclusive dark accent/white text pair in both themes. Waveform controls preserve editor history and registry-configured global shortcuts while isolating local navigation/timing keys. The desktop window already enforces a 1024px minimum width; the waveform strip itself supports narrower embedded widths.
- Boundary sync: validates the selected interval without moving neighbors; manual confirmation disables Sync until a new timing adjustment.
- Lyric following: `useLyricsFollow` selects the latest active nonblank cue during matching playback. Manual selection disables following; loops, marker drafts/drags, word edits and multi-selection block it. Selection changes never mutate timing. Blank cues/gaps and repeated phrases are resolved by timestamp, not wording.
- Sentence markers: initial selection skips blank/untimed rows; valid existing selections survive mode changes. Sentence sync/nudges and word updates use shared document bounds checks, matching-recording progress and loaded duration. Failed sync-and-advance shortcuts do not advance. All word-only updates preserve sentence start/end markers. Marker selection follows playback only when lyric following is enabled and editing/loop guards allow it.
- Word wording: the word lane is timing-only. Spelling/wording edits belong to sentence rows; double-click selects without splitting, F2/right-click do not edit, and Delete is suppressed while the lane is expanded to protect the sentence.
- Reset behavior: clears persisted word timings and reloads default (non-persisted) segmentation
- Line-start sync behavior: syncing line start shifts existing word boundaries by the same offset
- Selection behavior: selecting a synced line starts at the second boundary by default

### Keyboard Shortcuts Details

Shortcut behavior and shortcut-menu content share one canonical registry:

- Definitions live in `composables/edit-lyrics-v2/shortcutRegistry.js`
- Runtime handlers consume that registry: `useEditLyricsV2Hotkeys.js`, `useEditLyricsV2SyncedHotkeys.js`, `useEditLyricsV2WordTimingHotkeys.js`
- Menu data (`keyboardShortcuts.js`) is derived from the same registry
- Result: shortcut behavior and displayed shortcut menu stay in sync
- Shortcut-aware button tooltips are also derived from the same registry (e.g., `Sync line to current playback (Space)`)
- Shortcuts are configurable via registry override APIs (`setShortcutOverride`, `resetShortcutOverride`, `resetAllShortcutOverrides`) and persisted in browser `localStorage`
- `KeyboardShortcutsModal.vue` includes a Configure mode window to remap shortcuts by key capture and reset per-shortcut or all shortcuts
- Configure mode detects duplicate shortcut assignments and shows warnings both globally and per conflicting shortcut
- Configure mode shows capture/result feedback through button color states (listening, assigned, canceled, reset)
- Modified shortcuts (customized from defaults) are highlighted via key chip and reset-button colors
- Access: header keyboard icon and `Ctrl+/` open `KeyboardShortcutsModal.vue`

Utils: `src/utils/` (parsing, linting), Composables: `composables/edit-lyrics-v2/`, `composables/export.js`. Default word timing tokenization uses backend `segment_words` (Charabia), with frontend tokenizer fallback.

## Technical Details

**Styling**: Tailwind CSS + custom classes in `style.css`. Primary accent palette (`hoa`) from `tailwind.config.cjs`. Structural colors (backgrounds, text, borders) use Tailwind's default `neutral` scale. Dark mode via `html.dark`. Semantic classes: `.button`, `.input`, `.select`, `.modal-content`, `.link`.

**Icons**: Icons are imported directly per-file from `~icons/mdi/*` (powered by `unplugin-icons` in `vite.config.js`). Avoid adding `mdue`; use MDI icon imports instead.

**Utilities**: `src/utils/` — duration formatting, line counts, lyric parsing/linting, Lyricsfile YAML helpers (including LRCLIB payload normalization for lyricsfile-first responses).

### Playback System

The player supports two types of tracks via a unified `PlayableTrack` type:

| Track Source       | Required Fields | Backend Command                               |
| ------------------ | --------------- | --------------------------------------------- |
| Library (Database) | `id`            | `play_track({ trackId: id, ...metadata })`    |
| File Picker        | `file_path`     | `play_track({ filePath: path, ...metadata })` |

**`usePlayer().playTrack(track)`** automatically detects the track source:

- If `track.id` is present → Database track, fetches full data from SQLite
- If only `track.file_path` is present → File-based track, metadata extracted from file or provided directly

This enables the V2 lyrics editor to support playback for:

- Scanned library tracks (full features)
- Arbitrary files from file picker (full features)
- Tracks without audio (disabled playback, manual timestamp editing only)

## Testing

**Framework**: Vitest. Run `npm test` (once) or `npm run test:watch` (watch mode).

Tests live next to the source files they exercise (e.g. `word-tokenizer.test.js` for `word-tokenizer.js`). Add tests for any utilities that involve non-trivial branching logic (e.g. parsing, tokenization, transformations). `export-workflows.test.js` verifies shared preferences and batch snapshots with mocked commands. `download-options.test.js` uses a minimal Vue renderer to exercise all four album/artist trigger setups, recycling/unmount lifecycle, target isolation, and scope queries without a DOM or real downloads. DOM component tests are not yet set up.

### Optional hover help (2.2.4)

`main.js` installs one `installTimedHoverHelp` controller with the readonly global
`showHoverHelp` preference and a disposable Vue watcher. The global value starts
false; App startup restores `get_config().show_hover_help`. Configuration edits a
local draft, saves an immutable submitted snapshot and only updates runtime state
after successful persistence. Cancel/failed Save preserve the previous choice.

`editor-tooltip.js` supplies `data-editor-help` / `aria-description`; native titles
become managed descriptions. Automatic help is disabled by default. Opt-in hover
waits 1000 ms; one passive literal-text bubble expires after 2000 ms. F1 requests
help under the pointer or at keyboard focus independently of the preference, on
window bubbling after configured editor shortcuts. Modifier/repeat/handled keys
are ignored. Toggle changes cancel pending/displayed help. Disposal removes the
watcher, timers, observer and listeners. Dropdown behavior and playback are unchanged.

### Persistent loop mode (2.2.5)

`useEditLyricsV2Playback` keeps `loopEnabled` separate from range availability.
Selection invalidates old asynchronous starts/replays and resets seek acknowledgement
without disabling the mode; the computed range follows the new selected lyric.
Explicit sentence/word playback selects its loop target and suppresses automatic
repeat seeks during load/resume/seek. `loopAvailable` suspends repetition for
inactive Plain/instrumental states. Invalid/untimed ranges suspend rather than
clear the mode. The active toggle remains enabled for Off and a conditional status
explains unavailable markers. Source changes/disposal and genuine loop failures
still reset safely. Waveform zoom/pan/seek preserve the mode and selected range.

### Local marker and LRC export update (2.2.6)

Sentence Sync Start/End confirms only its corresponding moved waveform boundary,
otherwise taking the playback position. The waveform exposes a synchronous
confirmation callback so hotkeys advance only on success, then restores the
other pending boundary after document watchers settle. Source/line identity guards
prevent stale restoration. Live previews drive sentence highlighting; released
or nudged drafts drive Loop to avoid repeated seek requests during a drag.
Untimed rows get stable provisional markers without assigning document timestamps.
Optional session overlap protection defaults on and validates timing mutations.

Frontend and backend standard-LRC conversion sort timed rows and add blank cues
for confirmed gaps of at least 250 ms, plus final ends. Existing timestamps are
not duplicated and cues cannot clear another active overlapping phrase. Untimed
rows and words allow absent starts in the internal schema; exports omit untimed
rows and presence flags no longer label them Synced. Exact ends remain internal;
LRC-only reimports retain exported blank rows but cannot recover omitted tiny gaps.

### Saved overlap protection (2.2.6+local.2)

Configuration → Common owns the overlap checkbox. Synced exposes only read-only
On/Off status. App hydrates `prevent_lyric_overlaps` into a shared reactive
preference; document validation receives the readonly preference. A missing
field defaults on for compatibility. Configuration submits an immutable snapshot
and updates runtime state only after successful atomic save. Save and preference
inputs are disabled until configuration loads; a failed load displays an error.
Migration 20 adds a checked boolean defaulting true. Optional command arguments
preserve existing choices for older callers. The existing settings transaction
includes the scoped overlap setter, with tests for upgrade, restart and rollback.

### Pending marker controls (2.2.6+local.3)

The frontend lyric-row buttons derive amber Confirm labels from the corresponding
previewRange startChanged/endChanged flags, keeping ordinary playback Sync actions
unchanged. Waveform Cancel remains visible, disabled without a preview or during
drag, and clears only the preview; confirmed document times are the baseline.
Word Timing omits the duplicate header sentence. Timed hover help resolves pointer
coordinates for disabled controls and has a keyup fallback for desktop F1 presses,
with press/release deduplication and consumed-shortcut priority. No backend timing,
persistence, LRC export or data-identifier changes are required.

### Marker color indicator (2.2.6+local.4)

Pending start/end previews now change only the corresponding original Sync icon
button color. Buttons retain their circular 24px layout and Equal icon. Timing
handlers and cancellation remain unchanged. No backend behavior changes.

### Optional Enhanced LRC export (2.2.6+local.5)

Migration 21 adds `config_data.export_elrc`, false by default. Configuration/Common
and scoped export preference updates preserve omitted values; combined updates
use a transaction so rejected selections cannot change the ELRC preference.
Editor, bulk and Download export add the `elrc` format. Queues snapshot the choice;
legacy download payloads default `enhancedLrc` to false. Editor hydration seeds the
saved default once per editor, preserving subsequent manual menu choices.

`ParsedLyricsfile.enhanced_lyrics` stores an independent result. Shared line-event
construction preserves the existing standard LRC output and gap policy. ELRC
validates saved word text reconstruction, monotonic starts and valid end bounds;
missing ends use the next word/sentence boundary when known. Only timed rows with
saved word timing produce inline tags. Mixed line-only rows are retained. Missing
word timing skips ELRC; invalid timing errors only that format. Atomic verified
sidecar replacement preserves older files on skip/failure. This export change originally added no import or player changes; enhanced
file import was added in local.9. The internal document retains editable words.

### Native MP3 embedding and read-only word preview (2.2.6+local.6)

Embedding edits `MpegFile`'s native ID3v2 tag, avoiding generic-tag conversions
that lose frame descriptions/languages. Missing ID3v2 tags are created. Writes
use UTF-8 ID3v2.4 USLT and SYLT (milliseconds, content type Lyrics, language XXX).
SYLT carries whitespace before subsequent words/lines, includes known clear cues,
and is reread and checked before atomic replacement. NUL text fails safely.

Selecting both `elrc` and `embedded` opts into MP3 Enhanced LRC embedding: retain
normal plain USLT, add a distinct `Enhanced LRC` USLT, store the same text in
TXXX `LYRICS_ELRC`, and use inline word times as binary SYLT entries. The TXXX
name is an app convention, not a universally recognized player field. Missing
word timing falls back to normal embedding; invalid requested timing leaves the
MP3 unchanged. Normal embedding removes only the owned custom ELRC field while
preserving unrelated TXXX/comment/artwork metadata. FLAC uses its existing
Vorbis lyric comments; it does not use ID3 frame types.

`WordPlaybackPreview.vue` is independent of timeline box geometry. The Synced
editor's Word preview toggle enables Follow Lyrics; existing editing/Loop guards
hold selection. The preview reads word timing and respects explicit ends/gaps,
wraps long text, and scrolls only its own text container while playing. Unsaved
word timing is shown as an evenly spaced estimate. Preview emits no edits or
seeks, and Loop keeps its existing playback/selection behavior.

### Remembered editor ELRC choice (2.2.6+local.7)

Save's Word-timed lyrics checkbox writes only exportElrc via the existing scoped
set_export_preferences command and reloads the saved choice on menu opening.
The schema's false default remains; upgrades preserve existing choices. Failed
writes retain the confirmed choice and show a retry message. Inputs are disabled
until loaded and during writes; request generations discard stale reads.
Configuration no longer displays or submits exportElrc, preserving this preference
when unrelated settings are saved. Existing backend optional arguments remain
compatible with older callers. Bulk/Download keep their applicable format choices.

### Selected-word looping (2.2.6+local.8)

The shared playback composable owns exclusive phrase/word modes. A word target
contains line identity/index, word index and committed/estimated millisecond
bounds. Availability follows the word lane and active Synced tab. Invalid/stale
ranges suspend repetition, preserving mode; explicit stop remains available.
Selection changes invalidate asynchronous starts. Playback bounds clamp shared
lead/tail context to the recording without modifying the lyric document.

Word lane emits targets from its selected word, not viewport geometry or live
drag drafts. Explicit ends preserve gaps; missing ends infer the next word or
line end. Precision fields use Timing step, clamp against adjacent words/line
bounds and use normal document/history updates. Word-mode Sync does not advance.
Word timing replay does not restart the whole sentence while word looping.
Saved targets survive collapse/reopen; labels use horizontal CSS sticky positioning
for zoomed readability. Reset submits an empty word array instead of undefined.
No backend or lyric export format changes; the existing 40 ms player updates
drive auditions. Saved timestamp precision is independent of audition latency.

### Additional local packages (2.2.6+local.8)

AppImage uses the existing Linux bundle configuration and unchanged identifier.
Windows MSI tooling under packaging/windows is platform-gated, generates a
temporary Windows config overlay, uses locked frontend dependencies and the
x86_64-pc-windows-msvc target, checks each command and delivers one installer plus
SHA256. The default x64 UpgradeCode is pinned; patch\*1000+local maps the app
revision into the MSI's third version field. It embeds WebView2's downloader,
not the whole offline runtime. Windows execution requires a Windows builder.
No app UI/schema/export changes are required by this packaging update.

### Illustrated feature documentation

`docs/features.md` indexes current library/editor/export behavior;
`docs/troubleshooting.md` distinguishes measured word timing from Reset estimates
and documents sequential Sync word versus Loop word refinement. The source build
and package guides cover both Linux and native Windows packaging. Screenshots use
isolated fixture profiles; `docs/screenshots/current/README.md` records provenance.

### Server word timing and enhanced import (2.2.6+local.9)

LRCLIB supplies optional word timing in its raw YAML `lyricsfile`, not through
a dedicated ELRC download endpoint. Download/apply/prepare/refresh retain that
document unchanged. Empty structured payloads fall back to standard LRC and then
plain text; malformed nonempty structured payloads report errors on application.
The frontend validates actual word data instead of trusting `hasWordSync`. Search
labels word-timed records and offers an optional local result filter; ordinary
results remain visible by default. Preview respects explicit word ends and gaps.
Structured content takes precedence over stale legacy text, matching native apply.

The editor file picker imports TXT/LRC/ELRC through `lyrics-import.js`; enhanced
inline timestamps route to `enhanced-lrc.js`, preserving explicit end tags and
untimed rows. Ambiguous/malformed input errors before editor replacement. Existing
replace confirmation, undo and dirty/session guards remain in effect. TXT/LRC/ELRC
export selections are independent. Publishing already sends serialized YAML with
word timing to compatible LRCLIB servers; it does not upload ELRC sidecar files.

### Safe timing-only word edits (2.2.6+local.10)

Released divider drags select and change only that word's start. Document updates
acknowledge acceptance before replay/advance. Own word refreshes preserve drag
click suppression; external document/bounds changes cancel stale pointer edits.
The next Sync preserves a matching manual drag/precision edit. Other Sync actions
reject playback outside the selected interval rather than cascading neighboring
starts to 1 ms apart. Numeric edits and drags participate in synced Undo/Redo.
Word arrays must reconstruct sentence text, have strictly ordered finite starts
and positive explicit ends that do not overlap the next word. Word-only changes
never move sentence markers. Keyboard navigation, Sync and Reset are guarded
while a pointer interaction is pending/active. Editor export snapshots the target
track before awaiting Save. Standard import now rejects seconds >= 60.

### Word Sync lock and Pause/Resume (2.2.7)

Manual confirmation is keyed by line/index, serialized word timing and lane bounds.
The next Sync locks matching timing; the UI uses a gray disabled button and a help
explanation, while the composable also blocks shortcuts. Playback/reselection and
unchanged numeric values cannot unlock it. Accepted new edits and changed words/
bounds invalidate the lock. Ordinary Sync retains advance; matching duplicate
playback/selection/document states return false silently to prevent another advance.
The added word-lane Pause/Resume emits through SyncedLyricsEditor to existing pause
and resumeOrPlay functions. Play retains sentence replay; pause/resume retains
position and loop state without lyric edits or explicit seeks.
