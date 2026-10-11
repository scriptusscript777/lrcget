# LRCGET Documentation

Rick Lidgett's enhanced LRCGET, **2.2.7**.
An independent fork of the original project; original authors and license remain credited.

## Choose a Guide

| What You Want to Do                              | Guide                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Understand the app, enhancements and limitations | [Illustrated overview](app-overview.md)                                                                |
| Start with a recording and plain lyrics          | [Step-by-step how-tos](how-to.md#create-timed-lyrics-from-a-text-file)                                 |
| Edit an existing LRC or timestamped TXT          | [Edit existing lyrics](how-to.md#edit-an-existing-lrc-or-timed-text-file)                              |
| Zoom, place markers and preview a phrase         | [Waveform and marker workflow](how-to.md#place-precise-markers-and-preview-before-confirming)          |
| Edit individual words                            | [Word timing and safe synchronization](how-to.md#edit-individual-words)                                            |
| Save, export, embed or publish                   | [Output workflows](how-to.md#save-and-export-for-playback)                                             |
| Find keyboard shortcuts and detailed behavior    | [Complete editing reference](editing-guide.md)                                                         |
| See what Rick changed in the source              | [Modification overview](app-overview.md#modification-map) and [technical history](../LOCAL_CHANGES.md) |
| Install the current Linux build                  | [Installation](how-to.md#install-or-upgrade)                                                           |
| Understand the latest fixes and test results     | [Release notes](releases/2.2.7.md)                                                             |

See [Enhanced LRC export](how-to.md#export-word-timing-as-enhanced-lrc) for the new optional word-timed sidecar.

See [read-only word preview](how-to.md#review-words-without-resizing-timing-boxes) and
[standard/enhanced MP3 embedding](how-to.md#embed-standard-and-enhanced-lyrics-in-mp3).

See the [complete feature index](features.md), [word-sync walkthrough](how-to.md#sync-every-word-in-a-sentence-in-one-continuous-pass),
and [troubleshooting guide](troubleshooting.md).

## At a Glance

LRCGET finds lyrics through LRCLIB and helps you manually synchronize them to
your recording. This fork adds waveform navigation, preview-and-confirm markers,
word editing, improved embedding, refresh controls and saved modification dates.
It does not automatically identify singing, run Whisper/Demucs, or guarantee
perfect synchronization or lyric display on every player.

![Zoomed waveform following playback in light mode](screenshots/current/waveform-follow-light.png)

Screenshots use temporary fixture lyrics and waveform data. Word-loop and embedding
views were recaptured from 2.2.6+local.8; the screenshot index identifies older
unchanged views.
The guides describe the current build; historical release notes describe their
own versions, including behavior since changed.

See [local package instructions](packages.md) for Debian/AppImage use and the Windows MSI build prerequisites.

See [building from source](build-from-source.md) for Linux/Windows prerequisites,
locked builds, tests and application identity.

See the [all-platform build matrix and limitations](platform-builds.md) and
[complete code/maintenance guide](developer-guide.md).

See [word-timed downloads and TXT/LRC/ELRC import](how-to.md#download-and-reopen-word-timed-lyrics) for automatic server fallback and independent format workflows.
