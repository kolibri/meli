import sqlite3
from pathlib import Path

from PySide6.QtCore import QAbstractTableModel, QModelIndex, Qt


class VideoTableModel(QAbstractTableModel):
    HEADERS = [
        "Filename",
        "Path",
    ]

    def __init__(self, library_controller):
        super().__init__()

        self._library_controller = library_controller
        self._videos = []

        library_controller.currentLibraryChanged.connect(self.reload)
        library_controller.videosChanged.connect(self.reload)

        self.reload()

    def rowCount(self, parent=QModelIndex()):
        if parent.isValid():
            return 0

        return len(self._videos)

    def columnCount(self, parent=QModelIndex()):
        if parent.isValid():
            return 0

        return len(self.HEADERS)

    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid():
            return None

        if role != Qt.ItemDataRole.DisplayRole:
            return None

        video = self._videos[index.row()]

        if index.column() == 0:
            return Path(video["relative_path"]).name

        if index.column() == 1:
            return str(
                Path(video["directory_path"])
                / video["relative_path"]
            )

        return None

    def headerData(
        self,
        section,
        orientation,
        role=Qt.ItemDataRole.DisplayRole,
    ):
        if role != Qt.ItemDataRole.DisplayRole:
            return None

        if orientation == Qt.Orientation.Horizontal:
            return self.HEADERS[section]

        return section + 1

    def reload(self):
        self.beginResetModel()

        self._videos = []

        library_path = self._library_controller.currentLibraryPath

        if library_path:
            connection = sqlite3.connect(library_path)
            connection.row_factory = sqlite3.Row

            try:
                self._videos = connection.execute(
                    """
                    SELECT
                        videos.id,
                        videos.relative_path,
                        library_directories.path AS directory_path
                    FROM videos
                    JOIN library_directories
                        ON library_directories.id = videos.directory_id
                    ORDER BY videos.relative_path
                    """
                ).fetchall()
            finally:
                connection.close()

        self.endResetModel()