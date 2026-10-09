use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    process::Command,
};
use rusqlite::{params, Connection};
use tauri::Manager;

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


#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    storage_dir: Option<String>,
}



fn settings_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;

    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    Ok(config_dir.join("settings.json"))
}

fn read_storage_dir(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    let file = settings_file(app)?;

    if !file.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(file).map_err(|e| e.to_string())?;
    let settings: AppSettings =
        serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(settings.storage_dir.map(PathBuf::from))
}

#[tauri::command]
fn get_storage_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_storage_dir(&app)?
        .map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn set_storage_dir(
    app: tauri::AppHandle,
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

    let settings = AppSettings {
        storage_dir: Some(directory.to_string_lossy().into_owned()),
    };

    let file = settings_file(&app)?;
    let temporary_file = file.with_extension("json.tmp");

    let contents =
        serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;

    fs::write(&temporary_file, contents).map_err(|e| e.to_string())?;
    fs::rename(&temporary_file, &file).map_err(|e| e.to_string())?;
    let _connection = open_library_db(&app)?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn scan_video_folder(
    app: tauri::AppHandle,
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

fn probe_duration(path: &Path) -> f64 {
    let output = match Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(path)
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return -1.0,
    };

    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|duration| duration.is_finite() && *duration > 0.0)
        .unwrap_or(-1.0)
}

fn extract_frames(path: &Path, duration: f64, cache_dir: &Path) {
    if duration <= 0.0 || !duration.is_finite() {
        return;
    }

    let marker = cache_dir.join(".complete");

    // A completed cache is reused, even if extraction produced no frames.
    if marker.exists() {
        return;
    }

    let output_pattern = cache_dir.join("frame-%02d.jpg");
    let filter = format!(
        "fps=10/{duration:.6},scale=160:90:force_original_aspect_ratio=decrease,\
pad=160:90:(ow-iw)/2:(oh-ih)/2"
    );

    let result = Command::new("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-nostdin", "-y"])
        .arg("-i")
        .arg(path)
        .args(["-vf", &filter, "-frames:v", "10", "-q:v", "5"])
        .arg(&output_pattern)
        .output();

    if let Ok(output) = result {
        if !output.status.success() {
            eprintln!(
                "Thumbnail extraction failed for {}: {}",
                path.display(),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    // Prevent repeatedly retrying an unreadable video on every visit.
    let _ = fs::write(marker, b"complete");
}
#[tauri::command]
fn get_video_frames(
    app: tauri::AppHandle,
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

fn collect_videos(
    directory: &Path,
    videos: &mut Vec<PathBuf>,
) -> std::io::Result<()> {
    const EXTENSIONS: &[&str] = &[
        "mp4", "mkv", "avi", "mov", "webm", "m4v", "mpg",
        "mpeg", "wmv", "flv", "ts", "mts", "m2ts", "3gp", "ogv",
    ];

    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();

        if file_type.is_dir() {
            collect_videos(&path, videos)?;
        } else if file_type.is_file() {
            let is_video = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| EXTENSIONS.iter().any(|known| ext.eq_ignore_ascii_case(known)))
                .unwrap_or(false);

            if is_video {
                videos.push(path);
            }
        }
    }

    Ok(())
}


fn open_library_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let storage_dir = read_storage_dir(app)?
        .ok_or_else(|| "Choose a storage location first".to_string())?;

    if !storage_dir.is_dir() {
        return Err(format!(
            "Storage directory is unavailable: {}",
            storage_dir.display()
        ));
    }

    let db_path = storage_dir.join("library.sqlite");
    let connection = Connection::open(db_path).map_err(|e| e.to_string())?;

    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS library_folders (
                path TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS videos (
                path TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                size INTEGER NOT NULL,
                duration REAL NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                rating INTEGER NOT NULL DEFAULT 0
                    CHECK (rating BETWEEN 0 AND 5)
            );
            ",
        )
        .map_err(|e| e.to_string())?;

    Ok(connection)
}

#[tauri::command]
fn load_library(app: tauri::AppHandle) -> Result<Vec<VideoFile>, String> {
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
            load_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}