# Verified mixed manual and estimated ELRC

These files came from a real native Save/export using an isolated temporary
library and synthetic audio. No personal music or database was changed.

The editor changed the first word's end from 1.800 s to **1.650 s**, leaving the
next word's 2.000 s start untouched. The second sentence kept its displayed
estimates: **3.000 s** and **4.500 s**. ELRC acceptance saved both approaches.

- [project.yaml](project.yaml): exact editor Save/export payload.
- [verification.elrc](verification.elrc): native word-timed export.
- [verification.lrc](verification.lrc): standard sentence-timed export.
- [verification.txt](verification.txt): independent plain-text export.
- [verification-report.json](verification-report.json): native export and reimport data.

Reimport matched all word starts, explicit word ends, sentence bounds and text.
The shared word highlight function matched before/after at 10 ms intervals across
the 10-second recording. Real Vue preview highlights matched before/after estimate
acceptance at 3.000, 4.490, 4.500, 5.990 and 6.000 seconds. Cancel wrote nothing;
repeated export did not prompt again. Subsequent TXT/LRC export left ELRC unchanged,
and the audio SHA256 stayed unchanged.

The final empty `[00:06.000]` row clears lyrics after the last sentence; it is a
gap cue, not an extra lyric sentence. The 1.650 s inline end tag preserves the
explicit pause before the next word. Estimated times are not audio alignment.
