import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ToolBar {
    id: root

    property bool hasLibrary: false

    signal newLibraryRequested()
    signal openLibraryRequested()
    signal addDirectoryRequested()

    RowLayout {
        anchors.fill: parent

        Button {
            text: "New Library"
            onClicked: root.newLibraryRequested()
        }

        Button {
            text: "Open Library"
            onClicked: root.openLibraryRequested()
        }

        Button {
            text: "Add Directory"
            enabled: root.hasLibrary
            onClicked: root.addDirectoryRequested()
        }
    }
}