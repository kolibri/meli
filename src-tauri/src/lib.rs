
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn scan_video_folder(folder_path: String) -> Result<Vec<VideoFile>, String> {
    let root = PathBuf::from(&folder_path);

    if !root.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    let mut paths = Vec::new();
    collect_videos(&root, &mut paths).map_err(|e| e.to_string())?;
    paths.sort();

    let mut videos = Vec::with_capacity(paths.len());

    for path in paths {
        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let full_path = path.to_string_lossy().into_owned();

        videos.push(VideoFile {
            id: full_path.clone(),
            path: full_path,
            filename,
            size: metadata.len(),
            duration: -1.0,
            tags: Vec::new(),
            rating: 0,
            frames: Vec::new(),
        });
    }

    Ok(videos)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_video_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}