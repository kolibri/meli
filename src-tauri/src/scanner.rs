
use std::{
    path::{Path, PathBuf},
    process::Command,
};

pub(crate) fn probe_duration(path: &Path) -> f64 {
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

pub(crate) fn collect_videos(
    directory: &Path,
    videos: &mut Vec<PathBuf>,
) -> std::io::Result<()> {
    const EXTENSIONS: &[&str] = &[
        "mp4", "mkv", "avi", "mov", "webm", "m4v", "mpg",
        "mpeg", "wmv", "flv", "ts", "mts", "m2ts", "3gp", "ogv",
    ];

    for entry in std::fs::read_dir(directory)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();

        if file_type.is_dir() {
            collect_videos(&path, videos)?;
        } else if file_type.is_file() {
            let is_video = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| {
                    EXTENSIONS.iter().any(|known| ext.eq_ignore_ascii_case(known))
                })
                .unwrap_or(false);

            if is_video {
                videos.push(path);
            }
        }
    }

    Ok(())
}