# Architecture

## High-level structure

    QML / Qt Quick
           |
           | Qt signals, slots, properties, models
           |
    Python application
           |
      +----+----------+----------+----------+
      |               |          |          |
    SQLite          ffprobe     ffmpeg      VLC

## Layers

### Domain

Pure application concepts.

Examples:

- Video
- Tag
- Playlist
- SmartPlaylist
- LibraryQuery
- PlaybackQueue

Domain code should contain as little Qt-specific behavior as practical.

### Repositories

Persistence interfaces and SQLite implementations.

Examples:

- VideoRepository
- TagRepository
- PlaylistRepository

Repositories do not know about QML.

### Services

Operations involving several domain objects, repositories, the filesystem,
or external processes.

Examples:

- LibraryScanner
- MetadataService
- ThumbnailService
- FileService
- PlaylistService
- PlaybackController

### Models

Qt models used to expose application state to QML.

Examples:

- VideoTableModel
- DirectoryTreeModel
- PlaylistModel
- PlaybackQueueModel

Models adapt application data for Qt. They should not become the main location
for business logic.

### QML UI

Responsible for:

- layout
- rendering
- animation
- visual states
- user interaction

QML sends user intent to Python and renders state received from Python.

QML does not implement persistence, filesystem operations, media probing, or
playlist query evaluation.

## Query model

Normal filtering, search, and smart playlists should eventually use the same
LibraryQuery representation.

Example:

    AND
    ├── DirectoryUnder("/Archive")
    ├── HasTag("Documentary")
    ├── RatingAtLeast(4)
    └── DurationGreaterThan(300)

Smart playlists serialize this query representation.

## Playback

Playback is accessed through a PlaybackController.

Initial backend:

    PlaybackController
            |
            v
      External VLC

Future backend:

    PlaybackController
            |
            +-- PlaybackQueue
            |
            v
        LibVLC backend

Application code should not depend directly on either playback backend.