# Product Requirements

## Purpose

A desktop application for cataloguing, filtering, organizing, and playing a
local video collection.

The application is a media library rather than a media server.

## Library

The application manages configured library roots containing video files.

Each video can have application-owned metadata including:

- rating
- tags
- date added
- optional playback state

Extracted media metadata should include where available:

- filename
- path
- directory
- file size
- duration
- resolution
- video codec
- frame rate

## Main library view

The primary view is a large table/list.

It supports:

- sortable columns
- search
- selection
- directory filtering
- tag filtering
- rating filtering
- additional combined filters

The first column displays a video thumbnail.

Eventually, hovering the thumbnail expands an animated preview containing
multiple frames sampled from different timestamps in the video.

## Directory browser

The sidebar displays the directory hierarchy beneath configured library roots.

Selecting a directory filters the library to that directory and its descendants.

## Tags and ratings

Users can assign multiple tags to videos.

Users can assign ratings to videos.

Tags and ratings are stored in the application database, not written into the
video files.

## Search

Search filters the currently selected library/playlist view.

Initially search:

- filename
- path/directory
- tags

## Static playlists

Static playlists contain explicitly selected videos in a saved order.

Users can reorder playlist entries.

## Smart playlists

Smart playlists store filter rules rather than fixed video membership.

Supported rule types should eventually include:

- rating comparisons
- tags
- directories
- duration comparisons
- filename/text search
- combinations using AND/OR

Example:

    tag = "Documentary"
    AND directory under "/Archive"
    AND duration > 5 minutes
    AND rating >= 4

Smart playlists dynamically reflect library metadata changes.

Starting playback creates a snapshot queue so changes to the smart playlist do
not unexpectedly mutate the active playback session.

## Playback queue

The application's queue is independent of VLC.

It supports:

- ordered playback
- shuffled playback
- next/previous
- reorder
- add next
- add to end

Initially the resulting queue is launched in external VLC.

Embedded LibVLC playback may replace the external backend later.

## File operations

The application will eventually support:

- moving videos
- moving videos to trash
- rescan/reconciliation

Database and filesystem state must remain consistent.

## Performance

The application must remain responsive with approximately 2,000 to 4.000 videos.

Expensive work must not run synchronously on the GUI thread.

Metadata and thumbnails should be cached.