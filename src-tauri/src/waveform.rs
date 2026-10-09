//! Read-only, bounded peak extraction using the same decoder defaults as Kira.
use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, Metadata},
    io::{BufReader, BufWriter, ErrorKind, Write},
    path::Path,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use symphonia::core::{audio::SampleBuffer, errors::Error, io::MediaSourceStream, probe::Hint};

const VERSION: u32 = 1;
const MAX_PEAKS: usize = 24_000;
const MAX_SECONDS: u64 = 4 * 60 * 60;
const MAX_CACHE_BYTES: u64 = 1024 * 1024;
const MAX_CACHE_FILES: usize = 128;
// One extraction at a time, without holding the player/DB lock. Duplicate requests
// wait here, then find the completed cache instead of decoding the song again.
static EXTRACTION: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Waveform {
    pub duration: f64,
    pub seconds_per_peak: f64,
    pub peaks: Vec<f32>,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
struct Fingerprint {
    length: u64,
    modified_ns: u128,
}

impl Fingerprint {
    fn from_metadata(metadata: &Metadata) -> Result<Self> {
        if !metadata.is_file() {
            bail!("Waveform source is not a regular file");
        }
        Ok(Self {
            length: metadata.len(),
            modified_ns: metadata.modified()?.duration_since(UNIX_EPOCH)?.as_nanos(),
        })
    }
}

#[derive(Deserialize, Serialize)]
struct CachedWaveform {
    version: u32,
    fingerprint: Fingerprint,
    waveform: Waveform,
}

impl Waveform {
    fn valid(&self) -> bool {
        self.duration.is_finite()
            && self.duration > 0.0
            && self.duration <= MAX_SECONDS as f64
            && self.seconds_per_peak.is_finite()
            && self.seconds_per_peak > 0.0
            && !self.peaks.is_empty()
            && self.peaks.len() <= MAX_PEAKS
            && self
                .peaks
                .iter()
                .all(|peak| peak.is_finite() && (0.0..=1.0).contains(peak))
            && self.duration <= self.peaks.len() as f64 * self.seconds_per_peak + 0.000_001
            && self.duration > (self.peaks.len() - 1) as f64 * self.seconds_per_peak
    }
}

struct Peaks {
    values: Vec<f32>,
    frames_per_peak: u64,
    pending_frames: u64,
    pending_peak: f32,
    frames: u64,
}

impl Peaks {
    fn new(sample_rate: u32) -> Self {
        Self {
            values: Vec::with_capacity(MAX_PEAKS),
            frames_per_peak: (sample_rate as u64 / 100).max(1),
            pending_frames: 0,
            pending_peak: 0.0,
            frames: 0,
        }
    }

    fn push(&mut self, peak: f32) {
        self.frames += 1;
        self.pending_frames += 1;
        self.pending_peak = self.pending_peak.max(peak);
        if self.pending_frames == self.frames_per_peak {
            self.values.push(self.pending_peak);
            self.pending_peak = 0.0;
            self.pending_frames = 0;
            // Coarsen old and future bins together; memory is independent of duration.
            if self.values.len() == MAX_PEAKS {
                for index in 0..MAX_PEAKS / 2 {
                    self.values[index] = self.values[index * 2].max(self.values[index * 2 + 1]);
                }
                self.values.truncate(MAX_PEAKS / 2);
                self.frames_per_peak *= 2;
            }
        }
    }

    fn finish(mut self, sample_rate: u32) -> Result<Waveform> {
        if self.pending_frames > 0 {
            self.values.push(self.pending_peak);
        }
        let waveform = Waveform {
            duration: self.frames as f64 / sample_rate as f64,
            seconds_per_peak: self.frames_per_peak as f64 / sample_rate as f64,
            peaks: self.values,
        };
        if !waveform.valid() {
            bail!("No usable audio waveform found");
        }
        Ok(waveform)
    }
}

fn decode(file: File) -> Result<Waveform> {
    let stream = MediaSourceStream::new(Box::new(file), Default::default());
    // Match Kira's default format/decoder options, including encoder-delay handling.
    let mut format = symphonia::default::get_probe()
        .format(
            &Hint::default(),
            stream,
            &Default::default(),
            &Default::default(),
        )?
        .format;
    let track = format
        .default_track()
        .ok_or_else(|| anyhow!("No audio track found"))?;
    let track_id = track.id;
    let sample_rate = track
        .codec_params
        .sample_rate
        .filter(|rate| *rate > 0)
        .ok_or_else(|| anyhow!("Unknown audio sample rate"))?;
    if track
        .codec_params
        .n_frames
        .is_some_and(|frames| frames > sample_rate as u64 * MAX_SECONDS)
    {
        bail!("Waveform preview supports audio up to four hours");
    }
    let mut decoder =
        symphonia::default::get_codecs().make(&track.codec_params, &Default::default())?;
    let mut peaks = Peaks::new(sample_rate);
    let mut samples: Option<SampleBuffer<f32>> = None;
    let mut buffer_capacity = 0;
    let mut buffer_channels = 0;
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(Error::IoError(error)) if error.kind() == ErrorKind::UnexpectedEof => break,
            Err(error) => return Err(error.into()),
        };
        if packet.track_id() != track_id {
            continue;
        }
        // A decode error must not silently remove time from the preview.
        let decoded = decoder.decode(&packet)?;
        let spec = *decoded.spec();
        let channels = spec.channels.count();
        if spec.rate != sample_rate || channels == 0 {
            bail!("Audio format changed while preparing waveform");
        }
        if peaks.frames + decoded.frames() as u64 > sample_rate as u64 * MAX_SECONDS {
            bail!("Waveform preview supports audio up to four hours");
        }
        if decoded.capacity() > buffer_capacity || channels != buffer_channels {
            buffer_capacity = decoded.capacity();
            buffer_channels = channels;
            samples = Some(SampleBuffer::new(buffer_capacity as u64, spec));
        }
        let buffer = samples
            .as_mut()
            .ok_or_else(|| anyhow!("Empty audio buffer"))?;
        buffer.copy_interleaved_ref(decoded);
        for frame in buffer.samples().chunks_exact(channels) {
            // Magnitudes across channels preserve transients even for anti-phase stereo.
            let mut peak = 0.0_f32;
            for sample in frame {
                if !sample.is_finite() {
                    bail!("Invalid audio samples");
                }
                peak = peak.max(sample.abs().min(1.0));
            }
            peaks.push(peak);
        }
    }
    peaks.finish(sample_rate)
}

pub fn load(source: &Path, cache_root: &Path) -> Result<Waveform> {
    let _guard = EXTRACTION
        .lock()
        .map_err(|_| anyhow!("Waveform worker unavailable"))?;
    let source = source.canonicalize().context("Audio file is unavailable")?;
    let file = File::open(&source).context("Cannot read audio file")?;
    let fingerprint = Fingerprint::from_metadata(&file.metadata()?)?;
    let cache_dir = cache_root.join("waveforms-v1");
    let key = xxhash_rust::xxh3::xxh3_128(source.as_os_str().as_encoded_bytes());
    let cache_path = cache_dir.join(format!("{key:032x}.json"));
    if fs::metadata(&cache_path).is_ok_and(|metadata| metadata.len() <= MAX_CACHE_BYTES) {
        if let Ok(cached_file) = File::open(&cache_path) {
            if let Ok(cached) =
                serde_json::from_reader::<_, CachedWaveform>(BufReader::new(cached_file))
            {
                if cached.version == VERSION
                    && cached.fingerprint == fingerprint
                    && cached.waveform.valid()
                {
                    return Ok(cached.waveform);
                }
            }
        }
    }
    let waveform = decode(file).context("Cannot prepare waveform")?;
    if fingerprint != Fingerprint::from_metadata(&fs::metadata(&source)?)? {
        bail!("Audio changed during waveform preparation; retry");
    }
    // Cache failures are nonfatal: playback/editing still work on read-only disks.
    if fs::create_dir_all(&cache_dir).is_ok() {
        let cached = CachedWaveform {
            version: VERSION,
            fingerprint,
            waveform: waveform.clone(),
        };
        let write_cache = || -> Result<()> {
            let mut staging = tempfile::NamedTempFile::new_in(&cache_dir)?;
            {
                let mut writer = BufWriter::new(staging.as_file_mut());
                serde_json::to_writer(&mut writer, &cached)?;
                writer.flush()?;
            }
            staging.persist(&cache_path)?;
            Ok(())
        };
        if write_cache().is_ok() {
            prune_cache(&cache_dir, &cache_path);
        }
    }
    Ok(waveform)
}

fn prune_cache(directory: &Path, keep: &Path) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    let mut files = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path == keep
                || path
                    .extension()
                    .map_or(true, |extension| extension != "json")
            {
                return None;
            }
            let metadata = entry.metadata().ok()?;
            metadata
                .is_file()
                .then(|| (metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH), path))
        })
        .collect::<Vec<_>>();
    files.sort_by_key(|(modified, _)| *modified);
    let remove_count = files.len().saturating_sub(MAX_CACHE_FILES - 1);
    for (_, path) in files.into_iter().take(remove_count) {
        let _ = fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_wav(path: &Path, amplitude: i16) {
        let frames = 1000_u32;
        let bytes = frames * 4;
        let mut data = Vec::new();
        data.extend_from_slice(b"RIFF");
        data.extend_from_slice(&(36 + bytes).to_le_bytes());
        data.extend_from_slice(b"WAVEfmt ");
        data.extend_from_slice(&16_u32.to_le_bytes());
        data.extend_from_slice(&1_u16.to_le_bytes());
        data.extend_from_slice(&2_u16.to_le_bytes());
        data.extend_from_slice(&1000_u32.to_le_bytes());
        data.extend_from_slice(&4000_u32.to_le_bytes());
        data.extend_from_slice(&4_u16.to_le_bytes());
        data.extend_from_slice(&16_u16.to_le_bytes());
        data.extend_from_slice(b"data");
        data.extend_from_slice(&bytes.to_le_bytes());
        for _ in 0..frames {
            data.extend_from_slice(&amplitude.to_le_bytes());
            data.extend_from_slice(&(-amplitude).to_le_bytes());
        }
        fs::write(path, data).unwrap();
    }

    #[test]
    fn peaks_compact_without_losing_transients_or_partial_end() {
        let mut peaks = Peaks::new(100);
        for index in 0..MAX_PEAKS + 3 {
            peaks.push(if index == 5 { 1.0 } else { 0.2 });
        }
        let waveform = peaks.finish(100).unwrap();
        assert!(waveform.peaks.len() < MAX_PEAKS);
        assert_eq!(waveform.peaks[2], 1.0);
        assert_eq!(waveform.duration, (MAX_PEAKS + 3) as f64 / 100.0);
        assert_eq!(waveform.seconds_per_peak, 0.02);
        assert!(waveform.valid());
    }

    #[test]
    fn cache_reuse_invalidation_and_repair_preserve_audio() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("fixture.wav");
        let cache = directory.path().join("cache");
        write_wav(&source, 16000);
        let original = fs::read(&source).unwrap();
        let first = load(&source, &cache).unwrap();
        assert_eq!(first.duration, 1.0);
        assert!((first.peaks[0] - 16000.0 / 32768.0).abs() < 0.001);
        let cache_file = fs::read_dir(cache.join("waveforms-v1"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let stamp = fs::metadata(&cache_file).unwrap().modified().unwrap();
        let second = load(&source, &cache).unwrap();
        assert_eq!(first.peaks, second.peaks);
        assert_eq!(
            stamp,
            fs::metadata(&cache_file).unwrap().modified().unwrap()
        );
        assert_eq!(original, fs::read(&source).unwrap());
        fs::write(&cache_file, b"broken cache").unwrap();
        assert_eq!(first.peaks, load(&source, &cache).unwrap().peaks);
        std::thread::sleep(std::time::Duration::from_millis(10));
        write_wav(&source, 8000);
        assert!(load(&source, &cache).unwrap().peaks[0] < first.peaks[0]);
    }

    #[test]
    fn invalid_sources_and_empty_peaks_fail_safely() {
        let directory = tempfile::tempdir().unwrap();
        assert!(load(directory.path(), directory.path()).is_err());
        let invalid = directory.path().join("invalid.mp3");
        fs::write(&invalid, b"not audio").unwrap();
        assert!(load(&invalid, directory.path()).is_err());
        assert!(Peaks::new(44100).finish(44100).is_err());
        assert!(!Waveform {
            duration: 1.0,
            seconds_per_peak: 1.0,
            peaks: vec![f32::NAN]
        }
        .valid());
    }

    #[test]
    fn unwritable_cache_does_not_block_preview() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("fixture.wav");
        write_wav(&source, 8000);
        let cache = directory.path().join("not-a-directory");
        fs::write(&cache, b"fixture").unwrap();
        assert!(load(&source, &cache).unwrap().valid());
    }

    #[test]
    #[ignore = "requires synthesized WAV/MP3/FLAC/Ogg fixtures via LRCGET_WAVEFORM_FIXTURES"]
    fn generated_formats_match_existing_player_and_preserve_sources() {
        let fixtures =
            std::env::var("LRCGET_WAVEFORM_FIXTURES").expect("fixture directory required");
        let cache = tempfile::tempdir().unwrap();
        for extension in ["wav", "mp3", "flac", "ogg"] {
            let source = Path::new(&fixtures).join(format!("fixture.{extension}"));
            let before = fs::read(&source).unwrap();
            let player_duration = kira::sound::streaming::StreamingSoundData::from_file(&source)
                .unwrap()
                .duration()
                .as_secs_f64();
            let waveform = load(&source, cache.path()).unwrap();
            assert!(
                (waveform.duration - player_duration).abs() < 0.05,
                "{extension}: waveform {} vs player {player_duration}",
                waveform.duration
            );
            assert!(waveform.peaks.iter().any(|peak| *peak > 0.01));
            assert_eq!(waveform.peaks, load(&source, cache.path()).unwrap().peaks);
            assert_eq!(before, fs::read(&source).unwrap());
        }
    }
}
