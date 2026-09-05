import QtQuick
import QtQuick.Dialogs

FileDialog {
    id: createLibraryDialog

    title: "Create Library"
    fileMode: FileDialog.SaveFile
    defaultSuffix: "sqlite"
    nameFilters: ["meli libraries (*.sqlite)"]

    onAccepted: {
        libraryController.createLibrary(selectedFile)
    }
}