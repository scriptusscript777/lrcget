//! Streaming playback adapter that tolerates audio files without duration metadata.
//! Kira's bundled adapter requires a frame count and currently reports its absence
//! as a missing sample rate. We use the waveform decoder's Symphonia version and
//! derive a frame count from packet durations when the file omits it.

use std::{convert::TryInto, fs::File, io::ErrorKind, path::Path};

use anyhow::{anyhow, Result};
use kira::{
    sound::streaming::{Decoder, StreamingSoundData},
    Frame,
};
use symphonia::core::{
    audio::SampleBuffer,
    codecs::Decoder as SymphoniaDecoder,
    errors::Error as SymphoniaError,
    formats::{FormatReader, SeekMode, SeekTo},
    io::{MediaSource, MediaSourceStream},
    probe::Hint,
    units::TimeBase,
};

struct AudioStreamDecoder {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn SymphoniaDecoder>,
    sample_rate: u32,
    num_frames: usize,
    track_id: u32,
}

impl AudioStreamDecoder {
    fn new(source: Box<dyn MediaSource>) -> Result<Self> {
        let stream = MediaSourceStream::new(source, Default::default());
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
        let params = &track.codec_params;
        let sample_rate = params
            .sample_rate
            .filter(|rate| *rate > 0)
            .ok_or_else(|| anyhow!("Could not detect the sample rate of the audio"))?;
        let track_id = track.id;
        let n_frames = params.n_frames;
        let time_base = params.time_base;
        let decoder = symphonia::default::get_codecs().make(params, &Default::default())?;
        let num_frames = match n_frames
            .and_then(|frames| frames.try_into().ok())
            .filter(|frames| *frames > 0)
        {
            Some(frames) => frames,
            None => {
                let frames = scan_frame_count(&mut *format, track_id, time_base, sample_rate)?;
                format.seek(SeekMode::Accurate, SeekTo::TimeStamp { ts: 0, track_id })?;
                frames
            }
        };

        Ok(Self {
            format,
            decoder,
            sample_rate,
            num_frames,
            track_id,
        })
    }
}

fn frames_from_seconds(seconds: f64, sample_rate: u32) -> Option<usize> {
    let frames = seconds * f64::from(sample_rate);
    let rounded_frames = frames.round();
    (seconds.is_finite()
        && seconds > 0.0
        && rounded_frames.is_finite()
        && rounded_frames >= 1.0
        && rounded_frames <= usize::MAX as f64)
        .then_some(rounded_frames as usize)
}

fn scan_frame_count(
    format: &mut dyn FormatReader,
    track_id: u32,
    time_base: Option<TimeBase>,
    sample_rate: u32,
) -> Result<usize> {
    let time_base = time_base.ok_or_else(|| anyhow!("Audio time base is unavailable"))?;
    let mut seconds = 0.0_f64;
    loop {
        match format.next_packet() {
            Ok(packet) if packet.track_id() == track_id => {
                let duration = time_base.calc_time(packet.dur);
                seconds += duration.seconds as f64 + duration.frac;
                if !seconds.is_finite() {
                    return Err(anyhow!("Audio duration is invalid"));
                }
            }
            Ok(_) => continue,
            Err(SymphoniaError::IoError(error)) if error.kind() == ErrorKind::UnexpectedEof => {
                break;
            }
            Err(error) => return Err(error.into()),
        }
    }
    frames_from_seconds(seconds, sample_rate)
        .ok_or_else(|| anyhow!("Could not determine the audio duration"))
}

impl Decoder for AudioStreamDecoder {
    type Error = anyhow::Error;

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn num_frames(&self) -> usize {
        self.num_frames
    }

    fn decode(&mut self) -> Result<Vec<Frame>> {
        let packet = loop {
            match self.format.next_packet() {
                Ok(packet) if packet.track_id() == self.track_id => break packet,
                Ok(_) => continue,
                Err(SymphoniaError::IoError(error)) if error.kind() == ErrorKind::UnexpectedEof => {
                    return Ok(Vec::new());
                }
                Err(error) => return Err(error.into()),
            }
        };
        let decoded = self.decoder.decode(&packet)?;
        let channels = decoded.spec().channels.count();
        if channels != 1 && channels != 2 {
            return Err(anyhow!("Only mono and stereo audio are supported"));
        }
        let mut samples = SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
        samples.copy_interleaved_ref(decoded);
        Ok(samples
            .samples()
            .chunks_exact(channels)
            .map(|frame| match channels {
                1 => Frame::from_mono(frame[0]),
                _ => Frame::new(frame[0], frame[1]),
            })
            .collect())
    }

    fn seek(&mut self, index: usize) -> Result<usize> {
        let index = index as u64;
        let seeked = self.format.seek(
            SeekMode::Accurate,
            SeekTo::TimeStamp {
                ts: index,
                track_id: self.track_id,
            },
        )?;
        self.decoder.reset();
        Ok((seeked.actual_ts as usize).min(self.num_frames))
    }
}

pub fn streaming_sound_from_file(
    path: impl AsRef<Path>,
) -> Result<StreamingSoundData<anyhow::Error>> {
    let file = File::open(path)?;
    Ok(StreamingSoundData::from_decoder(AudioStreamDecoder::new(
        Box::new(file),
    )?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_count_fallback_rejects_invalid_duration() {
        assert!(frames_from_seconds(0.0, 44_100).is_none());
        assert!(frames_from_seconds(f64::NAN, 44_100).is_none());
        assert_eq!(frames_from_seconds(1.0, 44_100), Some(44_100));
    }

    #[test]
    #[ignore = "manual check with LRCGET_AUDIO_TEST_FILE set"]
    fn opens_and_decodes_audio_when_kira_lacks_frame_count_metadata() {
        let path = std::env::var("LRCGET_AUDIO_TEST_FILE").unwrap();
        let input =
            MediaSourceStream::new(Box::new(File::open(&path).unwrap()), Default::default());
        let probe = symphonia::default::get_probe()
            .format(
                &Hint::default(),
                input,
                &Default::default(),
                &Default::default(),
            )
            .unwrap();
        assert!(probe
            .format
            .default_track()
            .unwrap()
            .codec_params
            .n_frames
            .is_some());
        let mut decoder = AudioStreamDecoder::new(Box::new(File::open(path).unwrap())).unwrap();
        assert!(decoder.sample_rate() > 0);
        assert!(decoder.num_frames() > decoder.sample_rate() as usize * 200);
        assert!(!decoder.decode().unwrap().is_empty());
        let target = decoder.sample_rate() as usize * 10;
        assert!(decoder.seek(target).unwrap() <= target);
        assert!(!decoder.decode().unwrap().is_empty());
    }
}
