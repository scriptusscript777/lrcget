# Current Interface Screenshots

Unchanged guide images were freshly captured from **LRCGET 2.2.2+local.1**
on 2026-10-11 in both light and dark themes, using demonstration data.

The `automatic-lrc-*`, `waveform-marker-times-*`, `waveform-click-play-*`,
`marker-preview-*`, `marker-overlap-*` and `marker-previous-overlap-*` images
come from the native desktop application at 1024x768. An isolated profile uses
an externally created matching LRC/TXT and a generated silent 45-second MP3.
The flat native waveform reflects that silent fixture. Checks verified sidecar
import, both warning directions, preview cancellation, zoom continuity,
playhead advancement, paused position and resume without a jump to zero,
and final-lyric looping through the recording end.

Other images render the current app through its local Vite server with a mocked
Tauri backend and temporary demonstration lyrics/waveform data. Browser checks
covered editor views, forward/backward Follow Lyrics, word spelling and timing,
point zoom, waveform panning/following, untimed text, import confirmation,
export choices and Modified-column layouts. Most browser images use 1280x900;
Modified-column checks also cover maximized and narrow layouts.

These are screenshots of the actual interface, not generated mockups. Captures
were settled after theme/zoom updates. Verification did not change user music,
sidecars or the live lyrics database. Native hover help is not forced open.
Historical screenshots outside this directory remain for old release notes.

`timed-hover-help-light.png` and `timed-hover-help-dark.png` are new 2.2.3 browser
captures of the actual editor and shared hover-help controller using generated
fixture data. Checks keep the pointer stationary until help expires, then verify
re-entry, Escape/click/scroll/leave, dynamic controls, literal text and cleanup.
