# Troubleshooting — 2.2.6+local.8

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

Loops follow the audio player's approximately 40 ms notification cadence. Use
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
