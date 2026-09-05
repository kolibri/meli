# AGENTS.md

## Project

This repository contains a desktop video library application built with Python,
PySide6, Qt Quick/QML, SQLite, FFmpeg/ffprobe, and external VLC.

Read `docs/REQUIREMENTS.md` and `docs/ARCHITECTURE.md` before making
architecturally significant changes.

## Development commands

Use uv for all Python environment and dependency management.

Run the application with:

    uv run python -m video_library

Run tests with:

    uv run pytest

Run linting with:

    uv run ruff check .

Format Python with:

    uv run ruff format .

Do not use pip directly and do not create requirements.txt.

## Architecture

Keep application logic in Python.

Use QML for presentation, layout, animation, and interaction.

Do not put filesystem, database, media scanning, playlist query, or playback
business logic in QML or QML JavaScript.

Python/QML communication must use Qt models, QObject properties, signals,
and slots.

Keep these layers separate:

- domain: application concepts and rules
- repositories: persistence
- services: application operations and external tools
- models: Qt models exposed to QML
- ui/qml: presentation

Do not let QML access SQLite directly.

Do not let repositories depend on QML or UI classes.

## Threading and performance

Never perform blocking filesystem scans, ffmpeg/ffprobe work, thumbnail
generation, hashing, or long file operations on the GUI thread.

Avoid loading all thumbnails into memory.

Use cached metadata and thumbnails.

The UI must remain responsive with at least 2,000 videos visible in the library.

## Dependencies

Prefer Python standard-library or Qt functionality where practical.

Do not add production dependencies unless they provide substantial value.

Use Python's sqlite3 module initially; do not introduce an ORM without a
specific reason.

Interact with ffmpeg and ffprobe as external executables.

Initially launch VLC externally. Embedded LibVLC playback is a later feature.

## Safety for media files

Tests must never modify or delete real user media.

File-operation tests must use temporary directories and generated dummy files.

Deletion functionality should use the operating system trash/recycle bin rather
than irreversible deletion unless explicitly designed otherwise.

## Testing

Add tests for domain rules, playlist queries, repository behavior, and file
operations.

Avoid tests that merely duplicate implementation details.

For bug fixes, add a regression test when practical.

## Scope discipline

Do not implement future roadmap features while working on an earlier milestone
unless they are required for the current architecture.

Prefer small, reviewable changes.

Update documentation when an architectural decision or user-visible behavior
changes.