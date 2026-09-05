import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    width: 1200
    height: 800
    visible: true
    title: "meli"

    Shortcut {
        sequence: StandardKey.Quit
        onActivated: Qt.quit()
    }

    Component.onCompleted: {
        if (!libraryController.hasLibrary) {
            createLibraryDialog.open()
        }
    }


    CreateLibraryDialog {
        id: createLibraryDialog
    }

    OpenLibraryDialog {
        id: openLibraryDialog
    }

    AddDirectoryDialog {
        id: addDirectoryDialog
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        GlobalToolbar {
            Layout.fillWidth: true
            hasLibrary: libraryController.hasLibrary
            onOpenLibraryRequested: {
                console.log("Open library requested")
                openLibraryDialog.open()
            }
            onNewLibraryRequested: {
                console.log("New library requested")
                createLibraryDialog.open()
            }
            onAddDirectoryRequested: {
                console.log("New library requested")
                addDirectoryDialog.open()
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            Rectangle {
                Layout.preferredWidth: 260
                Layout.fillHeight: true

                Label {
                    anchors.centerIn: parent
                    text: "Library sidebar"
                }
            }

            LibraryView {
                Layout.fillWidth: true
                Layout.fillHeight: true

            }
        }
    }
}