//! Read-only streaming-loop diagnostic; no audio device, database or lyric writes.
use anyhow::{ensure, Context, Result};
use kira::{
    backend::mock::{MockBackend, MockBackendSettings},
    sound::streaming::StreamingSoundData,
    AudioManager, AudioManagerSettings, Tween,
};
use std::{env, thread, time::Duration};

fn main() -> Result<()> {
    let arguments: Vec<_> = env::args().collect();
    ensure!(
        arguments.len() == 4,
        "Usage: verify_editor_loop AUDIO START_SECONDS END_SECONDS"
    );
    let start: f64 = arguments[2].parse()?;
    let end: f64 = arguments[3].parse()?;
    let data = StreamingSoundData::from_file(&arguments[1])?;
    ensure!(
        start.is_finite()
            && end.is_finite()
            && start >= 0.0
            && end > start
            && end <= data.duration().as_secs_f64(),
        "Invalid recording range"
    );
    let mut manager = AudioManager::<MockBackend>::new(AudioManagerSettings {
        backend_settings: MockBackendSettings {
            sample_rate: 48_000,
        },
        internal_buffer_size: 256,
        ..Default::default()
    })
    .map_err(|_| anyhow::anyhow!("Cannot create test renderer"))?;
    let mut handle = manager.play(data.start_position(start).loop_region(start..end))?;
    let mut last = start;
    let mut wraps = 0;
    let mut advanced = false;
    for _ in 0..1500 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
        manager.backend_mut().on_start_processing();
        let position = handle.position();
        // Renderer-block telemetry is intentionally coarser than sample processing.
        ensure!(
            position >= start - 1.0 / 48_000.0 && position < end + 1.0 / 48_000.0,
            "Position escaped loop: {position}"
        );
        if position < last - 0.001 {
            wraps += 1;
        }
        if (position - last).abs() > 0.001 {
            advanced = true;
        }
        last = position;
        if wraps >= 8 {
            break;
        }
        // Give the streaming decoder time to fill its bounded read-ahead buffer.
        thread::sleep(Duration::from_millis(2));
    }
    ensure!(
        advanced && wraps >= 8,
        "Streaming loop did not advance/repeat enough times"
    );
    // Exercise the same live handle commands used by editor marker changes.
    handle.pause(Tween::default());
    for _ in 0..120 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
        thread::sleep(Duration::from_millis(2));
    }
    let changed_start = start + (end - start) / 4.0;
    let changed_end = end - (end - start) / 4.0;
    handle.set_loop_region(changed_start..changed_end);
    handle.seek_to(changed_start);
    for _ in 0..120 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
        thread::sleep(Duration::from_millis(2));
    }
    ensure!(
        matches!(handle.state(), kira::sound::PlaybackState::Paused),
        "Boundary edits must not resume paused audio"
    );
    let paused_position = handle.position();
    for _ in 0..20 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
    }
    ensure!(
        handle.position() == paused_position,
        "Paused playback advanced"
    );
    handle.resume(Tween::default());
    // Paused streaming position reflects the last rendered frame until resume.
    // Allow bounded decoder read-ahead to settle after a live seek/range change.
    for _ in 0..120 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
        thread::sleep(Duration::from_millis(2));
    }
    let mut changed_wraps = 0;
    let mut last = changed_start;
    for _ in 0..1500 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
        manager.backend_mut().on_start_processing();
        let position = handle.position();
        ensure!(
            position >= changed_start - 1.0 / 48_000.0 && position < changed_end + 1.0 / 48_000.0,
            "Position escaped changed range: {position}"
        );
        if position < last - 0.001 {
            changed_wraps += 1;
        }
        last = position;
        if changed_wraps >= 8 {
            break;
        }
        thread::sleep(Duration::from_millis(2));
    }
    ensure!(changed_wraps >= 8, "Changed range failed to resume/repeat");
    handle.set_loop_region(None);
    for _ in 0..120 {
        manager.backend_mut().on_start_processing();
        manager.backend_mut().process();
        thread::sleep(Duration::from_millis(2));
    }
    ensure!(
        handle.position() > changed_end,
        "Disabling loop failed to continue playback"
    );
    println!("PASS: paused live range change, {changed_wraps} resumed repeats and loop disable");
    println!("PASS: {wraps} streaming repeats inside {start:.3}–{end:.3} seconds; original file read only; no physical audio device");
    std::fs::metadata(&arguments[1]).context("Read-only source unavailable")?;
    Ok(())
}
