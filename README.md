# AutoSlice

AutoSlice is a powerful desktop application for automatically slicing audio files based on silence detection. Ideal for digitizing vinyl, cassette tapes, or splitting long recordings into individual tracks.

## Features

- **Automated Slicing**: Detects gaps in audio using adjustable silence threshold and duration.
- **Waveform Visualization**: Interactive waveform display with zoom and spectrogram support.
- **Discogs Integration**: Search for release metadata and automatically match track names to detected segments.
- **Flexible Export**: Export slices as WAV, FLAC, or MP3 with metadata tagging.
- **Manual Editing**: Fine-tune markers manually with drag-and-drop precision.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Angki/audio_slicer.git
   cd audio_slicer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the application:
   ```bash
   npm start
   # or
   npx electron .
   ```

2. Drag and drop an audio file into the window.
3. Click "⚡ Auto Detect" to find gaps.
4. Verify markers on the waveform.
5. (Optional) Search Discogs for track names.
6. Click "Export Tracks" to save your files.

## Project Structure

- `src/main`: Electron main process and backend services.
  - `services/`: Core logic (Audio detection, Exporting, Discogs API).
  - `utils/`: Shared generic utilities (e.g. FFmpeg pathing).
- `src/renderer`: Frontend UI and logic.
  - `state/`: Global frontend state manager (`store.js`).
  - `modules/`: Decoupled UI components (waveform, tracklist, controls, history, etc.).

## License

MIT
