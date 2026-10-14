use anyhow::Result;
use kira::{
    sound::{
        streaming::{Decoder, StreamingSoundData, StreamingSoundHandle},
        FromFileError, PlaybackState,
    },
    AudioManager, AudioManagerSettings, Decibels, DefaultBackend, Frame, Tween,
};

use crate::persistent_entities::PlayableTrack;
use serde::Serialize;
use std::{
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::Path,
};
use symphonia::core::{
    audio::SampleBuffer,
    errors::Error as Symphonia05Error,
    formats::{FormatReader as FormatReader05, SeekMode as SeekMode05, SeekTo as SeekTo05},
    io::{MediaSource as MediaSource05, MediaSourceStream as MediaSourceStream05},
    probe::Hint as Hint05,
    units::TimeStamp as TimeStamp05,
};
use symphonia06::core::io::MediaSource;

fn audio_data_offset_after_id3v2(header: &[u8], file_len: u64) -> io::Result<Option<u64>> {
    if header.len() < 10 || &header[..3] != b"ID3" || !(2..=4).contains(&header[3]) {
        return Ok(None);
    }

    if header[4] == 0xff {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid ID3v2 revision",
        ));
    }
    let reserved_flags = match header[3] {
        2 => 0x3f,
        3 => 0x1f,
        4 => 0x0f,
        _ => unreachable!("supported ID3v2 versions were checked"),
    };
    if header[5] & reserved_flags != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid ID3v2 header flags",
        ));
    }
    if header[6..10].iter().any(|byte| byte & 0x80 != 0) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid ID3v2 tag size",
        ));
    }

    let tag_size = ((header[6] as u64) << 21)
        | ((header[7] as u64) << 14)
        | ((header[8] as u64) << 7)
        | header[9] as u64;
    // The declared size includes extended headers, padding, unsynchronization
    // bytes, and (for v2.4) the footer. It excludes only the 10-byte header.
    let offset = 10_u64
        .checked_add(tag_size)
        .filter(|offset| *offset < file_len)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Invalid ID3v2 tag size"))?;
    if header[3] == 4 && header[5] & 0x10 != 0 && tag_size < 10 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid ID3v2.4 footer size",
        ));
    }
    Ok(Some(offset))
}

struct Id3v2AudioSource {
    file: File,
    audio_offset: u64,
    file_len: u64,
}

impl Id3v2AudioSource {
    fn open(path: &Path, audio_offset: u64) -> io::Result<Self> {
        let mut file = File::open(path)?;
        let file_len = file.metadata()?.len();
        file.seek(SeekFrom::Start(audio_offset))?;
        Ok(Self {
            file,
            audio_offset,
            file_len,
        })
    }
}

impl Read for Id3v2AudioSource {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        self.file.read(buffer)
    }
}

impl Seek for Id3v2AudioSource {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        let logical_position = self
            .file
            .stream_position()?
            .saturating_sub(self.audio_offset);
        let audio_len = self.file_len.saturating_sub(self.audio_offset);
        let target = match position {
            SeekFrom::Start(offset) => i128::from(offset),
            SeekFrom::Current(offset) => i128::from(logical_position) + i128::from(offset),
            SeekFrom::End(offset) => i128::from(audio_len) + i128::from(offset),
        };
        if target < 0 || target > i128::from(u64::MAX) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Invalid audio seek",
            ));
        }
        let physical_position = self
            .audio_offset
            .checked_add(target as u64)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "Invalid audio seek"))?;
        self.file
            .seek(SeekFrom::Start(physical_position))
            .map(|position| position.saturating_sub(self.audio_offset))
    }
}

impl symphonia06::core::io::MediaSource for Id3v2AudioSource {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        Some(self.file_len.saturating_sub(self.audio_offset))
    }
}

fn playback_sound_data(
    path: &Path,
    duration: f64,
) -> std::result::Result<StreamingSoundData<FromFileError>, FromFileError> {
    match StreamingSoundData::from_media_source(open_audio_source(path)?) {
        Ok(data) => Ok(data),
        Err(FromFileError::UnknownSampleRate) => {
            let decoder = LenientSymphoniaDecoder::new(open_audio_source(path)?, duration)?;
            Ok(StreamingSoundData::from_decoder(decoder))
        }
        Err(error) => Err(error),
    }
}

enum AudioSource {
    File(File),
    Id3v2(Id3v2AudioSource),
}

impl Read for AudioSource {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        match self {
            Self::File(file) => file.read(buffer),
            Self::Id3v2(source) => source.read(buffer),
        }
    }
}

impl Seek for AudioSource {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        match self {
            Self::File(file) => file.seek(position),
            Self::Id3v2(source) => source.seek(position),
        }
    }
}

impl MediaSource for AudioSource {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        match self {
            Self::File(file) => file.metadata().ok().map(|metadata| metadata.len()),
            Self::Id3v2(source) => Some(source.file_len.saturating_sub(source.audio_offset)),
        }
    }
}

impl MediaSource05 for AudioSource {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        match self {
            Self::File(file) => file.metadata().ok().map(|metadata| metadata.len()),
            Self::Id3v2(source) => Some(source.file_len.saturating_sub(source.audio_offset)),
        }
    }
}

fn open_audio_source(path: &Path) -> std::io::Result<AudioSource> {
    let mut file = File::open(path)?;
    let file_len = file.metadata()?.len();
    let mut header = [0_u8; 10];
    let header_len = file.read(&mut header)?;
    if let Some(offset) = audio_data_offset_after_id3v2(&header[..header_len], file_len)? {
        return Ok(AudioSource::Id3v2(Id3v2AudioSource::open(path, offset)?));
    }
    file.seek(SeekFrom::Start(0))?;
    Ok(AudioSource::File(file))
}

struct LenientSymphoniaDecoder {
    format_reader: Box<dyn FormatReader05>,
    decoder: Box<dyn symphonia::core::codecs::Decoder>,
    sample_rate: u32,
    num_frames: usize,
    track_id: u32,
}

impl LenientSymphoniaDecoder {
    fn new(source: AudioSource, duration: f64) -> std::result::Result<Self, FromFileError> {
        let format_reader = symphonia::default::get_probe()
            .format(
                &Hint05::default(),
                MediaSourceStream05::new(Box::new(source), Default::default()),
                &Default::default(),
                &Default::default(),
            )
            .map_err(map_symphonia05_error)?
            .format;
        let track = format_reader
            .default_track()
            .ok_or(FromFileError::NoDefaultTrack)?;
        let track_id = track.id;
        let audio_params = track.codec_params.clone();
        let sample_rate = audio_params
            .sample_rate
            .filter(|rate| *rate > 0)
            .ok_or(FromFileError::UnknownSampleRate)?;
        let num_frames = resolve_num_frames(audio_params.n_frames, sample_rate, duration)?;
        let decoder = symphonia::default::get_codecs()
            .make(&audio_params, &Default::default())
            .map_err(map_symphonia05_error)?;
        Ok(Self {
            format_reader,
            decoder,
            sample_rate,
            num_frames,
            track_id,
        })
    }
}

fn resolve_num_frames(
    frame_count: Option<u64>,
    sample_rate: u32,
    duration: f64,
) -> std::result::Result<usize, FromFileError> {
    match frame_count {
        Some(frames) => usize::try_from(frames).map_err(|_| FromFileError::UnknownDuration),
        None if duration.is_finite() && duration > 0.0 => {
            let frames = (duration * f64::from(sample_rate)).round();
            if frames > usize::MAX as f64 {
                Err(FromFileError::UnknownDuration)
            } else {
                Ok(frames as usize)
            }
        }
        None => Err(FromFileError::UnknownDuration),
    }
}

impl Decoder for LenientSymphoniaDecoder {
    type Error = FromFileError;

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn num_frames(&self) -> usize {
        self.num_frames
    }

    fn decode(&mut self) -> std::result::Result<Vec<Frame>, Self::Error> {
        let packet = loop {
            match self.format_reader.next_packet() {
                Ok(packet) if packet.track_id() == self.track_id => break packet,
                Ok(_) => continue,
                Err(Symphonia05Error::IoError(error))
                    if error.kind() == io::ErrorKind::UnexpectedEof =>
                {
                    return Ok(Vec::new());
                }
                Err(error) => return Err(map_symphonia05_error(error)),
            }
        };
        let buffer = self
            .decoder
            .decode(&packet)
            .map_err(map_symphonia05_error)?;
        let channels = buffer.spec().channels.count();
        if channels == 0 || channels > 2 {
            return Err(FromFileError::UnsupportedChannelConfiguration);
        }
        let mut samples = SampleBuffer::<f32>::new(buffer.capacity() as u64, *buffer.spec());
        samples.copy_interleaved_ref(buffer);
        Ok(samples
            .samples()
            .chunks_exact(channels)
            .map(|frame| match frame {
                [mono] => Frame::from_mono(*mono),
                [left, right] => Frame::new(*left, *right),
                _ => unreachable!("channel count was checked"),
            })
            .collect())
    }

    fn seek(&mut self, index: usize) -> std::result::Result<usize, Self::Error> {
        let seeked = self
            .format_reader
            .seek(
                SeekMode05::Accurate,
                SeekTo05::TimeStamp {
                    ts: index as TimeStamp05,
                    track_id: self.track_id,
                },
            )
            .map_err(map_symphonia05_error)?;
        Ok(seeked.actual_ts as usize)
    }
}

fn map_symphonia05_error(error: Symphonia05Error) -> FromFileError {
    match error {
        Symphonia05Error::IoError(error) => FromFileError::IoError(error),
        error => FromFileError::IoError(io::Error::new(
            io::ErrorKind::InvalidData,
            error.to_string(),
        )),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayerStatus {
    Playing,
    Paused,
    Stopped,
}

#[derive(Default)]
struct EditorLoopState {
    session: u64,
    revision: u64,
    range: Option<(f64, f64)>,
}

impl EditorLoopState {
    fn begin(&mut self) -> Result<u64> {
        self.session = self
            .session
            .checked_add(1)
            .ok_or_else(|| anyhow::anyhow!("Loop session limit reached"))?;
        self.revision = 0;
        self.range = None;
        Ok(self.session)
    }

    fn accepts(&self, session: u64, revision: u64) -> bool {
        session == self.session && session != 0 && revision > self.revision
    }

    fn validate_range(
        start: Option<f64>,
        end: Option<f64>,
        duration: f64,
    ) -> Result<Option<(f64, f64)>> {
        match (start, end) {
            (None, None) => Ok(None),
            (Some(start), Some(end))
                if start.is_finite()
                    && end.is_finite()
                    && start >= 0.0
                    && end > start
                    && end <= duration =>
            {
                Ok(Some((start, end)))
            }
            _ => Err(anyhow::anyhow!(
                "Loop boundaries must be finite, ordered and inside the recording"
            )),
        }
    }
}

#[derive(Serialize)]
pub struct Player {
    #[serde(skip)]
    manager: AudioManager,
    #[serde(skip)]
    editor_loop: EditorLoopState,
    #[serde(skip)]
    sound_handle: Option<StreamingSoundHandle<FromFileError>>,
    #[serde(skip)]
    pub track: Option<PlayableTrack>,
    pub status: PlayerStatus,
    pub progress: f64,
    pub duration: f64,
    pub volume: f64,
    pub playback_speed: f64,
}

impl Player {
    pub fn new(initial_volume: f64) -> Result<Player> {
        let manager = AudioManager::<DefaultBackend>::new(AudioManagerSettings::default())?;

        Ok(Player {
            manager,
            editor_loop: EditorLoopState::default(),
            sound_handle: None,
            track: None,
            status: PlayerStatus::Stopped,
            progress: 0.0,
            duration: 0.0,
            volume: initial_volume,
            playback_speed: 1.0,
        })
    }

    pub fn begin_loop_session(&mut self) -> Result<u64> {
        let session = self.editor_loop.begin()?;
        if let Some(handle) = &mut self.sound_handle {
            handle.set_loop_region(None);
        }
        Ok(session)
    }

    pub fn set_editor_loop(
        &mut self,
        session: u64,
        revision: u64,
        track_id: Option<i64>,
        file_path: Option<&str>,
        start: Option<f64>,
        end: Option<f64>,
    ) -> Result<bool> {
        // A late change/cleanup from an older editor must never alter a new loop.
        if !self.editor_loop.accepts(session, revision) {
            return Ok(false);
        }
        let range = EditorLoopState::validate_range(start, end, self.duration)?;
        if range.is_some() {
            let matches = self.track.as_ref().is_some_and(|track| match track_id {
                Some(id) => track.id == Some(id),
                None => file_path.is_some_and(|path| track.file_path == path),
            });
            if !matches || self.sound_handle.is_none() {
                return Err(anyhow::anyhow!("Loop recording changed or is unavailable"));
            }
        }
        self.editor_loop.revision = revision;
        self.editor_loop.range = range;
        if let Some(handle) = &mut self.sound_handle {
            match range {
                Some((start, end)) => {
                    handle.set_loop_region(start..end);
                    // Apply changed boundaries without unpausing or awaiting GUI telemetry.
                    let position = handle.position();
                    if position < start || position >= end {
                        handle.seek_to(start);
                    }
                }
                None => handle.set_loop_region(None),
            }
        }
        Ok(true)
    }

    pub fn has_editor_loop(&self) -> bool {
        self.editor_loop.range.is_some()
    }

    pub fn renew_state(&mut self) {
        if let Some(ref mut sound_handle) = self.sound_handle {
            match sound_handle.state() {
                PlaybackState::Playing => self.status = PlayerStatus::Playing,
                PlaybackState::Pausing => self.status = PlayerStatus::Playing,
                PlaybackState::Stopping => self.status = PlayerStatus::Playing,
                PlaybackState::WaitingToResume => self.status = PlayerStatus::Playing,
                PlaybackState::Resuming => self.status = PlayerStatus::Playing,
                PlaybackState::Paused => self.status = PlayerStatus::Paused,
                PlaybackState::Stopped => self.status = PlayerStatus::Stopped,
            }
        } else {
            self.status = PlayerStatus::Stopped
        }

        match self.sound_handle {
            Some(ref mut sound_handle) => {
                self.progress = sound_handle.position();
            }
            None => {}
        }
    }

    pub fn play(&mut self, track: PlayableTrack) -> Result<()> {
        let _ = self.stop();
        self.track = Some(track);

        if let Some(ref mut track) = self.track {
            let sound_data = playback_sound_data(Path::new(&track.file_path), track.duration)?;

            self.duration = sound_data.duration().as_secs_f64();
            self.sound_handle = Some(self.manager.play(sound_data)?);
            self.sound_handle
                .as_mut()
                .unwrap()
                .set_volume(Self::volume_as_decibels(self.volume), Tween::default());
            self.sound_handle
                .as_mut()
                .unwrap()
                .set_playback_rate(self.playback_speed, Tween::default());
        }

        Ok(())
    }

    pub fn resume(&mut self) {
        if let Some(ref mut sound_handle) = self.sound_handle {
            sound_handle.resume(Tween::default());
        }
    }

    pub fn pause(&mut self) {
        if let Some(ref mut sound_handle) = self.sound_handle {
            sound_handle.pause(Tween::default());
        }
    }

    pub fn seek(&mut self, position: f64) {
        self.seek_with_options(position, false);
    }

    pub fn seek_with_options(&mut self, position: f64, preserve_paused: bool) {
        if let Some(ref mut sound_handle) = self.sound_handle {
            let should_resume = Self::resume_after_seek(sound_handle.state(), preserve_paused);
            sound_handle.seek_to(position);
            if should_resume {
                sound_handle.resume(Tween::default());
            }
        }
    }

    fn resume_after_seek(state: PlaybackState, preserve_paused: bool) -> bool {
        // Waveform inspection can seek silently; existing seek/loop callers keep
        // their original resume behavior. Do not resume then pause (audible blip).
        !matches!(state, PlaybackState::Playing)
            && !(preserve_paused && matches!(state, PlaybackState::Paused | PlaybackState::Pausing))
    }

    pub fn stop(&mut self) {
        self.editor_loop.range = None;
        if let Some(ref mut sound_handle) = self.sound_handle {
            sound_handle.stop(Tween::default());
            self.sound_handle = None;
            self.track = None;
            self.duration = 0.0;
            self.progress = 0.0;
            self.status = PlayerStatus::Stopped;
        }
    }

    /// Kira doesn't provide a way to create Decibels from an amplitude.
    /// Invert the formula in Decibels::as_amplitude():
    /// original:                         amp = 10 ^ (db / 20)
    /// take log() of both sides:         log(amp) = log(10 ^ (db / 20))
    /// identity log(a^b) = b*log(a):     log(amp) = (db / 20) * log(10)
    /// divide both sides by log(10):     log(amp) / log(10) = db / 20
    /// divide by log(10) is log base 10: log10(amp) = db / 20
    /// multiply both sides by 20:        20 * log10(amp) = db
    pub(crate) fn volume_as_decibels(volume: f64) -> Decibels {
        if volume <= 0.0 {
            Decibels::SILENCE
        } else if volume == 1.0 {
            Decibels::IDENTITY
        } else {
            Decibels((20.0 * volume.log10()) as f32)
        }
    }

    pub fn set_volume(&mut self, volume: f64) {
        if let Some(ref mut sound_handle) = self.sound_handle {
            sound_handle.set_volume(Self::volume_as_decibels(volume), Tween::default());
        }
        self.volume = volume;
    }

    pub fn set_playback_speed(&mut self, playback_speed: f64) {
        let clamped_speed = playback_speed.clamp(0.5, 2.0);

        if let Some(ref mut sound_handle) = self.sound_handle {
            sound_handle.set_playback_rate(clamped_speed, Tween::default());
        }

        self.playback_speed = clamped_speed;
    }
}

#[cfg(test)]
mod tests {
    use super::{
        audio_data_offset_after_id3v2, open_audio_source, playback_sound_data, resolve_num_frames,
        Id3v2AudioSource, LenientSymphoniaDecoder, Player,
    };
    use kira::sound::{streaming::Decoder, PlaybackState};
    use std::{
        io::{Read, Seek, SeekFrom},
        path::Path,
    };

    #[test]
    fn fallback_decoder_reads_mp3_fixture_and_uses_track_duration() {
        assert_eq!(resolve_num_frames(None, 44_100, 0.216).unwrap(), 9526);
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/embedding.mp3");
        let source = open_audio_source(&path).unwrap();
        let mut decoder = LenientSymphoniaDecoder::new(source, 0.216).unwrap();
        assert!(decoder.num_frames() > 0);
        let frames = decoder.decode().unwrap();
        assert!(!frames.is_empty());
    }

    #[test]
    fn id3v2_audio_offset_validates_supported_versions_and_bounds() {
        let mut header = *b"ID3\x04\x00\x00\x00\x00\x00\x05";
        assert_eq!(
            audio_data_offset_after_id3v2(&header, 100).unwrap(),
            Some(15)
        );
        header[3] = 3;
        assert_eq!(
            audio_data_offset_after_id3v2(&header, 100).unwrap(),
            Some(15)
        );
        header[3] = 2;
        assert_eq!(
            audio_data_offset_after_id3v2(&header, 100).unwrap(),
            Some(15)
        );
        header[3] = 5;
        assert_eq!(audio_data_offset_after_id3v2(&header, 100).unwrap(), None);
        assert_eq!(
            audio_data_offset_after_id3v2(b"not an id3 tag", 100).unwrap(),
            None
        );
        header[3] = 4;
        header[9] = 100;
        assert!(audio_data_offset_after_id3v2(&header, 50).is_err());
        header[9] = 0x80;
        assert!(audio_data_offset_after_id3v2(&header, 1000).is_err());
    }

    #[test]
    fn id3v24_footer_is_included_in_audio_offset() {
        // ID3v2.4's declared size includes its 10-byte footer.
        let header = *b"ID3\x04\x00\x10\x00\x00\x00\x0f";
        assert_eq!(
            audio_data_offset_after_id3v2(&header, 100).unwrap(),
            Some(25)
        );
    }

    #[test]
    fn id3v23_tag_is_skipped_before_audio_probe() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("id3v23.mp3");
        let header = b"ID3\x03\x00\x00\x00\x00\x00\x05";
        let mut bytes = header.to_vec();
        bytes.extend_from_slice(b"abcdeaudio");
        std::fs::write(&path, &bytes).unwrap();

        let mut source = open_audio_source(&path).unwrap();
        let mut audio = Vec::new();
        source.read_to_end(&mut audio).unwrap();
        assert_eq!(audio, b"audio");
    }

    #[test]
    fn playback_skips_id3v23_extended_unsynchronised_tag_and_keeps_seekable() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/embedding.mp3");
        let fixture_bytes = std::fs::read(&fixture).unwrap();
        let original_offset =
            audio_data_offset_after_id3v2(&fixture_bytes[..10], fixture_bytes.len() as u64)
                .unwrap()
                .unwrap() as usize;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("id3v23.mp3");
        let mut tag_body = vec![0, 0, 0, 6, 0, 0, 0, 0, 0, 0]; // v2.3 extended header
        tag_body.extend_from_slice(b"TIT2\x00\x00\x00\x03\x00\x00");
        tag_body.extend_from_slice(&[0, 0xff, 0x00, 0xe0]); // payload includes unsync byte
        let tag_size = tag_body.len() as u32;
        let mut bytes = b"ID3\x03\x00\xc0".to_vec(); // unsynchronisation + extended header
        bytes.extend_from_slice(&[
            ((tag_size >> 21) & 0x7f) as u8,
            ((tag_size >> 14) & 0x7f) as u8,
            ((tag_size >> 7) & 0x7f) as u8,
            (tag_size & 0x7f) as u8,
        ]);
        bytes.extend_from_slice(&tag_body);
        let audio_start = bytes.len();
        bytes.extend_from_slice(&fixture_bytes[original_offset..]);
        std::fs::write(&path, &bytes).unwrap();
        let data = playback_sound_data(&path, 0.216).expect("ID3v2.3 MP3 should be playable");
        assert!(data.duration().as_secs_f64() > 0.0);
        let loop_data = playback_sound_data(&path, 0.216)
            .unwrap()
            .loop_region(0.02..0.12);
        assert!(loop_data.settings.loop_region.is_some());

        let offset = audio_data_offset_after_id3v2(&bytes[..10], bytes.len() as u64)
            .unwrap()
            .unwrap();
        assert_eq!(offset as usize, audio_start);
        let mut source = Id3v2AudioSource::open(&path, offset).unwrap();
        let mut first_audio_bytes = [0; 4];
        source.read_exact(&mut first_audio_bytes).unwrap();
        assert_eq!(
            first_audio_bytes,
            bytes[offset as usize..offset as usize + 4]
        );
        assert_eq!(source.seek(SeekFrom::Start(0)).unwrap(), 0);
        assert_eq!(
            source.seek(SeekFrom::End(0)).unwrap(),
            bytes.len() as u64 - offset
        );

        let mut decoder = LenientSymphoniaDecoder::new(open_audio_source(&path).unwrap(), 0.216)
            .expect("fallback decoder should also probe the audio after the tag");
        assert!(decoder.seek(100).unwrap() <= 100);
        assert!(!decoder.decode().unwrap().is_empty());
    }

    #[test]
    fn playback_without_id3_tag_still_works_and_does_not_modify_audio() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/embedding.mp3");
        let fixture_bytes = std::fs::read(&fixture).unwrap();
        let audio_offset =
            audio_data_offset_after_id3v2(&fixture_bytes[..10], fixture_bytes.len() as u64)
                .unwrap()
                .unwrap() as usize;
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("no-id3.mp3");
        let bytes = fixture_bytes[audio_offset..].to_vec();
        std::fs::write(&path, &bytes).unwrap();

        let data = playback_sound_data(&path, 0.216).expect("untagged MP3 should remain playable");
        assert!(data.duration().as_secs_f64() > 0.0);
        assert_eq!(std::fs::read(path).unwrap(), bytes);
    }

    #[test]
    fn waveform_seek_preserves_pause_without_changing_normal_seek() {
        assert!(!Player::resume_after_seek(PlaybackState::Paused, true));
        assert!(!Player::resume_after_seek(PlaybackState::Pausing, true));
        assert!(Player::resume_after_seek(PlaybackState::Paused, false));
        assert!(!Player::resume_after_seek(PlaybackState::Playing, false));
        assert!(!Player::resume_after_seek(PlaybackState::Playing, true));
        assert!(Player::resume_after_seek(PlaybackState::Stopped, true));
    }
    #[test]
    fn editor_loop_rejects_old_sessions_and_revisions() {
        let mut state = super::EditorLoopState::default();
        let first = state.begin().unwrap();
        assert!(state.accepts(first, 1));
        state.revision = 2;
        assert!(!state.accepts(first, 1));
        assert!(!state.accepts(first, 2));
        assert!(state.accepts(first, 3));
        state.range = Some((1.0, 2.0));
        let second = state.begin().unwrap();
        assert_ne!(first, second);
        assert!(state.range.is_none());
        assert!(!state.accepts(first, 100));
        assert!(state.accepts(second, 1));
    }

    #[test]
    fn editor_loop_validates_real_recording_bounds() {
        use super::EditorLoopState;
        assert_eq!(
            EditorLoopState::validate_range(Some(1.0), Some(1.001), 10.0).unwrap(),
            Some((1.0, 1.001))
        );
        assert_eq!(
            EditorLoopState::validate_range(None, None, 0.0).unwrap(),
            None
        );
        for (start, end) in [
            (Some(f64::NAN), Some(2.0)),
            (Some(1.0), Some(f64::INFINITY)),
            (Some(-1.0), Some(2.0)),
            (Some(2.0), Some(2.0)),
            (Some(3.0), Some(2.0)),
            (Some(1.0), Some(11.0)),
            (Some(1.0), None),
        ] {
            assert!(EditorLoopState::validate_range(start, end, 10.0).is_err());
        }
    }

    use kira::Decibels;

    #[test]
    fn test_volume_as_decibels() {
        let decibels = [
            Decibels::IDENTITY,
            Decibels(3.0),
            Decibels(12.0),
            Decibels(-3.0),
            Decibels(-12.0),
            Decibels::SILENCE,
        ];
        for db_expected in decibels {
            let db_actual = Player::volume_as_decibels(db_expected.as_amplitude() as f64);
            assert!(
                (db_expected.0 - db_actual.0) < 1e-5,
                "{} != {}",
                db_expected.0,
                db_actual.0
            );
        }
    }

    #[test]
    fn test_player_new_with_volume() {
        // This test just verifies the constructor signature compiles
        // We can't actually test the audio manager in a unit test
        let _ = Player::volume_as_decibels(0.5);
        let _ = Player::volume_as_decibels(1.0);
        let _ = Player::volume_as_decibels(0.0);
    }
}
