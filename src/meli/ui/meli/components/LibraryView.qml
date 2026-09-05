import QtQuick
import QtQuick.Controls
import QtQml.Models

Item {
    id: root

    property int sortColumn: 0
    property bool sortAscending: true

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
            required property int index
            required property string modelData


            text: {
                if (root.sortColumn !== index) {
                    return modelData
                }

                return modelData + (
                    root.sortAscending ? " ▲" : " ▼"
                )
            }

            onClicked: {
                root.sortByColumn(index)
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