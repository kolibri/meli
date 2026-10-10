
mod database;
mod scanner;
mod settings;
mod thumbnails;

use std::process::Command;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use database::open_library_db;
use rusqlite::params;
use scanner::{collect_videos, probe_duration};
use serde::Serialize;
use settings::save_storage_dir;
pub(crate) use settings::read_storage_dir;
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::PathBuf,
};
use tauri::AppHandle;
use thumbnails::extract_frames;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoFile {
    id: String,
    path: String,
    filename: String,
    size: u64,
    duration: f64,
    tags: Vec<String>,
    rating: u8,
    frames: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    id: i64,
    name: String,
}

#[tauri::command]
fn get_storage_dir(app: AppHandle) -> Result<Option<String>, String> {
    Ok(read_storage_dir(&app)?
        .map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn set_storage_dir(
    app: AppHandle,
    storage_dir: String,
) -> Result<String, String> {
    let requested_path = PathBuf::from(&storage_dir);

    if !requested_path.is_dir() {
        return Err(format!("Not a directory: {}", storage_dir));
    }

    let directory = requested_path
        .canonicalize()
        .map_err(|e| e.to_string())?;

    // Ensure the chosen location is writable and ready for thumbnails.
    let thumbnails_dir = directory.join("thumbnails");
    fs::create_dir_all(&thumbnails_dir).map_err(|e| e.to_string())?;

    save_storage_dir(&app, directory.clone())?;

    let _connection = open_library_db(&app)?;

    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn scan_video_folder(
    app: AppHandle,
    folder_path: String,
) -> Result<Vec<VideoFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_video_folder_blocking(app, folder_path)
    })
    .await
    .map_err(|error| format!("Folder scan worker failed: {error}"))?
}


fn scan_video_folder_blocking(
    app: AppHandle,
    folder_path: String,
) -> Result<Vec<VideoFile>, String> {
    let root = PathBuf::from(&folder_path);

    if !root.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    let connection = open_library_db(&app)?;

    connection
        .execute(
            "INSERT OR IGNORE INTO library_folders (path) VALUES (?1)",
            params![folder_path],
        )
        .map_err(|e| e.to_string())?;

    let mut paths = Vec::new();
    collect_videos(&root, &mut paths).map_err(|e| e.to_string())?;
    paths.sort();

    let mut videos = Vec::with_capacity(paths.len());

    for path in paths {
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let full_path = path.to_string_lossy().into_owned();

        let duration = probe_duration(&path);

        connection
            .execute(
                "INSERT INTO videos (path, filename, size, duration)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(path) DO UPDATE SET
                     filename = excluded.filename,
                     size = excluded.size,
                     duration = excluded.duration",
                params![
                    full_path,
                    filename,
                    metadata.len() as i64,
                    duration
                ],
            )
            .map_err(|e| e.to_string())?;

        let (tags_json, rating): (String, i64) = connection
            .query_row(
                "SELECT tags_json, rating FROM videos WHERE path = ?1",
                params![full_path],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        videos.push(VideoFile {
            id: full_path.clone(),
            path: full_path,
            filename,
            size: metadata.len(),
            duration,
            tags: serde_json::from_str(&tags_json).unwrap_or_default(),
            rating: rating.clamp(0, 5) as u8,
            frames: Vec::new(),
        });
    }

    Ok(videos)
}

#[tauri::command]
async fn get_video_frames(
    app: AppHandle,
    video_path: String,
    duration: f64,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_video_frames_blocking(app, video_path, duration)
    })
    .await
    .map_err(|error| format!("Thumbnail worker failed: {error}"))?
}


fn get_video_frames_blocking(
    app: AppHandle,
    video_path: String,
    duration: f64,
) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&video_path);

    if !path.is_file() {
        return Err(format!("Video file not found: {}", video_path));
    }

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|time| time.as_secs())
        .unwrap_or(0);

    // A changed path, file size, or modification time gets a new cache entry.
    let mut hasher = DefaultHasher::new();
    video_path.hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    modified.hash(&mut hasher);

    let storage_dir = read_storage_dir(&app)?
        .ok_or_else(|| "Storage location has not been configured".to_string())?;

    if !storage_dir.is_dir() {
        return Err(format!(
            "Storage directory is unavailable: {}",
            storage_dir.display()
        ));
    }

    let cache_dir = storage_dir
        .join("thumbnails")
        .join(format!("{:016x}", hasher.finish()));

    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    extract_frames(&path, duration, &cache_dir);

    let mut frames = Vec::new();

    for index in 1..=10 {
        let frame_path = cache_dir.join(format!("frame-{index:02}.jpg"));

        let Ok(bytes) = fs::read(frame_path) else {
            continue;
        };

        frames.push(format!(
            "data:image/jpeg;base64,{}",
            STANDARD.encode(bytes)
        ));
    }

    Ok(frames)
}

#[tauri::command]
fn load_library_folders(app: AppHandle) -> Result<Vec<String>, String> {
    let connection = open_library_db(&app)?;

    let mut statement = connection
        .prepare("SELECT path FROM library_folders ORDER BY path")
        .map_err(|e| e.to_string())?;

    let folders = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(folders)
}

#[tauri::command]
fn load_library(app: AppHandle) -> Result<Vec<VideoFile>, String> {
    let connection = open_library_db(&app)?;

    let mut statement = connection
        .prepare(
            "SELECT path, filename, size, duration, tags_json, rating
             FROM videos
             ORDER BY filename COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let videos = statement
        .query_map([], |row| {
            let path: String = row.get(0)?;
            let tags_json: String = row.get(4)?;
            let rating: i64 = row.get(5)?;

            Ok(VideoFile {
                id: path.clone(),
                path,
                filename: row.get(1)?,
                size: row.get(2)?,
                duration: row.get(3)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                rating: rating.clamp(0, 5) as u8,
                frames: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(videos)
}

#[tauri::command]
fn update_video_rating(
    app: AppHandle,
    video_path: String,
    rating: u8,
) -> Result<(), String> {
    if rating > 5 {
        return Err("Rating must be between 0 and 5".to_string());
    }

    let connection = open_library_db(&app)?;

    let updated = connection
        .execute(
            "UPDATE videos SET rating = ?1 WHERE path = ?2",
            params![rating, video_path],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err(format!("Video not found in library: {video_path}"));
    }

    Ok(())
}

#[tauri::command]
fn update_video_tags(
    app: AppHandle,
    video_path: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let mut normalized_tags = Vec::new();

    for tag in tags {
        let tag = tag.trim();

        if !tag.is_empty()
            && !normalized_tags.iter().any(|existing: &String| {
                existing.eq_ignore_ascii_case(tag)
            })
        {
            normalized_tags.push(tag.to_string());
        }
    }

    let tags_json =
        serde_json::to_string(&normalized_tags).map_err(|e| e.to_string())?;

    let connection = open_library_db(&app)?;

    let updated = connection
        .execute(
            "UPDATE videos SET tags_json = ?1 WHERE path = ?2",
            params![tags_json, video_path],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err(format!("Video not found in library: {video_path}"));
    }

    Ok(())
}

#[tauri::command]
fn load_playlists(app: AppHandle) -> Result<Vec<Playlist>, String> {
    let connection = open_library_db(&app)?;
    let mut statement = connection
        .prepare("SELECT id, name FROM playlists ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;

    let playlists = statement
        .query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(playlists)
}

#[tauri::command]
fn create_playlist(app: AppHandle, name: String) -> Result<Playlist, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }

    let connection = open_library_db(&app)?;
    connection
        .execute("INSERT INTO playlists (name) VALUES (?1)", params![name])
        .map_err(|e| format!("Could not create playlist: {e}"))?;

    Ok(Playlist {
        id: connection.last_insert_rowid(),
        name: name.to_string(),
    })
}

#[tauri::command]
fn rename_playlist(
    app: AppHandle,
    playlist_id: i64,
    name: String,
) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }

    let connection = open_library_db(&app)?;
    let updated = connection
        .execute(
            "UPDATE playlists SET name = ?1 WHERE id = ?2",
            params![name, playlist_id],
        )
        .map_err(|e| format!("Could not rename playlist: {e}"))?;

    if updated == 0 {
        return Err(format!("Playlist not found: {playlist_id}"));
    }

    Ok(())
}

#[tauri::command]
fn delete_playlist(app: AppHandle, playlist_id: i64) -> Result<(), String> {
    let connection = open_library_db(&app)?;
    let deleted = connection
        .execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
        .map_err(|e| e.to_string())?;

    if deleted == 0 {
        return Err(format!("Playlist not found: {playlist_id}"));
    }

    Ok(())
}

#[tauri::command]
fn load_playlist_videos(
    app: AppHandle,
    playlist_id: i64,
) -> Result<Vec<VideoFile>, String> {
    let connection = open_library_db(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT v.path, v.filename, v.size, v.duration,
                    v.tags_json, v.rating
             FROM playlist_items AS pi
             JOIN videos AS v ON v.path = pi.video_path
             WHERE pi.playlist_id = ?1
             ORDER BY pi.position",
        )
        .map_err(|e| e.to_string())?;

    let videos = statement
        .query_map(params![playlist_id], |row| {
            let path: String = row.get(0)?;
            let tags_json: String = row.get(4)?;
            let rating: i64 = row.get(5)?;

            Ok(VideoFile {
                id: path.clone(),
                path,
                filename: row.get(1)?,
                size: row.get(2)?,
                duration: row.get(3)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                rating: rating.clamp(0, 5) as u8,
                frames: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(videos)
}

#[tauri::command]
fn add_videos_to_playlist(
    app: AppHandle,
    playlist_id: i64,
    video_paths: Vec<String>,
) -> Result<(), String> {
    let mut connection = open_library_db(&app)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    let playlist_exists: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM playlists WHERE id = ?1)",
            params![playlist_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !playlist_exists {
        return Err(format!("Playlist not found: {playlist_id}"));
    }

    for video_path in video_paths {
        let video_exists: bool = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM videos WHERE path = ?1)",
                params![video_path],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if !video_exists {
            return Err(format!("Video not found in library: {video_path}"));
        }

        transaction
            .execute(
                "INSERT OR IGNORE INTO playlist_items
                    (playlist_id, video_path, position)
                 SELECT ?1, ?2, COALESCE(MAX(position) + 1, 0)
                 FROM playlist_items
                 WHERE playlist_id = ?1",
                params![playlist_id, video_path],
            )
            .map_err(|e| e.to_string())?;
    }

    transaction.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_video_from_playlist(
    app: AppHandle,
    playlist_id: i64,
    video_path: String,
) -> Result<(), String> {
    let connection = open_library_db(&app)?;
    let deleted = connection
        .execute(
            "DELETE FROM playlist_items
             WHERE playlist_id = ?1 AND video_path = ?2",
            params![playlist_id, video_path],
        )
        .map_err(|e| e.to_string())?;

    if deleted == 0 {
        return Err("Video was not found in that playlist".to_string());
    }

    Ok(())
}

#[tauri::command]
fn open_videos_in_vlc(paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No videos selected".to_string());
    }

    for path in &paths {
        if !PathBuf::from(path).is_file() {
            return Err(format!("Video file not found: {path}"));
        }
    }

    Command::new("vlc")
        .args(&paths)
        .spawn()
        .map(|_| ())
        .map_err(|error| {
            format!(
                "Could not launch VLC. Make sure VLC is installed and available on PATH: {error}"
            )
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_video_folder,
            get_video_frames,
            get_storage_dir,
            set_storage_dir,
            load_library,
            load_library_folders,
            open_videos_in_vlc,
            update_video_rating,
            update_video_tags,
            load_playlists,
            create_playlist,
            rename_playlist,
            delete_playlist,
            load_playlist_videos,
            add_videos_to_playlist,
            remove_video_from_playlist
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}