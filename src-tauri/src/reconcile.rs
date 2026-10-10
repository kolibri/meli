use std::{
    collections::HashSet,
    fs,
    path::Path,
};

use rusqlite::params;
use tauri::AppHandle;

use crate::database::open_library_db;

pub(crate) fn remove_missing_video_records(
    app: &AppHandle,
) -> Result<usize, String> {
    let mut connection = open_library_db(app)?;

    // Load registered folders.
    let folders = {
        let mut statement = connection
            .prepare("SELECT path FROM library_folders")
            .map_err(|e| e.to_string())?;

        statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    // Load existing database paths.
    let video_paths = {
        let mut statement = connection
            .prepare("SELECT path FROM videos")
            .map_err(|e| e.to_string())?;

        statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    let mut missing_paths = HashSet::new();

    for folder in folders {
        let folder_path = Path::new(&folder);

        // Never delete records belonging to an unavailable folder.
        match fs::metadata(folder_path) {
            Ok(metadata) if metadata.is_dir() => {}
            _ => continue,
        }

        for video_path in &video_paths {
            let path = Path::new(video_path);

            // Only reconcile records belonging to this registered folder.
            // Path::starts_with compares path components, not string prefixes.
            if !path.starts_with(folder_path) {
                continue;
            }

            match fs::metadata(path) {
                Ok(metadata) if metadata.is_file() => {}
                Err(error)
                    if error.kind() == std::io::ErrorKind::NotFound =>
                {
                    missing_paths.insert(video_path.clone());
                }
                Ok(_) => {
                    // The path no longer refers to a regular file.
                    missing_paths.insert(video_path.clone());
                }
                Err(error) => {
                    // Permission errors and other uncertain conditions
                    // must not cause deletion.
                    eprintln!(
                        "Could not verify video '{}': {}",
                        video_path, error
                    );
                }
            }
        }
    }

    if missing_paths.is_empty() {
        return Ok(0);
    }

    // Delete records atomically. playlist_items are removed by the
    // existing ON DELETE CASCADE foreign key.
    let transaction = connection
        .transaction()
        .map_err(|e| e.to_string())?;

    let mut removed = 0;

    for path in &missing_paths {
        removed += transaction
            .execute(
                "DELETE FROM videos WHERE path = ?1",
                params![path],
            )
            .map_err(|e| e.to_string())?;
    }

    transaction.commit().map_err(|e| e.to_string())?;

    Ok(removed)
}
