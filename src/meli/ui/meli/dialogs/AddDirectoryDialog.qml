import QtQuick.Dialogs

FolderDialog {
    title: "Add Directory to Library"

    onAccepted: {
        libraryController.addDirectory(selectedFolder)
    }
}