use crate::db;
use crate::db::ScanTrackInfo;
use crate::lyricsfile::{
    build_enhanced_lyricsfile, build_lyricsfile, lyrics_presence_from_lyricsfile,
    LyricsfileTrackMetadata, INSTRUMENTAL_LRC,
};
use crate::parser::lrc::parse_lrc;
use crate::persistent_entities::PersistentTrack;
use crate::scanner::hasher::compute_quick_hash;
use crate::scanner::metadata::extract_track_info;
use crate::scanner::models::{ScanProgress, ScanResult};
use anyhow::{bail, Result};
use globwalk::glob;
use rusqlite::Connection;
use std::time::{Instant, SystemTime};

const BATCH_SIZE: usize = 100;

/// Method to detect file changes during scan
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DetectionMethod {
    /// Use content hash (default) - slower but handles all edge cases including:
    /// - File moves with modified metadata
    /// - Cross-platform timestamp differences
    /// - Filesystems with different timestamp precision
    Hash,
    /// Use file metadata (mtime + size) - faster but with limitations:
    /// - May create duplicates if files are moved with different metadata
    /// - Best for: Large libraries on single filesystem that rarely move
    Metadata,
}

impl Default for DetectionMethod {
    fn default() -> Self {
        DetectionMethod::Hash
    }
}

/// Single-pass streaming scan - discovers and processes files simultaneously
///
/// This approach eliminates the double-traversal problem by processing files
/// in a single pass and emitting progress updates showing processed count.
pub fn scan_library(
    directories: &[String],
    conn: &mut Connection,
    progress_callback: &dyn Fn(ScanProgress),
    detection_method: DetectionMethod,
) -> Result<ScanResult> {
    // A disconnected share is not an empty library. Validate before marking
    // anything pending so startup refresh cannot erase its cached tracks.
    if directories.is_empty() {
        bail!("No music directories configured; library retained");
    }
    for directory in directories {
        std::fs::read_dir(directory).map_err(|err| {
            anyhow::anyhow!(
                "Music directory unavailable: {}: {}; library retained",
                directory,
                err
            )
        })?;
    }
    let start_time = Instant::now();
    let is_initial_scan = !db::get_init(conn)?;

    // Phase 1: Mark all tracks as pending
    db::mark_all_tracks_pending(conn)?;

    let mut total_files = 0;
    let mut processed_files = 0;
    let mut added = 0;
    let mut modified = 0;
    let mut moved = 0;
    let mut unchanged = 0;
    let mut failed = 0;
    let mut batch = Vec::with_capacity(BATCH_SIZE);

    // Phase 2: Stream through files with globwalk - discover AND process in single pass
    for directory in directories {
        let pattern = format!(
            "{}/**/*.{{mp3,m4a,flac,ogg,opus,wav,MP3,M4A,FLAC,OGG,OPUS,WAV}}",
            directory
        );

        for item in glob(&pattern)? {
            match item {
                Ok(entry) => {
                    batch.push(entry);
                    total_files += 1;

                    if batch.len() >= BATCH_SIZE {
                        let batch_result = process_batch(&batch, conn, detection_method)?;
                        added += batch_result.added;
                        modified += batch_result.modified;
                        moved += batch_result.moved;
                        unchanged += batch_result.unchanged;
                        failed += batch_result.failed;
                        processed_files += batch.len();

                        // Emit progress after processing each batch
                        progress_callback(ScanProgress::processing(processed_files, total_files));

                        batch.clear();
                    }
                }
                Err(e) => {
                    // Do not prune unvisited tracks after an incomplete walk.
                    return Err(e.into());
                }
            }
        }
    }

    // Process remaining files in batch
    if !batch.is_empty() {
        let batch_result = process_batch(&batch, conn, detection_method)?;
        added += batch_result.added;
        modified += batch_result.modified;
        moved += batch_result.moved;
        unchanged += batch_result.unchanged;
        failed += batch_result.failed;
        processed_files += batch.len();

        // Emit final progress
        progress_callback(ScanProgress::processing(processed_files, total_files));
    }

    if failed > 0 {
        bail!("{} music file(s) could not be read; missing-track cleanup skipped. Retry after fixing the files", failed);
    }

    // Phase 3: Delete tracks that weren't processed (deleted files)
    progress_callback(ScanProgress::updating());
    let deleted = db::delete_unprocessed_tracks(conn)?;
    db::restore_orphaned_edit_dates(conn)?;

    // Mark as initialized after first successful scan
    if is_initial_scan {
        db::set_init(true, conn)?;
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    Ok(ScanResult {
        total_files,
        added,
        modified,
        deleted,
        moved,
        unchanged,
        is_initial_scan,
        duration_ms,
    })
}

#[derive(Default)]
struct BatchResult {
    added: usize,
    modified: usize,
    moved: usize,
    unchanged: usize,
    failed: usize,
}

fn process_batch(
    batch: &[globwalk::DirEntry],
    conn: &mut Connection,
    detection_method: DetectionMethod,
) -> Result<BatchResult> {
    let mut result = BatchResult::default();
    let tx = conn.transaction()?;

    for entry in batch {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                eprintln!("Error getting metadata for {:?}: {}", path, e);
                result.failed += 1;
                continue;
            }
        };

        let file_size = metadata.len() as i64;
        let modified_time = metadata
            .modified()?
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs() as i64;

        let path_str = path.to_string_lossy().to_string();

        match detection_method {
            DetectionMethod::Hash => {
                // Hash-based detection (default)
                let hash = match compute_quick_hash(path) {
                    Ok(h) => h,
                    Err(e) => {
                        eprintln!("Error hashing {:?}: {}", path, e);
                        result.failed += 1;
                        continue;
                    }
                };

                match db::find_track_by_hash_tx(&hash, &tx)? {
                    Some(ScanTrackInfo { id, file_path }) => {
                        if file_path == path_str {
                            // Same path, same hash - unchanged
                            db::mark_track_processed_tx(id, &tx)?;
                            result.unchanged += 1;
                        } else {
                            // Different path, same hash - moved!
                            db::update_track_path_and_fingerprint_tx(
                                id,
                                &path_str,
                                file_size,
                                modified_time,
                                &hash,
                                &tx,
                            )?;
                            result.moved += 1;
                        }
                    }
                    None => {
                        // No match found - new file
                        match insert_new_track(path, file_size, modified_time, &hash, &tx) {
                            Ok(true) => result.added += 1,
                            Ok(false) => result.modified += 1,
                            Err(e) => {
                                eprintln!("Error inserting track {:?}: {}", path, e);
                                result.failed += 1;
                                continue;
                            }
                        }
                    }
                }
            }
            DetectionMethod::Metadata => {
                // Metadata-based detection (mtime + size) - FAST but less accurate
                match db::find_track_by_fingerprint_tx(modified_time, file_size, &tx)? {
                    Some(ScanTrackInfo { id, file_path }) => {
                        if file_path == path_str {
                            // Same path, same fingerprint - unchanged
                            db::mark_track_processed_tx(id, &tx)?;
                            result.unchanged += 1;
                        } else {
                            // Different path, same fingerprint - moved!
                            db::update_track_path_tx(id, &path_str, &tx)?;
                            result.moved += 1;
                        }
                    }
                    None => {
                        // No fingerprint match - treat as new file
                        let hash = match compute_quick_hash(path) {
                            Ok(h) => h,
                            Err(e) => {
                                eprintln!("Error hashing {:?}: {}", path, e);
                                result.failed += 1;
                                continue;
                            }
                        };
                        match insert_new_track(path, file_size, modified_time, &hash, &tx) {
                            Ok(true) => result.added += 1,
                            Ok(false) => result.modified += 1,
                            Err(e) => {
                                eprintln!("Error inserting track {:?}: {}", path, e);
                                result.failed += 1;
                                continue;
                            }
                        }
                    }
                }
            }
        }
        import_matching_sidecar(path, &tx)?;
    }

    tx.commit()?;
    Ok(result)
}

/// Refresh external lyrics even when the audio fingerprint has not changed.
/// Explicit editor saves (including reset/untimed work) are protected.
/// A valid matching LRC can still upgrade automatically imported plain lyrics.
fn import_matching_sidecar(path: &std::path::Path, tx: &rusqlite::Transaction) -> Result<()> {
    let Some(info) = db::find_track_by_path_tx(&path.to_string_lossy(), tx)? else {
        return Ok(());
    };
    let (protected, has_plain, has_synced, has_words): (bool, bool, bool, bool) = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM lyricsfiles WHERE track_id = ?1
         AND (instrumental = 1 OR edited_at IS NOT NULL)),
         EXISTS(SELECT 1 FROM lyricsfiles WHERE track_id = ?1 AND has_plain_lyrics = 1),
         EXISTS(SELECT 1 FROM lyricsfiles WHERE track_id = ?1 AND has_synced_lyrics = 1),
         EXISTS(SELECT 1 FROM lyricsfiles WHERE track_id = ?1 AND has_word_synced_lyrics = 1)",
        [info.id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )?;
    if protected || has_words {
        return Ok(());
    }
    let track = db::get_track_by_id(info.id, tx)?;
    let metadata = LyricsfileTrackMetadata::from_persistent_track(&track);
    let raw_lrc = std::fs::read_to_string(path.with_extension("lrc")).ok();
    let enhanced = std::fs::read_to_string(path.with_extension("elrc"))
        .ok()
        .and_then(|text| build_enhanced_lyricsfile(&metadata, &text).ok())
        .or_else(|| {
            raw_lrc
                .as_ref()
                .filter(|text| text.contains('<'))
                .and_then(|text| build_enhanced_lyricsfile(&metadata, text).ok())
        });
    let enhanced = enhanced.filter(|content| {
        !has_synced
            || lyrics_presence_from_lyricsfile(content)
                .is_ok_and(|presence| presence.has_word_synced_lyrics)
    });
    // Unedited ordinary LRC can upgrade to real word timing. Saved word timing,
    // manual edits and instrumental records never get overwritten by a scan.
    if has_synced && enhanced.is_none() {
        return Ok(());
    }
    let lrc = raw_lrc.filter(|text| !text.contains('<') && valid_lrc(text));
    // TXT is a fallback for missing lyrics, never an overwrite of saved plain edits.
    let txt = if enhanced.is_none() && lrc.is_none() && !has_plain {
        std::fs::read_to_string(path.with_extension("txt")).ok()
    } else {
        None
    };
    if enhanced.is_none() && lrc.is_none() && txt.is_none() {
        return Ok(());
    }
    if let Some(content) = enhanced.or_else(|| {
        build_lyricsfile(
            &LyricsfileTrackMetadata::from_persistent_track(&track),
            txt.as_deref(),
            lrc.as_deref(),
        )
    }) {
        db::upsert_lyricsfile_for_track_tx(
            track.id,
            &track.title,
            &track.album_name,
            &track.artist_name,
            track.duration,
            &content,
            tx,
        )?;
    }
    Ok(())
}

fn valid_lrc(text: &str) -> bool {
    text.trim() == INSTRUMENTAL_LRC
        || parse_lrc(text)
            .timed_lines
            .iter()
            .any(|line| !line.text.trim().is_empty())
}

/// Describe malformed lyric sidecars for the library row. This reports only
/// files the normal scanner would reject, so display and import agree.
pub fn lyrics_sidecar_warning(track: &PersistentTrack) -> Option<String> {
    let audio_path = std::path::Path::new(&track.file_path);
    let elrc_path = audio_path.with_extension("elrc");
    let lrc_path = audio_path.with_extension("lrc");
    let metadata = LyricsfileTrackMetadata::from_persistent_track(track);

    let inspect = |path: &std::path::Path, enhanced: bool| -> Option<Result<(), String>> {
        if !path.is_file() {
            return None;
        }
        Some(
            std::fs::read_to_string(path)
                .map_err(|error| format!("could not be read: {error}"))
                .and_then(|text| {
                    if enhanced || text.contains('<') {
                        build_enhanced_lyricsfile(&metadata, &text)
                            .map(|_| ())
                            .map_err(|error| error.to_string())
                    } else if valid_lrc(&text) {
                        Ok(())
                    } else {
                        Err("no valid timed lyric lines were found".to_owned())
                    }
                }),
        )
    };

    let elrc = inspect(&elrc_path, true);
    let lrc = inspect(&lrc_path, false);
    let invalid_elrc = elrc.as_ref().and_then(|result| result.as_ref().err());
    let invalid_lrc = lrc.as_ref().and_then(|result| result.as_ref().err());
    if invalid_elrc.is_none() && invalid_lrc.is_none() {
        return None;
    }

    let name = |path: &std::path::Path| {
        path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned()
    };
    let mut messages = Vec::new();
    if let Some(reason) = invalid_elrc {
        messages.push(format!("{} is invalid ({reason})", name(&elrc_path)));
    }
    if let Some(reason) = invalid_lrc {
        messages.push(format!("{} is invalid ({reason})", name(&lrc_path)));
    }
    let valid_elrc = elrc.as_ref().is_some_and(Result::is_ok);
    let valid_lrc = lrc.as_ref().is_some_and(Result::is_ok);
    let fallback = match (valid_elrc, valid_lrc) {
        (true, true) => "A valid ELRC is preferred over the LRC file.",
        (true, false) if invalid_lrc.is_some() => {
            "The valid ELRC is available and remains preferred."
        }
        (false, true) if invalid_elrc.is_some() => "The valid LRC file is available as a fallback.",
        _ => "No valid timed LRC or ELRC sidecar was found.",
    };
    messages.push(fallback.to_owned());
    Some(messages.join(". "))
}

/// Helper to insert a new track with metadata extraction
fn insert_new_track(
    path: &std::path::Path,
    file_size: i64,
    modified_time: i64,
    content_hash: &str,
    tx: &rusqlite::Transaction,
) -> Result<bool> {
    // Extract metadata and lyrics
    let (metadata, lyrics) = extract_track_info(path)?;

    // Get or create artist
    let artist_id = match db::find_artist_tx(&metadata.artist, tx) {
        Ok(id) => id,
        Err(_) => db::add_artist_tx(&metadata.artist, tx)?,
    };

    // Get or create album
    let album_id = match db::find_album_tx(&metadata.album, &metadata.album_artist, tx) {
        Ok(id) => id,
        Err(_) => db::add_album_tx(&metadata.album, &metadata.album_artist, tx)?,
    };

    // Tag exports change fingerprints, not track identity or the user's saved lyrics.
    let existing = db::find_track_by_path_tx(&metadata.file_path, tx)?;
    let track_id = if let Some(existing) = &existing {
        tx.execute(
            "UPDATE tracks SET title = ?, title_lower = ?, album_id = ?, artist_id = ?,
             duration = ?, track_number = ? WHERE id = ?",
            rusqlite::params![
                metadata.title,
                crate::utils::prepare_input(&metadata.title),
                album_id,
                artist_id,
                metadata.duration,
                metadata.track_number,
                existing.id
            ],
        )?;
        db::update_track_path_and_fingerprint_tx(
            existing.id,
            &metadata.file_path,
            file_size,
            modified_time,
            content_hash,
            tx,
        )?;
        db::delete_tracks_fts_by_ids_tx(&[existing.id], tx)?;
        existing.id
    } else {
        db::insert_track_from_metadata_tx(
            &metadata,
            &lyrics,
            file_size,
            modified_time,
            content_hash,
            artist_id,
            album_id,
            tx,
        )?
    };

    // Sync FTS index
    db::insert_track_fts_tx(
        track_id,
        &crate::utils::prepare_input(&metadata.title),
        &crate::utils::prepare_input(&metadata.artist),
        &crate::utils::prepare_input(&metadata.album),
        tx,
    )?;

    if existing.is_some() {
        return Ok(false);
    }

    // Check for orphaned lyricsfile before importing embedded lyrics
    let orphaned_lyricsfile = db::find_orphaned_lyricsfile_tx(
        &metadata.title,
        &metadata.artist,
        &metadata.album,
        metadata.duration,
        tx,
    )?;

    if let Some(lyricsfile_id) = orphaned_lyricsfile {
        // Reattach orphaned lyricsfile to this track
        db::reattach_lyricsfile_to_track_tx(lyricsfile_id, track_id, tx)?;
    }

    Ok(true)
}

#[cfg(test)]
mod refresh_tests {
    use super::*;
    use include_dir::{include_dir, Dir};
    use lofty::config::WriteOptions;
    use lofty::prelude::{Accessor, TagExt, TaggedFileExt};
    use rusqlite_migration::Migrations;

    fn add_metadata(path: &std::path::Path, title: &str) {
        let mut file = lofty::read_from_path(path).unwrap();
        let tag = file.primary_tag_mut().unwrap();
        tag.set_title(title.into());
        tag.set_artist("test artist".into());
        tag.set_album("test album".into());
        tag.save_to_path(path, WriteOptions::default()).unwrap();
    }

    fn test_database() -> Connection {
        static MIGRATIONS: Dir = include_dir!("$CARGO_MANIFEST_DIR/migrations");
        let mut conn = Connection::open_in_memory().unwrap();
        Migrations::from_directory(&MIGRATIONS)
            .unwrap()
            .to_latest(&mut conn)
            .unwrap();
        conn
    }

    fn sidecar_test_track(audio_path: &std::path::Path) -> PersistentTrack {
        PersistentTrack {
            id: 1,
            file_path: audio_path.to_string_lossy().into_owned(),
            file_name: audio_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            title: "song".to_owned(),
            album_name: "album".to_owned(),
            album_artist_name: None,
            album_id: 1,
            artist_name: "artist".to_owned(),
            artist_id: 1,
            image_path: None,
            track_number: None,
            txt_lyrics: None,
            lrc_lyrics: None,
            lyricsfile: None,
            lyricsfile_id: None,
            lyrics_modified_at: None,
            lyrics_sidecar_warning: None,
            duration: 10.0,
            instrumental: false,
        }
    }

    #[test]
    fn sidecar_warning_identifies_invalid_file_and_valid_alternative() {
        let directory = tempfile::tempdir().unwrap();
        let audio = directory.path().join("song.mp3");
        let track = sidecar_test_track(&audio);
        let elrc = audio.with_extension("elrc");
        let lrc = audio.with_extension("lrc");

        std::fs::write(&elrc, "[00:61.000]<00:61.000>bad").unwrap();
        std::fs::write(&lrc, "[00:01.00]valid sentence").unwrap();
        let warning = lyrics_sidecar_warning(&track).unwrap();
        assert!(warning.contains("song.elrc is invalid"));
        assert!(warning.contains("valid LRC file is available as a fallback"));

        std::fs::write(&elrc, "[00:01.000]<00:01.000>valid <00:02.000>ELRC").unwrap();
        std::fs::write(&lrc, "not timed lyrics").unwrap();
        let warning = lyrics_sidecar_warning(&track).unwrap();
        assert!(warning.contains("song.lrc is invalid"));
        assert!(warning.contains("valid ELRC is available and remains preferred"));

        std::fs::remove_file(&elrc).unwrap();
        std::fs::remove_file(&lrc).unwrap();
        assert!(lyrics_sidecar_warning(&track).is_none());
    }

    #[test]
    fn sidecar_warning_reports_when_both_timed_files_are_invalid() {
        let directory = tempfile::tempdir().unwrap();
        let audio = directory.path().join("song.mp3");
        let track = sidecar_test_track(&audio);
        std::fs::write(audio.with_extension("elrc"), "broken enhanced file").unwrap();
        std::fs::write(audio.with_extension("lrc"), "untimed words").unwrap();

        let warning = lyrics_sidecar_warning(&track).unwrap();
        assert!(warning.contains("song.elrc is invalid"));
        assert!(warning.contains("song.lrc is invalid"));
        assert!(warning.contains("No valid timed LRC or ELRC sidecar was found"));
    }

    #[test]
    fn elrc_discovery_priority_and_saved_edit_protection() {
        for method in [DetectionMethod::Hash, DetectionMethod::Metadata] {
            for initial in [true, false] {
                let directory = tempfile::tempdir().unwrap();
                let path = directory.path().join("song.mp3");
                std::fs::write(&path, include_bytes!("../../tests/fixtures/embedding.mp3"))
                    .unwrap();
                add_metadata(&path, "song");
                let audio = std::fs::read(&path).unwrap();
                let directories = vec![directory.path().to_string_lossy().into_owned()];
                let mut conn = test_database();
                std::fs::write(path.with_extension("txt"), "plain fallback").unwrap();
                std::fs::write(
                    path.with_extension("lrc"),
                    "[00:01.00]ordinary line\n[00:03.00]next\n",
                )
                .unwrap();
                if !initial {
                    scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
                }
                let enhanced =
                    include_str!("../../../docs/examples/estimated-word-save/verification.elrc");
                std::fs::write(path.with_extension("elrc"), enhanced).unwrap();
                scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
                let imported = db::get_tracks(&conn).unwrap().remove(0);
                let presence =
                    lyrics_presence_from_lyricsfile(imported.lyricsfile.as_deref().unwrap())
                        .unwrap();
                assert!(presence.has_synced_lyrics && presence.has_word_synced_lyrics);
                assert!(imported.lyrics_modified_at.is_none());
                assert!(crate::lyricsfile::parse_lyricsfile(
                    imported.lyricsfile.as_deref().unwrap()
                )
                .unwrap()
                .enhanced_lyrics
                .unwrap()
                .unwrap()
                .contains("<00:01.650>"));
                // Rescans and deleting sidecars retain saved word timing.
                std::fs::remove_file(path.with_extension("elrc")).unwrap();
                scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
                assert_eq!(
                    db::get_track_by_id(imported.id, &conn).unwrap().lyricsfile,
                    imported.lyricsfile
                );
                let saved = build_lyricsfile(
                    &LyricsfileTrackMetadata::from_persistent_track(&imported),
                    Some("manual plain work"),
                    None,
                )
                .unwrap();
                db::save_edited_lyricsfile_for_track(&imported, &saved, &conn).unwrap();
                std::fs::write(path.with_extension("elrc"), enhanced).unwrap();
                scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
                let retained = db::get_track_by_id(imported.id, &conn).unwrap();
                assert_eq!(retained.lyricsfile.as_deref(), Some(saved.as_str()));
                assert!(retained.lyrics_modified_at.is_some());
                assert_eq!(std::fs::read(&path).unwrap(), audio);
                assert_eq!(
                    std::fs::read_to_string(path.with_extension("elrc")).unwrap(),
                    enhanced
                );
            }
        }
    }

    #[test]
    fn invalid_elrc_falls_back_to_valid_lrc_then_txt_without_modified_label() {
        for lrc in [Some("[00:01.00]ordinary"), None] {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("song.mp3");
            std::fs::write(&path, include_bytes!("../../tests/fixtures/embedding.mp3")).unwrap();
            add_metadata(&path, "song");
            std::fs::write(path.with_extension("elrc"), "[00:01.000]<00:00.000>invalid").unwrap();
            std::fs::write(path.with_extension("txt"), "plain fallback").unwrap();
            if let Some(lrc) = lrc {
                std::fs::write(path.with_extension("lrc"), lrc).unwrap();
            }
            let mut conn = test_database();
            scan_library(
                &[directory.path().to_string_lossy().into_owned()],
                &mut conn,
                &|_| {},
                DetectionMethod::Hash,
            )
            .unwrap();
            let track = db::get_tracks(&conn).unwrap().remove(0);
            let presence =
                lyrics_presence_from_lyricsfile(track.lyricsfile.as_deref().unwrap()).unwrap();
            assert!(!presence.has_word_synced_lyrics);
            assert_eq!(presence.has_synced_lyrics, lrc.is_some());
            assert!(track.lyrics_modified_at.is_none());
        }
    }

    #[test]
    fn matching_lrc_upgrades_plain_after_restart_and_preserves_synced_edits() {
        for method in [DetectionMethod::Hash, DetectionMethod::Metadata] {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("song.mp3");
            std::fs::write(&path, include_bytes!("../../tests/fixtures/embedding.mp3")).unwrap();
            add_metadata(&path, "song");
            let audio = std::fs::read(&path).unwrap();
            std::fs::write(path.with_extension("txt"), "original plain words").unwrap();
            let directories = vec![directory.path().to_string_lossy().into_owned()];
            let mut conn = test_database();
            scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            let original = db::get_tracks(&conn).unwrap().remove(0);
            let parsed =
                crate::lyricsfile::parse_lyricsfile(original.lyricsfile.as_deref().unwrap())
                    .unwrap();
            assert!(parsed.plain_lyrics.is_some());
            assert!(parsed.synced_lyrics.is_none());

            // An external app creates an LRC while LRCGET is closed.
            let database_path = directory.path().join("restart.sqlite3");
            conn.execute("VACUUM INTO ?", [database_path.to_str().unwrap()])
                .unwrap();
            drop(conn);
            let timed = "[00:01.00]external synced words\n[00:02.00]second line\n";
            std::fs::write(path.with_extension("lrc"), timed).unwrap();
            let mut conn = Connection::open(&database_path).unwrap();
            let result = scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            assert_eq!(result.unchanged, 1);
            let upgraded = db::get_track_by_id(original.id, &conn).unwrap();
            let parsed =
                crate::lyricsfile::parse_lyricsfile(upgraded.lyricsfile.as_deref().unwrap())
                    .unwrap();
            assert!(parsed
                .synced_lyrics
                .as_deref()
                .unwrap()
                .contains("external synced words"));
            assert!(!parsed
                .plain_lyrics
                .as_deref()
                .unwrap()
                .contains("original plain words"));
            assert!(upgraded.lyrics_modified_at.is_none());
            assert_eq!(std::fs::read(&path).unwrap(), audio);
            assert_eq!(
                std::fs::read_to_string(path.with_extension("txt")).unwrap(),
                "original plain words"
            );
            assert_eq!(
                std::fs::read_to_string(path.with_extension("lrc")).unwrap(),
                timed
            );

            let saved = build_lyricsfile(
                &LyricsfileTrackMetadata::from_persistent_track(&upgraded),
                None,
                Some("[00:03.00]protected editor words\n"),
            )
            .unwrap();
            db::save_edited_lyricsfile_for_track(&upgraded, &saved, &conn).unwrap();
            let edited_at = db::get_track_by_id(original.id, &conn)
                .unwrap()
                .lyrics_modified_at;
            std::fs::write(
                path.with_extension("lrc"),
                "[00:04.00]conflicting external words\n",
            )
            .unwrap();
            scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            let protected = db::get_track_by_id(original.id, &conn).unwrap();
            assert_eq!(protected.lyricsfile.as_deref(), Some(saved.as_str()));
            assert_eq!(protected.lyrics_modified_at, edited_at);
        }
    }

    #[test]
    fn manually_saved_untimed_reset_is_not_replaced_by_old_sidecars() {
        for method in [DetectionMethod::Hash, DetectionMethod::Metadata] {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("song.mp3");
            std::fs::write(&path, include_bytes!("../../tests/fixtures/embedding.mp3")).unwrap();
            add_metadata(&path, "song");
            std::fs::write(path.with_extension("lrc"), "[00:01.00]old timed words\n").unwrap();
            let directories = vec![directory.path().to_string_lossy().into_owned()];
            let mut conn = test_database();
            scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            let track = db::get_tracks(&conn).unwrap().remove(0);
            for plain in [Some("reset words"), None] {
                let saved = build_lyricsfile(
                    &LyricsfileTrackMetadata::from_persistent_track(&track),
                    plain,
                    None,
                )
                .unwrap_or_else(|| {
                    "version: \"1.0\"\nmetadata: {}\nplain: \"\"\nlines: []\n".into()
                });
                db::save_edited_lyricsfile_for_track(&track, &saved, &conn).unwrap();
                let before = db::get_track_by_id(track.id, &conn).unwrap();
                assert!(before.lyrics_modified_at.is_some());
                scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
                let after = db::get_track_by_id(track.id, &conn).unwrap();
                assert_eq!(after.lyricsfile.as_deref(), Some(saved.as_str()));
                assert_eq!(after.lyrics_modified_at, before.lyrics_modified_at);
                assert_eq!(
                    std::fs::read_to_string(path.with_extension("lrc")).unwrap(),
                    "[00:01.00]old timed words\n"
                );
            }
        }
    }

    #[test]
    fn missing_lyrics_use_txt_fallback_until_valid_lrc_appears() {
        for method in [DetectionMethod::Hash, DetectionMethod::Metadata] {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("song.mp3");
            std::fs::write(&path, include_bytes!("../../tests/fixtures/embedding.mp3")).unwrap();
            add_metadata(&path, "song");
            let directories = vec![directory.path().to_string_lossy().into_owned()];
            let mut conn = test_database();
            scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            let id = db::get_tracks(&conn).unwrap().remove(0).id;
            assert!(db::get_track_by_id(id, &conn).unwrap().lyricsfile.is_none());
            std::fs::write(path.with_extension("txt"), "fallback words").unwrap();
            for invalid in ["untimed words", "[ti:metadata only]", "[00:01.00]\n"] {
                std::fs::write(path.with_extension("lrc"), invalid).unwrap();
                scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
                let plain = db::get_track_by_id(id, &conn).unwrap();
                let parsed =
                    crate::lyricsfile::parse_lyricsfile(plain.lyricsfile.as_deref().unwrap())
                        .unwrap();
                assert_eq!(parsed.plain_lyrics.as_deref(), Some("fallback words"));
                assert!(parsed.synced_lyrics.is_none());
            }
            std::fs::write(
                path.with_extension("lrc"),
                "[00:01.00]preferred LRC words\n",
            )
            .unwrap();
            scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            let upgraded = db::get_track_by_id(id, &conn).unwrap();
            let parsed =
                crate::lyricsfile::parse_lyricsfile(upgraded.lyricsfile.as_deref().unwrap())
                    .unwrap();
            assert!(parsed
                .synced_lyrics
                .unwrap()
                .contains("preferred LRC words"));
        }
    }

    #[test]
    fn unavailable_or_unconfigured_directories_do_not_modify_library() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE tracks (id INTEGER, scan_status INTEGER);
                            INSERT INTO tracks VALUES (1, 1);",
        )
        .unwrap();
        assert!(
            scan_library(&[], &mut conn, &|_| {}, DetectionMethod::Metadata)
                .unwrap_err()
                .to_string()
                .contains("No music directories")
        );
        let missing = std::env::temp_dir().join(format!(
            "lrcget-missing-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        assert!(scan_library(
            &[missing.to_string_lossy().into_owned()],
            &mut conn,
            &|_| {},
            DetectionMethod::Metadata
        )
        .unwrap_err()
        .to_string()
        .contains("Music directory unavailable"));
        let status: i64 = conn
            .query_row("SELECT scan_status FROM tracks WHERE id=1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(status, 1);
    }

    #[test]
    fn embedded_export_and_restart_preserve_track_identity_and_saved_edit() {
        for method in [DetectionMethod::Hash, DetectionMethod::Metadata] {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("song.mp3");
            std::fs::write(&path, include_bytes!("../../tests/fixtures/embedding.mp3")).unwrap();
            add_metadata(&path, "song");
            let directories = vec![directory.path().to_string_lossy().into_owned()];
            let mut conn = test_database();
            scan_library(&directories, &mut conn, &|_| {}, method).unwrap();
            let track = db::get_tracks(&conn).unwrap().remove(0);
            let text = build_lyricsfile(
                &LyricsfileTrackMetadata::new("song", "test album", "test artist", track.duration),
                Some("saved words"),
                Some("[00:01.00]saved words\n"),
            )
            .unwrap();
            db::save_edited_lyricsfile_for_track(&track, &text, &conn).unwrap();
            let edited = db::get_track_by_id(track.id, &conn)
                .unwrap()
                .lyrics_modified_at;
            let hash_before = compute_quick_hash(&path).unwrap();
            crate::export::embed_lyrics(
                path.to_str().unwrap(),
                "saved words",
                "[00:01.00]saved words\n",
            )
            .unwrap();
            assert_ne!(compute_quick_hash(&path).unwrap(), hash_before);
            let database = directory.path().join("library.sqlite3");
            conn.execute("VACUUM INTO ?", [database.to_str().unwrap()])
                .unwrap();
            drop(conn);
            let mut reopened = Connection::open(&database).unwrap();
            reopened.execute_batch("PRAGMA foreign_keys = ON").unwrap();
            let result = scan_library(&directories, &mut reopened, &|_| {}, method).unwrap();
            assert_eq!(result.modified, 1);
            assert_eq!(result.added, 0);
            assert_eq!(result.deleted, 0);
            let after = db::get_tracks(&reopened).unwrap();
            assert_eq!(after.len(), 1);
            assert_eq!(after[0].id, track.id);
            assert_eq!(after[0].lyrics_modified_at, edited);
            assert_eq!(after[0].lyricsfile.as_deref(), Some(text.as_str()));
            let repeat = scan_library(&directories, &mut reopened, &|_| {}, method).unwrap();
            assert_eq!(repeat.unchanged, 1);
            assert_eq!(
                db::get_tracks(&reopened).unwrap()[0].lyrics_modified_at,
                edited
            );
            assert!(!path.with_extension("mp3.lrcget.bak").exists());
        }
    }

    #[test]
    fn repeated_incremental_scan_discovers_additions_and_removals_without_writing_files() {
        let directory = std::env::temp_dir().join(format!(
            "lrcget-refresh-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&directory).unwrap();
        let mp3 = directory.join("first.mp3");
        let lrc = directory.join("first.lrc");
        let bytes = include_bytes!("../../tests/fixtures/embedding.mp3");
        std::fs::write(&mp3, bytes).unwrap();
        add_metadata(&mp3, "first");
        let original_mp3 = std::fs::read(&mp3).unwrap();
        std::fs::write(&lrc, "[00:00.00]human lyrics\n").unwrap();
        let mut conn = test_database();
        let directories = vec![directory.to_string_lossy().into_owned()];
        let first = scan_library(&directories, &mut conn, &|_| {}, DetectionMethod::Hash).unwrap();
        assert_eq!(first.added, 1);
        assert!(first.is_initial_scan);
        let second = scan_library(&directories, &mut conn, &|_| {}, DetectionMethod::Hash).unwrap();
        assert_eq!(second.unchanged, 1);
        assert!(!second.is_initial_scan);
        assert_eq!(std::fs::read(&mp3).unwrap(), original_mp3);
        assert_eq!(
            std::fs::read_to_string(&lrc).unwrap(),
            "[00:00.00]human lyrics\n"
        );
        std::fs::write(
            directory.join("second.flac"),
            include_bytes!("../../tests/fixtures/embedding.flac"),
        )
        .unwrap();
        add_metadata(&directory.join("second.flac"), "second");
        std::fs::remove_file(&mp3).unwrap();
        let corrupt = directory.join("broken.mp3");
        std::fs::write(&corrupt, b"corrupt audio").unwrap();
        assert!(
            scan_library(&directories, &mut conn, &|_| {}, DetectionMethod::Hash)
                .unwrap_err()
                .to_string()
                .contains("cleanup skipped")
        );
        let retained: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tracks WHERE file_path=?",
                [mp3.to_string_lossy().as_ref()],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(retained, 1);
        std::fs::remove_file(corrupt).unwrap();
        let third = scan_library(&directories, &mut conn, &|_| {}, DetectionMethod::Hash).unwrap();
        assert_eq!(third.total_files, 1);
        assert_eq!(third.deleted, 1);
        assert_eq!(
            std::fs::read_to_string(&lrc).unwrap(),
            "[00:00.00]human lyrics\n"
        );
        std::fs::remove_dir_all(&directory).unwrap();
    }
}
