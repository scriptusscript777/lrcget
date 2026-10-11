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
word timing. Missing/invalid ELRC timing skips/errors that format and preserves
an existing ELRC. Failed local Save stops export. Review partial-export messages
rather than assuming all targets succeeded.

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
