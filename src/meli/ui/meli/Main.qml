import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    width: 1200
    height: 800
    visible: true
    title: "meli"

    Shortcut {
        sequence: StandardKey.Quit
        onActivated: Qt.quit()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        GlobalToolbar {
            Layout.fillWidth: true

            onOpenLibraryRequested: {
                console.log("Open library requested")
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

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true

                Label {
                    anchors.centerIn: parent
                    text: "Video library"
                }
            }
        }
    }
}