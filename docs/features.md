# Complete feature index — 2.2.7

This describes the current fork, including the original library/downloader and
Rick's editor enhancements. See the [illustrated overview](app-overview.md),
[how-tos](how-to.md), [editing reference](editing-guide.md) and
[packages/source](packages.md). Historical releases describe their own behavior.

| Area                 | Available features                                                                                                                     | Guide                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Library              | Configured music directories, scanning, artist/album/track views, search, lyrics status, Modified date, incremental startup/F5 refresh | [Library](editing-guide.md#library-search-and-refresh)                   |
| Finding lyrics       | LRCLIB search/download with validated word timing and automatic LRC/plain fallback, recording metadata/duration comparison, bulk download and configured server                                | [Search](how-to.md#find-lyrics-online)                                   |
| Local inputs         | Plain TXT, timestamped TXT, LRC and ELRC import; matching LRC preference for imported Plain/missing records; manual-save protection; explicit replacement confirmation        | [Import](how-to.md#create-timed-lyrics-from-a-text-file)                 |
| Sentence timing      | Start/end stamps, row insertion/deletion, timing steps, shifts, session Undo/Redo, configurable shortcuts                              | [Sentence editing](editing-guide.md#edit-lines-and-text)                 |
| Waveform             | Cached peaks, click to seek/play, playhead position, point/button zoom, panning, playback following, visible time range                | [Waveform](how-to.md#zoom-and-follow-without-looping)                    |
| Sentence markers     | Exact Start/End readouts, shaded range, provisional previews, separate Sync confirmation, Cancel, overlap warnings                     | [Markers](how-to.md#place-precise-markers-and-preview-before-confirming) |
| Overlap prevention   | Enabled by default; saved Configuration setting; status shown when disabled; intentional overlap opt-out                               | [Reference](editing-guide.md)                                            |
| Word editing         | Word selection, independent lane zoom, read-only wording, safe drag boundaries, millisecond Start/End, manual sequential Sync word, gray confirmation lock, additional Pause/Resume | [Word timing](how-to.md#edit-individual-words)                           |
| Single-word audition | Persistent Loop word, selected-word bounds, Lead-in/Tail, precise 10/25/50/100 ms editing, no advance while syncing a looped word      | [Word loops](how-to.md#loop-one-word-for-precise-timing)                 |
| Readable playback    | Read-only word follow-along without resizing timing boxes; gaps respected; does not change the document or seek audio                  | [Preview](how-to.md#review-words-without-resizing-timing-boxes)          |
| Phrase playback      | Loop sentence beside Loop word in word timing, shared selected-phrase loop, preview bounds, slower playback, volume, persistent loop mode across selection changes                           | [Loops](how-to.md#loop-between-the-markers)                              |
| Sidecar exports      | Independent TXT, standard LRC and optional ELRC choices; ELRC starts unchecked and remembers the user's choice                         | [Export](how-to.md#save-and-export-for-playback)                         |
| Embedded lyrics      | Optional MP3 ID3v2.4 UTF-8 USLT/SYLT and custom TXXX ELRC; FLAC Vorbis comments; staged writes without audio re-encoding               | [Embedding](how-to.md#embed-standard-and-enhanced-lyrics-in-mp3)         |
| Publishing           | Explicit Save and Publish confirmation for the configured LRCLIB server; structured lyrics including saved word timing; no ELRC sidecar upload                 | [Output](editing-guide.md#save-export-and-publish)                       |
| Preferences and help | Light/dark themes, saved hover-help switch default off, F1 help with timeout, configurable shortcuts                                   | [Help](editing-guide.md#themes-diagnostics-and-limits)                   |
| Packages             | Linux x64 Debian upgrade and AppImage, full source archives, supported Windows MSI build script and manual build workflow              | [Packages](packages.md)                                                  |

## Boundaries and data protection

Timing supports manual edits and explicitly accepted estimates; estimated word
boxes are not automatic speech alignment.
Native audio-engine ranges repeat without a GUI seek per cycle. Active-loop
position updates arrive about every 10 ms; normal playback stays at 40 ms.
Saved times have millisecond resolution; display/device latency still applies. Player support for
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

## Automatic unfinished-work recovery

Unfinished lyrics are protected separately from normal saves and exports.
Reopen the song or use Resume editing to recover it. Successful Save cleans
only that project's completed draft; newer edits and pending markers remain.
Word timing warnings now use yellow text. See the [recovery guide](recovery.md)
for restoration, conflicts, cleanup and limitations.

## Restart one sentence’s word timing

Use **Reset words** to clear only the selected sentence’s word timing and
regenerate evenly spaced estimates. Text and sentence markers stay in place;
Undo restores the prior word timings. Master reset has been removed.

Word preview now matches sentence-row highlights during live word edits, using
the same clock and word-start rules. The current word stays highlighted until
the next word starts or sentence ends. Recovery notices clear the debug icon
and wrap long song names.

Word-editing maintenance (version remains 2.2.7): Follow Lyrics holds both word
views when off, independent manual adjustments retain confirmed ranges on Sync,
confirmed words stay gray until changed, and Reset words restarts one sentence’s
word timing with Undo support. Overlap status is green On/red Off in both themes.
Master reset is removed; recovery and TXT/LRC/ELRC Save/import/export remain.

## ELRC save with accepted estimates (version unchanged)

Editor **Save and export** with ELRC selected offers to fill missing word starts
after showing the number of affected sentences. Existing manual times, word gaps
and lyric text stay unchanged. Users may adjust some words and leave others alone.
Accepted estimates persist in the project and ELRC, with Undo support; Cancel does
not save or export. Untimed text must receive sentence timing first. Invalid saved
word data, too-short ranges and protected overlaps block preparation. Plain TXT
and standard LRC export alone do not estimate words. Library batch export and
server publishing retain their saved-data behavior. The green dot indicates valid
word timing, including accepted estimates, rather than manual verification.

See [illustrated export instructions](editing-guide.md#export-word-timing-as-enhanced-lrc).
