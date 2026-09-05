import sys
from pathlib import Path

from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine


def main() -> int:
    app = QGuiApplication(sys.argv)

    app.setOrganizationName("meli")
    app.setApplicationName("meli")

    engine = QQmlApplicationEngine()

    qml_import_path = Path(__file__).resolve().parent / "ui"
    engine.addImportPath(str(qml_import_path))

    engine.loadFromModule("meli", "Main")

    if not engine.rootObjects():
        return 1

    return app.exec()