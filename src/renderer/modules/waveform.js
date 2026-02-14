// We'll load WaveSurfer from local lib files
import WaveSurfer from '../lib/wavesurfer.esm.js';
import RegionsPlugin from '../lib/regions.esm.js';
import SpectrogramPlugin from '../lib/spectrogram.esm.js';
import TimelinePlugin from '../lib/timeline.esm.js';

let wavesurfer = null;
let regionsPlugin = null;
let spectrogramPlugin = null;
let spectrogramVisible = false;

const MARKER_COLOR = 'rgba(124, 92, 252, 0.7)';
const MARKER_HOVER_COLOR = 'rgba(167, 139, 250, 0.9)';

// ── Initialize WaveSurfer ──────────────────────────────────

export function initWaveform() {
    const container = document.getElementById('waveformContainer');

    regionsPlugin = RegionsPlugin.create();

    // Create media element if not exists
    let media = document.querySelector('audio#waveformAudio');
    if (!media) {
        media = document.createElement('audio');
        media.id = 'waveformAudio';
        document.body.appendChild(media);
    }

    wavesurfer = WaveSurfer.create({
        container,
        media, // Use media element backend
        waveColor: '#4a4a6a',
        progressColor: '#7c5cfc',
        cursorColor: '#a78bfa',
        cursorWidth: 1,
        height: 140,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        normalize: true,
        fillParent: true,
        minPxPerSec: 10,
        autoCenter: true,
        autoScroll: true,
        plugins: [
            regionsPlugin,
            TimelinePlugin.create({
                container: container,
                height: 20,
                timeInterval: 10,
                primaryLabelInterval: 30,
                style: {
                    fontSize: '10px',
                    color: '#55556a',
                },
            }),
        ],
    });

    // ── Play/Pause state sync ──
    wavesurfer.on('play', () => {
        document.getElementById('iconPlay').classList.add('hidden');
        document.getElementById('iconPause').classList.remove('hidden');
        window.appState.isPlaying = true;
    });

    wavesurfer.on('pause', () => {
        document.getElementById('iconPlay').classList.remove('hidden');
        document.getElementById('iconPause').classList.add('hidden');
        window.appState.isPlaying = false;
    });

    // ── Time display ──
    wavesurfer.on('timeupdate', (time) => {
        document.getElementById('currentTime').textContent = window.formatTime(time);
    });

    wavesurfer.on('ready', () => {
        const duration = wavesurfer.getDuration();
        document.getElementById('totalTime').textContent = window.formatTime(duration);
    });

    // ── Region events (marker dragging) ──
    regionsPlugin.on('region-updated', (region) => {
        // Update marker position in state
        const state = window.appState;
        const idx = state.markers.findIndex(m => Math.abs(m - region.start) < 0.5 || region.id === `marker_${state.markers.indexOf(parseFloat(region.id?.replace('marker_', '')))}`);

        // Find marker by region id
        const markerIdx = parseInt(region.id?.replace('marker_', ''));
        if (!isNaN(markerIdx) && markerIdx < state.markers.length) {
            state.markers[markerIdx] = region.start;
            state.markers.sort((a, b) => a - b);
            const { updateTracklist } = window._tracklistModule || {};
            if (updateTracklist) updateTracklist(state);
        }
    });

    // ── Playback controls ──
    document.getElementById('btnPlayPause').addEventListener('click', () => {
        wavesurfer.playPause();
    });

    document.getElementById('btnStop').addEventListener('click', () => {
        wavesurfer.stop();
    });

    // ── Zoom controls ──
    const $zoomSlider = document.getElementById('zoomSlider');
    const $btnZoomIn = document.getElementById('btnZoomIn');
    const $btnZoomOut = document.getElementById('btnZoomOut');

    $zoomSlider.addEventListener('input', (e) => {
        wavesurfer.zoom(Number(e.target.value));
    });

    $btnZoomIn.addEventListener('click', () => {
        const val = Math.min(Number($zoomSlider.value) + 20, 500);
        $zoomSlider.value = val;
        wavesurfer.zoom(val);
    });

    $btnZoomOut.addEventListener('click', () => {
        const val = Math.max(Number($zoomSlider.value) - 20, 1);
        $zoomSlider.value = val;
        wavesurfer.zoom(val);
    });

    // ── Toggle Spectrogram ──
    document.getElementById('btnToggleSpectrogram').addEventListener('click', () => {
        const $spectContainer = document.getElementById('spectrogramContainer');
        spectrogramVisible = !spectrogramVisible;

        if (spectrogramVisible) {
            const decodedData = wavesurfer.getDecodedData();
            if (decodedData) {
                $spectContainer.classList.remove('hidden');
                if (!spectrogramPlugin) {
                    try {
                        spectrogramPlugin = wavesurfer.registerPlugin(
                            SpectrogramPlugin.create({
                                container: $spectContainer,
                                labels: true,
                                height: 100,
                                splitChannels: false,
                            })
                        );
                    } catch (e) {
                        console.warn('Spectrogram init failed:', e);
                    }
                }
            } else {
                alert('Spectrogram is disabled for large files (streaming mode) to improve performance.');
                spectrogramVisible = false;
            }
        } else {
            $spectContainer.classList.add('hidden');
        }
    });

    // ── Click to add marker (double-click) ──
    wavesurfer.on('dblclick', (relativeX) => {
        const time = relativeX * wavesurfer.getDuration();
        window.addMarker(time);
        syncMarkersToRegions();
    });
}

// ── Load Audio ─────────────────────────────────────────────

export async function loadAudio(wavPath, peaks) {
    // Convert Windows path to file:// URL
    const fileUrl = `file:///${wavPath.replace(/\\/g, '/')}`;

    return new Promise((resolve, reject) => {
        wavesurfer.once('ready', () => {
            resolve();
        });

        const onError = (err) => {
            reject(err);
        };
        wavesurfer.once('error', onError);

        try {
            // Load audio with pre-calculated peaks (if available)
            wavesurfer.load(fileUrl, peaks ? [peaks] : undefined);
        } catch (e) {
            reject(e);
        }
    });
}

// ── Sync Markers to WaveSurfer Regions ─────────────────────

export function syncMarkersToRegions() {
    if (!regionsPlugin) return;

    // Clear existing regions
    regionsPlugin.clearRegions();

    const state = window.appState;

    // Add marker lines (thin regions)
    state.markers.forEach((time, idx) => {
        regionsPlugin.addRegion({
            id: `marker_${idx}`,
            start: time,
            end: time + 0.01,
            color: MARKER_COLOR,
            drag: true,
            resize: false,
            content: `${idx + 1}`,
        });
    });
}

window.syncMarkersToRegions = syncMarkersToRegions;

// ── Play segment ───────────────────────────────────────────

export function playSegment(startTime, endTime) {
    if (!wavesurfer) return;
    wavesurfer.setTime(startTime);
    wavesurfer.play();

    // Stop at endTime
    const checkEnd = () => {
        if (wavesurfer.getCurrentTime() >= endTime) {
            wavesurfer.pause();
            wavesurfer.un('timeupdate', checkEnd);
        }
    };
    wavesurfer.on('timeupdate', checkEnd);
}

window.playSegment = playSegment;

// ── Get WaveSurfer instance ────────────────────────────────

export function getWavesurfer() {
    return wavesurfer;
}

// ── Destroy ────────────────────────────────────────────────

export function destroyWaveform() {
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = null;
    }
}
