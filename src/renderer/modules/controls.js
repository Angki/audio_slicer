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

    // ── Clear All Exclusions ──
    document.getElementById('btnClearExclusions').addEventListener('click', () => {
        if (!state.excludedRegions || state.excludedRegions.length === 0) return;
        if (confirm(`Clear all ${state.excludedRegions.length} excluded region(s)?`)) {
            window.clearAllExclusions();
        }
    });

    // ── Advanced Export Options ──
    const $btnToggleAdvancedExport = document.getElementById('btnToggleAdvancedExport');
    const $advancedExportOptions = document.getElementById('advancedExportOptions');
    if ($btnToggleAdvancedExport) {
        $btnToggleAdvancedExport.addEventListener('click', () => {
            $advancedExportOptions.classList.toggle('hidden');
            $btnToggleAdvancedExport.textContent = $advancedExportOptions.classList.contains('hidden') ? 'Advanced ▾' : 'Advanced ▴';
        });
    }

    const $btnSelectCover = document.getElementById('btnSelectCover');
    const $exportCoverPath = document.getElementById('exportCoverPath');
    if ($btnSelectCover) {
        $btnSelectCover.addEventListener('click', async () => {
            if (window.api.openImage) {
                const filePath = await window.api.openImage();
                if (filePath) $exportCoverPath.value = filePath;
            }
        });
    }

    // ── Export UI Elements ──
    const $exportProgressOverlay = document.getElementById('exportProgressOverlay');
    const $exportProgressBar = document.getElementById('exportProgressBar');
    const $exportProgressText = document.getElementById('exportProgressText');
    const $exportETA = document.getElementById('exportETA');
    const $exportSuccessActions = document.getElementById('exportSuccessActions');
    const $btnCopyOutputPath = document.getElementById('btnCopyOutputPath');
    const $btnOpenOutputDir = document.getElementById('btnOpenOutputDir');
    const $btnCloseExportProgress = document.getElementById('btnCloseExportProgress');
    const $btnExport = document.getElementById('btnExport');

    let exportStartTime = 0;
    let exportTotalTracks = 0;
    let currentOutputPath = '';

    if ($btnCopyOutputPath) {
        $btnCopyOutputPath.addEventListener('click', () => {
            navigator.clipboard.writeText(currentOutputPath).then(() => {
                if (window.showToast) window.showToast('Copied to clipboard', 'success');
            });
        });
    }

    if ($btnOpenOutputDir) {
        $btnOpenOutputDir.addEventListener('click', () => {
            window.api.openPath(currentOutputPath);
        });
    }

    if ($btnCloseExportProgress) {
        $btnCloseExportProgress.addEventListener('click', () => {
            if ($exportProgressOverlay) $exportProgressOverlay.classList.add('hidden');
        });
    }

    // ── Export ──
    if ($btnExport) {
        $btnExport.addEventListener('click', async () => {
            if (!state.filePath || state.markers.length === 0) {
                alert('No file loaded or no markers set');
                return;
            }

            let outputDir = '';
            if (window.api.storeGet) {
                outputDir = await window.api.storeGet('defaultOutputDir', '');
            }
            if (!outputDir) {
                outputDir = await window.api.selectExportDir();
                if (!outputDir) return;
            }

            try {
                const format = document.getElementById('exportFormat').value;
                const artist = document.getElementById('exportArtist').value || 'Unknown Artist';
                const album = document.getElementById('exportAlbum').value || 'Unknown Album';
                const year = document.getElementById('exportYear').value || '';
                const albumArtist = document.getElementById('exportAlbumArtist')?.value || '';
                const genre = document.getElementById('exportGenre')?.value || '';
                const comment = document.getElementById('exportComment')?.value || '';
                const coverArt = document.getElementById('exportCoverPath')?.value || null;
                const normalize = document.getElementById('exportNormalize')?.checked || false;
                const sampleRate = document.getElementById('exportSampleRate')?.value || null;

                // Gather track names and artists from the track list inputs
                const trackNameInputs = document.querySelectorAll('.track-title input');
                const trackNames = Array.from(trackNameInputs).map(input => input.value);

                const trackArtistInputs = document.querySelectorAll('.track-artist input');
                const trackArtists = Array.from(trackArtistInputs).map(input => input.value);

                // Listen to IPC for progress
                if (window.api.onExportInit) {
                    window.api.onExportInit((data) => {
                        exportTotalTracks = data.totalTracks;
                        exportStartTime = Date.now();
                    });
                }

                if (window.api.onExportProgress) {
                    window.api.onExportProgress((data) => {
                        if (data.type === 'start_track') {
                            $exportProgressText.textContent = `Exporting track ${data.trackNum} of ${data.totalTracks}: ${data.trackName}`;
                            $exportProgressBar.style.width = '0%';
                            $exportETA.textContent = 'Calculating ETA...';
                        } else if (data.type === 'encode_progress') {
                            $exportProgressBar.style.width = `${data.percent}%`;

                            // Calculate ETA
                            const elapsed = Date.now() - exportStartTime;
                            const tracksDoneAmount = (data.trackNum - 1) + (data.percent / 100);
                            if (tracksDoneAmount > 0) {
                                const totalEstTime = (elapsed / tracksDoneAmount) * exportTotalTracks;
                                const remaining = totalEstTime - elapsed;
                                if (remaining > 0) {
                                    const remSec = Math.max(0, Math.floor(remaining / 1000));
                                    $exportETA.textContent = `ETA: ${window.formatTime ? window.formatTime(remSec) : remSec + 's'}`;
                                } else {
                                    $exportETA.textContent = 'Finishing up...';
                                }
                            }
                        }
                    });
                }

                // Show UI
                if ($exportProgressOverlay) {
                    $exportProgressOverlay.classList.remove('hidden');
                    $exportSuccessActions.classList.add('hidden');
                    $exportProgressText.textContent = 'Starting export...';
                    $exportProgressBar.style.width = '0%';
                    $exportETA.textContent = 'Initializing...';
                }

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
                    albumArtist,
                    genre,
                    comment,
                    coverArt,
                    normalize,
                    sampleRate,
                });

                if (window.api.removeExportListeners) {
                    window.api.removeExportListeners();
                }

                currentOutputPath = result.outputPath;

                // Show Success Actions
                if ($exportProgressOverlay) {
                    $exportProgressBar.style.width = '100%';
                    $exportProgressText.textContent = `✓ Exported ${result.tracks.length} tracks successfully!`;
                    $exportETA.textContent = `Saved to: ${result.outputPath}`;
                    $exportSuccessActions.classList.remove('hidden');
                } else {
                    window.showToast(`✓ Exported ${result.tracks.length} tracks`, 'success');
                    const openFolder = confirm(`Export complete! Saved to:\n${result.outputPath}\n\nOpen folder?`);
                    if (openFolder) window.api.openPath(result.outputPath);
                }

            } catch (err) {
                if (window.api.removeExportListeners) window.api.removeExportListeners();
                if ($exportProgressOverlay) $exportProgressOverlay.classList.add('hidden');
                console.error('Export failed:', err);
                alert(`Export failed: ${err.message}`);
            }
        });
    }
}
