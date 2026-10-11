# Complete feature index — 2.2.6+local.10

This describes the current fork, including the original library/downloader and
Rick's editor enhancements. See the [illustrated overview](app-overview.md),
[how-tos](how-to.md), [editing reference](editing-guide.md) and
[packages/source](packages.md). Historical releases describe their own behavior.

| Area                 | Available features                                                                                                                     | Guide                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Library              | Configured music directories, scanning, artist/album/track views, search, lyrics status, Modified date, incremental startup/F5 refresh | [Library](editing-guide.md#library-search-and-refresh)                   |
| Finding lyrics       | LRCLIB search/download with validated word timing and automatic LRC/plain fallback, recording metadata/duration comparison, bulk download and configured server                                | [Search](how-to.md#find-lyrics-online)                                   |
| Local inputs         | Plain TXT, timestamped TXT, LRC and ELRC import; matching LRC preference for Plain/missing records; explicit replacement confirmation        | [Import](how-to.md#create-timed-lyrics-from-a-text-file)                 |
| Sentence timing      | Start/end stamps, row insertion/deletion, timing steps, shifts, session Undo/Redo, configurable shortcuts                              | [Sentence editing](editing-guide.md#edit-lines-and-text)                 |
| Waveform             | Cached peaks, click to seek/play, playhead position, point/button zoom, panning, playback following, visible time range                | [Waveform](how-to.md#zoom-and-follow-without-looping)                    |
| Sentence markers     | Exact Start/End readouts, shaded range, provisional previews, separate Sync confirmation, Cancel, overlap warnings                     | [Markers](how-to.md#place-precise-markers-and-preview-before-confirming) |
| Overlap prevention   | Enabled by default; saved Configuration setting; status shown when disabled; intentional overlap opt-out                               | [Reference](editing-guide.md)                                            |
| Word editing         | Word selection, independent lane zoom, read-only wording, safe drag boundaries, millisecond Start/End, manual sequential Sync word | [Word timing](how-to.md#edit-individual-words)                           |
| Single-word audition | Persistent Loop word, selected-word bounds, Lead-in/Tail, precise 10/25/50/100 ms editing, no advance while syncing a looped word      | [Word loops](how-to.md#loop-one-word-for-precise-timing)                 |
| Readable playback    | Read-only word follow-along without resizing timing boxes; gaps respected; does not change the document or seek audio                  | [Preview](how-to.md#review-words-without-resizing-timing-boxes)          |
| Phrase playback      | Selected-phrase loop, preview bounds, slower playback, volume, persistent loop mode across selection changes                           | [Loops](how-to.md#loop-between-the-markers)                              |
| Sidecar exports      | Independent TXT, standard LRC and optional ELRC choices; ELRC starts unchecked and remembers the user's choice                         | [Export](how-to.md#save-and-export-for-playback)                         |
| Embedded lyrics      | Optional MP3 ID3v2.4 UTF-8 USLT/SYLT and custom TXXX ELRC; FLAC Vorbis comments; staged writes without audio re-encoding               | [Embedding](how-to.md#embed-standard-and-enhanced-lyrics-in-mp3)         |
| Publishing           | Explicit Save and Publish confirmation for the configured LRCLIB server; structured lyrics including saved word timing; no ELRC sidecar upload                 | [Output](editing-guide.md#save-export-and-publish)                       |
| Preferences and help | Light/dark themes, saved hover-help switch default off, F1 help with timeout, configurable shortcuts                                   | [Help](editing-guide.md#themes-diagnostics-and-limits)                   |
| Packages             | Linux x64 Debian upgrade and AppImage, full source archives, supported Windows MSI build script and manual build workflow              | [Packages](packages.md)                                                  |

## Boundaries and data protection

Timing is manual; estimated word boxes are not automatic speech alignment.
Audio notifications occur about every 40 ms; saved times have millisecond
resolution, while audible looping is not sample accurate. Player support for
word-timed sidecars/embedded lyrics varies. Standard LRC remains available.

Import, refresh and preview do not rewrite music or source sidecars. Save keeps
the working document; export writes selected formats. Export checks staged
files before replacement, but separate destinations can succeed independently.
Keep your own backups. Session Undo is not a permanent file history.

![Current word loop controls](screenshots/current/selected-word-loop-light.png)
![Current embedded export choices](screenshots/current/embedded-word-export-dark.png)

See [troubleshooting](troubleshooting.md) for short/missing word labels, Reset,
loop behavior and package compatibility. The proposed one-click automatic word
alignment feature is not implemented.
