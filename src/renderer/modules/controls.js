/**
 * AutoSlice — Controls Module
 * Detection parameters, auto-detect button, marker controls, export.
 */

import { getWavesurfer } from './waveform.js';

export function initControls(state) {
    // ── Parameter sliders ──
    const $threshold = document.getElementById('paramThreshold');
    const $thresholdVal = document.getElementById('paramThresholdVal');
    const $minSilence = document.getElementById('paramMinSilence');
    const $minSilenceVal = document.getElementById('paramMinSilenceVal');
    const $sensitivity = document.getElementById('paramSensitivity');
    const $sensitivityVal = document.getElementById('paramSensitivityVal');
    const $autoThreshold = document.getElementById('paramAutoThreshold');

    $threshold.addEventListener('input', () => {
        $thresholdVal.textContent = `${$threshold.value} dB`;
    });

    $minSilence.addEventListener('input', () => {
        const val = Number($minSilence.value);
        $minSilenceVal.textContent = val >= 1000 ? `${(val / 1000).toFixed(1)} s` : `${val} ms`;
    });

    $sensitivity.addEventListener('input', () => {
        $sensitivityVal.textContent = `${$sensitivity.value}%`;
    });

    // ── Auto Detect ──
    document.getElementById('btnAutoDetect').addEventListener('click', async () => {
        if (!state.filePath) {
            alert('No file loaded');
            return;
        }

        try {
            window.showLoading('Analyzing audio for silence gaps...');

            const params = {
                thresholdDb: Number($threshold.value),
                minDurationMs: Number($minSilence.value),
                sensitivity: Number($sensitivity.value) / 100,
                autoThreshold: $autoThreshold.checked,
            };

            const result = await window.api.detectGaps(state.filePath, params);

            // Set markers from detection result
            const markerTimes = result.markers.map(m => m.time);
            window.setMarkers(markerTimes);

            // Sync visual markers
            window.syncMarkersToRegions();

            // Show info
            const info = [
                `Found ${result.trackCount} tracks (${result.markers.length} gaps)`,
                `Effective threshold: ${result.effectiveThreshold?.toFixed(1)} dB`,
            ];
            if (result.noiseFloor !== null) {
                info.push(`Noise floor: ${result.noiseFloor?.toFixed(1)} dB`);
            }

            window.hideLoading();
        } catch (err) {
            window.hideLoading();
            console.error('Detection failed:', err);
            alert(`Detection failed: ${err.message}`);
        }
    });

    // ── Add Marker at cursor ──
    document.getElementById('btnAddMarker').addEventListener('click', () => {
        try {
            const wavesurfer = getWavesurfer();
            if (wavesurfer) {
                const time = wavesurfer.getCurrentTime();
                window.addMarker(time);
                window.syncMarkersToRegions();
            }
        } catch (e) {
            console.warn('Add marker error:', e);
        }
    });

    // ── Clear Markers ──
    document.getElementById('btnClearMarkers').addEventListener('click', () => {
        if (state.markers.length === 0) return;
        if (confirm(`Clear all ${state.markers.length} markers?`)) {
            window.clearMarkers();
            window.syncMarkersToRegions();
        }
    });

    // ── Export ──
    document.getElementById('btnExport').addEventListener('click', async () => {
        if (!state.filePath || state.markers.length === 0) {
            alert('No file loaded or no markers set');
            return;
        }

        const outputDir = await window.api.selectExportDir();
        if (!outputDir) return;

        try {
            window.showLoading('Exporting tracks...');

            const format = document.getElementById('exportFormat').value;
            const artist = document.getElementById('exportArtist').value || 'Unknown Artist';
            const album = document.getElementById('exportAlbum').value || 'Unknown Album';
            const year = document.getElementById('exportYear').value || '';

            // Gather track names and artists from the track list inputs
            const trackNameInputs = document.querySelectorAll('.track-title input');
            const trackNames = Array.from(trackNameInputs).map(input => input.value);

            const trackArtistInputs = document.querySelectorAll('.track-artist input');
            const trackArtists = Array.from(trackArtistInputs).map(input => input.value);

            const result = await window.api.exportTracks({
                inputFile: state.filePath,
                markers: state.markers,
                excludedRegions: state.excludedRegions || [],
                outputDir,
                format,
                artist,
                album,
                year,
                trackNames,
                trackArtists,
            });

            window.hideLoading();

            window.showToast(`✓ Exported ${result.tracks.length} tracks`, 'success');
            const openFolder = confirm(
                `Export complete! ${result.tracks.length} tracks saved to:\n${result.outputPath}\n\nOpen folder?`
            );
            if (openFolder) {
                window.api.openPath(result.outputPath);
            }
        } catch (err) {
            window.hideLoading();
            console.error('Export failed:', err);
            alert(`Export failed: ${err.message}`);
        }
    });
}
