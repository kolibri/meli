import QtQuick
import QtQuick.Dialogs

FileDialog {
    id: openLibraryDialog

    title: "Open Library"
    fileMode: FileDialog.OpenFile
    nameFilters: ["meli libraries (*.sqlite)"]

    onAccepted: {
        libraryController.openLibrary(selectedFile)
    }
}
