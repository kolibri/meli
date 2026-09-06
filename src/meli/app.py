import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine

from meli.library import LibraryController
from meli.video_model import VideoSortFilterModel, VideoTableModel


def main() -> int:
    app = QGuiApplication(sys.argv)

    app.setOrganizationName("meli")
    app.setApplicationName("meli")

    engine = QQmlApplicationEngine(app)

    library_controller = LibraryController()
    library_controller.setParent(app)

    video_source_model = VideoTableModel(library_controller)

    video_model = VideoSortFilterModel()
    video_model.setSourceModel(video_source_model)
    video_model.sort(
        0,
        Qt.SortOrder.AscendingOrder,
    )

    engine.rootContext().setContextProperty(
        "libraryController",
        library_controller,
    )

    engine.rootContext().setContextProperty(
        "videoModel",
        video_model,
    )

    qml_import_path = Path(__file__).resolve().parent / "ui"
    engine.addImportPath(str(qml_import_path))

    engine.loadFromModule("meli", "Main")

    if not engine.rootObjects():
        return 1

    return app.exec()