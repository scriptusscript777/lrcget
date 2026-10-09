# LRCGET Frontend Architecture

## Architecture Overview

Vue 3 frontend in Tauri webview. Handles UI, playback, library browsing, lyric editing, and backend communication. Session state only; persistence in Rust/SQLite.

Local build 2.2.0+local.12: the lyrics editor defaults to synced LRC export
selected and loads the saved embedding preference when experimental embedding
is enabled. Disabled embedding cannot be submitted, and publishing still requires confirmation.
The library performs an incremental quick-hash scan on every opening. F5 invokes the same
refresh action, captures native webview reload, ignores held/repeated keys while
scanning, and refuses refresh with an open modal to protect unsaved editing.
The header menu displays the shortcut. Scans do not export or rewrite music files.
The synced editor keeps bounded session undo/redo snapshots via `useLyricHistory`.
Timing steps (10/25/50/100 ms) apply to line, end and bulk controls; line nudges
shift word/end timing by the same actual displacement. Phrase-loop controls
use the selected line's boundaries and playback updates with seek deduplication.
Changing the selection or leaving the Synced tab disables looping. Native undo
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

| Composable           | Purpose                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGlobalState()`   | `isHotkey`, `themeMode`, `lrclibInstance`                                                                                                                                       |
| `usePlayer()`        | `playingTrack`, `status`, `duration`, `progress`, `volume`. Supports both library tracks (with `id`) and file-based tracks (with `file_path`). Listens to `player-state` events |
| `useDownloader()`    | Download queue, progress. Loop started by App.vue at boot                                                                                                                       |
| `useExporter()`      | Mass export queue, progress; each queued track retains submitted formats. Used by ExportViewer modal                                                                                                                         |
| `useSearchLibrary()` | Shared search text and track-centric filters; used by Tracks, Albums, and Artists tabs |
| `useSearchLyrics()`  | Search modal state                                                                                                                                                              |
| `useEditLyricsV2()`  | Edit lyrics modal state                                                                                                                                                         |
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

| Aspect | Details |
|--------|---------|
| **Display** | `LyricsViewer.vue` (synced) / `PlainLyricsViewer.vue`. Click to `seek()` |
| **Search** | `SearchLyrics.vue` + `Preview.vue` for LRCLIB lookup; word-level highlight when available |
| **Normalization** | `normalizeLrclibLyrics()` derives plain/synced/instrumental from `lyricsfile` when LRCLIB omits direct fields |
| **Edit/Publish** | `EditLyricsV2.vue` + `useEditLyricsV2Publish.js` + `useEditLyricsV2Export.js`. For detailed editor behavior, see **Edit/Publish Details** below. |
| **Keyboard Shortcuts** | `KeyboardShortcutsModal.vue` + shared registry in `composables/edit-lyrics-v2/shortcutRegistry.js`. See **Keyboard Shortcuts Details** below. |
| **Mass Export** | `LibraryHeader.vue` → `ExportViewer.vue` → `useExporter()` queue → `export_track_lyrics` per track |
| **My LRCLIB** | User workflows (preview, edit, publish, flag) in `my-lrclib/` |
| **Track Association** | My LRCLIB edit flow: `prepare_lrclib_lyricsfile()` → `AssociateTrackModal.vue` → `EditLyricsV2.vue` with `trackId: null` (temporary association only) |

### Download and Export preferences

`Library.vue` mounts one `DownloadOptionsPopup.vue` for the library-wide button and the album/artist row and detail Download actions. `useDownloadOptions()` owns the shared draft, hydration, submission, and queue preparation. `useDownloadTrigger()` captures an immutable target ID/name and the clicked anchor; row triggers hold no separate popup or preference state. Scrolling outside the popup, recycling/unmounting its trigger, Escape, or dismissal clears the draft. Late hydration or hide events from an older target cannot change the new session. Only confirmation saves preferences and queues tracks for the captured target with the confirmed filters. The manual Export popup stays separate. `useExportPreferences()` (`composables/export-preferences.js`) provides one reactive source backed by `get_config` / scoped `set_export_preferences` commands. Both popups load drafts on opening and save only on submission; dismissing discards drafts. No browser storage is used. Popup styling is scoped to `DownloadOptionsPopup.vue` and manual Export in `LibraryHeader.vue`: theme-aware error text, readable disabled actions, darker accent action backgrounds for text contrast, and viewport-bounded scrolling.

The Download popup also drafts the three existing Configuration “Download lyrics for” choices above a separator and the auto-export controls. `utils/download-filter.js` matches Configuration’s skip-flag mapping (plain-flag precedence), and submission saves those existing flags with export preferences in one scoped update. Queue filters use the captured submission, not returned/re-read config. Configuration remains available and refreshes from `get_config` before opening. The popup contains controls and actionable errors without explanatory export copy.

Shared fields are `export_txt`, `export_lrc`, and `export_embedded`. `auto_export_enabled` belongs only to Download. Download updates applicable format choices when enabled; turning it off preserves all formats. Manual Export does not update the toggle. Both popups show the embedded choice under the experimental `try_embed_lyrics` gate and preserve its remembered value when disabled. Defaults: auto-export off, LRC selected, TXT/embedded off. Automatic export accepts embed-only batches when the gate is enabled; at least one effective format is required.

`downloader.js` queues `{ trackId, autoExport }` entries; `autoExport` is an immutable TXT/LRC/embedded snapshot or null. The album/artist row actions (`AlbumItem.vue`, `ArtistItem.vue`) and detail actions (`AlbumTrackList.vue`, `ArtistTrackList.vue`) use the same popup and snapshots as Download All. Scope queries use `get_album_track_ids` / `get_artist_track_ids` with the submitted skip flags; library-wide queries retain their existing presence filters. Single-track Download, Apply, and editor saves are unchanged. `export.js` queues `{ trackId, formats }` with immutable ordered TXT/LRC/embedded selections. Subsequent submissions cannot mutate queued batches.

`download_lyrics` still returns a string. Post-save export failures are appended to that string and stay on the existing green success/FOUND log path in `DownloadViewer.vue`. No reporting UI or retry flow is added. The shared writers still overwrite targets and delete the opposite sidecar; format-operation success does not imply both files remain.

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
- Waveform: `EditLyricsV2Waveform.vue` is a compact canvas strip below the existing transport. `useAudioWaveform` requests backend-owned `get_audio_waveform` data once per source/mount (explicit retry on error), invalidates stale responses, and keeps no shared JS cache. `waveform-viewport.js` owns bounded zoom/pan, time/pixel mapping, and max-peak pixel aggregation. Resize/DPR and theme changes redraw static peaks/ruler; playback only moves a CSS playhead. Zoom anchors at a visible playhead or the window midpoint; a native range pans while paused. Click and isolated slider keyboard controls emit seconds without changing lyric timestamps. `useWaveformPlayback` hides wrong-track/loading progress, loads the editor source before seeking, and awaits `usePlayer.seek(target, { preservePaused })` for toast errors; pause is preserved when the loaded editor source is paused, including its first queued seek, without a pause-after-seek race. Canvas RAF and resize/theme observers are disposed on unmount. Component tests use an in-memory Vue renderer for keyboard/ARIA controls, loading/error/retry states, minute-rollover formatting, and canvas cleanup.
- Line status: each synced line row shows a tiny word-sync status dot
- Word timing: multi-separator selection (Ctrl/Cmd+click + Shift+click), merge separators (`Delete`/`Backspace`), hover split preview snapped to grapheme boundaries, double-click split at cursor, and `Z` syncs selected separator then advances (last-word sync advances to next line)
- Word timing disclosure defaults collapsed; only expanded lanes mount and bind word hotkeys. Expanded word bindings take precedence over conflicting phrase actions, while history/save retain priority. A native zoom range uniformly enlarges the whole horizontal timeline from 1x to 8x (default 2x), preserving linear drag mapping and limiting layout size even for 1ms words. Selected boundaries scroll into view; guarded matching playback follows only when not manually inspecting or pending/actively dragging. Paused matching cursors/highlights remain visible with no automatic scrolling; wrong-source progress is hidden. Pointer identity is enforced; cancellation, blur, synchronous document/word changes, collapse, and unmount discard drag previews and remove listeners. Pointer-down freezes geometry and grab offset before threshold. Segmentation generations invalidate stale selection/unmount responses and prevent requests after disposal. Disclosure, zoom, and scrolling never persist timings or write files.
- Waveform follow: enabled by default with a compact toggle; pages forward/backward only for the matching active playing source, including loops. Paused panning stays manual. Progress within a page (including the final duration) retains viewport identity and does not redraw peaks.
- Waveform navigation: manual range/wheel/trackpad panning temporarily disables follow, so playback cannot undo inspection. A pending manual-inspection flag restores follow on pause/play, but explicit toggle choices clear that flag and remain respected. Zoom preserves the follow setting and prioritizes a visible playhead inside the selected phrase, then a visible start/end marker, then the visible phrase interior; an entirely off-screen selection is brought back around its start. Wheel deltas support pixel/line/page units, preserve modified browser gestures and use the plot width for linear mapping. Zoom/pan/fit are ignored during marker drags; navigation never emits document edits or seeks. Committed marker times remain in the document regardless of viewport/playhead movement.
- Waveform lyric markers: selected synced line start/end are pointer-captured sliders with Arrow/Home/End controls using the timing step (Shift multiplies by ten). Preview is local, with millisecond timestamps; release stages a draft and only Apply Markers commits through the document API/history. Pointer cancellation/lost capture discard only the active drag; Cancel/Escape outside a drag, source/selection/document changes and unmount discard the pending pair. Start changes shift word timestamps while keeping the lyric end fixed; end changes cannot truncate words. Bounds allow word ends exactly equal to the lyric end. Neighbors and overlaps are untouched, and an implicit end uses the next start or audio duration until explicitly edited.
- Preview loops (.12): `preview-markers` publishes valid released/nudged drafts with line identity/index to the parent. Playback uses that range only for the current selected line; null or stale previews fall back to committed bounds. Lead-in/tail default to zero. Range changes reset seek acknowledgement, and out-of-range playing positions seek back inside. No preview changes saved lyric data; active pointer drags do not emit new loop ranges.
- Point zoom (.11): double-click maps the pointer through the current viewport and halves its span around that anchor. It shares minimum-span bounds and manual-inspection follow behavior with navigation. Single-click seeking remains; drag-time navigation and invalid pointer geometry are ignored. Zoom cannot change marker/document timestamps.
- Marker confirmation (.10): drag release/keyboard nudges stage a component-local start/end draft. Apply Markers emits `update-markers` with both milliseconds, original line identity/index and duration; `updateWaveformMarkers` rejects stale or invalid pairs, shifts word timings once and records one history snapshot. Cancel discards the pair; a canceled drag restores the pre-drag draft. Source/selection/document changes and unmount discard unconfirmed drafts. Save/export never sees a pending draft. Bounds validate the virtual shifted-word line and the proposed end; navigation/follow cannot mutate draft timestamps.
- Narrow word segments retain native title tooltips, active highlighting, split previews, and divider drag timestamps; no hint bubble is rendered beneath selected dividers. Active words use a mutually exclusive dark accent/white text pair in both themes. Waveform controls preserve editor history and registry-configured global shortcuts while isolating local navigation/timing keys. The desktop window already enforces a 1024px minimum width; the waveform strip itself supports narrower embedded widths.
- Boundary sync: can cascade adjacent boundaries so sync is not blocked by intervening separators, while staying within line bounds
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
