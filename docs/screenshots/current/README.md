# Current Interface Screenshots

`waveform-marker-times-light.png`, `waveform-marker-times-dark.png` and both
`marker-preview-*` images are fresh native **2.2.1+local.1** captures at 1024x768.
They show persistent labeled Start/End times, zoomed markers, and live previews
beside Apply/Cancel, plus Elapsed/Total, Position and View labels and subtle marker-range shading. The isolated
profile uses a generated silent 45-second MP3
and demonstration lyrics. Settled canvas frames were captured after zoom/theme
updates. Layout checks found no overlapping header controls or horizontal
overflow in either theme; nudging/canceling previews preserved the saved pair.

`waveform-click-play-light.png` and `waveform-click-play-dark.png` were captured
from the native **2.2.0+local.22** desktop app at 1024x768. An isolated profile
used a generated 45-second silent MP3 and demonstration lyrics. The flat waveform
reflects that silent fixture; the images show the playhead and zoom controls.
Native checks verified playback advancement, paused zoom and resume continuity
without saving/exporting or touching the user's music database.

The `automatic-lrc-*` images were captured from the native .21 app for external
sidecar detection. Other unchanged interface images below retain their .20
captures.

These images were recaptured from **LRCGET 2.2.0+local.20**, source commit
`fcb4d99`, for the current README, overview, how-tos and editing reference.
The app code is rendered through the local Vite server with a mocked Tauri
backend and temporary demonstration lyrics/waveform data. These are real
captures of the current UI, not generated interface mockups or private music.

Both light and dark themes cover the collapsed/expanded editor, Follow Lyrics,
word spelling edits, word-lane zoom, marker preview, point zoom, waveform panning,
playback following, untimed text, import confirmation, export choices and the
Modified column. Native hover help is not forced open in these captures.

The capture checks exercised rendering and navigation without saving/exporting
any user files. The Modified-column fixture tests normal, maximized and narrow
layouts; most editor captures use a 1280x900 browser viewport.

Historical screenshots outside this directory are retained for old release
notes. Current guides reference this directory rather than those older images.
