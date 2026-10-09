# Creating and Editing Timed Lyrics

Rick Lidgett's enhanced LRCGET build, `2.2.0+local.9`.
Original project authors and license remain credited.

## Start With Lyrics and a Recording

- **Plain text file:** open your `.txt` file, copy its contents, open the song's
  lyric editor and paste into **Plain**, one sung phrase per line. There is not
  currently a direct plain-text-file import button.
- **Online lyrics:** use LRCGET's built-in LRCLIB search. A synced result already
  has timestamps; a plain result needs manual timing.
- **Genius or another website:** copy the lyrics into **Plain**. Arbitrary website
  URLs are not imported or scraped by LRCGET.
- **Existing LRC:** use **Import LRC file** in the empty Synced editor, or
  **Paste LRC** for timestamped lyrics copied to your clipboard.

You need the corresponding audio recording to listen and set timings. LRCGET
does not run Whisper/Demucs or automatically align plain text to singing.

## Create a Timeline

1. Paste your words into **Plain**.
2. Open **Synced** and select **Import from plain lyrics** when it is empty.
3. Play the recording, select a line and press **Space** when its singing starts.
4. Press **Shift+Space** when that line finishes. Select the next line and repeat.
5. Replay and refine with phrase looping, waveform markers and timing steps.

These are default shortcuts; customized bindings appear in the keyboard menu.
Use the synced editor rather than typing in a text field when invoking shortcuts.

## Zoom and Precision

Magnification keeps a visible selected phrase marker in view, rather than
anchoring to an unrelated playhead. Zooming with a selected phrase disables
playback following. At high magnification, a phrase can span more than one
window; scroll to reach its other marker.

Use a horizontal trackpad gesture, mouse wheel over the waveform or the bottom
pan control. Manual panning disables follow, so playing audio does not pull
your view away. The crosshair follow button turns automatic paging back on.

Drag the start/end markers, or focus a marker and use Left/Right with the
selected 10/25/50/100 ms timing step. Shift multiplies a marker nudge by ten.
Start-marker edits shift that line's word timings while holding its end fixed.
End-marker edits cannot truncate its timed words. Completed drags create one
undoable edit; Escape/cancellation discards a preview. Zoom and scrolling do
not change timestamps or save files.

Expand **Word timing** only when individual-word timing is needed. Its 1-8x
zoom and horizontal scrolling are separate from waveform zoom.

## Save, Export and Publish

Save retains the editor's changes. Use **Export** with **Synced lyrics (.lrc)**
selected to write a playback sidecar. Select embedded lyrics too if desired;
that option requires experimental embedding enabled and a supported audio file.
Embedding/exporting writes the track or sidecar; waveform navigation does not.

**Publish** sends lyrics to LRCLIB, with confirmation. Local saving/exporting
does not itself publish your lyrics. Player support for lyric display varies.

## Current Views

![Light theme: zoomed phrase end and manual pan](screenshots/waveform-navigation-light.png)

![Dark theme: zoomed phrase end and manual pan](screenshots/waveform-navigation-dark.png)

Screenshots use temporary fixture lyrics and mocked waveform data, not private
music. A waveform shows the full mix; it is not proof of exact singer alignment.
