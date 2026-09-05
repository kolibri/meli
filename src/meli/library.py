from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QObject, Property, QSettings, QUrl, Signal, Slot

from meli.database import create_database, open_database


VIDEO_EXTENSIONS = {
    ".avi",
    ".flv",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".ts",
    ".webm",
    ".wmv",
}


class LibraryController(QObject):
    currentLibraryChanged = Signal()
    videosChanged = Signal()

    def __init__(self) -> None:
        super().__init__()

        self._settings = QSettings()
        self._current_library: Path | None = None

        saved_path = self._settings.value(
            "library/lastPath",
            "",
            type=str,
        )

        if not saved_path:
            return

        path = Path(saved_path)

        if not path.is_file():
            return

        try:
            with open_database(path):
                self._current_library = path
        except (OSError, RuntimeError):
            self._current_library = None

    @Property(bool, notify=currentLibraryChanged)
    def hasLibrary(self) -> bool:
        return self._current_library is not None

    @Property(str, notify=currentLibraryChanged)
    def currentLibraryPath(self) -> str:
        if self._current_library is None:
            return ""

        return str(self._current_library)

    @Slot(QUrl)
    def createLibrary(self, url: QUrl) -> None:
        path = Path(url.toLocalFile())

        if not path:
            return

        create_database(path)

        self._set_current_library(path)

    @Slot(QUrl)
    def openLibrary(self, url: QUrl) -> None:
        path = Path(url.toLocalFile())

        if not path.is_file():
            return

        with open_database(path):
            self._set_current_library(path)

    @Slot(QUrl)
    def addDirectory(self, url: QUrl) -> None:
        if self._current_library is None:
            return

        directory = Path(url.toLocalFile()).resolve()

        if not directory.is_dir():
            return

        with open_database(self._current_library) as connection:
            connection.execute(
                """
                INSERT INTO library_directories (path)
                VALUES (?)
                ON CONFLICT(path) DO NOTHING
                """,
                (str(directory),),
            )

            row = connection.execute(
                """
                SELECT id
                FROM library_directories
                WHERE path = ?
                """,
                (str(directory),),
            ).fetchone()

            if row is None:
                return

            directory_id = row[0]

            videos: list[tuple[int, str]] = []

            for path in directory.rglob("*"):
                if not path.is_file():
                    continue

                if path.suffix.lower() not in VIDEO_EXTENSIONS:
                    continue

                relative_path = path.relative_to(directory)

                videos.append(
                    (
                        directory_id,
                        str(relative_path),
                    )
                )

            connection.executemany(
                """
                INSERT INTO videos (
                    directory_id,
                    relative_path
                )
                VALUES (?, ?)
                ON CONFLICT(directory_id, relative_path) DO NOTHING
                """,
                videos,
            )

            connection.commit()

        self.videosChanged.emit()

    def _set_current_library(self, path: Path) -> None:
        self._current_library = path

        self._settings.setValue(
            "library/lastPath",
            str(path),
        )

        self.currentLibraryChanged.emit()