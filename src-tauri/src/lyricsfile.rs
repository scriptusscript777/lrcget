use crate::parser::lrc::parse_lrc;
use crate::persistent_entities::PersistentTrack;
use crate::utils::strip_timestamp;
use anyhow::Result;
use serde::{Deserialize, Serialize};

pub const LYRICSFILE_VERSION: &str = "1.0";
pub const INSTRUMENTAL_LRC: &str = "[au: instrumental]";

#[derive(Debug, Clone, Copy, Default)]
pub struct LyricsPresence {
    pub has_plain_lyrics: bool,
    pub has_synced_lyrics: bool,
    pub has_word_synced_lyrics: bool,
    pub is_instrumental: bool,
}

#[derive(Debug, Clone)]
pub struct LyricsfileTrackMetadata {
    pub title: String,
    pub album_name: String,
    pub artist_name: String,
    pub duration: f64,
}

impl LyricsfileTrackMetadata {
    pub fn from_persistent_track(track: &PersistentTrack) -> Self {
        Self {
            title: track.title.clone(),
            album_name: track.album_name.clone(),
            artist_name: track.artist_name.clone(),
            duration: track.duration,
        }
    }

    pub fn new(title: &str, album_name: &str, artist_name: &str, duration: f64) -> Self {
        Self {
            title: title.to_string(),
            album_name: album_name.to_string(),
            artist_name: artist_name.to_string(),
            duration,
        }
    }
}

#[derive(Debug)]
pub struct ParsedLyricsfile {
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
    pub enhanced_lyrics: Result<Option<String>, String>,
    pub is_instrumental: bool,
}

#[derive(Debug, Serialize)]
struct LyricsfileDocument {
    version: String,
    metadata: LyricsfileMetadata,
    lines: Vec<LyricsfileLine>,
    #[serde(skip_serializing_if = "Option::is_none")]
    plain: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LyricsfileMetadata {
    title: String,
    artist: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    album: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    offset_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    instrumental: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct LyricsfileLine {
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    start_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    words: Vec<LyricsfileWord>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LyricsfileWord {
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    start_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_ms: Option<i64>,
}

fn null_as_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Default + serde::Deserialize<'de>,
{
    let opt = Option::<T>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

#[derive(Debug, Deserialize)]
struct ParsedLyricsfileDocument {
    metadata: ParsedLyricsfileMetadata,
    #[serde(default, deserialize_with = "null_as_default")]
    lines: Vec<LyricsfileLine>,
    plain: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ParsedLyricsfileMetadata {
    #[serde(default)]
    instrumental: bool,
}

pub fn build_lyricsfile(
    metadata: &LyricsfileTrackMetadata,
    plain_lyrics: Option<&str>,
    synced_lyrics: Option<&str>,
) -> Option<String> {
    let plain = normalize_non_empty(plain_lyrics);
    let synced = normalize_non_empty(synced_lyrics);
    let is_instrumental = synced
        .as_ref()
        .map(|value| is_instrumental_lyrics(value))
        .unwrap_or(false);

    if plain.is_none() && synced.is_none() {
        return None;
    }

    let synced_lines = if is_instrumental {
        Vec::new()
    } else {
        synced
            .as_ref()
            .map_or_else(Vec::new, |value| parse_lrc_lines(value))
    };

    let plain_for_document = if is_instrumental {
        None
    } else {
        plain.or_else(|| synced.as_ref().map(|value| strip_timestamp(value)))
    };

    let document = LyricsfileDocument {
        version: LYRICSFILE_VERSION.to_string(),
        metadata: LyricsfileMetadata {
            title: metadata.title.clone(),
            artist: metadata.artist_name.clone(),
            album: normalize_non_empty(Some(metadata.album_name.as_str())),
            duration_ms: duration_to_ms(metadata.duration),
            offset_ms: None,
            language: None,
            instrumental: is_instrumental,
        },
        lines: synced_lines,
        plain: plain_for_document,
    };

    serde_yaml::to_string(&document).ok()
}

pub fn parse_lyricsfile(lyricsfile: &str) -> Result<ParsedLyricsfile> {
    let document: ParsedLyricsfileDocument = serde_yaml::from_str(lyricsfile)?;

    let is_instrumental = document.metadata.instrumental;
    let synced_lyrics = if is_instrumental {
        Some(INSTRUMENTAL_LRC.to_string())
    } else {
        lines_to_lrc(&document.lines)
    };

    let plain_lyrics = normalize_non_empty(document.plain.as_deref()).or_else(|| {
        synced_lyrics
            .as_ref()
            .map(|value| strip_timestamp(value))
            .and_then(|value| normalize_non_empty(Some(value.as_str())))
    });

    Ok(ParsedLyricsfile {
        plain_lyrics,
        synced_lyrics,
        enhanced_lyrics: if is_instrumental {
            Ok(None)
        } else {
            lines_to_enhanced_lrc(&document.lines)
        },
        is_instrumental,
    })
}

pub fn lyrics_presence_from_lyricsfile(lyricsfile: &str) -> Result<LyricsPresence> {
    let document: ParsedLyricsfileDocument = serde_yaml::from_str(lyricsfile)?;
    let is_instrumental = document.metadata.instrumental;

    if is_instrumental {
        return Ok(LyricsPresence {
            is_instrumental: true,
            ..LyricsPresence::default()
        });
    }

    let has_synced_lyrics = document
        .lines
        .iter()
        .any(|line| line.start_ms.is_some_and(|start| start >= 0));
    let has_word_synced_lyrics = document
        .lines
        .iter()
        .any(|line| line.start_ms.is_some_and(|start| start >= 0) && !line.words.is_empty());
    let has_plain_from_lines = document.lines.iter().any(|line| {
        normalize_non_empty(Some(line.text.as_str())).is_some()
            || line
                .words
                .iter()
                .any(|word| normalize_non_empty(Some(word.text.as_str())).is_some())
    });
    let has_plain_lyrics =
        normalize_non_empty(document.plain.as_deref()).is_some() || has_plain_from_lines;

    Ok(LyricsPresence {
        has_plain_lyrics,
        has_synced_lyrics,
        has_word_synced_lyrics,
        is_instrumental: false,
    })
}

pub fn is_instrumental_lyrics(lyrics: &str) -> bool {
    let lowered = lyrics.to_lowercase();
    lowered.contains("[au:") && lowered.contains("instrumental")
}

fn parse_lrc_lines(synced_lyrics: &str) -> Vec<LyricsfileLine> {
    let parsed = parse_lrc(synced_lyrics);

    parsed
        .timed_lines
        .iter()
        .enumerate()
        .map(|(index, timed_line)| {
            let start_ms = timed_line.timestamp_ms;
            let end_ms = parsed
                .timed_lines
                .get(index + 1)
                .map(|next_line| next_line.timestamp_ms);

            LyricsfileLine {
                text: timed_line.text.clone(),
                start_ms: Some(start_ms),
                end_ms,
                words: Vec::new(),
            }
        })
        .collect()
}

const MIN_LRC_GAP_MS: i64 = 250;

fn lines_to_lrc(lines: &[LyricsfileLine]) -> Option<String> {
    lines_to_lrc_with_text(lines, |line| {
        if line.words.is_empty() { line.text.clone() } else {
            line.words.iter().map(|word| word.text.as_str()).collect()
        }
    })
}

fn lines_to_lrc_with_text(lines: &[LyricsfileLine], text_for_line: impl Fn(&LyricsfileLine) -> String) -> Option<String> {
    let mut timed: Vec<_> = lines
        .iter()
        .filter_map(|line| {
            line.start_ms
                .filter(|start| *start >= 0)
                .map(|start| (start, line))
        })
        .collect();
    timed.sort_by_key(|(start, _)| *start);
    let mut events: Vec<(i64, String)> = timed
        .iter()
        .map(|(start, line)| {
            let text = text_for_line(line);
            (*start, text)
        })
        .collect();
    let mut occupied: std::collections::HashSet<i64> =
        timed.iter().map(|(start, _)| *start).collect();
    for (start, line) in &timed {
        let Some(end) = line.end_ms.filter(|end| *end > *start) else {
            continue;
        };
        if line.text.trim().is_empty() || occupied.contains(&end) {
            continue;
        }
        let next_start = timed
            .iter()
            .find(|(candidate, _)| *candidate > end)
            .map(|(candidate, _)| *candidate);
        if next_start.is_some_and(|next| next - end < MIN_LRC_GAP_MS) {
            continue;
        }
        let active = timed.iter().any(|(other_start, other)| {
            if std::ptr::eq(*other, *line) || other.text.trim().is_empty() || *other_start > end {
                return false;
            }
            let next = timed
                .iter()
                .find(|(candidate, _)| *candidate > *other_start)
                .map(|(candidate, _)| *candidate);
            let other_end = other.end_ms.or(next).unwrap_or(i64::MAX);
            *other_start <= end && other_end > end
        });
        if !active {
            events.push((end, String::new()));
            occupied.insert(end);
        }
    }
    events.sort_by_key(|(time, _)| *time);
    let output = events
        .iter()
        .map(|(time, text)| {
            // Milliseconds keep short gaps distinct, matching the frontend exporter.
            format!(
                "[{:02}:{:02}.{:03}]{}\n",
                time / 60_000,
                (time % 60_000) / 1_000,
                time % 1_000,
                text
            )
        })
        .collect::<String>();
    normalize_non_empty(Some(output.as_str()))
}

// Enhanced LRC retains the standard line/gap cues and adds inline word timestamps.
// Only saved, valid word timing is exported; never synthesize karaoke timing.
fn lines_to_enhanced_lrc(lines: &[LyricsfileLine]) -> Result<Option<String>, String> {
    static RESERVED_TAG: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"<\d+:\d+(?:[.:]\d+)?>").unwrap());
    let mut enhanced = std::collections::HashMap::new();
    for (index, line) in lines.iter().enumerate() {
        let Some(start) = line.start_ms else { continue };
        let fail = || format!("Invalid saved word timing on lyric {}", index + 1);
        // Literal inline timestamps cannot be escaped reliably across ELRC players.
        if start < 0 || line.text.contains(['\n', '\r']) || RESERVED_TAG.is_match(&line.text) {
            return Err(fail());
        }
        if line.words.is_empty() {
            continue;
        }
        let text: String = line.words.iter().map(|word| word.text.as_str()).collect();
        if text != line.text || text.contains(['\n', '\r']) {
            return Err(fail());
        }
        let line_end = match line.end_ms {
            Some(end) if end > start => Some(end),
            Some(_) => return Err(fail()),
            None => lines
                .iter()
                .filter_map(|other| other.start_ms)
                .filter(|other| *other > start)
                .min(),
        };
        let mut output = String::new();
        let mut previous_start = None;
        for (word_index, word) in line.words.iter().enumerate() {
            let word_start = word.start_ms.ok_or_else(fail)?;
            if word_start < start
                || previous_start.is_some_and(|prev| word_start <= prev)
                || line_end.is_some_and(|end| word_start >= end)
            {
                return Err(fail());
            }
            let next_start = line
                .words
                .get(word_index + 1)
                .and_then(|next| next.start_ms);
            let word_end = word.end_ms.or(next_start).or(line_end);
            if let Some(end) = word_end {
                if end <= word_start
                    || next_start.is_some_and(|next| end > next)
                    || line_end.is_some_and(|limit| end > limit)
                {
                    return Err(fail());
                }
            }
            output.push_str(&format!("<{}>{}", inline_timestamp(word_start), word.text));
            // A trailing end tag preserves silence, including gaps within a sentence.
            if let Some(end) = word_end {
                if next_start != Some(end) {
                    output.push_str(&format!("<{}>", inline_timestamp(end)));
                }
            }
            previous_start = Some(word_start);
        }
        enhanced.insert(line as *const LyricsfileLine, output);
    }
    if enhanced.is_empty() {
        return Ok(None);
    }
    Ok(lines_to_lrc_with_text(lines, |line| {
        enhanced
            .get(&(line as *const LyricsfileLine))
            .cloned()
            .unwrap_or_else(|| line.text.clone())
    }))
}

fn inline_timestamp(time: i64) -> String {
    format!(
        "{:02}:{:02}.{:03}",
        time / 60_000,
        (time % 60_000) / 1_000,
        time % 1_000
    )
}

fn duration_to_ms(duration: f64) -> Option<i64> {
    if duration > 0.0 {
        Some((duration * 1000.0).round() as i64)
    } else {
        None
    }
}

fn normalize_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::to_string)
        .filter(|content| !content.trim().is_empty())
}

#[cfg(test)]
mod gap_export_tests {
    use super::*;

    fn line(text: &str, start: Option<i64>, end: Option<i64>) -> LyricsfileLine {
        LyricsfileLine {
            text: text.into(),
            start_ms: start,
            end_ms: end,
            words: vec![],
        }
    }

    #[test]
    fn standard_lrc_preserves_gaps_final_end_and_milliseconds() {
        let output = lines_to_lrc(&[
            line("First", Some(1001), Some(2001)),
            line("Last", Some(3001), Some(4001)),
        ])
        .unwrap();
        assert_eq!(
            output,
            "[00:01.001]First\n[00:02.001]\n[00:03.001]Last\n[00:04.001]\n"
        );
        let parsed = parse_lrc(&output);
        assert_eq!(parsed.timed_lines.len(), 4);
        assert_eq!(parsed.timed_lines[1].timestamp_ms, 2001);
        assert!(parsed.timed_lines[1].text.is_empty());
    }

    #[test]
    fn avoids_short_duplicate_and_overlapping_clear_cues() {
        for start in [1500, 2000, 2001, 2249] {
            let output = lines_to_lrc(&[
                line("First", Some(1000), Some(2000)),
                line("Last", Some(start), Some(4000)),
            ])
            .unwrap();
            assert!(!output.contains("[00:02.000]\n"));
        }
        let output = lines_to_lrc(&[
            line("First", Some(1000), Some(2000)),
            line("", Some(2000), None),
            line("Last", Some(2250), Some(4000)),
        ])
        .unwrap();
        assert_eq!(output.matches("[00:02.000]").count(), 1);
    }

    #[test]
    fn untimed_rows_are_plain_and_survive_internal_storage() {
        let document = "metadata:\n  title: Song\n  artist: Artist\nlines:\n  - text: untimed phrase\n  - text: other phrase\n    words:\n      - text: other phrase\nplain: |\n  untimed phrase\n  other phrase\n";
        let parsed = parse_lyricsfile(document).unwrap();
        assert!(parsed.synced_lyrics.is_none());
        assert!(parsed.plain_lyrics.unwrap().contains("untimed phrase"));
        let presence = lyrics_presence_from_lyricsfile(document).unwrap();
        assert!(presence.has_plain_lyrics);
        assert!(!presence.has_synced_lyrics);
        assert!(!presence.has_word_synced_lyrics);
    }
}

#[cfg(test)]
mod enhanced_export_tests {
    use super::*;

    const DOCUMENT: &str = "metadata: {}\nlines:\n  - text: 'Hello world'\n    start_ms: 1001\n    end_ms: 2001\n    words:\n      - text: 'Hello '\n        start_ms: 1001\n        end_ms: 1501\n      - text: world\n        start_ms: 1751\n        end_ms: 2001\n  - text: Next\n    start_ms: 3001\n    end_ms: 4001\n";

    #[test]
    fn preserves_word_silence_sentence_gaps_and_standard_lrc() {
        let parsed = parse_lyricsfile(DOCUMENT).unwrap();
        assert_eq!(parsed.enhanced_lyrics.unwrap().unwrap(),
            "[00:01.001]<00:01.001>Hello <00:01.501><00:01.751>world<00:02.001>\n[00:02.001]\n[00:03.001]Next\n[00:04.001]\n");
        assert_eq!(
            parsed.synced_lyrics.unwrap(),
            "[00:01.001]Hello world\n[00:02.001]\n[00:03.001]Next\n[00:04.001]\n"
        );
        assert_eq!(parsed.plain_lyrics.unwrap(), "Hello world\nNext\n");
    }

    #[test]
    fn does_not_invent_word_timing_for_plain_line_timed_or_instrumental_lyrics() {
        for doc in [
            "metadata: {}\nplain: hello\n",
            "metadata: {}\nlines:\n  - text: hello\n    start_ms: 1000\n",
            "metadata: {instrumental: true}\n",
        ] {
            assert!(parse_lyricsfile(doc)
                .unwrap()
                .enhanced_lyrics
                .unwrap()
                .is_none());
        }
    }

    #[test]
    fn invalid_words_do_not_block_standard_exports() {
        for replacement in ["start_ms: 999", "start_ms: 2001"] {
            let broken = DOCUMENT.replace("start_ms: 1751", replacement);
            let parsed = parse_lyricsfile(&broken).unwrap();
            assert!(parsed.enhanced_lyrics.is_err());
            assert!(parsed.synced_lyrics.unwrap().contains("Hello world"));
        }
        for broken in [
            DOCUMENT.replace("end_ms: 1501", "end_ms: 1801"),
            DOCUMENT.replace(
                "      - text: world\n        start_ms: 1751",
                "      - text: world",
            ),
            DOCUMENT.replace("text: 'Hello world'", "text: 'Different text'"),
        ] {
            assert!(parse_lyricsfile(&broken).unwrap().enhanced_lyrics.is_err());
        }
    }

    #[test]
    fn rejects_negative_sentence_times_and_reserved_inline_tags() {
        for doc in [
            DOCUMENT.replace("start_ms: 1001", "start_ms: -1"),
            DOCUMENT.replace("Hello world", "<00:01.000>Hello world"),
        ] {
            let parsed = parse_lyricsfile(&doc).unwrap();
            assert!(parsed.enhanced_lyrics.is_err());
            assert!(parsed.synced_lyrics.is_some());
        }
    }

    #[test]
    fn uses_next_word_and_sentence_end_for_missing_word_ends() {
        let doc = DOCUMENT
            .replace("        end_ms: 1501\n", "")
            .replace("        end_ms: 2001\n", "");
        let enhanced = parse_lyricsfile(&doc)
            .unwrap()
            .enhanced_lyrics
            .unwrap()
            .unwrap();
        assert!(enhanced.contains("<00:01.001>Hello <00:01.751>world<00:02.001>"));
    }
}
