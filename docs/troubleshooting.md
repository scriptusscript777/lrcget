# Troubleshooting — 2.2.7

## A short word is difficult to see in its box

Pause, select the sentence and zoom the **word lane**, which is independent of
waveform zoom. Check the selected word's Start/End and neighboring boundaries.
A very short or invalid saved interval can make the label hard to see; this is
not proof the word text was deleted. The first-word disappearance reported by
Rick has not yet been reproduced on his actual song. Do not reset the whole
sentence simply to expose a label if you want to preserve custom word timing.

## Reset made the word appear again

Reset removes that sentence's custom word timings and displays evenly distributed
estimates. Use Undo in the same editing session to recover the preceding edit.
Save/export only after listening and verifying the result. Reset is not a repair
that preserves existing measured timestamps.

## Sync word does not move to the next word

With **Loop word on**, Sync word stays on the selected word for refinement.
Turn word and phrase looping off for a continuous manual sentence pass, then
stamp each beginning with Sync word. Check the keyboard menu for current
bindings. A focused text/time field consumes typing rather than editor shortcuts.

## A word time will not move farther

Precision Start/End fields clamp against the sentence, neighboring starts and
explicit ends to protect ordering/gaps. First-word precision editing does not
move the sentence start. Adjust the appropriate sentence/neighbor boundary
deliberately before extending beyond it. Timing steps are milliseconds; the
precision fields display seconds with three decimal places.

## Loop does not sound perfectly sample accurate

Loops repeat inside the native audio engine, with approximately 10 ms cursor updates. Use
Lead-in/Tail for context and listen at a lower playback speed; these are audition
settings, not saved time offsets. Collapsing Word timing suspends word audition
while retaining the mode; Stop word loop or reopening the lane makes this clear.

## Another player does not highlight words

Standard LRC normally contains line timestamps. Optional ELRC uses inline word
timestamps; MP3 SYLT carries timestamped entries. A valid export cannot add support
to a player that does not read that format. Keep standard LRC for line playback.
LRCLIB publishing is standard line lyric data, not uploading an ELRC sidecar.

## Save and export appear different

Save stores the working document. Export writes the selected sidecars/embedded
metadata; unchanged selections can replace their existing destinations. Confirm
waveform marker previews with the sentence Sync controls before saving. Select
ELRC under Save file types to export measured word timing. Its choice is remembered.

## AppImage does not start

This Linux x64 build needs glibc 2.39 or newer. Make it executable and verify its
checksum. If FUSE is unavailable, use `--appimage-extract-and-run`. See
[packages](packages.md); older distributions need a build with an older baseline.

## The update alert does not appear

The check runs once, a few seconds after LRCGET starts. No alert appears when:

- You already have the newest version. Open the menu, choose **About**, and
  compare **Current version** with **Newest version**.
- You chose **Skip this version** for that release. A higher release alerts again.
- An editor or another window was open. The alert waits and appears about a
  minute after that window closes.
- There was no internet connection, or GitHub was unavailable or rate-limited.
  The check stays silent and runs again at the next start.
- The computer is not a supported system (phones, tablets, macOS or ARM
  computers). Only Linux x64 and Windows 10/11 x64 installers are published.
- The new release was published with the same version number. Only a higher
  version (for example 2.2.8) produces an alert.

## The update downloaded but did not install

LRCGET only downloads the file; it never runs an installer. Follow the steps for
your format in [Install a downloaded update](how-to.md#install-a-downloaded-update).
For an AppImage, make the new file executable and start the new file, not the old
one or an old desktop shortcut. On Windows, a SmartScreen warning is expected
because the MSI is not code-signed; choose **More info**, then **Run anyway**.

## Windows installer or build fails

Use the x64 MSI and checksum from the matching release, not an upstream installer
that omits these changes. Read [Windows instructions](../packaging/windows/README.md)
for MSVC/Windows SDK, WiX/VBScript and WebView2 requirements. MinGW alone does not
build this Tauri Windows target. Include installer logs and the exact app/Windows
version in a bug report. Installation checks on Windows Server CI do not establish
all Windows 11 playback behavior.

## Sync Word did not change timing

After a divider drag or precise Start/End edit, Sync Word keeps that accepted
adjustment and then turns gray/disabled until another timing adjustment. This
prevents repeated presses from stamping playback over your chosen time. Other Sync actions
reject playback outside this word's sentence/neighbor interval and show a message.
Seek inside that interval or refine adjacent dividers/fields before retrying.
Words should not disappear or shift neighboring starts; Undo restores each edit.
Word boxes edit timing only. Change wording in the sentence row; that clears its
word timing for retiming, and Undo restores the previous text and timings.

## Choosing TXT, LRC or ELRC

Each Save menu checkbox selects only that target. Save alone retains the internal
document, including word timing; export writes only selected formats. TXT carries
text, standard LRC carries sentence timestamps and applicable blank gap cues,
and ELRC carries saved word timestamps/ends. LRC-only import cannot reconstruct
word timing. Editor ELRC export offers to save missing word times as estimates;
Cancel or invalid timing stops preparation before saving/exporting and preserves
existing files. Untimed text needs sentence timing first. Library batch export
still uses saved word timing only. Failed local Save stops export. Review
partial-export messages rather than assuming all targets succeeded.

## Automatic unfinished-work recovery

Unfinished lyrics are protected separately from normal saves and exports.
Reopen the song or use Resume editing to recover it. Successful Save cleans
only that project's completed draft; newer edits and pending markers remain.
Word timing warnings now use yellow text. See the [recovery guide](recovery.md)
for restoration, conflicts, cleanup and limitations.

## Restarting word timing

Use **Reset words** to rebuild only the selected sentence’s word timing estimates;
Undo restores the previous timing. Master reset has been removed. For external
TXT/LRC/ELRC replacement, use Import and its existing confirmation.


### Matching ELRC does not appear as Synced

Use the audio file's exact basename with `.elrc` in the same folder, then refresh
with F5. Discovery accepts absolute line/word timestamps and validated ranges.
Nonzero `[offset:...]`, malformed or crossed timestamps are rejected; apply any
offset to the timestamps first. Valid ordinary LRC/TXT is used as fallback.
Explicit saved edits and existing word timing remain protected from sidecar
replacement; use explicit Import in the editor when intentionally replacing them.


## Basic and optional Automatic audio alignment

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

If automatic alignment reports that live progress is unavailable, this refers
to the notification channel, not missing Whisper packages. The app still checks
installed requirements and enables alignment when ready. Broken inherited
PyTorch imports can be repaired privately through the explicit Install action.
See [optional setup failure checks](audio-alignment.md#setup-failure-checks).
