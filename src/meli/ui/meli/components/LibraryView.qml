import QtQuick
import QtQuick.Controls
import QtQml.Models
import QtCore

Item {
    id: root

    property int sortColumn: 0
    property bool sortAscending: true

    Settings {
        id: settings
        category: "LibraryView"
    }

    function saveColumnWidths() {
        const widths = []

        for (let column = 0; column < tableView.columns; ++column) {
            widths.push(tableView.explicitColumnWidth(column))
        }

        settings.setValue(
            "columnWidths",
            JSON.stringify(widths)
        )
    }

    function restoreColumnWidths() {
        const stored = settings.value("columnWidths", "")

        if (!stored) {
            return
        }

        const widths = JSON.parse(stored)

        for (let column = 0; column < widths.length; ++column) {
            if (widths[column] >= 0) {
                tableView.setColumnWidth(
                    column,
                    widths[column]
                )
            }
        }
    }

    Component.onCompleted: {
        restoreColumnWidths()
    }

    Component.onDestruction: {
        saveColumnWidths()
    }

    function sortByColumn(column) {
        if (sortColumn === column) {
            sortAscending = !sortAscending
        } else {
            sortColumn = column
            sortAscending = true
        }

        videoModel.sortByColumn(
            sortColumn,
            sortAscending
        )
    }

    HorizontalHeaderView {
        id: header

        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top

        syncView: tableView
        clip: true

        resizableColumns: true
        movableColumns: false

        delegate: HorizontalHeaderViewDelegate {
            id: headerDelegate

            required property int index

             TapHandler {
                onTapped: {
                    root.sortByColumn(headerDelegate.index)
                }
            }

            Label {
                anchors.right: parent.right
                anchors.rightMargin: 8
                anchors.verticalCenter: parent.verticalCenter

                text: {
                    if (root.sortColumn !== headerDelegate.index) {
                        return ""
                    }

                    return root.sortAscending ? "▲" : "▼"
                }
            }
        }
    }

    TableView {
        id: tableView

        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: header.bottom
        anchors.bottom: parent.bottom

        model: videoModel

        clip: true

         acceptedButtons: Qt.NoButton

        selectionBehavior: TableView.SelectRows
        selectionMode: TableView.ExtendedSelection

        selectionModel: ItemSelectionModel {
            model: videoModel
        }

        ScrollBar.vertical: ScrollBar {
            policy: ScrollBar.AsNeeded
        }

        ScrollBar.horizontal: ScrollBar {
            policy: ScrollBar.AsNeeded
        }

        delegate: TableViewDelegate {
            implicitWidth: 320
            implicitHeight: 32

            text: display
        }
    }

    SelectionRectangle {
        target: tableView
        selectionMode: SelectionRectangle.Drag

        topLeftHandle: null
        bottomRightHandle: null
    }
}