
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    storage_dir: Option<String>,
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;

    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    Ok(config_dir.join("settings.json"))
}

pub(crate) fn read_storage_dir(
    app: &AppHandle,
) -> Result<Option<PathBuf>, String> {
    let file = settings_file(app)?;

    if !file.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(file).map_err(|e| e.to_string())?;
    let settings: AppSettings =
        serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(settings.storage_dir.map(PathBuf::from))
}

pub(crate) fn save_storage_dir(
    app: &AppHandle,
    directory: PathBuf,
) -> Result<(), String> {
    let settings = AppSettings {
        storage_dir: Some(directory.to_string_lossy().into_owned()),
    };

    let file = settings_file(app)?;
    let temporary_file = file.with_extension("json.tmp");

    let contents =
        serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;

    fs::write(&temporary_file, contents).map_err(|e| e.to_string())?;
    fs::rename(&temporary_file, &file).map_err(|e| e.to_string())?;

    Ok(())
}