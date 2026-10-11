# Creating and Editing Timed Lyrics

Rick Lidgett's enhanced LRCGET build, `2.2.7`.
Original project authors and license remain credited.

[Illustrated overview](app-overview.md) | [Step-by-step how-tos](how-to.md) | [Documentation index](README.md)

## Quick Workflow

1. Open your music library and select the recording you want to edit.
2. Open its lyrics editor. Import TXT/LRC or use the online lyrics search.
3. Use **Synced** to listen, set line starts/ends and refine markers.
4. Preview each change, use **Sync Sentence Start/End**, then **Save**.
5. Open the arrow beside Save and choose **Synced lyrics (.lrc)**, then
   **Save and export**. Choose embedding separately if you want it.

Do not select **Save and Publish** unless you want to upload lyrics to LRCLIB.

## Library, Search and Refresh

Add your music directory through the library controls, then let the scan finish.
Search LRCLIB for the selected recording, checking artist, title and duration
before choosing a result. A different recording/version may have different timing.
Bulk lyric downloading and manual editing are separate workflows: review a
downloaded timeline against your recording before relying on its timing.

Opening LRCGET scans the initialized library incrementally. Close editing dialogs,
then press **F5** or use **Refresh library (F5)** to scan after adding/removing files.
An active scan cannot be started again. Refresh does not publish/export lyrics,
and it does not automatically overwrite database-owned lyrics with external edits.
To load an LRC you edited in another application, explicitly import that file.

### Modified Column

Track, album and artist lists show **Modified** between Lyrics and the action
buttons. A green badge and local date/time record your last lyric save in
LRCGET. The date updates only after a successful editor save, not when you
merely open a song, download lyrics or refresh the library. Unsaved edits do
not change it. Imports become recorded edits when you save them in the editor.

The database keeps this date through app restarts, F5 and rescans. Removing the
song from its directory removes its library row on the next refresh. Existing
orphaned lyric preservation still applies if a removed song is later re-added.
Older edits with no recorded date show `--`; this version cannot infer when
they were edited. File-system modification dates are not used as lyric-edit dates.

Normal and maximized windows share aligned columns. In a very narrow window,
scroll horizontally to see the date and action buttons.

## Start With Lyrics and a Recording

- **Plain text file:** click the header **Import lyrics file** icon and choose
  a `.txt` file, one sung phrase per line. It creates untimed synced rows for
  you to time against the recording; it does not invent timestamps.
- **Online lyrics:** use LRCGET's built-in LRCLIB search. A synced result already
  has timestamps; a plain result needs manual timing.
- **Genius or another website:** copy the lyrics into **Plain**. Arbitrary website
  URLs are not imported or scraped by LRCGET.
- **Existing LRC or timestamped TXT:** use the same **Import lyrics file**
  action. Line timestamps are detected automatically, including `[mm:ss.xx]`
  and millisecond precision. Existing times become editable synced rows.
  **Paste LRC content** remains available in the empty Synced editor.

Import asks before replacing existing words/timings. Cancel leaves them intact.
Import does not rewrite your source TXT or LRC file. Save/export is a separate action.
Malformed files are rejected before replacing existing lyrics. The picker supports
plain TXT, line-timed LRC and enhanced inline ELRC (including enhanced .lrc files).
ELRC retains mixed untimed rows and explicit word gaps. Nonzero offset headers and
ambiguous repeated line tags with absolute word times need correction first.

![Light theme: confirmation before replacing lyrics](screenshots/current/lyrics-import-light.png)

![Dark theme: confirmation before replacing lyrics](screenshots/current/lyrics-import-dark.png)

You need the corresponding audio recording to listen and set timings. LRCGET
does not run Whisper/Demucs or automatically align plain text to singing.

![Untimed imported text has no confirmed waveform markers](screenshots/current/overlap-untimed-dark.png)

## Create a Timeline

1. Import a plain text file using the header icon, or paste your words into **Plain**.
2. File import opens untimed **Synced** rows. For pasted plain text, open **Synced**
   and select **Import from plain lyrics** when it is empty.
3. Play the recording, select a line and press **Space** when its singing starts.
4. Press **Shift+Space** when that line finishes. Select the next line and repeat.
5. Replay and refine with phrase looping, waveform markers and timing steps.

These are default shortcuts; customized bindings appear in the keyboard menu.
Use the synced editor rather than typing in a text field when invoking shortcuts.

## Edit Lines and Text

Use **Plain** for wording without timestamps and **Synced** for timed rows.
Select a synced row, then double-click its text to edit its phrase or adjust its start/end. The plus buttons
insert before, between or after rows; delete deliberately removes the selected row.
The selection toolbar can shift or delete multiple selected rows.
Use Undo/Redo to recover a synced edit while the editor session remains open.
Unsaved edits require confirmation when closing.

Importing a file replaces the editor's plain and synced working content only
after you confirm. It is not a merge of two lyric versions. Keep your original
TXT when importing a separate LRC; neither source is rewritten by import.
Exporting TXT or LRC can replace an existing destination of that same type.

| Default Key              | Synced Editor Action                                |
| ------------------------ | --------------------------------------------------- |
| Up / Down                | Select previous / next line                         |
| Space                    | Set selected line start at playback position        |
| Shift+Space              | Set selected line end at playback position          |
| N                        | Set end and advance to next line                    |
| Enter                    | Set start, set previous line end and advance        |
| Shift+Enter              | Set start and advance without changing previous end |
| Left / Right             | Shift line by the chosen timing step and replay     |
| Shift+Left / Shift+Right | Adjust line end by the chosen timing step           |
| P / Shift+P              | Replay selected / previous line                     |
| Backspace                | Delete selected line                                |
| Ctrl+Z / Ctrl+Shift+Z    | Undo / redo synced edits                            |
| Ctrl+S                   | Save the editor document                            |

Marker focus uses Left/Right to nudge that marker instead of shifting a lyric
row. Text input and active tools have their own keyboard behavior. Open the
keyboard icon to see current bindings, configure replacements or reset them;
resolve any highlighted duplicate shortcuts.

## Playback and Phrase Loops

Use the editor's playback controls to play/pause, seek and adjust playback speed. Slower
playback can help locate consonants or long held notes; saved timestamps remain
positions in the original recording, not the slowed playback clock.

Select a timed line and enable **Loop selected phrase**. **Lead-in** and **Tail**
add listening context around that phrase without changing its lyric timestamps.
Both context values default to zero: the loop is exactly between the two markers.
Released/nudged marker previews are used immediately for auditioning; dragging
does not continuously reseek the player. Sentence Sync confirms them; Cancel returns the
loop to the saved document boundaries. Changing selected lines moves the loop to
the new lyric's markers without turning it off. Sentence Play, word playback,
pause/resume, waveform seeking and zoom preserve the toggle. Waveform seeking
uses the current selected range; it does not select a different lyric.
Untimed/reversed selections suspend repetition and show a short status message;
selecting valid markers resumes it. Switching to Plain suspends repetition and
returning to Synced restores it.
Turn looping off when you want to continue through the whole song.
Changing recordings or closing the editor cancels a pending loop start. A player
failure stops looping and displays an error rather than repeatedly seeking.
Saved row timestamps and word timing remain committed until confirmation.
Sentence highlighting uses the proposed bounds as soon as a marker moves;
previewing does not save or rewrite lyric words.

## Zoom and Precision

Automatic hover help is **off by default**. In Configuration, turn **Show hover
help** on/off and Save; the choice survives restarting. When on, descriptions
appear after a one-second deliberate hover and close two seconds later. F1 over
a control (or with keyboard focus) shows its help even when automatic help is off.
Moving away, clicking, scrolling or Escape closes help immediately. The bubble
never blocks input; accessible descriptions remain available.
The waveform shows
the playhead position as `mm:ss.mmm`; the player reports updates every 40 ms,
so three decimal places do not imply 1 ms playback accuracy.
Each marker uses a single vertical guide. The start handle is at the top and
the end handle at the bottom, making close boundaries separately selectable.
Resyncing a start outside the zoomed view reveals it without changing zoom.
Only an active Loop bounds the displayed playhead while a repeat seek finishes.
Optional Lead-in/Tail extend the loop range; set both to zero for exact markers.
Normal Play continues beyond the end marker.

Sentence **Play** buttons remain visible without hovering. Click one to select
its markers and play from that sentence. Loop stays on when enabled; the new
selected range repeats. With Loop off, playback continues forward and Follow
Lyrics can move the selection. Turn the Loop button off explicitly for continuous
playback. Timing-edit auditions also retain Loop. An untimed sentence's Play button is disabled
until you assign its start; a start at `00:00.000` is valid.

On entering **Synced**, markers show the selected sentence's saved start/end.
If nothing is selected, the first timed lyric is selected, skipping opening
blank cues and untimed rows. Selecting another lyric updates the marker pair;
switching between Plain and Synced preserves your selection. Untimed rows
show provisional markers without confirmed timestamps. Selection alone never edits timestamps.

For untimed text, select a sentence and use sentence start sync at its beginning,
then end sync when it finishes. After setting only the start, the end marker is
provisional: its tooltip says **Inferred end** (the next timed lyric or recording
end). Sync Sentence End confirms your chosen end. Importing or entering
Synced does not invent timestamps or overwrite your original text file.

- Sentence start sync sets the start marker to playback and keeps the end fixed.
- Sentence shift arrows move the entire sentence, its words and both markers.
- End sync/arrows change only the sentence end and its end marker.
- Word timing leaves sentence markers fixed, including the first word. The next
  Sync word after a manual drag/precision edit preserves that accepted timing and
  selection. Other Sync actions stamp valid playback and advance when Loop word
  is off; Loop word keeps selection. Out-of-range stamps are rejected.
- Timing step chooses the nudge amount; choosing a step does not move anything.
- Follow Lyrics moves marker selection during playback, not saved timestamps.
  Manual selection, marker previews, word/text editing and loops hold the target.

Invalid boundaries are rejected with a message, and unavailable playback cannot
sync timestamps from another recording. Sync/nudge edits support Undo/Redo;
waveform drags require the corresponding sentence Sync action to commit their preview.

Double-click a point on the waveform to magnify it. Repeat to go deeper, then
drag or nudge the selected lyric's start/end markers and use Sync Sentence Start/End.
A single waveform click moves to that point and starts playback, including when
paused. Keyboard seeking retains paused inspection. Play resumes the current
position without restarting the recording. Double-click zoom preserves Follow:
while playing, the zoomed view advances to keep the playhead visible, with or
without Loop. Pause playback or turn Follow off to inspect a fixed region.
The minus and Fit controls zoom back out. Marker timestamps never move with zoom.

![Zoomed playback following in light mode](screenshots/current/waveform-follow-light.png)
![Zoomed playback following in dark mode](screenshots/current/waveform-follow-dark.png)

Magnification keeps a visible selected phrase marker in view, rather than
anchoring to an unrelated playhead. Zoom preserves the playback-follow setting;
when following is enabled, the view advances with the moving playhead.
At high magnification, a phrase can span more than one
window; scroll to reach its other marker.

Use a horizontal trackpad gesture, mouse wheel over the waveform or the bottom
pan control. Manual panning disables follow, so playing audio does not pull
your view away. Pause and play again to resume following after manual inspection,
or use the crosshair follow button. If you explicitly turn that button off,
it stays off until you turn it on. Marker timestamps stay fixed through zoom,
scrolling and playback, including after an edit; only deliberate timing edits
move them.

Drag the start/end markers, or focus a marker and use Left/Right with the
selected 10/25/50/100 ms timing step. Shift multiplies a marker nudge by ten.
Dragging or nudging a marker stages a preview. Use **Sync Sentence Start** or **Sync Sentence End** to confirm the corresponding
moved marker. Each confirmation is one undoable edit. **Cancel** restores the
last confirmed boundary times, including after repeated marker movements. Escape during a drag discards that drag; outside a
drag it discards the pending preview. Switching phrases or closing the editor
also discards unconfirmed previews.

Start-marker changes shift that line's word timings while holding its preview
end fixed. End-marker changes cannot truncate timed words. Playback, zoom and
scrolling leave both preview and committed recording timestamps unchanged.
Save/export uses the confirmed lyric document: apply your markers first.

Expand **Word timing** only when individual-word timing is needed. Its 1-8x
zoom and horizontal scrolling are separate from waveform zoom.

![Light theme: double-click point zoom with pending marker preview](screenshots/current/point-zoom-light.png)

![Dark theme: double-click point zoom with pending marker preview](screenshots/current/point-zoom-dark.png)

## Individual Words

**Follow Lyrics** is enabled initially when you open **Word timing**. During
normal playback the boxes advance to the current lyric, including backward
seeks. Selecting a row pins it; click **Follow Lyrics** to resume. Loops,
marker previews, word drags and text edits hold the selected line in place.
This changes the editing selection, not the recording or saved timestamps.

Expand **Word timing** and select a line. Use **Play** to listen, **Pause/Resume**
to pause and continue at the current position without restarting the sentence,
and **Sync word**
to place the selected separator at the current playback position, and the
divider handles to refine word boundaries. The word lane has its own zoom and
scrolling; changing it does not zoom the waveform. **Reset** resets that line's
word timing, so use it only when you intend to rebuild those boundaries.
Collapse the word lane when you only need line-level timing.

Word boxes are read-only text. Edit wording in the sentence row; double-click
selects a word without splitting it. F2/right-click no longer edit word spelling,
and Delete cannot remove a sentence while Word timing is expanded. Collapse the
lane before using sentence-delete shortcuts. Every released timing drag is one
Undo/Redo action. The next Sync word preserves manual drag/precision edits;
the button then stays gray/disabled until another timing adjustment. Otherwise
it stamps playback within the selected word's safe bounds. A rejected
stamp reports why and never shifts neighbors or advances selection.

![Dark theme: word timing with safe Sync](screenshots/current/word-timing-protected-dark.png)

![Precise word timing and independent lane zoom](screenshots/current/selected-word-loop-light.png)

## Save, Export and Publish

Save retains the editor's changes. Use **Export** with **Synced lyrics (.lrc)**
selected to write a playback sidecar. Select embedded lyrics too if desired;
that option requires optional embedding enabled and a supported audio file.
Embedding/exporting writes the track or sidecar; waveform navigation does not.

**Publish** sends lyrics to LRCLIB, with confirmation. Local saving/exporting
does not itself publish your lyrics. Player support for lyric display varies.

| Action                 | Result                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Save                   | Retains edits in LRCGET's lyric document; does not itself export sidecars |
| Save and export: TXT   | Writes plain lyrics beside the track                                      |
| Save and export: LRC   | Writes timed lyrics beside the track; selected initially                  |
| Save and export: ELRC  | Writes saved word timing to a separate `.elrc`                            |
| Save and export: Embed | Writes lyrics into supported audio metadata                               |
| Save and Publish       | Uploads lyrics to the configured LRCLIB instance after confirmation       |

TXT and LRC export coexist; exporting one does not delete the other. A chosen
format can replace its existing destination, so leave TXT unchecked to avoid
rewriting that TXT. Confirm waveform marker previews before saving/exporting.

![Light theme: LRC, TXT and embedding choices](screenshots/current/embedded-word-export-light.png)

![Dark theme: LRC, TXT and embedding choices](screenshots/current/embedded-word-export-dark.png)

If **Embed into track** is disabled, enable optional lyric embedding in
settings and check that the recording is supported. MP3 embedding uses ID3v2.4
UTF-8 USLT/SYLT, with milliseconds for synchronized words. Audio is not
re-encoded. Some car stereos, Windows players and Jellyfin clients cannot
display these lyrics; retaining the `.lrc` sidecar is still useful.

## Safe Saving

Exports stage and validate their output before atomically replacing a destination.
Failed preparation leaves the original untouched and removes temporary files.
Successful saves do not create `.bak` files; old `<filename>.lrcget.bak` files
for that exact destination are removed after a successful replacement. Unrelated
backups are not deleted. Embedded export needs space for one staged audio copy.
Keep separate backups if you need version history.
Read-only, symlink/non-file destinations and detected external edits can block
an export. Resolve the error and retry rather than assuming every target saved.

## Themes, Diagnostics and Limits

Select light or dark appearance in settings; waveform and timing controls follow
the theme. The bug icon opens the YAML document view for diagnostics. This view
is not an acoustic timing validator.

No separate WAV conversion is required. A waveform is decoded once and cached;
zoom, playback and theme changes reuse it. Changed files can rebuild the cache.
An unavailable waveform should not prevent text editing or normal playback.

For missing words, correct the trusted text manually. For a wrong recording,
choose the right audio before timing. For lyrics that do not appear in a player,
check that you exported LRC/embedded lyrics rather than only pressing Save,
and that the player supports the format. This app does not automatically detect
lead vocals, guarantee exact lip sync or run Whisper/Demucs.

## Current Views

![Light theme: previewed markers awaiting confirmation](screenshots/current/marker-color-pending-light.png)

![Dark theme: previewed markers awaiting confirmation](screenshots/current/marker-color-pending-dark.png)

The preview timestamps above the waveform differ from the unchanged lyric-row
timestamps. Sync Start/End confirms each boundary; Cancel restores the last confirmed pair.

![Light theme: zoomed phrase end and manual pan](screenshots/current/waveform-navigation-light.png)

![Dark theme: zoomed phrase end and manual pan](screenshots/current/waveform-navigation-dark.png)

Current word-timing and word-loop screenshots were refreshed for 2.2.7. Earlier unchanged feature captures remain labeled by their behavior.
Unchanged native marker/playback captures use demonstration lyrics and generated
silent audio; the screenshot index records each group’s version and provenance.
A waveform shows the full mix; it is not proof of exact singer alignment.

### Waveform Playhead Continuity (.22)

The playhead advances smoothly with audio. Pause holds its position; Play
continues from there. Zoom buttons, double-click zoom, Fit and panning change the
view without changing the recording position or lyric timestamps. Follow keeps
the playhead visible during zoomed playback unless explicitly turned off.

![Click-to-play waveform in light mode](screenshots/current/waveform-click-play-light.png)
![Click-to-play waveform in dark mode](screenshots/current/waveform-click-play-dark.png)

### Start and End Marker Times (2.2.1)

Select a timed lyric in Synced to see **Start** and **End** above the waveform.
The values use `mm:ss.mmm` and remain visible when a marker is outside the zoomed
view. Dragging or nudging updates the values immediately. **Preview** identifies
unconfirmed changes; Sync Sentence Start/End commits them, and Cancel restores saved times.
For a lyric without an explicit end, hover End and press F1 to read its inferred-end explanation.
Untimed selections display provisional markers without inventing timestamps;
confirm Start before End. Invalid ranges do not display editable markers.

A faint shaded range joins the two markers. It follows their preview positions
and clips to the visible view; it disappears for an entirely off-screen phrase
or an invalid range. The overlay does not intercept clicks or drags.

### Neighboring Lyrics and Final-Line Loops (2.2.2)

A warning appears when Start passes the previous lyric's end or End passes the
next lyric's start. It updates during drag/nudge previews and remains visible
through zooming/panning. Exact adjoining boundaries show no warning. Untimed
neighbors are skipped; a previous lyric without an explicit end uses the saved
current start as its inferred end. Distances describe crossed boundaries, not
the duration of every possible overlapping phrase. Correct accidental crossings
before confirming. Turn off **Prevent overlapping lyrics** for intentional overlaps. Neighboring lyrics are never moved
automatically. Cancel restores the saved pair and its warning state.

For the last lyric without an explicit end, Loop uses the known recording end,
matching the waveform's inferred-end behavior. Without a known duration, that
loop stays unavailable until loading completes.

![Next lyric crossing in light mode](screenshots/current/overlap-setting-warning-light.png)
![Next lyric crossing in dark mode](screenshots/current/overlap-setting-warning-dark.png)
![Overlap protection](screenshots/current/overlap-setting-warning-dark.png)

![Start and End in light mode](screenshots/current/marker-color-pending-light.png)
![Start and End in dark mode](screenshots/current/marker-color-pending-dark.png)

### Optional Hover Help (2.2.4)

Open Configuration and find **Show hover help** under Common. The default is off
so tool descriptions do not appear over your work. Save applies and remembers
your choice; closing without Save discards the draft. A failed save keeps the
previous preference and shows a retry message. F1 always provides help on demand.
Existing configured shortcuts have priority over F1 help.

![Hover help setting in light mode](screenshots/current/embedded-lyrics-settings-light.png)
![Hover help setting in dark mode](screenshots/current/embedded-lyrics-settings-dark.png)
![On-demand help in light mode](screenshots/current/timed-hover-help-light.png)
![On-demand help in dark mode](screenshots/current/timed-hover-help-dark.png)

### Persistent Loop Navigation (2.2.5)

The Loop toggle stays on while navigating within the current recording. Selecting
another lyric uses its markers; waveform seeking stays within the current selected
loop range. Zoom/pan and word playback preserve the mode. Paused navigation does
not start audio. Plain/instrumental/untimed states suspend repetition without
losing the choice. Invalid ranges leave the Loop button enabled so you can turn
it off. Source changes, editor closure and playback failures reset the mode.

![Persistent Loop in light mode](screenshots/current/loop-persistent-navigation-light.png)
![Persistent Loop in dark mode](screenshots/current/loop-persistent-navigation-dark.png)

### Marker Confirmation and LRC Gaps (2.2.6)

Move Start/End to preview sentence highlighting with its normal colors. Use the
matching **Sync Sentence Start** or **Sync Sentence End** action to confirm that
boundary; an unchanged boundary uses playback. Confirm Start first on untimed text.
The other pending boundary survives confirmation, and Cancel restores only the
unconfirmed changes to the last confirmed pair. Save persists confirmed timings.

**Prevent overlapping lyrics**, in Settings → Configuration → Common, defaults on as a saved Configuration preference. Crossings can be
previewed but cannot be confirmed unless resolved or protection is turned off.
Standard LRC has start cues rather than separate end fields: export represents
confirmed gaps of at least 250 ms with empty timestamped cues and also marks
confirmed final ends. Duplicate clears and clears during overlapping lyrics are
avoided. Exact end times remain in internal saved data; a bare LRC reimport can
only recover the gaps represented by its timestamps, with blank cues as timed rows.

## Confirm Marker Previews and Cancel

After moving a waveform marker, its original sentence Sync icon turns amber.
Only the color changes; there is no extra text or button resizing.
The start button beside Play confirms only the pending start; the end button
confirms only the pending end. Without a pending edit, each ordinary button still
uses the current playback position.

**Cancel** is always visible beside the waveform marker times. Release the drag,
then Cancel to discard every unconfirmed movement, even after repeated edits or
zooming. It restores the last confirmed pair; it keeps any boundary already
confirmed. **Undo** reverses confirmed edits, and **Redo** reapplies an undone edit.
F1 over either arrow explains its action, including when disabled.

Word Timing shows the time range and editable word boxes without repeating the
sentence in its header.

![Confirm and Cancel, light](screenshots/current/marker-color-pending-light.png)
![Confirm and Cancel, dark](screenshots/current/marker-color-pending-dark.png)
![After Cancel](screenshots/current/marker-color-cancelled-light.png)

![Word Timing without duplicate header text, light](screenshots/current/marker-color-word-timing-light.png)
![Word Timing without duplicate header text, dark](screenshots/current/marker-color-word-timing-dark.png)

## Export Word Timing as Enhanced LRC

Enhanced LRC export is optional. Under **Save → Export to track’s directory**,
select **Word-timed lyrics (.elrc)**. It starts unchecked; selecting or clearing it
is remembered across editor openings and app restarts. Configuration has no
separate ELRC default switch. Existing saved selections are preserved.

Confirm your edits, including word timing, before exporting. ELRC uses the saved
word starts and ends, with millisecond precision; it preserves known word silence
and the existing sentence gap cues. Mixed documents keep line-only sentences as
normal timed lines. It does not analyze the recording or create accurate karaoke
timing automatically. No saved word timing means ELRC is skipped; invalid saved
word timing reports an error. Both cases leave an older ELRC untouched, and the
other selected formats still run. Check partial-export messages.

Example of a saved word-timed line:

```text
[00:01.000]<00:01.000>Hello <00:01.500>world<00:02.000>
[00:02.000]
```

The final inline tag marks the word end; the empty timestamped line clears the
sentence. Existing rules avoid unnecessary sentence clear cues for gaps under
250 ms. TXT remains plain text, and standard LRC remains line-timed.

Keep the local saved lyric document to reopen and edit word timing. The editor
can also import TXT, LRC and ELRC with the file picker; explicit word ends and
gaps are retained. Automatic library scanning for .elrc sidecars is not added. Karaoke display depends on the
player. Jellyfin 10.11's server parser supports word cues, but this update does not add
word highlighting to Jellyfin's web player. Keep standard LRC for line playback.
Sources: [Jellyfin LRC parser](https://github.com/jellyfin/jellyfin/blob/v10.11.0/MediaBrowser.Providers/Lyric/LrcLyricParser.cs),
[Jellyfin web lyric player](https://github.com/jellyfin/jellyfin-web/blob/v10.11.0/src/controllers/lyrics.js).

![TXT, LRC and Enhanced LRC exports, light](screenshots/current/embedded-word-export-light.png)
![TXT, LRC and Enhanced LRC exports, dark](screenshots/current/embedded-word-export-dark.png)
![Embedded lyrics settings, light](screenshots/current/embedded-lyrics-settings-light.png)
![Embedded lyrics settings, dark](screenshots/current/embedded-lyrics-settings-dark.png)

## Review Words Without Resizing Timing Boxes

1. In **Synced**, select a sentence and enable **Word preview** beside Word timing.
2. Press Play. The readable text highlights one word at a time using the current
   word boundaries. Boxes can stay collapsed; resizing is unnecessary.
3. **Follow Lyrics** is enabled when you turn on the preview. It follows the playing
   sentence. Manual selection/editing holds the target; re-enable Follow Lyrics
   when you want to continue through the song.
4. Turn on **Loop selected phrase** to repeat that phrase. The preview follows
   every rewind, and Loop remains enabled until you turn it off. Lead-in, tail,
   waveform zoom and word-timeline zoom retain their existing behavior.
5. Turn off Word preview to hide it. No timestamps change and nothing is saved or
   exported by this toggle. Preview state lasts for this editor session.

Explicit word ends clear the highlight during gaps. If no word timing is saved,
the preview labels its evenly spaced estimate; it cannot infer actual singing.
To create accurate word timing, expand Word timing and use Sync word against
playback, then save. The readable preview remains independent of box size/zoom.

![Read-only word playback preview, light](screenshots/current/word-playback-preview-light.png)
![Read-only word playback preview, dark](screenshots/current/word-playback-preview-dark.png)
![Loop and zoom with the readable preview](screenshots/current/word-preview-loop-zoom-light.png)

## Embed Standard and Enhanced Lyrics in MP3

Configuration now calls the section **Embedded lyrics**, with **Enable embedded
lyrics** as the saved opt-in. It remains an optional, saved setting.

| Frame                            | This build writes                                            | Meaning                                                 |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| USLT                             | Plain lyrics in the ordinary frame                           | Unsynchronized UTF-8 text                               |
| USLT, description `Enhanced LRC` | Optional complete ELRC text                                  | Text storage; this frame itself is unsynchronized       |
| SYLT                             | Line timing normally; word timing with Enhanced LRC selected | Binary synchronized strings with millisecond timestamps |
| TXXX, description `LYRICS_ELRC`  | Optional complete ELRC text                                  | Custom text field; name is this app's convention        |

For Enhanced MP3 embedding, select **Word-timed lyrics (.elrc)** and **Embed into
track** together, then Save and export. Normal plain USLT remains available while
ELRC has its own description. Missing saved word timing skips the ELRC sidecar
and uses normal line embedding; invalid requested word timing stops MP3 embedding
and leaves the old file intact. Ordinary embedding replaces old lyric variants
and removes the app's stale custom ELRC field, preserving unrelated metadata.

TXT, standard LRC and ELRC sidecars remain independent and can all be selected.
The app creates staged copies, verifies written lyric frames and atomically
replaces the selected audio file. It does not re-encode audio. Player support for
SYLT, ELRC text and custom fields varies; storing valid frames does not add karaoke
to every player. FLAC continues to use Vorbis lyric comments rather than ID3.
See [ID3v2.4 frame definitions](https://id3.org/id3v2.4.0-frames) and
[encoding/language rules](https://id3.org/id3v2.4.0-structure).

![Embedded lyrics configuration, light](screenshots/current/embedded-lyrics-settings-light.png)
![Embedded lyrics configuration, dark](screenshots/current/embedded-lyrics-settings-dark.png)

## Loop One Word for Precise Timing

1. Open **Synced → Word timing** and click the word you want to adjust.
2. Enable **Loop word**. It repeats that word until you turn the mode off.
3. Use **Lead-in** and **Tail** above the word lane for extra listening context;
   these change playback only, never saved timestamps. Both start at zero.
4. Set **Timing step** to **10 ms** or **25 ms**. Adjust the selected word’s
   **Start** and **End** fields in seconds (three decimal places), using the input
   arrows or typing the exact time. Boundaries are clamped to the sentence and
   neighboring words. These fields edit the word without moving sentence markers.
   The loop follows accepted edits. You can also drag starts.
5. Slow playback if needed. **Sync word** stays on the selected word while its
   loop is enabled; it does not automatically advance to another word/sentence.
6. Click another word or use the boundary navigation keys to move the loop.
   Zoom/scroll changes only the view. Word labels remain visible while scrolling.
7. Turn **Loop word** off when finished, or click **Loop sentence** beside it
   to repeat the selected sentence and waveform markers. The two modes never run
   together. Both sentence-loop buttons share the same state. Pause/Resume keeps
   your chosen mode; Lead-in/Tail apply to either range.

Explicit word ends preserve silence gaps; missing ends use the next word start
or sentence end. Estimated timing is labeled and is not saved merely by looping.
Editing estimated word boundaries saves word timing in the lyric document.
**Undo** restores timing edits. **Reset** returns word timings to estimates.

Collapsing Word timing suspends word repeats and preserves the target. Reopen to
resume, or use **Stop word loop** without reopening. Inactive tabs and untimed
sentences also suspend repeats; switching tracks or closing the editor ends the
loop. Playback auditions use the existing player clock (40 ms updates), so loop
playback is not sample-accurate; saved timestamps retain millisecond precision.

Save/export keeps the existing TXT, LRC, ELRC and MP3 embedded format choices.
Loop selection, context and zoom are listening aids, not exported lyric events.

![Selected word loop, light](screenshots/current/selected-word-loop-light.png)
![Selected word loop, dark](screenshots/current/selected-word-loop-dark.png)

See [server word timing and enhanced import](how-to.md#download-and-reopen-word-timed-lyrics) for fallback and reopen details.

## Automatic unfinished-work recovery

Unfinished lyrics are protected separately from normal saves and exports.
Reopen the song or use Resume editing to recover it. Successful Save cleans
only that project's completed draft; newer edits and pending markers remain.
Word timing warnings now use yellow text. See the [recovery guide](recovery.md)
for restoration, conflicts, cleanup and limitations.

## Master reset for the current lyrics project

A reset icon beside YAML debug stays visible in both tabs and gray in Plain.
Synced mode opens a warning and choices to return to the last save or clear
all timing while keeping text. Cancel keeps work; confirmation affects only
this song. See the [illustrated reset guide](master-reset.md).

![Word timing with Sentence loop selected](screenshots/current/selected-sentence-loop-light.png)
![Sentence loop in dark mode](screenshots/current/selected-sentence-loop-dark.png)
