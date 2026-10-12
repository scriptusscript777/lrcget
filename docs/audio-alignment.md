# Basic editing and optional Automatic audio alignment

Version remains **2.2.7**. Debian is the active supported build; Windows/AppImage
updates remain on hold.

## Basic mode — no AI engine required

Import TXT, LRC or ELRC. Plain text is split into sentences; sentence timing can
be marked while listening. The word lane separates the sentence into words,
displays estimated timing and supports manual Sync/drag/precision adjustments.
Live Word preview and sentence highlighting use the same playback clock. Save
and export can accept missing estimated word times after one confirmation.
Existing manual starts/ends are preserved. No AI model is loaded or downloaded
by any of these operations. Estimates distribute available sentence time and
are not audio-derived singing alignment.

## Automatic mode — optional local audio alignment

1. Open lyrics editing for a local audio track and import the lyrics if necessary.
2. Click **Align words** beside Import in the editor header.
3. Choose the lyric language (`en`, `es`, `fr`, etc.) and model: tiny is quickest,
   base is the default, small uses more resources. First use may download a model.
4. Leave **Replace existing word timing** unchecked to preserve all existing word
   timestamps, including previously accepted estimates. Check it only when you
   intentionally want to replace those timestamps. Existing LRC sentence bounds
   and original text are always retained.
5. Click **Align using audio**. Progress and Cancel are shown; Basic mode remains
   independent of this optional engine. Only one alignment runs at a time.
6. Review the proposed timestamps. Yellow words have low/unknown model confidence;
   yellow sentence entries also identify skipped or conflicting results. Select a
   sentence, **Listen to sentence**, and inspect its live word highlighting.
   **Pause** stops listening. An existing editor loop stays enabled until you
   explicitly turn it off; preview listening offers that control when necessary.
7. **Apply preview** commits the accepted result as one Undo step. Cancel closes
   without changing lyric data. Apply is rejected if the lyrics/audio/settings
   changed while alignment was running. Save persists the work normally.
8. Save selected TXT/LRC/ELRC formats. Complete applied word timing does not prompt
   again for estimates. Skipped or partially timed lines may still require manual
   timing or explicit estimate acceptance.

![Automatic alignment preview, light](screenshots/current/audio-alignment-preview-light.png)
![Automatic alignment preview, dark](screenshots/current/audio-alignment-preview-dark.png)

The worker uses stable-ts forced alignment against the provided lyrics, without
replacing words with recognized text. Timed LRC restricts analysis to each
sentence's existing audio interval. Untimed TXT receives provisional sentence
and word ranges; use complete lyrics for the chosen recording. Partial lyrics,
instrumental passages, repeated verses, backing vocals and incorrect text can
produce unreliable results. Invalid/zero-length/crossed timing is skipped rather
than silently written. Confidence is a review hint, not a calibrated guarantee
of singing accuracy. Listening and manual corrections remain necessary.

CPU is supported; CUDA is selected when available. VAAPI is a video encoder and
is not used for lyric alignment. No cloud transcription/upload is involved. Model
downloads use the model provider; once cached they can run locally. The original
audio, sidecars and database are not written by the alignment worker.

## Optional setup on Debian/Linux

Basic mode works without these packages. Automatic mode needs Python 3, ffmpeg,
PyTorch, OpenAI Whisper and stable-ts. Install them in a dedicated environment:

```bash
python3 -m venv --system-site-packages ~/.local/share/lrcget/alignment-venv
~/.local/share/lrcget/alignment-venv/bin/python -m pip install stable-ts==2.19.1
```

Existing compatible PyTorch/Whisper packages can be reused from system/user site
packages. A clean environment may require substantial optional dependency/model
downloads. Python venv/ffmpeg must be installed by the operating system package
manager if missing. LRCGET finds this environment automatically; a custom Python
executable can be selected through `LRCGET_ALIGN_PYTHON` when launching the app.
The helper itself is included inside the application binary. Restart the app
if its environment/path configuration changes.

Language codes and alignment API behavior follow the
[stable-ts documentation](https://github.com/jianfch/stable-ts).
See [editing](editing-guide.md), [exports](how-to.md) and
[troubleshooting](troubleshooting.md) for the existing no-AI workflow.
