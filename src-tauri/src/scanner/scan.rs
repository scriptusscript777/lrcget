use crate::db;
use crate::db::ScanTrackInfo;
use crate::lyricsfile::{build_lyricsfile, LyricsfileTrackMetadata};
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
                            }
                        }
                    }
                }
            }
        }
    }

    tx.commit()?;
    Ok(result)
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
            rusqlite::params![metadata.title, crate::utils::prepare_input(&metadata.title),
                album_id, artist_id, metadata.duration, metadata.track_number, existing.id],
        )?;
        db::update_track_path_and_fingerprint_tx(existing.id, &metadata.file_path,
            file_size, modified_time, content_hash, tx)?;
        db::delete_tracks_fts_by_ids_tx(&[existing.id], tx)?;
        existing.id
    } else { db::insert_track_from_metadata_tx(
        &metadata,
        &lyrics,
        file_size,
        modified_time,
        content_hash,
        artist_id,
        album_id,
        tx,
    )? };

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
    } else {
        // No orphaned lyricsfile found, import embedded lyrics as usual
        let lyricsfile_track_metadata = LyricsfileTrackMetadata::new(
            &metadata.title,
            &metadata.album,
            &metadata.artist,
            metadata.duration,
        );

        if let Some(lyricsfile) = build_lyricsfile(
            &lyricsfile_track_metadata,
            lyrics.txt_lyrics.as_deref(),
            lyrics.lrc_lyrics.as_deref(),
        ) {
            db::upsert_lyricsfile_for_track_tx(
                track_id,
                &metadata.title,
                &metadata.album,
                &metadata.artist,
                metadata.duration,
                &lyricsfile,
                tx,
            )?;
        }
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
                Some("saved words"), Some("[00:01.00]saved words\n"),
            ).unwrap();
            db::save_edited_lyricsfile_for_track(&track, &text, &conn).unwrap();
            let edited = db::get_track_by_id(track.id, &conn).unwrap().lyrics_modified_at;
            let hash_before = compute_quick_hash(&path).unwrap();
            crate::export::embed_lyrics(path.to_str().unwrap(), "saved words",
                "[00:01.00]saved words\n").unwrap();
            assert_ne!(compute_quick_hash(&path).unwrap(), hash_before);
            let database = directory.path().join("library.sqlite3");
            conn.execute("VACUUM INTO ?", [database.to_str().unwrap()]).unwrap();
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
            assert_eq!(db::get_tracks(&reopened).unwrap()[0].lyrics_modified_at, edited);
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
