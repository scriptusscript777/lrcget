# Code and maintenance guide — 2.2.6+local.9

Start with [build instructions](build-from-source.md),
[platform matrix](platform-builds.md), [frontend architecture](../src/ARCHITECTURE.md)
and [backend architecture](../src-tauri/ARCHITECTURE.md). This guide maps the
current source to behavior; it is not a promise that every platform is verified.

## Project map

| Location                                                    | Responsibility                                                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/App.vue`, `src/main.js`                                | Vue application shell, plugins and global styling                                                         |
| `src/components/library/`                                   | Library, search, Configuration and editor entry points                                                    |
| `src/components/library/EditLyricsV2.vue`                   | Editor integration, selection, document, playback and export wiring                                       |
| `src/components/library/edit-lyrics-v2/`                    | Synced rows, waveform, word lane/segments, readable word preview                                          |
| `src/composables/edit-lyrics-v2/`                           | Document/history, phrase and word playback, waveform state, hotkeys, import/export/publishing             |
| `src/utils/`                                                | Parsing/serialization, word bounds, viewport/marker calculations, refresh/import/help utilities and tests |
| `src-tauri/src/main.rs`                                     | Native command entry points and player/scan notifications                                                 |
| `src-tauri/src/player.rs`, `waveform.rs`                    | Kira playback, seeking/speed and Symphonia peak extraction/cache                                          |
| `src-tauri/src/scanner/`                                    | Metadata/hash scan, sidecar discovery, persistence and missing-track handling                             |
| `src-tauri/src/lyricsfile.rs`, `parser/`                    | Working lyric structures and standard LRC parsing                                                         |
| `src-tauri/src/export.rs`                                   | Validated staged sidecar/MP3/FLAC export and replacement                                                  |
| `src-tauri/src/db.rs`, `state.rs`, `persistent_entities.rs` | SQLite migrations, shared state, persistent entities                                                      |
| `src-tauri/src/lrclib/`                                     | Search, download, publish and challenge requests                                                          |
| `src-tauri/Cargo.toml`, `Cargo.lock`                        | Native app version and Rust dependency lock                                                               |
| `package.json`, `package-lock.json`                         | Frontend scripts and locked dependencies                                                                  |
| `src-tauri/tauri.conf.json`, `packaging/`                   | App identity, native permissions/bundling, desktop metadata and Windows tooling                           |
| `.github/workflows/`                                        | Existing upstream release workflows plus a manually triggered Windows verification job                    |
| `docs/`, `LOCAL_CHANGES.md`                                 | User guides, images, version history and verification records                                             |

## Timing data and control flow

The backend owns saved documents and library persistence. Vue keeps editing/session
state and calls native commands. A document may contain plain text, sentence starts,
explicit ends and word timings. Import, selection and read-only preview must not
silently turn estimates into measured timing or write music files.

`useEditLyricsV2Document` handles accepted document edits and history snapshots.
`useLyricHistory` supplies bounded session Undo/Redo. Waveform marker drags create
proposals; the corresponding sentence Sync action confirms them. Cancel returns
to the last confirmed baseline. Settings control neighboring-sentence overlap
prevention; the editor displays its status. Precision word fields have their own
ordering/gap constraints rather than using the sentence overlap setting.

`useEditLyricsV2WordBoundaryDrag` implements normal boundary dragging/stamping
and advance. `SyncedWordTimingLane` coordinates selected words, precision inputs,
split/merge and loop targets. `word-loop-range.js` validates selected intervals
and clamps precision edits against sentence and neighbor bounds. First-word
precision edits preserve sentence start; normal first-boundary stamping can move it.
Reset submits an empty word list, restoring estimates rather than keeping custom times.

`useEditLyricsV2Playback` is the single phrase/word loop controller. Its mode
prevents competing loop engines. Selection, async playback requests, pause, tabs,
lane visibility and disposal affect audition availability. Lead-in/Tail affect
listening context only. Notifications are approximately 40 ms apart; millisecond
data precision is not sample-accurate audible looping. `WordPlaybackPreview.vue`
reads playback/document state without modifying it or seeking.

## Saving, export and publication

The document-save action is separate from writing selected outputs. `useEditLyricsV2Export`
prepares format choices; `useEditLyricsV2Publish` handles explicit server publication.
Standard LRC expresses starts and uses empty timestamp cues for appropriate explicit
sentence gaps. ELRC adds word timestamp text. These are independent sidecars.
LRCLIB publication sends structured YAML including saved word timing to a
compatible server, not a dedicated ELRC sidecar upload. Search/apply/download
retain server YAML; ordinary line LRC and plain text remain automatic fallbacks.

Native `export.rs` serializes writes, prepares staged outputs on the destination
filesystem, validates embedded frames and then replaces accepted targets. MP3
uses ID3v2.4 USLT/SYLT and optional TXXX ELRC; FLAC uses Vorbis comments. Audio is
not re-encoded. Different destinations can complete independently, so partial
export results must remain visible. Do not claim file history from session Undo
or automatic backups from this version's successful exports.

## Checks and change workflow

Use [source build instructions](build-from-source.md) for dependency setup.
For a reviewed change, run checks appropriate to the affected files:

```bash
npm test
npm run build
npx eslint path/to/changed.js path/to/changed.vue
npx prettier --check path/to/changed.md
node --test packaging/windows/msi-config.checks.mjs
cd src-tauri
cargo check --locked
cargo test --locked
```

For Python changes use Ruff. The unchanged `tools/generate_fake_music.py` currently
has 11 existing Ruff findings; do not describe the whole repository as lint clean.
PowerShell scripts should pass the native PowerShell parser and Windows execution
checks; syntax acceptance on Linux is not native Windows validation.

Review logic and failure paths: wrong recording, untimed/empty lyrics, explicit
gaps, first/last words, narrow boxes, zoom/pan, repeated drags, cancel baselines,
Undo/Redo, pause, loops, editor close/track changes, failed persistence/export,
read-only files and saved preference transitions. Use temporary music/profile
fixtures for automated tests and label mocked versus native screenshots.

Keep versions/identifiers consistent; update feature lists, how-tos, architecture,
release notes and screenshots as applicable. Preserve historical notes. Package,
verify hashes/startup, update the installed Debian app in place when code changes,
commit locally and refresh the configured server backup. Publish to the fork and
notify upstream only under current user authorization. Do not rewrite unrelated
PRs or include private music/databases, build directories or unrelated projects.

## Known limits

See the [platform matrix](platform-builds.md) and [troubleshooting](troubleshooting.md).
No automatic singing alignment is implemented. Matching word text alone does
not prove timestamps are meaningful. The reported disappearing first word has
not been reproduced on the actual recording. Client karaoke/embedded-frame
support varies. Windows Server checks do not substitute for Windows 11 desktop
playback, older-version upgrades, signing or multi-distribution Linux validation.
