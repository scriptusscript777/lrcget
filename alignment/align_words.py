"""Optional local stable-ts worker. JSON stdin and newline-delimited JSON stdout."""

import contextlib
import importlib.util
import json
import math
import re
import sys


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True, file=sys.__stdout__)


def remap_words(text, tokens, aligned, offset=0):
    """Match character spans exactly; never replace lyrics with recognized text."""
    original = "".join(tokens)
    if original != text:
        raise ValueError("Word text does not match the sentence")
    normalize = lambda value: re.sub(r"\s", "", value).casefold()
    expected = normalize(text)
    actual = "".join(normalize(word["word"]) for word in aligned)
    if not expected or expected != actual:
        raise ValueError("Alignment did not preserve all lyric characters")
    spans = []
    position = 0
    for word in aligned:
        size = len(normalize(word["word"]))
        if size:
            spans.append((position, position + size, word))
            position += size
    result = []
    position = 0
    for token in tokens:
        size = len(normalize(token))
        hits = [
            word
            for start, end, word in spans
            if start < position + size and end > position
        ]
        if not hits:
            raise ValueError("A lyric token could not be aligned")
        start = round((hits[0]["start"] + offset) * 1000)
        end = round((hits[-1]["end"] + offset) * 1000)
        probabilities = [word.get("probability") for word in hits]
        confidence = (
            min(probabilities)
            if all(
                isinstance(p, (int, float)) and math.isfinite(p) for p in probabilities
            )
            else None
        )
        result.append(
            {"text": token, "start_ms": start, "end_ms": end, "confidence": confidence}
        )
        position += size
    return result


def main():
    if "--check" in sys.argv:
        available = all(
            importlib.util.find_spec(name) is not None
            for name in ["stable_whisper", "whisper", "torch"]
        )
        emit({"available": available})
        return
    request = json.load(sys.stdin)
    lines = request["lines"]
    if not lines or len(lines) > 2000:
        raise ValueError("Choose between 1 and 2000 lyric lines")
    # Keep dependencies, progress bars and model output off the JSON channel.
    with contextlib.redirect_stdout(sys.stderr):
        import stable_whisper
        import torch
        import whisper
        from whisper.tokenizer import LANGUAGES

        language = request.get("language", "en")
        if language not in LANGUAGES:
            raise ValueError("Choose a supported Whisper language code")
        model_name = request.get("model", "base")
        if model_name not in ["tiny", "base", "small"]:
            raise ValueError("Unsupported alignment model")
        torch.set_num_threads(min(4, torch.get_num_threads()))
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = stable_whisper.load_model(model_name, device=device)
        audio = whisper.load_audio(request["audio_path"])
    duration_ms = len(audio) * 1000 // 16000
    emit({"type": "progress", "percent": 0, "message": f"Aligning on {device.upper()}"})
    output = []
    # TXT has no bounds: align its full text first, retaining original line breaks.
    untimed = any(
        line.get("start_ms") is None for line in lines if line["text"].strip()
    )
    global_segments = None
    if untimed:
        with contextlib.redirect_stdout(sys.stderr):
            result = model.align(
                audio,
                "\n".join(line["text"] for line in lines if line["text"].strip()),
                language=language,
                original_split=True,
                regroup=False,
                verbose=None,
                suppress_silence=False,
                progress_callback=lambda current, total: emit(
                    {
                        "type": "progress",
                        "percent": round(current * 90 / max(total, 1)),
                        "message": "Finding sentence and word timing",
                    }
                ),
            )
        if result is None:
            raise ValueError("The audio could not be aligned to these lyrics")
        global_segments = result.to_dict()["segments"]
        if len(global_segments) != sum(bool(line["text"].strip()) for line in lines):
            raise ValueError(
                "Could not retain original sentence boundaries; add sentence timing first"
            )
    segment_index = 0
    for index, line in enumerate(lines):
        candidate = {"index": index, "words": [], "review": []}
        if not line["text"].strip():
            output.append(candidate)
            continue
        tokens = [word["text"] for word in line.get("words", [])]
        if not tokens:
            tokens = re.findall(r"\S+\s*", line["text"])
            if tokens:
                tokens[0] = (
                    line["text"][: len(line["text"]) - len(line["text"].lstrip())]
                    + tokens[0]
                )
        try:
            if untimed:
                segment = global_segments[segment_index]
                candidate["start_ms"] = round(segment["start"] * 1000)
                candidate["end_ms"] = round(segment["end"] * 1000)
                aligned = segment["words"]
                offset = 0
            else:
                start = line["start_ms"]
                next_start = next(
                    (
                        other["start_ms"]
                        for other in lines[index + 1 :]
                        if other.get("start_ms") is not None
                    ),
                    duration_ms,
                )
                end = line.get("end_ms") or next_start
                if not 0 <= start < end <= duration_ms:
                    raise ValueError("Sentence boundaries are outside the audio")
                with contextlib.redirect_stdout(sys.stderr):
                    result = model.align_words(
                        audio[start * 16 : end * 16],
                        [
                            {
                                "start": 0,
                                "end": (end - start) / 1000,
                                "text": line["text"],
                            }
                        ],
                        language=language,
                        normalize_text=False,
                        regroup=False,
                        verbose=None,
                        suppress_silence=False,
                    )
                aligned = [
                    word
                    for segment in result.to_dict()["segments"]
                    for word in segment["words"]
                ]
                offset = start / 1000
                candidate["start_ms"], candidate["end_ms"] = start, end
            candidate["words"] = remap_words(line["text"], tokens, aligned, offset)
            candidate["review"] = [
                i
                for i, word in enumerate(candidate["words"])
                if word["confidence"] is None
                or word["confidence"] < 0.5
                or word["end_ms"] <= word["start_ms"]
            ]
        except (ValueError, KeyError, TypeError) as error:
            candidate["error"] = str(error)
            candidate["words"] = []
        segment_index += 1
        output.append(candidate)
        emit(
            {
                "type": "progress",
                "percent": round(
                    (90 if untimed else 0)
                    + (index + 1) * (10 if untimed else 100) / len(lines)
                ),
                "message": f"Sentence {index + 1} of {len(lines)}",
            }
        )
    emit(
        {
            "type": "result",
            "lines": output,
            "duration_ms": duration_ms,
            "device": device,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 -- serialize all worker failures for the UI
        emit({"type": "error", "message": str(error)})
        sys.exit(1)
