use rusqlite::Connection;
use tauri::AppHandle;

pub(crate) fn open_library_db(app: &AppHandle) -> Result<Connection, String> {
    let storage_dir = crate::read_storage_dir(app)?
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

            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL COLLATE NOCASE UNIQUE
            );

            CREATE TABLE IF NOT EXISTS playlist_items (
                playlist_id INTEGER NOT NULL,
                video_path TEXT NOT NULL,
                position INTEGER NOT NULL,
                PRIMARY KEY (playlist_id, video_path),
                UNIQUE (playlist_id, position),
                FOREIGN KEY (playlist_id)
                    REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (video_path)
                    REFERENCES videos(path) ON DELETE CASCADE
            );
            ",
        )
        .map_err(|e| e.to_string())?;

    Ok(connection)
}