import QtQuick
import QtQuick.Controls

ListView {
    id: root

    model: videoModel
    clip: true

    delegate: ItemDelegate {
        width: ListView.view.width
        text: model.display
    }
}