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
const EXCLUDED_COLOR = 'rgba(239, 68, 68, 0.5)'; // Tailwind red-500 with opacity

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

    // ── Enable Drag Selection for Excluded Regions ──
    regionsPlugin.enableDragSelection({
        color: EXCLUDED_COLOR,
    });

    regionsPlugin.on('region-created', (region) => {
        // If it was created without an ID starting with 'marker_', it's an excluded region
        if (!region.id.startsWith('marker_') && !region.id.startsWith('excluded_')) {
            // It's a newly drag-selected region
            region.id = `excluded_${Date.now()}`;
        }
    });

    // ── Region events (marker dragging) ──
    // ── Region events (marker dragging) ──
    let isDragging = false;

    regionsPlugin.on('region-updated', (region) => {
        // Push history on start of drag
        if (!isDragging) {
            if (window.pushHistory) window.pushHistory('Move Marker');
            isDragging = true;
        }

        const state = window.appState;
        const markerIdx = parseInt(region.id?.replace('marker_', ''));

        if (!isNaN(markerIdx) && markerIdx < state.markers.length) {
            // Constraint Logic (prevent overlap)
            let minTime = 0.0;
            let maxTime = wavesurfer.getDuration();

            if (markerIdx > 0) {
                minTime = state.markers[markerIdx - 1] + 0.1;
            }
            if (markerIdx < state.markers.length - 1) {
                maxTime = state.markers[markerIdx + 1] - 0.1;
            }

            let newTime = region.start;
            // Clamp
            if (newTime < minTime) newTime = minTime;
            if (newTime > maxTime) newTime = maxTime;

            // Apply clamp if needed
            if (Math.abs(newTime - region.start) > 0.0001) {
                region.setOptions({ start: newTime, end: newTime + 0.01 });
            }

            state.markers[markerIdx] = newTime;
            // No sorting here to maintain ID->Index mapping!

            const { updateTracklist } = window._tracklistModule || {};
            if (updateTracklist) updateTracklist(state);
        } else if (region.id.startsWith('excluded_')) {
            // Excluded region updated (dragged or resized)
            updateExcludedRegionsState();
        }
    });

    regionsPlugin.on('region-update-end', (region) => {
        isDragging = false;
    });

    // ── Delete Excluded Region on Double Click ──
    regionsPlugin.on('region-clicked', (region, e) => {
        if (region.id.startsWith('excluded_')) {
            // E.g., double click or shift+click to delete? Let's use double click.
            // Actually, Wavesurfer handles double click on region via dblclick event, but region-clicked might suffice if we track time,
            // or we use region-in/out.
            // Let's listen to standard double click and see if it hits a region.
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

    // ── Double click handlers ──
    wavesurfer.on('dblclick', (relativeX) => {
        // Did we click on an excluded region?
        const time = relativeX * wavesurfer.getDuration();

        // Find if clicked inside an excluded region
        const regions = regionsPlugin.getRegions();
        const clickedExclusion = regions.find(r => r.id.startsWith('excluded_') && time >= r.start && time <= r.end);

        if (clickedExclusion) {
            // Delete the excluded region
            if (window.pushHistory) window.pushHistory('Remove Excluded Region');
            clickedExclusion.remove();
            updateExcludedRegionsState();
        } else {
            // Add a normal marker
            window.addMarker(time);
            syncMarkersToRegions();
        }
    });

    // ── Global Keyboard Shortcuts ──
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input field
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                wavesurfer.playPause();
                break;
            case 'KeyM':
                e.preventDefault();
                const time = wavesurfer.getCurrentTime();
                window.addMarker(time);
                syncMarkersToRegions();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                wavesurfer.skip(-5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                wavesurfer.skip(5);
                break;
        }
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

    // Add excluded regions
    if (state.excludedRegions) {
        state.excludedRegions.forEach((reg, idx) => {
            regionsPlugin.addRegion({
                id: `excluded_${idx}`,
                start: reg.start,
                end: reg.end,
                color: EXCLUDED_COLOR,
                drag: true,
                resize: true,
            });
        });
    }
}

function updateExcludedRegionsState() {
    const state = window.appState;
    if (!state) return;

    const regions = regionsPlugin.getRegions();
    state.excludedRegions = regions
        .filter(r => r.id.startsWith('excluded_'))
        .map(r => ({ start: r.start, end: r.end }))
        .sort((a, b) => a.start - b.start);
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
