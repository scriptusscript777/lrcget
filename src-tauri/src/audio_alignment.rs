//! Optional external alignment worker; never writes music or the lyric database.
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    process::Stdio,
    sync::{LazyLock, Mutex},
};
use tauri::{AppHandle, Emitter};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
    sync::{oneshot, Semaphore},
};

static SLOT: Semaphore = Semaphore::const_new(1);
// None is a remembered cancellation that arrived before worker registration.
static JOBS: LazyLock<Mutex<HashMap<String, Option<oneshot::Sender<()>>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
fn python() -> PathBuf {
    if let Some(path) = std::env::var_os("LRCGET_ALIGN_PYTHON") {
        return path.into();
    }
    if let Some(home) = std::env::var_os("HOME") {
        let path = PathBuf::from(home).join(".local/share/lrcget/alignment-venv/bin/python");
        if path.is_file() {
            return path;
        }
    }
    "python3".into()
}

#[tauri::command]
pub async fn audio_alignment_available() -> Result<bool, String> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        Command::new(python())
            .args(["-c", "import stable_whisper, whisper, torch; print(True)"])
            .kill_on_drop(true)
            .output(),
    )
    .await;
    Ok(
        matches!(output, Ok(Ok(output)) if output.status.success() && output.stdout.starts_with(b"True")),
    )
}

#[tauri::command]
pub fn cancel_audio_alignment(job_id: String) {
    let mut jobs = JOBS.lock().unwrap();
    if let Some(Some(sender)) = jobs.remove(&job_id) {
        let _ = sender.send(());
    } else if jobs.len() < 64 {
        jobs.insert(job_id, None);
    }
}

#[tauri::command]
pub async fn align_lyrics_audio(
    job_id: String,
    audio_path: String,
    lines: Vec<Value>,
    language: String,
    model: String,
    app: AppHandle,
) -> Result<Value, String> {
    if job_id.len() > 100 || job_id.is_empty() {
        return Err("Invalid alignment job".into());
    }
    let _permit = SLOT
        .try_acquire()
        .map_err(|_| "Another audio alignment is running. Wait or cancel it.".to_owned())?;
    let (sender, mut cancel) = oneshot::channel();
    {
        let mut jobs = JOBS.lock().unwrap();
        if jobs.remove(&job_id).is_some() {
            return Err("Alignment cancelled".into());
        }
        jobs.insert(job_id.clone(), Some(sender));
    }
    let result = run(
        &job_id,
        &audio_path,
        lines,
        &language,
        &model,
        &app,
        &mut cancel,
    )
    .await;
    JOBS.lock().unwrap().remove(&job_id);
    result
}
async fn run(
    job_id: &str,
    audio_path: &str,
    lines: Vec<Value>,
    language: &str,
    model: &str,
    app: &AppHandle,
    cancel: &mut oneshot::Receiver<()>,
) -> Result<Value, String> {
    let input =
        json!({"audio_path": audio_path, "lines": lines, "language": language, "model": model})
            .to_string();
    if input.len() > 1_000_000 || !std::path::Path::new(audio_path).is_file() {
        return Err("Choose local audio and a smaller lyric document".into());
    }
    let mut worker = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
    std::io::Write::write_all(
        &mut worker,
        include_bytes!("../../alignment/align_words.py"),
    )
    .map_err(|e| e.to_string())?;
    let errors = tempfile::tempfile().map_err(|e| e.to_string())?;
    let original_metadata = std::fs::metadata(audio_path).map_err(|e| e.to_string())?;
    let mut command = Command::new(python());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.as_std_mut().process_group(0);
    }
    let mut child = command
        .arg(worker.path())
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(errors))
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            format!("Alignment engine unavailable: {e}. See the audio alignment setup guide.")
        })?;
    let mut stdin = child.stdin.take().unwrap();
    stdin
        .write_all(input.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    drop(stdin);
    let mut output = BufReader::new(child.stdout.take().unwrap()).lines();
    let deadline = tokio::time::sleep(std::time::Duration::from_secs(1800));
    tokio::pin!(deadline);
    let result = loop {
        tokio::select! {
            _ = &mut *cancel => break Err("Alignment cancelled".into()),
            _ = &mut deadline => break Err("Alignment timed out; try fewer sentences or a smaller model".into()),
            line = output.next_line() => {
                let line = match line { Ok(Some(line)) if line.len() <= 4_000_000 => line, Ok(None) => break Err("Alignment engine stopped. Check optional dependencies and model availability.".into()), _ => break Err("Invalid alignment output".into()) };
                let value: Value = serde_json::from_str(&line).map_err(|_| "Invalid alignment output".to_owned())?;
                match value["type"].as_str() {
                    Some("progress") => { let _ = app.emit("audio-alignment-progress", json!({"jobId": job_id, "percent": value["percent"], "message": value["message"]})); }
                    Some("result") => break Ok(value),
                    Some("error") => break Err(value["message"].as_str().unwrap_or("Alignment failed").to_owned()),
                    _ => break Err("Invalid alignment response".into()),
                }
            }
        }
    };
    #[cfg(unix)]
    if let Some(pid) = child.id().and_then(|pid| i32::try_from(pid).ok()) {
        // The worker owns this new process group; also terminate decoder children.
        unsafe {
            libc::kill(-pid, libc::SIGKILL);
        }
    }
    let _ = child.kill().await;
    let _ = child.wait().await;
    if result.is_ok() {
        let current = std::fs::metadata(audio_path).map_err(|e| e.to_string())?;
        if original_metadata.len() != current.len()
            || original_metadata.modified().ok() != current.modified().ok()
        {
            return Err("Audio changed during alignment. Run it again.".into());
        }
    }
    result
}
