# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-27

### Added
- **Smart Import Engine**: Parse tracklists from any text format, including CUE sheets and YouTube descriptions.
- **Append Mode**: Import tracks and append them to the existing list instead of replacing.
- **Advanced Export options**:
  - Exclude Regions logic to seamlessly skip applause, noise, or silence during export using FFmpeg complex filters.
  - Formats: FLAC, WAV, MP3 with configurable 320kbps.
  - Normalization toggle (`loudnorm=I=-16:TP=-1.5:LRA=11`).
  - Sample Rate targeting options (original, 44.1kHz, 48kHz, 96kHz).
  - Advanced metadata tagging: AlbumArtist, Genre, Comment.
  - Embedded Cover Art mapping.
- **Export Progress UI**: Visual progress bars and ETA display for rendering tracks.
- **Settings & UI Theming**: Save default export preferences, output directory, and choose between custom waveform colors (Purple, Blue, Green).
- **Discogs Auto-tagging**: Fetch track names and metadata directly via Release ID.
- **Keyboard Shortcuts**: Space (Play/Pause), M (Mark), E (Exclude Region Mode), Ctrl+Scroll (Zoom).
- **Auto-updater configuration**: Built-in stub for OTA distribution via `electron-updater`.
- **Packaging Pipeline**: Configured `electron-builder` for production setup with native dependencies packaged and preserved.
