---
name: qt-qml
description: Use when implementing or modifying the PySide6 Qt Quick/QML user interface, Qt models exposed to QML, or Python-QML integration in this repository.
---

Read `docs/ARCHITECTURE.md` before making substantial UI changes.

For this project:

1. Keep visual layout, states, transitions, animations, and styling in QML.
2. Keep application state and business logic in Python.
3. Communicate between Python and QML using:
   - QAbstractItemModel subclasses
   - QObject properties
   - Qt signals
   - Qt slots
4. Do not implement database access, filesystem operations, ffmpeg execution,
   query evaluation, or playback management in QML JavaScript.
5. Prefer reusable QML components over large monolithic QML files.
6. Avoid unnecessary delegate complexity in TableView and ListView.
7. Do not perform expensive synchronous work from UI callbacks.
8. Preserve keyboard and mouse behavior expected from a desktop application.
9. When adding a Python object exposed to QML, keep its public QML-facing API
   narrow and explicit.
10. Run the relevant Python tests and launch the application after changing
    Python/QML integration.

For changes affecting TableView performance:

- delegates should represent only visible state
- thumbnails must come from a cache
- never decode media from a delegate
- avoid large object hierarchies inside every cell
- use models as the source of truth