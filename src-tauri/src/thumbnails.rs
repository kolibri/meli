
use std::{
    fs,
    path::Path,
    process::Command,
};

pub(crate) fn extract_frames(path: &Path, duration: f64, cache_dir: &Path) {
    if duration <= 0.0 || !duration.is_finite() {
        return;
    }

    let marker = cache_dir.join(".complete");

    // Reuse a completed cache, even if extraction produced no frames.
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

    // Avoid retrying unreadable videos on every visit.
    let _ = fs::write(marker, b"complete");
}