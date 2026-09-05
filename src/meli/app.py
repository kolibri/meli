import sys
from pathlib import Path

from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine

from meli.library import LibraryController
from meli.video_model import VideoTableModel


def main() -> int:
    app = QGuiApplication(sys.argv)

    app.setOrganizationName("meli")
    app.setApplicationName("meli")

    engine = QQmlApplicationEngine()

    library_controller = LibraryController()
    video_model = VideoTableModel(library_controller)
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