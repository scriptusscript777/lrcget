# Unfinished lyrics and recovery

Recovery is automatic in source version 2.3.0. Only the song/lyrics item being edited receives a draft;
recovery does not change library Synced/Plain status, Modified dates, music,
sidecars or the last explicit SQLite save.

## Continue unfinished work

1. Edit plain text, sentence text/timing or word timing normally. Recovery runs
   silently; storage errors and recovery conflicts still display when needed.
2. Close the editor or app when needed. Draft writes happen immediately as the
   working document changes; recovery does not depend on a shutdown handler.
3. Reopen LRCGET. The main window names the latest unfinished song. Choose
   **Resume editing**, or open that song's editor yourself. Other songs retain
   their own drafts. For standalone LRCLIB edits, reopen that lyrics item.
4. Your draft replaces the editor's working copy, with the saved tab, sentence,
   selected word and expanded word timing panel. Unconfirmed waveform markers
   remain previews: use the normal sentence Sync action to commit them or Cancel
   to discard them. Recovery does not start playback or resume looping.
5. If saved lyrics changed since the draft was created, choose **Restore draft**
   or **Keep saved lyrics**. Recovery will not silently overwrite newer saved data.

Sentence text still being typed is retained in the recovery copy. Changed wording
clears that sentence's old word timings, just as a normal sentence text edit does.
Undo history and uncommitted pointer movements are not retained across restarts.
Word dividers released into the document and staged waveform previews are retained.

## Save and cleanup

Normal **Save** persists the document to SQLite. Export still writes only the
selected TXT, LRC, ELRC or embedded targets. A successful document save removes
only that project's now-unneeded recovery draft. Edits made during saving,
unconfirmed waveform previews and unfinished sentence typing remain protected.
Other songs' drafts, exports, recordings and unrelated temporary files stay intact.
Exports already use owned staging files that are removed on normal completion or
failure; recovery introduces no extra sidecars in music folders.

If an export fails after SQLite Save succeeded, your work remains saved internally;
retry the export. Standard LRC/TXT cannot carry full word timing: retain the internal
save or select ELRC when you need that information in a sidecar.

## Limits and errors

Recovery uses the existing app profile's local browser storage, separate from
SQLite. It survives ordinary editor/app closing and application crashes. It is
not an independent backup against disk failure, clearing app data or power loss
before the browser flushes storage to disk. Run one editing instance at a time;
concurrent editors of the same song do not merge drafts.

Storage errors show **Recovery unavailable**, and closing the editor requires a
choice before discarding unprotected work. Save remains available for a storage
write failure. Unreadable drafts are preserved until you explicitly choose
**Discard unreadable recovery**; resolve that choice before saving. A resumed
song must still match its library identity, so a reused ID cannot load another
song's draft.

Word timing range/overlap warnings use yellow text on a dark background in both
themes. Prevention remains enabled by default and rejected edits retain the
last accepted word timing.

![Recovered unfinished editing — light](screenshots/current/editor-recovery-restored-light.png)
![Recovered unfinished editing — dark](screenshots/current/editor-recovery-restored-dark.png)

The main-window unfinished-lyrics notice starts to the right of the debug icon;
long song names wrap within the available width.

![Recovery notice spacing](screenshots/current/recovery-notice-aligned-light.png)
![Recovery notice in dark mode](screenshots/current/recovery-notice-aligned-dark.png)
