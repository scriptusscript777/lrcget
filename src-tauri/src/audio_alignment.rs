//! Optional external alignment worker; never writes music or the lyric database.
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    process::Stdio,
    sync::{LazyLock, Mutex},
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
    sync::{oneshot, Semaphore},
};

static SLOT: Semaphore = Semaphore::const_new(1);
// None is a remembered cancellation that arrived before worker registration.
static JOBS: LazyLock<Mutex<HashMap<String, Option<oneshot::Sender<()>>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
fn managed_root() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .map(|home| PathBuf::from(home).join(".local/share/lrcget/alignment-environments"))
        .ok_or_else(|| "Home directory unavailable".into())
}
fn valid_environment_name(name: &str) -> bool {
    name.starts_with("env-")
        && name.len() > 4
        && !name.contains(['/', '\\'])
        && !name.contains("..")
        && !name.chars().any(char::is_control)
}
fn managed_environment() -> Option<PathBuf> {
    let root = managed_root().ok()?;
    let name = std::fs::read_to_string(root.join("current")).ok()?;
    if !valid_environment_name(&name) {
        return None;
    }
    let path = root.join(name).join("bin/python");
    path.is_file().then_some(path)
}
fn python() -> PathBuf {
    if let Some(path) = std::env::var_os("LRCGET_ALIGN_PYTHON") {
        return path.into();
    }
    if let Some(path) = managed_environment() {
        return path;
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
            .args(["-c", "import stable_whisper, whisper, torch, torchaudio, shutil; assert shutil.which('ffmpeg'); print(True)"])
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
        .map_err(|_| "Another alignment/setup is running. Wait or cancel it.".to_owned())?;
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
    let original_metadata = std::fs::metadata(audio_path).map_err(|e| e.to_string())?;
    let result = worker(job_id, python(), "align_words.py", input, app, cancel).await;
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

async fn worker(
    job_id: &str,
    executable: PathBuf,
    script: &str,
    input: String,
    app: &AppHandle,
    cancel: &mut oneshot::Receiver<()>,
) -> Result<Value, String> {
    let scripts = tempfile::tempdir().map_err(|e| e.to_string())?;
    std::fs::write(
        scripts.path().join("align_words.py"),
        include_bytes!("../../alignment/align_words.py"),
    )
    .map_err(|e| e.to_string())?;
    std::fs::write(
        scripts.path().join("setup_alignment.py"),
        include_bytes!("../../alignment/setup_alignment.py"),
    )
    .map_err(|e| e.to_string())?;
    let errors = tempfile::tempfile().map_err(|e| e.to_string())?;
    let mut command = Command::new(executable);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.as_std_mut().process_group(0);
    }
    let mut child = command
        .arg(scripts.path().join(script))
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(errors))
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            format!("Optional Python engine unavailable: {e}. Basic mode remains available.")
        })?;
    let result = async {
        let mut stdin = child.stdin.take().unwrap();
        stdin.write_all(input.as_bytes()).await.map_err(|e| e.to_string())?;
        drop(stdin);
        let mut output = BufReader::new(child.stdout.take().unwrap()).lines();
        let deadline = tokio::time::sleep(std::time::Duration::from_secs(1800));
        tokio::pin!(deadline);
        loop {
            tokio::select! {
                _ = &mut *cancel => break Err("Operation cancelled".into()),
                _ = &mut deadline => break Err("Operation timed out. Retry with a smaller model or check the network.".into()),
                line = output.next_line() => {
                    let line = match line { Ok(Some(line)) if line.len() <= 4_000_000 => line, Ok(None) => break Err("Optional engine stopped. Check Python/venv, ffmpeg and network access.".into()), _ => break Err("Invalid alignment output".into()) };
                    let value: Value = serde_json::from_str(&line).map_err(|_| "Invalid alignment output".to_owned())?;
                    match value["type"].as_str() {
                        Some("progress") => { let _ = app.emit("audio-alignment-progress", json!({"jobId": job_id, "percent": value["percent"], "message": value["message"]})); }
                        Some("result") => break Ok(value),
                        Some("error") => break Err(value["message"].as_str().unwrap_or("Optional operation failed").to_owned()),
                        _ => break Err("Invalid alignment response".into()),
                    }
                }
            }
        }
    }.await;
    #[cfg(unix)]
    if let Some(pid) = child.id().and_then(|pid| i32::try_from(pid).ok()) {
        // Also terminate pip/decoder children before deleting the owned staging directory.
        unsafe {
            libc::kill(-pid, libc::SIGKILL);
        }
    }
    let _ = child.kill().await;
    let _ = child.wait().await;
    result
}

#[tauri::command]
pub async fn audio_alignment_model_status(model: String, app: AppHandle) -> Result<Value, String> {
    let (_sender, mut cancel) = oneshot::channel();
    worker(
        "model-status",
        "python3".into(),
        "setup_alignment.py",
        json!({"action":"model-status","model":model}).to_string(),
        &app,
        &mut cancel,
    )
    .await
}

#[tauri::command]
pub async fn setup_audio_alignment(
    job_id: String,
    action: String,
    model: String,
    confirmed: bool,
    app: AppHandle,
) -> Result<Value, String> {
    if !confirmed
        || !["install", "download"].contains(&action.as_str())
        || job_id.is_empty()
        || job_id.len() > 100
    {
        return Err("Explicit consent and a valid setup action are required".into());
    }
    if std::env::consts::OS != "linux" {
        return Err(
            "Integrated setup currently supports Linux. Basic mode remains available.".into(),
        );
    }
    if action == "install" && std::env::var_os("LRCGET_ALIGN_PYTHON").is_some() {
        return Err("A custom alignment Python is configured. Install dependencies there or remove LRCGET_ALIGN_PYTHON before using managed setup.".into());
    }
    let _permit = SLOT
        .try_acquire()
        .map_err(|_| "Another alignment/setup is running. Wait or cancel it.".to_owned())?;
    let (sender, mut cancel) = oneshot::channel();
    {
        let mut jobs = JOBS.lock().unwrap();
        if jobs.remove(&job_id).is_some() {
            return Err("Operation cancelled".into());
        }
        jobs.insert(job_id.clone(), Some(sender));
    }
    let result = setup(&job_id, &action, &model, &app, &mut cancel).await;
    JOBS.lock().unwrap().remove(&job_id);
    result
}
async fn setup(
    job_id: &str,
    action: &str,
    model: &str,
    app: &AppHandle,
    cancel: &mut oneshot::Receiver<()>,
) -> Result<Value, String> {
    let root = if action == "install" {
        managed_root()?
    } else {
        std::env::var_os("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")))
            .ok_or("Cache directory unavailable")?
            .join("whisper")
    };
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let staging = tempfile::Builder::new()
        .prefix(if action == "install" {
            "env-"
        } else {
            ".lrcget-download-"
        })
        .tempdir_in(&root)
        .map_err(|e| e.to_string())?;
    let result = worker(
        job_id,
        "python3".into(),
        "setup_alignment.py",
        json!({"action":action,"model":model,"confirmed":true,"target":staging.path()}).to_string(),
        app,
        cancel,
    )
    .await?;
    if result["ready"] != true {
        return Err("Optional setup verification failed".into());
    }
    if action == "install" {
        let mut pointer = tempfile::NamedTempFile::new_in(&root).map_err(|e| e.to_string())?;
        std::io::Write::write_all(
            &mut pointer,
            staging.path().file_name().unwrap().as_encoded_bytes(),
        )
        .map_err(|e| e.to_string())?;
        pointer.as_file().sync_all().map_err(|e| e.to_string())?;
        pointer
            .persist(root.join("current"))
            .map_err(|e| e.to_string())?;
        let _ = staging.keep(); // Only verified environments become active; cancelled staging is dropped.
    }
    Ok(result)
}

/// Atomically remember that the optional install question has already been shown.
#[tauri::command]
pub fn audio_alignment_setup_prompt(app: AppHandle) -> Result<bool, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    remember_setup_prompt(&directory)
        .map_err(|error| format!("Could not remember the setup prompt: {error}"))
}
fn remember_setup_prompt(directory: &std::path::Path) -> std::io::Result<bool> {
    std::fs::create_dir_all(directory)?;
    match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(directory.join("alignment-setup-prompt-shown"))
    {
        Ok(file) => {
            file.sync_all()?;
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(error) => Err(error),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn setup_question_is_shown_once_per_profile() {
        let profile = tempfile::tempdir().unwrap();
        assert!(remember_setup_prompt(profile.path()).unwrap());
        assert!(!remember_setup_prompt(profile.path()).unwrap());
        assert!(!remember_setup_prompt(profile.path()).unwrap());
        assert_eq!(std::fs::read_dir(profile.path()).unwrap().count(), 1);
    }
    #[test]
    fn unavailable_profile_storage_does_not_pretend_to_remember() {
        let file = tempfile::NamedTempFile::new().unwrap();
        assert!(remember_setup_prompt(file.path()).is_err());
    }
    #[test]
    fn managed_pointer_cannot_escape_its_directory() {
        assert!(valid_environment_name("env-abc123"));
        for name in [
            "env-",
            "../outside",
            "env-../outside",
            "env-a/b",
            "env-a\\b",
            "env-test\n",
        ] {
            assert!(!valid_environment_name(name));
        }
    }
}
