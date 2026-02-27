// We'll load WaveSurfer from local lib files
import WaveSurfer from '../lib/wavesurfer.esm.js';
import RegionsPlugin from '../lib/regions.esm.js';
import SpectrogramPlugin from '../lib/spectrogram.esm.js';
import TimelinePlugin from '../lib/timeline.esm.js';
import MinimapPlugin from '../lib/minimap.esm.js';
import { getThemeColors } from './settings.js';

let wavesurfer = null;
let regionsPlugin = null;
let spectrogramPlugin = null;
let spectrogramVisible = false;

// ── Exclude mode (E key toggle) ─────────────────────────────
let excludeMode = false;

const MARKER_COLOR = 'rgba(124, 92, 252, 0.7)';
const MARKER_HOVER_COLOR = 'rgba(167, 139, 250, 0.9)';
const EXCLUDED_COLOR = 'rgba(239, 68, 68, 0.4)';
const EXCLUDED_ACTIVE_COLOR = 'rgba(239, 68, 68, 0.65)';

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

    const theme = getThemeColors();

    wavesurfer = WaveSurfer.create({
        container,
        media, // Use media element backend
        waveColor: theme.waveColor,
        progressColor: theme.progressColor,
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
                height: 20,
                timeInterval: 10,
                primaryLabelInterval: 30,
                style: {
                    fontSize: '10px',
                    color: '#55556a',
                },
            }),
            MinimapPlugin.create({
                height: 40,
                waveColor: theme.waveColor,
                progressColor: theme.progressColor,
                overlayColor: 'rgba(124, 92, 252, 0.2)'
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

        // Sync active track row highlight to playback position
        _syncActiveTrackHighlight(time);
    });

    wavesurfer.on('ready', () => {
        const duration = wavesurfer.getDuration();
        document.getElementById('totalTime').textContent = window.formatTime(duration);
        _updateExcludedSummary();
    });

    // ── Enable Drag Selection for Excluded Regions ──
    // Only drag-select when in exclude mode
    regionsPlugin.enableDragSelection({
        color: EXCLUDED_COLOR,
    });

    regionsPlugin.on('region-created', (region) => {
        if (!region.id.startsWith('marker_') && !region.id.startsWith('excluded_')) {
            // It's a newly drag-selected region — only keep if in exclude mode
            if (!excludeMode) {
                region.remove();
                return;
            }
            region.id = `excluded_${Date.now()}`;
            region.setOptions({ content: 'EXCLUDED' });
        }
    });

    // ── Region events (marker dragging) ──
    let isDragging = false;

    regionsPlugin.on('region-updated', (region) => {
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
            if (newTime < minTime) newTime = minTime;
            if (newTime > maxTime) newTime = maxTime;

            if (Math.abs(newTime - region.start) > 0.0001) {
                region.setOptions({ start: newTime, end: newTime + 0.01 });
            }

            state.markers[markerIdx] = newTime;

            const { updateTracklist } = window._tracklistModule || {};
            if (updateTracklist) updateTracklist(state);
        } else if (region.id.startsWith('excluded_')) {
            _mergeOverlappingExclusions(region);
            updateExcludedRegionsState();
            _updateExcludedSummary();
        }
    });

    regionsPlugin.on('region-update-end', (region) => {
        isDragging = false;
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
    const $btnZoomFit = document.getElementById('btnZoomFit');

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

    // Zoom Fit: scale waveform to fit entire audio in container
    if ($btnZoomFit) {
        $btnZoomFit.addEventListener('click', () => {
            const containerWidth = document.getElementById('waveformContainer').clientWidth;
            const duration = wavesurfer.getDuration();
            if (!duration) return;
            const pxPerSec = Math.floor(containerWidth / duration);
            const val = Math.max(1, Math.min(pxPerSec, 500));
            $zoomSlider.value = val;
            wavesurfer.zoom(val);
        });
    }

    // ── Ctrl+Scroll to zoom ──
    document.getElementById('waveformContainer').addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -15 : 15;
        const val = Math.max(1, Math.min(Number($zoomSlider.value) + delta, 500));
        $zoomSlider.value = val;
        wavesurfer.zoom(val);
    }, { passive: false });

    // ── Time tooltip on waveform hover ──
    const $tooltip = document.getElementById('waveformTooltip');
    const $waveformContainer = document.getElementById('waveformContainer');

    if ($tooltip) {
        $waveformContainer.addEventListener('mousemove', (e) => {
            if (!wavesurfer || !wavesurfer.getDuration()) return;
            const scrollWrapper = wavesurfer.getWrapper().parentElement;
            const rect = scrollWrapper.getBoundingClientRect();

            // Calculate absolute X position within the scrolled content
            const xOnWaveform = (e.clientX - rect.left) + scrollWrapper.scrollLeft;
            const relX = Math.max(0, Math.min(1, xOnWaveform / scrollWrapper.scrollWidth));

            const time = relX * wavesurfer.getDuration();
            $tooltip.textContent = window.formatTime(time);
            $tooltip.style.left = `${e.clientX - rect.left + 10}px`;
            $tooltip.style.opacity = '1';
        });

        $waveformContainer.addEventListener('mouseleave', () => {
            $tooltip.style.opacity = '0';
        });
    }

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
        const time = relativeX * wavesurfer.getDuration();

        // Expand the hit zone tolerance for excluded region detection
        const TOLERANCE_SEC = 1.5;
        const regions = regionsPlugin.getRegions();
        const clickedExclusion = regions.find(r =>
            r.id.startsWith('excluded_') &&
            time >= r.start - TOLERANCE_SEC &&
            time <= r.end + TOLERANCE_SEC
        );

        if (clickedExclusion) {
            if (confirm('Remove this excluded region?')) {
                if (window.pushHistory) window.pushHistory('Remove Excluded Region');
                clickedExclusion.remove();
                updateExcludedRegionsState();
                _updateExcludedSummary();
            }
        } else {
            window.addMarker(time);
            syncMarkersToRegions();
        }
    });

    // ── E key to toggle exclude mode ──
    document.addEventListener('keydown', _handleKeydown);
}

// ── Keydown handler (defined separately for cleaner re-use) ──
function _handleKeydown(e) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (wavesurfer) wavesurfer.playPause();
            break;
        case 'KeyM':
            e.preventDefault();
            if (wavesurfer) {
                const time = wavesurfer.getCurrentTime();
                window.addMarker(time);
                syncMarkersToRegions();
            }
            break;
        case 'KeyE':
            e.preventDefault();
            _toggleExcludeMode();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (wavesurfer) wavesurfer.skip(-5);
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (wavesurfer) wavesurfer.skip(5);
            break;
        case 'Home':
            e.preventDefault();
            if (wavesurfer) wavesurfer.setTime(0);
            break;
        case 'End':
            e.preventDefault();
            if (wavesurfer) wavesurfer.setTime(wavesurfer.getDuration());
            break;
        case 'Delete': {
            e.preventDefault();
            const state = window.appState;
            if (!wavesurfer || !state || state.markers.length === 0) break;
            const curTime = wavesurfer.getCurrentTime();
            let closestIdx = 0;
            let closestDist = Math.abs(state.markers[0] - curTime);
            state.markers.forEach((m, i) => {
                const d = Math.abs(m - curTime);
                if (d < closestDist) { closestDist = d; closestIdx = i; }
            });
            if (closestDist < 10) {
                window.removeMarker(closestIdx);
                syncMarkersToRegions();
            }
            break;
        }
    }
}

// ── Exclude mode toggle ──────────────────────────────────────

function _toggleExcludeMode() {
    excludeMode = !excludeMode;
    const $badge = document.getElementById('excludeModeBadge');
    const $wc = document.getElementById('waveformContainer');
    if ($badge) {
        $badge.textContent = excludeMode ? '⛔ EXCLUDE MODE' : '';
        $badge.style.display = excludeMode ? '' : 'none';
    }
    if ($wc) {
        $wc.classList.toggle('exclude-mode-active', excludeMode);
    }
    window.showToast && window.showToast(
        excludeMode ? 'Exclude mode ON — drag to mark regions' : 'Exclude mode OFF',
        excludeMode ? 'warning' : 'info',
        2000
    );
}

export function isExcludeMode() {
    return excludeMode;
}

// ── Merge overlapping exclusions ────────────────────────────

function _mergeOverlappingExclusions(draggedRegion) {
    if (!regionsPlugin) return;
    const regions = regionsPlugin.getRegions().filter(r => r.id.startsWith('excluded_'));

    for (const other of regions) {
        if (other.id === draggedRegion.id) continue;
        // Check overlap
        if (draggedRegion.start < other.end && draggedRegion.end > other.start) {
            // Merge into draggedRegion
            const newStart = Math.min(draggedRegion.start, other.start);
            const newEnd = Math.max(draggedRegion.end, other.end);
            draggedRegion.setOptions({ start: newStart, end: newEnd });
            other.remove();
        }
    }
}

// ── Excluded duration summary ────────────────────────────────

function _updateExcludedSummary() {
    const state = window.appState;
    const $summary = document.getElementById('excludedDurationSummary');
    if (!$summary) return;

    const regions = state && state.excludedRegions ? state.excludedRegions : [];
    if (regions.length === 0) {
        $summary.textContent = '';
        $summary.style.display = 'none';
        return;
    }

    const total = regions.reduce((sum, r) => sum + (r.end - r.start), 0);
    $summary.textContent = `${regions.length} excluded · ${window.formatDuration ? window.formatDuration(total) : total.toFixed(1) + 's'} total`;
    $summary.style.display = '';
}

window.updateExcludedSummary = _updateExcludedSummary;

// ── Sync active track highlight to playback position ─────────

function _syncActiveTrackHighlight(time) {
    const state = window.appState;
    if (!state || !state.audioInfo) return;

    const markers = state.markers;
    const duration = state.audioInfo.duration;
    let activeIdx = markers.length; // Last track by default

    for (let i = 0; i < markers.length; i++) {
        if (time < markers[i]) {
            activeIdx = i;
            break;
        }
    }

    const rows = document.querySelectorAll('#trackList .track-row');
    rows.forEach((row, idx) => {
        if (idx === activeIdx) {
            row.classList.add('playing');
        } else {
            row.classList.remove('playing');
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
            wavesurfer.load(fileUrl, peaks ? [peaks] : undefined);
        } catch (e) {
            reject(e);
        }
    });
}

// ── Sync Markers to WaveSurfer Regions ─────────────────────

export function syncMarkersToRegions() {
    if (!regionsPlugin) return;

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
                content: 'EXCLUDED',
            });
        });
    }

    _updateExcludedSummary();
}

export function updateExcludedRegionsState() {
    const state = window.appState;
    if (!state) return;

    const regions = regionsPlugin.getRegions();
    state.excludedRegions = regions
        .filter(r => r.id.startsWith('excluded_'))
        .map(r => ({ start: r.start, end: r.end }))
        .sort((a, b) => a.start - b.start);
}

window.syncMarkersToRegions = syncMarkersToRegions;
window.updateExcludedRegionsState = updateExcludedRegionsState;

// ── Clear All Exclusions ────────────────────────────────────

export function clearAllExclusions() {
    if (!regionsPlugin) return;
    if (window.pushHistory) window.pushHistory('Clear All Exclusions');

    const regions = regionsPlugin.getRegions();
    regions.filter(r => r.id.startsWith('excluded_')).forEach(r => r.remove());

    const state = window.appState;
    if (state) state.excludedRegions = [];

    _updateExcludedSummary();
}

window.clearAllExclusions = clearAllExclusions;

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

// ── Seek waveform to time ──────────────────────────────────

export function seekTo(time) {
    if (!wavesurfer) return;
    wavesurfer.setTime(time);
}

window.seekTo = seekTo;

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
    regionsPlugin = null;
    spectrogramPlugin = null;
    spectrogramVisible = false;
    excludeMode = false;
    document.removeEventListener('keydown', _handleKeydown);
}
