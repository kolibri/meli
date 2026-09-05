import QtQuick
import QtQuick.Controls

ToolBar {
    signal openLibraryRequested()

    Button {
        anchors.verticalCenter: parent.verticalCenter
        text: "Open Library"
        onClicked: openLibraryRequested()
    }
}