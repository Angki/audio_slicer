# AutoSlice Architecture Context

This file serves as a reference point for LLMs assisting with future development of the AutoSlice application.

## Core Flow
1. **Frontend (Renderer Process)**: The user drops an audio file. The UI sets `$loadingOverlay` to true and calls `window.api.getAudioInfo(...)` through `preload.js`.
2. **Backend (Main Process)**: `AudioService.js` delegates FFmpeg tasks (using binary paths solved internally in `utils/ffmpeg.js`). It decodes the audio into a `.wav` file for WaveSurfer visualization.
3. **Detection**: The backend returns gap arrays. The frontend updates its global `state` via `store.js` and dynamically passes this data into UI components like `tracklist.js`. 
4. **Metadata & Export**: Users can fetch Discogs metadata mapped across segments. Output config is gathered from `controls.js` and `.track-title input` & `.track-artist input` rows and pushed via `window.api.exportTracks` to `ExportService.js`.

## Code Standard
- Global state should *only* be managed inside `src/renderer/state/store.js`.
- Raw DOM manipulation happens in `modules/`. Data preparation happens in the functions outside the rendering templates.
- Backend services return Promises. Errors should be bubbled up to `index.js` IPC handlers.
