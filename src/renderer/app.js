/**
 * AutoSlice — Main Renderer Application
 * Orchestrates waveform, controls, track list, Discogs, and export.
 */

import { initWaveform, loadAudio, getWavesurfer, destroyWaveform, syncMarkersToRegions } from './modules/waveform.js';
import { initControls } from './modules/controls.js';
import { initTracklist, updateTracklist } from './modules/tracklist.js';
import { initDiscogs } from './modules/discogs-ui.js';
import { initSmartImport } from './modules/smart-import.js';
import { initHistory, pushHistory, clearHistory } from './modules/history.js';

// ── App State ──────────────────────────────────────────────────
window.onerror = function (msg, url, line, col, error) {
    alert(`Global Error: ${msg}\nLine: ${line}\nStack: ${error ? error.stack : ''}`);
};
window.addEventListener('unhandledrejection', (event) => {
    alert(`Unhandled Rejection: ${event.reason}`);
});

const state = {
    filePath: null,
    wavPath: null,
    audioInfo: null,
    markers: [],         // Array of marker times (seconds), sorted
    trackNames: [],      // Track names (from Discogs or manual)
    trackArtists: [],    // Per-track artist names
    discogsInfo: null,    // Discogs release info if loaded
    isPlaying: false,
    isProcessing: false,
};

window.appState = state;

// ── DOM References ─────────────────────────────────────────────
const $dropZone = document.getElementById('dropZone');
const $mainContent = document.getElementById('mainContent');
const $fileNameDisplay = document.getElementById('fileNameDisplay');
const $fileInfoDisplay = document.getElementById('fileInfoDisplay');
const $loadingOverlay = document.getElementById('loadingOverlay');
const $loadingText = document.getElementById('loadingText');
const $btnOpenFile = document.getElementById('btnOpenFile');

// ── Loading helpers ────────────────────────────────────────────
function showLoading(text = 'Processing...') {
    state.isProcessing = true;
    $loadingText.textContent = text;
    $loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    state.isProcessing = false;
    $loadingOverlay.classList.add('hidden');
}

window.showLoading = showLoading;
window.hideLoading = hideLoading;

// ── Format time helper ─────────────────────────────────────────
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

window.formatTime = formatTime;

// ── Format duration helper ─────────────────────────────────────
function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

window.formatDuration = formatDuration;

// ── File Loading ───────────────────────────────────────────────
async function loadFile(filePath) {
    if (state.isProcessing) return;

    try {
        showLoading('Loading audio file...');

        // Get audio info
        const info = await window.api.getAudioInfo(filePath);
        state.audioInfo = info;
        state.filePath = filePath;

        // Update header
        $fileNameDisplay.textContent = info.fileName;
        $fileInfoDisplay.textContent = `${info.codec.toUpperCase()} · ${info.sampleRate}Hz · ${formatDuration(info.duration)}`;

        // Decode to WAV for WaveSurfer if needed
        showLoading('Decoding audio...');
        const wavPath = await window.api.decodeToWav(filePath);
        state.wavPath = wavPath;

        // Get waveform peaks from main process (avoids OOM in renderer)
        showLoading('Analyzing waveform...');
        try {
            const rmsData = await window.api.analyzeRMS(wavPath, 50);

            // Convert dB to linear [0..1] array for WaveSurfer
            // WaveSurfer expects values between 0 and 1
            const peaks = rmsData.rmsDb.map(db => {
                // Approximate linear amplitude from dB
                const val = Math.pow(10, db / 20);
                return Math.max(0, val);
            });

            // Show main content, hide drop zone
            $dropZone.classList.add('hidden');
            $mainContent.classList.remove('hidden');

            // Load into waveform with pre-calculated peaks
            showLoading('Rendering waveform...');
            await loadAudio(wavPath, peaks);
        } catch (peaksErr) {
            console.warn('Peak analysis failed, falling back to default load:', peaksErr);
            // Fallback to normal load (might crash on large files)
            $dropZone.classList.add('hidden');
            $mainContent.classList.remove('hidden');
            await loadAudio(wavPath);
        }

        // Clear previous markers
        state.markers = [];
        state.trackNames = [];
        state.trackArtists = [];
        state.discogsInfo = null;
        state.trackNames = [];
        state.trackArtists = [];
        state.discogsInfo = null;
        updateTracklist(state);

        // Reset history
        clearHistory();

        hideLoading();
    } catch (err) {
        hideLoading();
        console.error('Failed to load file:', err);
        alert(`Failed to load file: ${err.message}`);
    }
}

window.loadFile = loadFile;

// ── Marker Management ──────────────────────────────────────────
function addMarker(time) {
    // Don't add duplicates (within 0.1s)
    if (state.markers.some(m => Math.abs(m - time) < 0.1)) return;
    pushHistory('Add Marker');
    state.markers.push(time);
    state.markers.sort((a, b) => a - b);
    updateTracklist(state);
    updateMarkerCount();
}

function removeMarker(index) {
    pushHistory('Remove Marker');
    state.markers.splice(index, 1);
    updateTracklist(state);
    updateMarkerCount();
}

function clearMarkers() {
    pushHistory('Clear Markers');
    state.markers = [];
    const ws = getWavesurfer();
    if (ws && ws.regions) {
        ws.regions.clearRegions();
    }
    updateTracklist(state);
    updateMarkerCount();
}

function updateMarkerCount() {
    const $count = document.getElementById('markerCount');
    const $badge = document.getElementById('trackCountBadge');
    const n = state.markers.length;
    $count.textContent = `${n} markers · ${n + 1} tracks`;
    $badge.textContent = n + 1;
}

window.addMarker = addMarker;
window.removeMarker = removeMarker;
window.clearMarkers = clearMarkers;
window.updateMarkerCount = updateMarkerCount;

// ── Set markers from detection ─────────────────────────────────
function setMarkers(markerTimes, skipHistory = false) {
    if (!skipHistory) pushHistory('Set Markers');
    state.markers = [...markerTimes].sort((a, b) => a - b);
    syncMarkersToRegions(); // Added visual sync
    updateTracklist(state);
    updateMarkerCount();
}

window.setMarkers = setMarkers;

// ── Drag & Drop ────────────────────────────────────────────────
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

$dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    $dropZone.classList.add('drag-over');
});

$dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    $dropZone.classList.remove('drag-over');
});

$dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
});

$dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    $dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        loadFile(files[0].path);
    }
});

// Also allow drop on main content area for reloading
$mainContent.addEventListener('dragover', (e) => {
    e.preventDefault();
});

$mainContent.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        loadFile(files[0].path);
    }
});

// ── Open File button ───────────────────────────────────────────
$btnOpenFile.addEventListener('click', async () => {
    const filePath = await window.api.openFile();
    if (filePath) loadFile(filePath);
});

// ── Initialize ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initWaveform();
    initControls(state);
    initTracklist(state);
    initDiscogs(state);
    initSmartImport(state);
    initHistory(state);
});
