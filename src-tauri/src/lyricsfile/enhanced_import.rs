use super::*;
use anyhow::{ensure, Context};
use regex::Regex;
use std::sync::LazyLock;

static LINE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]").unwrap());
static WORD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<(\d+):(\d{1,2})(?:[.:](\d{1,3}))?>").unwrap());
static RESERVED: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<\s*\d+\s*:").unwrap());
static META: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\[([a-zA-Z]+):(.*)\]$").unwrap());
static LINE_PREFIX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\[\s*\d+\s*:").unwrap());

fn time(caps: &regex::Captures<'_>) -> Result<i64> {
    let minutes = caps[1].parse::<i64>()?;
    let seconds = caps[2].parse::<i64>()?;
    ensure!(seconds < 60, "Invalid ELRC seconds");
    let fraction = caps.get(3).map_or("", |value| value.as_str());
    let millis = format!("{fraction:0<3}").parse::<i64>()?;
    let value = minutes
        .checked_mul(60_000)
        .and_then(|value| value.checked_add(seconds * 1000))
        .and_then(|value| value.checked_add(millis))
        .context("ELRC timestamp overflow")?;
    ensure!(
        value <= 9_007_199_254_740_991,
        "ELRC time exceeds editor precision"
    );
    Ok(value)
}

// Same absolute word/start/end representation as the editor's enhanced-lrc importer.
// Parsing validates first; the scanner never stores inline tags as lyric words.
pub fn build_enhanced_lyricsfile(
    metadata: &LyricsfileTrackMetadata,
    source: &str,
) -> Result<String> {
    let mut lines: Vec<LyricsfileLine> = Vec::new();
    for raw in source.trim_start_matches('\u{feff}').lines() {
        let raw = raw.trim_start();
        if raw.trim().is_empty() {
            continue;
        }
        if let Some(tag) = META.captures(raw.trim()) {
            if tag[1].eq_ignore_ascii_case("offset") {
                ensure!(
                    tag[2].trim().parse::<i64>()? == 0,
                    "Apply ELRC offset before import"
                );
            }
            continue;
        }
        let Some(caps) = LINE.captures(raw) else {
            ensure!(
                !LINE_PREFIX.is_match(raw) && !RESERVED.is_match(raw),
                "Malformed ELRC timestamp"
            );
            lines.push(LyricsfileLine {
                text: raw.to_owned(),
                start_ms: None,
                end_ms: None,
                words: vec![],
            });
            continue;
        };
        let start = time(&caps)?;
        let text = &raw[caps.get(0).unwrap().end()..];
        ensure!(
            !LINE.is_match(text),
            "Use one line timestamp per word-timed row"
        );
        let tags: Vec<_> = WORD.captures_iter(text).collect();
        ensure!(
            !RESERVED.is_match(&WORD.replace_all(text, "")),
            "Malformed ELRC word timestamp"
        );
        if tags.is_empty() {
            lines.push(LyricsfileLine {
                text: text.trim().to_owned(),
                start_ms: Some(start),
                end_ms: None,
                words: vec![],
            });
            continue;
        }
        let prefix = &text[..tags[0].get(0).unwrap().start()];
        ensure!(
            prefix.trim().is_empty(),
            "Every ELRC word needs a start timestamp"
        );
        let times: Vec<_> = tags.iter().map(time).collect::<Result<_>>()?;
        ensure!(
            times.iter().all(|time| *time >= start)
                && times.windows(2).all(|pair| pair[0] <= pair[1]),
            "ELRC timestamps must stay ordered"
        );
        let mut words = Vec::new();
        for (index, tag) in tags.iter().enumerate() {
            let begin = tag.get(0).unwrap().end();
            let end = tags
                .get(index + 1)
                .map_or(text.len(), |next| next.get(0).unwrap().start());
            let word_text = &text[begin..end];
            if word_text.is_empty() {
                continue;
            }
            let word_end = times.get(index + 1).copied();
            ensure!(
                word_end.map_or(true, |end| end > times[index]),
                "ELRC word needs a positive range"
            );
            words.push(LyricsfileWord {
                text: if words.is_empty() {
                    format!("{prefix}{word_text}")
                } else {
                    word_text.to_owned()
                },
                start_ms: Some(times[index]),
                end_ms: word_end,
            });
        }
        ensure!(
            words.iter().any(|word| !word.text.trim().is_empty()),
            "ELRC row contains no words"
        );
        lines.push(LyricsfileLine {
            text: words.iter().map(|word| word.text.as_str()).collect(),
            start_ms: Some(start),
            end_ms: words.last().and_then(|word| word.end_ms),
            words,
        });
    }
    ensure!(
        lines
            .iter()
            .any(|line| line.start_ms.is_some() && !line.text.trim().is_empty()),
        "No timed ELRC lyrics"
    );
    let mut previous = None;
    for index in 0..lines.len() {
        let Some(start) = lines[index].start_ms else {
            continue;
        };
        ensure!(
            previous.map_or(true, |previous| start >= previous),
            "ELRC rows must stay ordered"
        );
        previous = Some(start);
        let next = lines[index + 1..].iter().find_map(|line| line.start_ms);
        lines[index].end_ms = lines[index].end_ms.or(next);
        let end = lines[index].end_ms;
        if let Some(last) = lines[index].words.last_mut() {
            if last.end_ms.is_none()
                && end.is_some_and(|end| last.start_ms.is_some_and(|start| end > start))
            {
                last.end_ms = end;
            }
        }
    }
    // Shared export validation catches duplicate starts, crossed ends and sentence bounds.
    lines_to_enhanced_lrc(&lines).map_err(anyhow::Error::msg)?;
    let plain = lines
        .iter()
        .filter(|line| !line.text.is_empty())
        .map(|line| line.text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    serde_yaml::to_string(&LyricsfileDocument {
        version: LYRICSFILE_VERSION.to_owned(),
        metadata: LyricsfileMetadata {
            title: metadata.title.clone(),
            artist: metadata.artist_name.clone(),
            album: normalize_non_empty(Some(&metadata.album_name)),
            duration_ms: duration_to_ms(metadata.duration),
            offset_ms: None,
            language: None,
            instrumental: false,
        },
        lines,
        plain: Some(plain),
    })
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn imports_verified_export_without_losing_manual_ends_or_estimates() {
        let source = include_str!("../../../docs/examples/estimated-word-save/verification.elrc");
        let yaml = build_enhanced_lyricsfile(
            &LyricsfileTrackMetadata::new("test", "album", "artist", 10.0),
            source,
        )
        .unwrap();
        let parsed = parse_lyricsfile(&yaml).unwrap();
        assert_eq!(parsed.enhanced_lyrics.unwrap().unwrap(), source);
        assert!(
            lyrics_presence_from_lyricsfile(&yaml)
                .unwrap()
                .has_word_synced_lyrics
        );
    }
    #[test]
    fn rejects_malformed_offset_overflow_and_crossed_times() {
        let metadata = LyricsfileTrackMetadata::new("test", "album", "artist", 10.0);
        for source in [
            "[offset:100]\n[00:01.00]<00:01.00>a",
            "[00:61.000]<00:61.000>a",
            "[00:01.000]<00:02.000>a<00:01.000>b",
            "[00:01.000]<00:01.000>a<00:01.000>b",
            "[00:01.000]<00:00.000>a",
            "[999999999999999999999:01.000]a",
            "[00:01.000]<00:bad>a",
            "[00:01.000]<00:02.000>a\n[00:01.500]b",
        ] {
            assert!(
                build_enhanced_lyricsfile(&metadata, source).is_err(),
                "{source}"
            );
        }
    }
    #[test]
    fn permits_line_only_and_untimed_rows_without_inventing_words() {
        let yaml = build_enhanced_lyricsfile(
            &LyricsfileTrackMetadata::new("test", "album", "artist", 10.0),
            "[ar:artist]\nNote\n[00:01]first\n[00:02.5]second",
        )
        .unwrap();
        let presence = lyrics_presence_from_lyricsfile(&yaml).unwrap();
        assert!(presence.has_synced_lyrics);
        assert!(!presence.has_word_synced_lyrics);
    }
}
