# Practical How-Tos

For Rick Lidgett's LRCGET **2.2.7**.
[Overview](app-overview.md) | [Full reference and shortcuts](editing-guide.md) | [Documentation home](README.md)

## Install or Upgrade

![LRCGET after installing the Debian package](screenshots/current/debian-startup.png)

1. Download the current `.deb` and checksum from the
   [2.2.7 release](https://github.com/scriptusscript777/lrcget/releases/tag/v2.2.7-windows-beta.1).
   See [all package and source instructions](packages.md) for AppImage and Windows.
2. Close LRCGET. In the directory containing the download, run:

```bash
sha256sum -c LRCGET_2.2.7_amd64.deb.sha256
sudo apt install --reinstall ./LRCGET_2.2.7_amd64.deb
```

3. Reopen LRCGET and let its startup scan finish.

The package upgrades the existing installed application, not a second copy.
This fork release supplies Debian amd64, AppImage x64 and an unsigned Windows x64
MSI beta. Follow the package guide for compatibility and Windows installation.

## Get Notified About New Releases

Each time LRCGET starts, it asks GitHub whether a newer version has been published
on the [fork's release page](https://github.com/scriptusscript777/lrcget/releases).
If one exists, an **Update available** window appears a few seconds after startup:

![Update available window, light theme](screenshots/current/update-available-light.png)
![Update available window, dark theme](screenshots/current/update-available-dark.png)

1. Read the version numbers. The window shows the new version, the version you
   are running and the one installer that matches your copy. LRCGET matches both
   the format and the processor type (currently 64-bit Intel/AMD):
   - Debian package (`.deb`) when LRCGET was installed with `apt`.
   - AppImage when LRCGET is running from an AppImage file.
   - Windows installer (`.msi`) on Windows.

   LRCGET is a desktop app. On a system it is not built for (phones, tablets,
   macOS or ARM computers) no alert appears, so a wrong package is never offered.
2. Choose one of the buttons:
   - **Download update** opens the matching installer download in your web
     browser. LRCGET never runs a downloaded installer by itself.
   - **See what's new** opens the release notes without closing the window.
   - **Later** closes the window. It appears again the next time you start LRCGET.
   - **Skip this version** hides the alert for that version only. A later release
     alerts again.

   The window lists the install steps for your format. They are also below.
3. To check by hand at any time, open the menu and choose **About**. The
   **Update** section shows your version and the newest published version.

### Install a downloaded update

Your music library, lyrics, settings and unfinished-work recovery are kept in
every case. The app identity (`net.lrclib.lrcget`) does not change between
releases. Optionally verify the download first with its `.sha256` file as shown
in the [package guide](packages.md#verify-downloads).

**Debian / Linux Mint (`.deb`)**

1. Close LRCGET.
2. Open a terminal in the download folder (usually `~/Downloads`) and run, using
   the actual file name:

   ```bash
   sudo apt install ./LRCGET_2.2.8_amd64.deb
   ```

3. Start LRCGET from the menu. The installed copy is upgraded in place; there is
   no second copy to remove.

**AppImage**

![AppImage update steps](screenshots/current/update-available-appimage-light.png)

1. Close LRCGET.
2. Make the new file runnable: right-click it, choose **Properties**, then
   **Permissions**, and turn on **Allow executing file as program**. Or run
   `chmod +x LRCGET_2.2.8_amd64.AppImage`.
3. Delete or replace the old AppImage file, and update any desktop shortcut so
   it points to the new file. Start the new file.

**Windows 10/11 (`.msi`)**

![Windows MSI update steps](screenshots/current/update-available-msi-dark.png)

1. Close LRCGET.
2. Double-click the downloaded `.msi` file.
3. If **Windows protected your PC** appears, choose **More info**, then
   **Run anyway**. The installer is not yet code-signed, so SmartScreen warns.
4. Follow the installer. It replaces the installed version; the old version is
   removed automatically and does not appear twice in **Installed apps**.

The alert waits while an editor or other window is open, so it never interrupts
unsaved work. Rebuilding the same version number does not produce an alert; only a
higher version (for example 2.2.8 or 2.3.0) does. Without an internet connection
the check stays silent and runs again at the next start. See
[Privacy](privacy.md#automatic-update-check) for what the check sends.

## Add Music and Refresh the Library

![Tracks list after adding music, light theme](screenshots/current/library-tracks-light.png)
![Tracks list after adding music, dark theme](screenshots/current/library-tracks-dark.png)

1. Add the directory containing your recordings using the library controls.
2. Wait for scanning to finish, then open a recording's lyrics editor.
3. After adding/removing recordings, close editing dialogs and press **F5**,
   or choose **Refresh library (F5)** in the library menu.

Refresh does not export or publish. When a recording has automatically imported/downloaded Plain or missing
lyrics, a valid matching LRC created by another application is picked up on
startup or F5. Its words take precedence over matching TXT; TXT fills missing
lyrics when no valid LRC exists. Manually saved and synced/instrumental lyrics are protected
and require explicit import to replace the working document.

Before: the matching TXT has been imported as Plain.

![Plain lyrics before a matching external LRC exists](screenshots/current/automatic-lrc-before-light.png)

After closing the app, creating a valid matching LRC and reopening: Synced.
Neither recording nor sidecar is rewritten by the scan.

![Synced lyrics after automatic external LRC detection](screenshots/current/automatic-lrc-after-light.png)

![Automatic external LRC detection in dark mode](screenshots/current/automatic-lrc-after-dark.png)

## Create Timed Lyrics From a Text File

1. Prepare a UTF-8 TXT with one sung phrase per line.
2. If copying from Genius, remove page credits, `[Verse]`/`[Chorus]` headings,
   contributor counts and other words that are not sung. LRCGET does not strip
   them or scrape a Genius URL for you.
3. Open the corresponding recording in the lyrics editor. Click **Import lyrics
   file**, select the TXT and confirm replacement if prompted.
4. The untimed rows open in **Synced**. Start audio with the main playback button;
   an untimed row's own Play button is unavailable until its start is set.
5. Select the first row. Press **Space** when that phrase begins; press
   **Shift+Space** when it ends. Select the next row and repeat.
6. Replay uncertain phrases, refine boundaries with zoom/markers, then Save and export LRC.

Use shortcuts outside text input fields. To paste instead of importing, paste
your words into **Plain**, switch to an empty **Synced** editor and choose
**Import from plain lyrics**. No automatic speech alignment is performed.

![Import replacement confirmation](screenshots/current/lyrics-import-light.png)

Your source TXT remains unchanged. The working Plain and Synced versions are
separate; editing synced text does not silently edit Plain or the source TXT.

![Imported text before any timestamps have been assigned](screenshots/current/overlap-untimed-light.png)

## Edit an Existing LRC or Timed Text File

![Importing an existing lyrics file, light theme](screenshots/current/lyrics-import-light.png)
![Importing an existing lyrics file, dark theme](screenshots/current/lyrics-import-dark.png)

1. Open the correct recording, not another mix/remaster with different timing.
2. Choose **Import lyrics file** and select its LRC or timestamped TXT.
3. Confirm replacement only when you want to replace the current document.
4. Select a synced line. Double-click its wording to correct it, or change its timestamps.
5. Listen to the start, last sung word and transition into the following line.
6. Save, then export LRC if you want the sidecar updated.

Import reads the source; export is the action that can overwrite an existing
destination. Leave TXT export unchecked to retain your original TXT. For
enhanced inline word tags or nonzero offset headers, convert to explicit
line timestamps before importing.

## Find Lyrics Online

![Search Lyrics window with LRCLIB results, light theme](screenshots/current/search-lyrics-light.png)
![Search Lyrics window with LRCLIB results, dark theme](screenshots/current/search-lyrics-dark.png)

1. In the **Tracks** list, click the search icon (magnifier on lines) beside the
   song. **Search Lyrics** opens with the track's title, album and artist filled in.
   Edit the fields if needed and click **Search**.
2. Compare title, artist and recording duration before selecting a result. Each
   result shows its line count, **Synced** or **Plain**, and how much longer (+) or
   shorter (-) it is than your recording. Click the eye icon to preview it and the
   save icon to use it. Tick **Show only word-timed lyrics** to filter.
3. Load the result and listen against your own audio. Plain lyrics need manual timing.
4. If no suitable result exists, copy trusted sung words into a TXT and use the text-file workflow.

Downloaded timing is not proof of a matching recording. This editor does not
automatically create missing words with Whisper or separate vocals with Demucs.

## Place Precise Markers and Preview Before Confirming

The recording controls show **Elapsed** and **Total** in `hh:mm:ss`. The waveform
shows **Position** (current playhead, `mm:ss.mmm`) and **View** (visible zoomed
time range). **Start / End** belong to the selected lyric; they do not show the
recording duration. Moving the playhead does not change marker times.

1. In Synced, select a timed lyric. Its start/end markers appear on the waveform.
   Read **Start** and **End** above the waveform for their exact millisecond times;
   both remain visible when a marker is outside the zoomed view.
   A faint highlight between the lines shows that lyric's selected time range.
2. Pause and zoom around the boundary. Use the upper handle for start and lower
   handle for end; each has one vertical guide.
3. Drag a handle, or focus it and nudge with Left/Right using the chosen timing
   step. Shift makes a marker nudge ten times larger.
4. Replay or loop the preview. The preview clock and sentence highlighting follow
   the proposed start/end; saved row timestamps stay unchanged until confirmation.
   The time row is labeled **Preview** and updates while you drag or nudge.
   The highlight follows the preview and clips to the visible waveform.
   If a boundary crosses the previous lyric's end or next lyric's start, a
   warning shows the distance in seconds. Correct an accidental crossing with
   a nudge/drag or Cancel. **Prevent overlapping lyrics** is in Settings → Configuration → Common and on by default;
   turn it off explicitly to confirm an intentional overlap.
5. Use **Sync Sentence Start** and **Sync Sentence End** to confirm the corresponding
   moved marker as separate undoable edits. **Cancel** restores the last confirmed
   timings; confirming one boundary preserves the other pending preview.

![Preview before confirming timestamps](screenshots/current/marker-color-pending-light.png)

![Start and End marker times in light mode](screenshots/current/marker-color-pending-light.png)
![Start and End marker times in dark mode](screenshots/current/marker-color-pending-dark.png)

![Warning before extending into the next lyric](screenshots/current/overlap-setting-warning-light.png)
![Overlap protection in dark mode](screenshots/current/overlap-setting-warning-dark.png)

Escape during dragging cancels that drag; otherwise it cancels the preview.
Changing phrases or closing discards unconfirmed previews. Confirm Start/End before Save/export.
For untimed text, first assign the line start; the provisional end says **Inferred
end** until you explicitly set or confirm it.

## Zoom and Follow Without Looping

1. Turn **Loop selected phrase** off for continuous playback.
2. Enable the crosshair **Follow waveform playback** button above the waveform.
3. Use Zoom in or double-click a waveform point repeatedly. Zoom preserves the
   audio position; Play continues from the current point. A single waveform click
   starts playback from the clicked point, including when paused.
4. Continue playing: the viewport advances when needed, retaining magnification.
5. For fixed-region editing, pause, turn Follow off or pan manually.

![Magnified playback with the moving line still visible](screenshots/current/waveform-follow-dark.png)

Zoom does not disable Follow. Manual panning temporarily holds the view;
pause/play or the crosshair resumes following. An explicitly disabled Follow
stays disabled until you enable it. Use the wheel, trackpad or bottom pan slider
to reach off-screen markers. Zoom and scrolling never change marker timestamps.

**Follow Lyrics** is a separate control: it selects the sentence being sung, so its
Start/End markers on the waveform move from sentence to sentence during playback.
It works in sentence (LRC) mode as well as with Word timing or Word preview open,
and is on when the editor opens. Clicking a line, pressing **Sync**, editing text
or selecting several lines holds your chosen sentence until your next **Play** or
**Resume**, so tapping Sync while the song plays is not affected. Opening or closing
Word timing or Word preview, or clicking **Follow Lyrics**, also resumes following.
Loop and unconfirmed marker changes hold the sentence until you finish them. Use
waveform Follow for viewport movement, Follow Lyrics for editing selection.

## Loop Between the Markers

1. Select a timed lyric and enable **Loop selected phrase**.
2. Set **Lead-in** and **Tail** to zero for exact marker-to-marker repetition.
3. Move/release marker previews to audition the revised range.
4. Confirm the corresponding Start/End when satisfied; Cancel restores saved bounds.
5. Turn Loop off to keep playing forward.

Lead-in/Tail add context to playback, not the saved lyric timestamps. Changing
selected lines moves the loop to the new lyric's markers while Loop stays on.
Sentence Play and word playback also retain Loop. Turn the Loop button off for
continuous playback. Untimed/reversed selections suspend repetition, keeping
Loop on and showing a short status message; select valid markers to resume.
Switching to Plain temporarily suspends repetition; returning to Synced resumes
it. Changing recordings, closing the editor or a playback failure resets Loop.

![Loop remains on after jumping to another sentence](screenshots/current/loop-persistent-navigation-light.png)

## Edit Individual Words

1. Select a timed row and expand **Word timing**.
2. Use its separate zoom/scrolling to inspect individual word boundaries.
3. Select a word, drag its left divider, or enter precise Start/End seconds.
   Releasing a drag applies one undoable timing edit; sentence markers stay fixed.
4. **Sync word** keeps that manual adjustment and selection, then turns gray and
   disables itself until the next divider or Start/End adjustment. Playback and
   repeated shortcuts cannot reapply it. Otherwise
   Sync stamps playback only inside the word's available sentence/neighbor bounds,
   then advances when Loop word is off. An unsafe stamp shows a message and keeps
   the words and selection unchanged. Loop word keeps the selected target.
5. Edit wording through the sentence row, not the word boxes. Double-click selects;
   F2/right-click do not open word editing and Delete cannot delete the sentence
   while the word lane is open. Collapse it before using sentence-delete shortcuts.

The additional **Pause/Resume** button beside Play pauses at the current position
and resumes there, retaining word Loop. **Play** keeps its existing replay behavior.

![Confirmed manual word timing disables Sync](screenshots/current/word-sync-confirmed-light.png)

![Timing-only word boxes and protected Sync](screenshots/current/word-timing-protected-light.png)

Changing sentence wording clears that sentence’s saved word timing so stale
word labels cannot survive; retime the new words, or Undo to restore both.

**Reset words** deliberately clears saved word timings and rebuilds estimates; use
**Undo** to restore an accidental reset. Undo/Redo includes each released drag and
numeric timing edit. Lane zoom never changes waveform zoom or saved timestamps.

## Save and Export for Playback

1. Confirm any pending marker previews with Sync Sentence Start/End.
2. Click **Save** to retain the local lyric document.
3. Open the arrow next to Save. Select **Synced lyrics (.lrc)** to write a timed
   sidecar. Select Plain TXT only if you also want that destination rewritten.
4. Optionally select **Embed into track** for supported MP3/FLAC files.
5. Click **Save and export** and check the result for each selected target.

![Choose exactly which destinations to write](screenshots/current/embedded-word-export-light.png)

If embedding is grayed out, enable optional embedding in Settings and check
the file type. The supported output is MP3 ID3v2.4 USLT/SYLT or FLAC metadata;
audio is not re-encoded. Some players do not display embedded lyrics even when
the tags are valid. Keep/export the LRC sidecar as needed.

Save alone does not write an LRC or embed lyrics. Export does not publish online.
TXT and LRC coexist; one is not deleted by exporting the other. Successful saves
leave no new `.bak` files. Old app-owned backups for that saved destination are
removed when permitted. Failed staging preserves the original. No version history
is retained automatically; keep your own backups when needed.

## Publish Lyrics for Other Users

![Save menu with Save and Publish, light theme](screenshots/current/save-publish-menu-light.png)
![Save menu with Save and Publish, dark theme](screenshots/current/save-publish-menu-dark.png)
![Publish confirmation, light theme](screenshots/current/publish-confirm-light.png)
![Publish confirmation, dark theme](screenshots/current/publish-confirm-dark.png)

1. Confirm wording/timing against the exact recording.
2. Click the arrow beside **Save** and choose **Save and Publish**.
3. Review the confirmation, which names the song and artist. **Publish Now** sends
   the lyrics to the configured LRCLIB instance; **Cancel** closes without sending.
4. Publish only lyrics you intend to share.

This is different from local saving/exporting. Other LRCLIB clients can discover
published lyrics, subject to the service's availability/search behavior. The
publication uploads lyric data, not your audio file or this app's installer.

## Check Modified Dates

1. Change a lyric word or timestamp, then explicitly Save.
2. Return to the library: **Modified** appears after Lyrics with local date/time.
3. Restart or refresh; the saved date remains.

![Saved modification date and time](screenshots/current/modified-dark.png)

Opening a song or saving unchanged content does not update the date. Unknown
historical dates show `--`. Creating a new timeline from your plain text and
saving it counts as a modification, just like editing an existing timed lyric.
Embedding changes the file fingerprint but now keeps
the track identity/date. Matching orphaned dates from older scans are repaired
without rewriting the current lyrics; ambiguous matches are not guessed.

## Troubleshooting

| Symptom                               | What to Check                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playhead leaves the zoomed view       | Enable waveform Follow; manual panning holds inspection; double-click zoom now preserves Follow                                                     |
| Markers do not advance with sentences | Enable Follow Lyrics; manual selection, edits and loops pin the target                                                                              |
| Audio stops/repeats at a marker       | Turn Loop off for forward playback; sentence Play retains an enabled Loop                                                                           |
| Row playback unavailable for TXT      | Provisional markers do not assign timing; confirm its start first                                                                                   |
| End says Inferred end                 | Set end at playback or confirm the intended pair with Sync Sentence Start/End                                                                       |
| Lyrics do not show in another player  | Export LRC/embed, rather than only Save; verify that player's format support                                                                        |
| An external LRC edit is absent        | Reopen or press F5 to upgrade missing/Plain lyrics from a valid matching LRC. Manually saved/synced lyrics require explicit import to protect edits. |
| Save is disabled or date unchanged    | No unsaved document changes; import/timing/text edits must be saved                                                                                 |
| Embedded option is disabled           | Saved embedding setting and supported file type                                                                                                     |
| Export partly failed                  | Review each target; successful targets may already be written; fix permissions/path and retry                                                       |
| Waveform is unavailable               | Use Retry; text editing/basic playback remain separate from waveform availability                                                                   |
| Hover help seems delayed              | Off by default. Enable Show hover help in Configuration and Save, or press F1 over a control                                                        |

Screenshots use temporary demonstration fixtures. Detailed keyboard bindings,
format limits and safety behavior are in the [editing reference](editing-guide.md).

Linux compatibility: the shared hover-help behavior is independent of desktop
environment. This amd64 installer requires glibc 2.39 or newer, GTK 3 and
WebKitGTK 4.1 (such as Ubuntu 24.04 / Mint 22 or compatible newer systems).
Older Debian-based releases and ARM need a build for their platform; a `.deb`
extension alone does not guarantee binary compatibility.

## Turn Hover Help On or Off

Open **Configuration**, change **Show hover help**, then **Save**. It defaults off
and remembers your choice between launches. With it on, help appears after a
one-second hover and closes after two seconds. With it off, use F1 over a control
or while that control has keyboard focus. Closing Configuration without Save
discards the change. Menus and marker warnings are unaffected.

![Hover help setting](screenshots/current/embedded-lyrics-settings-light.png)

## Preserve Sentence Ends When Exporting

![Export choices, light theme](screenshots/current/export-options-light.png)
![Export choices, dark theme](screenshots/current/export-options-dark.png)

1. Confirm Start and End with the sentence Sync controls, then Save.
2. Export LRC. Gaps of at least 250 ms become blank timestamped cues; final ends
   are included. Tiny gaps are omitted to avoid flashing lyrics between sentences.
3. Reopen the saved song to retain exact end-marker times. If importing only the
   LRC, its exported blank cues appear as real empty timed rows; omitted short
   gaps cannot restore their exact end times from that file alone.

## Turn Overlap Prevention On or Off

1. Open Settings (**Configuration**) and find **Common**.
2. Check or uncheck **Prevent overlapping lyrics**, then click **Save**.
3. In Synced, read **Overlap prevention: On/Off** beside Timing step. This text
   is informational; clicking it cannot change the setting or affect Loop.

The choice survives restarting. Cancel and failed saves preserve the prior choice.
Turning protection on does not automatically change existing lyric overlaps.

![Overlap setting](screenshots/current/embedded-lyrics-settings-light.png)
![Protection off in Synced](screenshots/current/overlap-status-off-dark.png)

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

Select **Word-timed lyrics (.elrc)**, then **Save and export**. If sentences
need word timestamps, a confirmation shows how many need estimates. Choose
**Use estimates and save** to retain every existing manual word start/end and
fill only missing word starts. You can adjust one word, leave the others as they
are, and move on; exporting does not regenerate already saved timing.

Accepted estimates are saved in the project and ELRC, so reopening uses the same
word timestamps. **Undo** can reverse the acceptance. **Cancel** leaves the
project and files unchanged. Already complete timing needs no estimate prompt.
The app spaces estimates inside sentence bounds, using the next sentence or
recording end if an end is missing, and preserves explicit word gaps. It does not
analyze singing; listen and refine estimates for accuracy. Untimed TXT needs
sentence timing first. Invalid word data, insufficient time, or sentence overlap
with protection enabled stops preparation before any save/export; other file
choices can be exported separately. TXT/LRC-only exports never add word timing.

The green dot means valid word timing is present, including accepted estimates;
it does not mean every word was manually checked.

![ELRC estimate confirmation](screenshots/current/estimated-elrc-confirmation-light.png)
![Accepted mixed word timing, dark theme](screenshots/current/estimated-elrc-accepted-dark.png)

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
   word starts and the same playback clock as the sentence timeline. Live word
   timing edits update both views immediately; no Sync or Save is needed to see
   an accepted boundary adjustment. Boxes can stay collapsed; resizing is unnecessary.
3. **Follow Lyrics** turns on when you open or close the preview and whenever you press
   Play or Resume, and follows the playing sentence. Clicking a sentence, Sync or editing
   holds the target until your next Play; **Follow Lyrics** also resumes it.
4. Turn on **Loop selected phrase** to repeat that phrase. The preview follows
   every rewind, and Loop remains enabled until you turn it off. Lead-in, tail,
   waveform zoom and word-timeline zoom retain their existing behavior.
5. Turn off Word preview to hide it. No timestamps change and nothing is saved or
   exported by this toggle. Preview state lasts for this editor session.

Like the sentence timeline and automatic alignment preview, Word preview uses
actual word starts and explicit ends. It clears at a saved word end, leaving
silence unhighlighted until the next word begins. Without an explicit word end,
the highlight continues until the next timed word or sentence end (including
waveform marker previews). Timing values remain unchanged by playback. Sentence
ends may still be inferred from the next sentence. Partial timing keeps existing starts; untimed words stay
unhighlighted. With no word timing, preview labels its evenly spaced estimate;
it cannot infer actual singing.
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
ELRC has its own description. Editor ELRC export offers to save missing word
timing as estimates before embedding; invalid requested word timing stops MP3 embedding
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
**Undo** restores timing edits. **Reset words** returns word timings to estimates.

Collapsing Word timing suspends word repeats and preserves the target. Reopen to
resume, or use **Stop word loop** without reopening. Inactive tabs and untimed
sentences also suspend repeats; switching tracks or closing the editor ends the
loop. Repeats now run in the native audio engine rather than waiting for GUI
seeks. Active-loop cursor updates arrive about every 10 ms (normal playback stays
at 40 ms). Display/audio-device latency and streaming read-ahead still apply;
saved timestamps retain millisecond precision.

Save/export keeps the existing TXT, LRC, ELRC and MP3 embedded format choices.
Loop selection, context and zoom are listening aids, not exported lyric events.

![Selected word loop, light](screenshots/current/selected-word-loop-light.png)
![Selected word loop, dark](screenshots/current/selected-word-loop-dark.png)

## Sync Every Word in a Sentence in One Continuous Pass

This is manual timing: one press per word, not automatic singing recognition.
The existing Sync word action advances through boundaries. For optional audio-derived
proposals instead, use Align sentences/Align words and review before applying.

1. Set the sentence start/end first, then expand **Word timing**.
2. Turn **Loop word** and phrase **Loop** off so audio continues through the sentence.
3. Select the first word boundary and play from just before the sentence.
4. Use **Sync word** as each word starts. It stamps playback time and advances
   to the next boundary. After the final boundary it may select the next sentence.
   Use the keyboard menu to check the current word timing shortcut; do not
   invoke shortcuts while typing in a time or sentence field. If playback lies
   outside that word’s available interval, Sync explains why and keeps timing
   unchanged; refine adjacent dividers or the precise fields before retrying.
5. Pause and inspect the result. Use Undo for a mistaken stamp. Do not use Reset
   to undo a single mistake: Reset replaces the sentence's word timings with estimates.
6. Select uncertain words and turn **Loop word** on for refinement. In that mode,
   Sync word stays on the current word. Use **Start** and **End** for its precise
   bounds, and Lead-in/Tail for listening context without changing saved times.
7. Save the document and select **ELRC** under the Save file types if you want a
   word-timed sidecar. Standard LRC remains sentence timed; selecting ELRC does
   not replace the independent TXT/LRC choices. Publishing sends the structured lyric document, including confirmed word
   timing, to a compatible LRCLIB server; it does not upload an ELRC sidecar file.

![Selected word loop and precise times, light](screenshots/current/selected-word-loop-light.png)
![Selected word loop and precise times, dark](screenshots/current/selected-word-loop-dark.png)

Saved word timing is more than the displayed estimates. Looping or previewing
estimates alone does not save them as measured word timings. End fields permit
silence between words; listen through transitions before export.

## Download and reopen word-timed lyrics

Search normally to see **Word timed**, **Synced** and **Plain** records. The app
checks actual timestamps rather than trusting a server flag. **Show only word-timed
lyrics** is optional and starts unchecked. If no word results appear, uncheck it
to use ordinary LRC or plain lyrics. Applying/download preserves the server's
structured document, including confirmed word starts/ends. No word timing is
invented when the server only supplies sentence timing or untimed text.

Use the editor's lyric-file import picker to open TXT, LRC or ELRC. Enhanced tags
inside .lrc files are recognized. Replacement follows the existing confirmation
and Undo workflow. Saved explicit word gaps remain editable after reopening; a
standard LRC alone cannot preserve word timing. Nonzero offsets and ambiguous or
invalid enhanced ranges need correction before import.

Under **Save file types**, select only TXT, LRC, ELRC, or any combination. These
choices do not require one another. ELRC starts unchecked and remembers changes.
Editor ELRC export offers to save missing word timing as estimates after explicit
acceptance. Untimed text still needs sentence timing first. Library batch exports
continue to use saved timing only. Local export and server publishing are separate: compatible LRCLIB accepts structured YAML
with word timing, not a dedicated uploaded ELRC sidecar. Older/custom servers
may offer only ordinary LRC or text. See [LRCLIB API documentation](https://lrclib.net/docs).

![Server lyric formats, light](screenshots/current/server-lyrics-types-light.png)
![Server lyric formats, dark](screenshots/current/server-lyrics-types-dark.png)

![Enhanced import, light](screenshots/current/enhanced-import-light.png)
![Enhanced import, dark](screenshots/current/enhanced-import-dark.png)

## Automatic unfinished-work recovery

![Restored unfinished work, light theme](screenshots/current/editor-recovery-restored-light.png)
![Restored unfinished work, dark theme](screenshots/current/editor-recovery-restored-dark.png)

Unfinished lyrics are protected separately from normal saves and exports.
Reopen the song or use Resume editing to recover it. Successful Save cleans
only that project's completed draft; newer edits and pending markers remain.
Word timing warnings now use yellow text. See the [recovery guide](recovery.md)
for restoration, conflicts, cleanup and limitations.

## Restart one sentence’s word timing

Use **Reset words** to clear only the selected sentence’s word timing and
regenerate evenly spaced estimates. Text and sentence markers stay in place;
Undo restores the prior word timings. Master reset has been removed.

![Word timing with Sentence loop selected](screenshots/current/selected-sentence-loop-light.png)
![Sentence loop in dark mode](screenshots/current/selected-sentence-loop-dark.png)

![Word preview follows live timing edits](screenshots/current/word-preview-live-edit-light.png)
![Live word preview in dark mode](screenshots/current/word-preview-live-edit-dark.png)

## More precise word and sentence repeats

![Loop controls, light theme](screenshots/current/loop-persistent-navigation-light.png)
![Loop controls, dark theme](screenshots/current/loop-persistent-navigation-dark.png)

Word and sentence loops repeat in the audio engine, avoiding an interface seek
on every repeat. Active-loop cursor updates run approximately every 10 ms.
Sentence loops follow pending waveform marker bounds; Cancel restores confirmed
bounds. Word loops use the selected word bounds. Lead-in/Tail remain optional
listening context: set both to zero to hear only the exact selected range.
Paused boundary changes do not resume playback. Zoom changes the view only.
Closing the editor, switching recordings or suspending a range clears native
looping; reopening a suspended word lane restores its chosen mode.

The cursor is a rendered playback estimate, not a sample-accurate measurement.
Audio-device latency and streaming read-ahead can delay a newly edited boundary
or seek. Saved lyrics and TXT/LRC/ELRC export choices are unchanged.

## Word editing follow and confirmation

**Follow Lyrics** now controls automatic sentence selection, scrolling of the
word timeline, and scrolling of the Word preview. Turn it off to hold the view
while playback, highlights and loops continue. It turns back on with every Play or
Resume and when Word timing or Word preview is opened or closed. Selecting a word or changing zoom can still
reveal that chosen word intentionally.

Manual changes are tracked independently for each word and sentence. Adjusting
a later divider does not discard an earlier word’s manual edit. Sync word
retains those times and turns gray/disabled for that word until its timing changes.
A shared divider also changes the preceding word’s implicit end. Ordinary live
sync advances to the next word; a non-advancing sync locks the current word.
Undo/Redo, changed wording and sentence boundaries reevaluate confirmations.

The green sentence dot means valid word timing is present, including any estimated
values retained while editing. Listen to verify accuracy; it does not mean all
words were manually synced or exported. **Reset words** clears only this sentence’s
word timings and regenerates estimates, keeping its wording and sentence markers.
Use Undo to restore the preceding word timing. Failed validation leaves timing
in place and explains the failure. Master reset is removed from the top bar.

Overlap prevention shows **On** in green and **Off** in red in both themes.
Settings uses matching colors. The text remains visible so status is clear
without relying on color.

![Manual confirmation with Follow off](screenshots/current/word-follow-off-confirmed-light.png)
![Follow off in dark mode](screenshots/current/word-follow-off-confirmed-dark.png)
![Overlap prevention off](screenshots/current/word-overlap-off-light.png)
![Overlap prevention off in dark mode](screenshots/current/word-overlap-off-dark.png)


### ELRC discovery and library status

![Library showing ELRC lyrics as Synced, light theme](screenshots/current/elrc-library-synced-light.png)
![Library showing ELRC lyrics as Synced, dark theme](screenshots/current/elrc-library-synced-dark.png)

Startup/F5 now reads valid matching `.elrc` before `.lrc`; missing lyrics fall
back to `.txt`. Untouched ordinary LRC can upgrade to real word timing. Existing
word timing, instrumental lyrics and explicit editor saves remain protected.
Invalid ELRC falls back safely; scans never change audio or sidecars and do not
mark imported lyrics Modified. Valid user/server ELRC appears **Synced**; untimed
sentence-editing rows remain **Plain**. Downloads honor the chosen filter and
automatic export formats; downloads never silently generate estimated word times.


## Basic and optional Automatic audio alignment

![Audio alignment controls, light theme](screenshots/current/audio-alignment-controls-light.png)
![Audio alignment controls, dark theme](screenshots/current/audio-alignment-controls-dark.png)

Basic TXT/LRC/ELRC editing, estimated word timing and manual synchronization
remain available without AI. **Align words** in the editor header opens optional
local audio alignment with language/model selection, progress and cancellation.
Preview yellow uncertain words, listen, then Apply in one Undo step. Existing
word times are protected unless explicitly replaced; sentence bounds and text
remain intact. Complete applied timing saves ELRC without another estimate prompt.
See the [illustrated audio alignment guide](audio-alignment.md) for setup and
limitations. Singing alignment requires review; confidence is only a hint.

Optional audio setup now asks once when the engine is unavailable; declining
keeps an Install button for later. Each missing model needs separate approval.
Synced toolbar order is Word preview → Align sentences → Align words; model choices remain
readable in light/dark themes. Basic editing needs no AI. See [the illustrated setup guide](audio-alignment.md).


Automatic **Align sentences** now precedes **Align words** in Synced. TXT/LRC/ELRC
use local audio to propose sentence boundaries, with listening preview and
explicit confirmation before replacing existing timestamps. Text/gap cues stay
intact; existing word timings shift with their sentence, and conflicting rows
are skipped. Apply is one Undo/Redo edit; saving remains explicit. See the
illustrated audio-alignment guide for the full workflow and limitations.


Platform rebuilds resumed for the current 2.2.7 Debian, AppImage and Windows MSI.
Optional alignment setup now understands Windows private Python environments;
Basic features remain independent of AI requirements. Windows build-only CI
checks actual MSI identity, Defender availability/definitions and MSI/payload
scans, install/repair/launch/uninstall. Current packages, checksums, source and illustrated guides are published in the
2.2.7 release. Check package/platform guides for validation scope and signing limitations.
