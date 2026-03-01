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

    const $exportProgressOverlay = document.getElementById('exportProgressOverlay');
    const $exportProgressContainer = document.getElementById('exportProgressContainer');
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

    const $uiThemeSelect = document.getElementById('uiThemeSelect');
    if ($uiThemeSelect) {
        const savedTheme = localStorage.getItem('autoslice-theme') || 'dark';
        $uiThemeSelect.value = savedTheme;
        if (savedTheme !== 'dark') {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }

        $uiThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            if (theme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            localStorage.setItem('autoslice-theme', theme);
        });
    }

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

            // Dictionary to hold dynamically created progress bar elements
            const progressBars = {};
            let completedTracks = 0;
            let exportTotalTracks = 0;
            let exportStartTime = 0;

            // Listen to IPC for progress
            if (window.api.onExportInit) {
                window.api.onExportInit((data) => {
                    exportTotalTracks = data.totalTracks;
                    exportStartTime = Date.now();
                    if ($exportProgressContainer) $exportProgressContainer.innerHTML = ''; // clear previous
                });
            }

            if (window.api.onExportProgress) {
                window.api.onExportProgress((data) => {
                    if (!$exportProgressContainer) return;

                    if (data.type === 'start_track') {
                        // Create a new progress element for this track
                        const barWrapper = document.createElement('div');
                        barWrapper.style.marginBottom = '5px';
                        barWrapper.style.display = 'flex';
                        barWrapper.style.flexDirection = 'column';
                        barWrapper.style.gap = '2px';

                        const label = document.createElement('div');
                        label.style.fontSize = '0.85em';
                        label.style.display = 'flex';
                        label.style.justifyContent = 'space-between';
                        label.innerHTML = `<span><strong style="color:var(--accent)">#${data.trackNum}</strong> ${data.trackName}</span> <span class="pct">0%</span>`;

                        const trackContainer = document.createElement('div');
                        trackContainer.style.background = 'rgba(255,255,255,0.1)';
                        trackContainer.style.height = '6px';
                        trackContainer.style.borderRadius = '3px';
                        trackContainer.style.overflow = 'hidden';

                        const fill = document.createElement('div');
                        fill.style.width = '0%';
                        fill.style.height = '100%';
                        fill.style.background = 'var(--accent)';
                        fill.style.transition = 'width 0.2s';

                        trackContainer.appendChild(fill);
                        barWrapper.appendChild(label);
                        barWrapper.appendChild(trackContainer);

                        $exportProgressContainer.appendChild(barWrapper);

                        // Save refs
                        progressBars[data.trackNum] = { fill, label: label.querySelector('.pct') };

                        // Scroll container to bottom
                        $exportProgressContainer.scrollTop = $exportProgressContainer.scrollHeight;

                    } else if (data.type === 'encode_progress') {
                        const bar = progressBars[data.trackNum];
                        if (bar) {
                            bar.fill.style.width = `${data.percent}%`;
                            bar.label.textContent = `${Math.round(data.percent)}%`;

                            if (data.percent >= 100 && !bar.completed) {
                                bar.completed = true;
                                bar.fill.style.background = '#10b981'; // Turn green when done
                                completedTracks++;
                            }
                        }

                        // Calculate Overall ETA
                        const elapsed = Date.now() - exportStartTime;

                        // Estimate total percentage across all tracks
                        let totalPercentAcc = 0;
                        for (const num in progressBars) {
                            totalPercentAcc += parseFloat(progressBars[num].fill.style.width) || 0;
                        }
                        const totalOverallPercent = totalPercentAcc / exportTotalTracks;

                        if (totalOverallPercent > 0) {
                            const totalEstTime = (elapsed / totalOverallPercent) * 100;
                            const remaining = totalEstTime - elapsed;
                            if (remaining > 0) {
                                const remSec = Math.max(0, Math.floor(remaining / 1000));
                                $exportETA.textContent = `ETA: ${window.formatTime ? window.formatTime(remSec) : remSec + 's'} | ${completedTracks}/${exportTotalTracks} done`;
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
                if ($exportSuccessActions) $exportSuccessActions.classList.add('hidden');
                if ($exportProgressText) $exportProgressText.textContent = 'Exporting Tracks...';
                if ($exportProgressContainer) $exportProgressContainer.innerHTML = '';
                if ($exportETA) $exportETA.textContent = 'Initializing Export Engine...';
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
                discogsImages: state.discogsImages || [],
                discogsToken: state.discogsToken || ''
            });

            if (window.api.removeExportListeners) {
                window.api.removeExportListeners();
            }

            currentOutputPath = result.outputPath;

            // Finalize UI presentation
            if ($exportETA) $exportETA.textContent = 'Export Completed Successfully! 🎉';
            if ($exportProgressContainer) {
                const allBars = $exportProgressContainer.querySelectorAll('div[style*="background: var(--accent)"]');
                allBars.forEach(b => b.style.background = '#10b981'); // Ensure everything remaining turns green
            }
            // Show Success Actions
            if ($exportProgressOverlay) {
                if ($exportProgressText) $exportProgressText.textContent = `✓ Exported ${result.tracks.length} tracks successfully!`;
                if ($exportETA) $exportETA.textContent = `Saved to: ${result.outputPath}`;
                if ($exportSuccessActions) $exportSuccessActions.classList.remove('hidden');
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
