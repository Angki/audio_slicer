# AutoSlice ✂️🎵

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
[![Electron](https://img.shields.io/badge/Electron-Desktop-blueviolet)](https://www.electronjs.org/)

A smart, Electron-based desktop application for automatically detecting, slicing, and exporting individual tracks from long audio files (full albums, vinyl rips, live sets). 

> **Stop manually slicing vinyl sides!** AutoSlice uses RMS analysis to automatically find the silence between tracks. 

## Features

- 🔊 **Auto Silence Detection**: Uses threshold and minimum duration parameters to automatically identify track gaps.
- 🎛️ **Advanced Export Engine**:
  - Export to FLAC, WAV, or MP3 (320kbps).
  - Apply Audio Normalization (`loudnorm`).
  - Resample output frequencies (Original, 44.1kHz, 48kHz).
  - Advanced Metadata mapping (Artist, Album, Year, AlbumArtist, Genre, Comment).
  - Embed local cover art into tracks directly via FFmpeg.
- ⛔ **Exclude Regions**: Visually drag across applause, skips, or unwanted sections to omit them from your exported files seamlessly.
- 📝 **Smart Import**: Paste any tracklist text, YouTube timestamps, or CUE sheets, and map them to detected regions instantly.
- 🌐 **Discogs Integration**: Auto-fetch album metadata and tracklists via Discogs Release ID.
- 🎨 **Customizable Theming**: WaveSurfer engine supports sleek UI themes (Purple, Ocean Blue, Neon Green) and preferences are synced with `electron-store`.
- ⌨️ **Keyboard Shortcuts**: Fluent editing workflow. Space to play/pause, M to place marker, E to toggle exclude mode, and Ctrl+scroll to zoom.

## Quickstart & Development

1. `npm install`
2. `npm start` (Runs the Electron application in dev mode)
3. `npm run build` (Compiles the application to `dist/win-unpacked` and generates the Windows installer).

> Note: For development, FFmpeg binaries are automatically unpacked by electron-builder.
