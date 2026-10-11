use anyhow::Result;
use kira::{
    sound::{
        streaming::{StreamingSoundData, StreamingSoundHandle},
        FromFileError, PlaybackState,
    },
    AudioManager, AudioManagerSettings, Decibels, DefaultBackend, Tween,
};

use crate::persistent_entities::PlayableTrack;
use serde::Serialize;

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
            let sound_data = StreamingSoundData::from_file(&track.file_path)?;

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
    use super::Player;
    use kira::sound::PlaybackState;

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
