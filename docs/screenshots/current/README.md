# Current interface screenshots — 2.2.7

All **85 images referenced by the current user guides** were recaptured on
2026-10-12 from the current application interface. Light/dark examples cover the
latest integrations. This supersedes the older capture descriptions for those files.
[Capture manifest](capture-manifest.json) records each image, date, content hash
and rendering source. It is an audit record, not a signature or OS certification.

## What the images show

| Workflow | Example image families |
| --- | --- |
| Current library status | automatic-lrc-before/after, elrc-library-synced, modified |
| Editor and waveform | editor-default, waveform-click-play/follow/navigation, point-zoom |
| Marker preview and cancellation | marker-color-pending/cancelled/word-timing, overlap-setting-warning, overlap-untimed |
| Word timing, follow, precision and loops | word-sync-confirmed, word-timing-protected, word-follow-off-confirmed, selected-word/sentence-loop, loop-persistent-navigation |
| Readable word preview and gaps | word-playback-preview, word-preview-live-edit/loop-zoom/silence |
| TXT/LRC/ELRC, estimates and embedding | lyrics-import, enhanced-import, estimated-elrc-confirmation/accepted, embedded-word-export, embedded-lyrics-settings |
| Server format selection | server-lyrics-types |
| Recovery | editor-recovery-restored, recovery-notice-aligned |
| Optional sentence/word alignment | sentence-alignment-toolbar/preview, audio-alignment-controls/preview/skipped |
| Optional engine/model consent and failure fallback | audio-alignment-setup/model-consent/progress-unavailable |
| Settings and help | overlap-settings-on/off, overlap-status-off, word-overlap-off, timed-hover-help |
| Native packaged startup | debian-startup.png, appimage-startup.png |

## Capture and verification

Browser screenshots render actual current Vue components, not designed mockups.
Native playback, database and network commands are mocked with temporary demonstration
lyrics/waveforms; they do not modify personal recordings or the installed database.
The library examples show Plain, sentence-timed and enhanced Synced data supplied by
fixtures; they illustrate status after import/refresh rather than claiming the browser
performed a real filesystem scan. Separate native scan/export tests are documented
in the [review](../../reviews/2.2.7.md).

Native Debian/AppImage startup captures use the actual latest packages under
separate temporary XDG profiles and Xvfb displays. Startup is not a test of every
Linux distribution or Windows desktop. Browser setup/model examples simulate
consent/failure cases; they do not claim a fresh large dependency/model installation.

Capture checks exercised live marker previews, Cancel, protected overlaps, timing-only
words, Sync confirmation, native-loop interface commands, Pause/Resume, preview gaps,
Follow off, import/export choices, recovery and manual timing protection. Alignment
checks covered sentence replacement, cancellation/stale results, skipped rows,
Undo/Redo, model/theme readability and progress-notification fallback. Some older
harnesses needed updated control selectors/estimate-consent expectations; no application
runtime changes were required by this refresh. Themes and settled layouts were checked.

## Historical images

Original upstream screenshots, old release-note images and removed master-reset/
inline-word-edit controls remain archived for historical documentation. They are
not used to describe current controls. Unreferenced older files in this directory
are historical; the current manifest is the authoritative guide-image inventory.
