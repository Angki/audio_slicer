/**
 * AutoSlice — Smart Tracklist Import
 * Parses tracklists from text (timestamps, artists, titles).
 */

let _state = null;
const HISTORY_KEY = 'autoslice_smart_import_history';
const MAX_HISTORY = 5;

export function initSmartImport(state) {
    _state = state;

    const $modal = document.getElementById('smartImportModal');
    const $btnOpen = document.getElementById('btnSmartImport');
    const $btnClose = document.getElementById('btnCloseSmartImport');
    const $btnCancel = document.getElementById('btnCancelSmartImport');
    const $btnApply = document.getElementById('btnApplySmartImport');
    const $btnParse = document.getElementById('btnParseSmartImport');
    const $textarea = document.getElementById('smartImportText');
    const $preview = document.getElementById('smartImportPreview');
    const $checkReplace = document.getElementById('checkSmartImportReplace');
    const $checkAppend = document.getElementById('checkSmartImportAppend');
    const $spinner = $btnParse ? $btnParse.querySelector('.spinner') : null;
    const $parseText = $btnParse ? $btnParse.querySelector('.btn-text') : null;
    const $trackCount = document.getElementById('smartImportTrackCount');
    const $historySelect = document.getElementById('smartImportHistory');
    const $btnCopy = document.getElementById('btnCopyTracklist');

    let _parsedTracks = [];

    // Load History
    const loadHistory = () => {
        try {
            const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            if (hist.length > 0 && $historySelect) {
                $historySelect.innerHTML = '<option value="">Recent Imports...</option>' +
                    hist.map((h, i) => `<option value="${i}">${h.date} - ${h.tracks} tracks</option>`).join('');
                $historySelect.style.display = 'block';
            } else if ($historySelect) {
                $historySelect.style.display = 'none';
            }
        } catch (e) { console.error('History load error', e); }
    };

    const saveHistory = (text, numTracks) => {
        if (!text.trim() || numTracks === 0) return;
        try {
            let hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

            // Check if exact same text is already first, don't duplicate
            if (hist.length > 0 && hist[0].text === text) return;

            hist.unshift({ date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text, tracks: numTracks });
            if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
            loadHistory();
        } catch (e) { }
    };

    if ($historySelect) {
        $historySelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === '') return;
            try {
                const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
                if (hist[val]) {
                    $textarea.value = hist[val].text;
                    if ($btnParse) $btnParse.click();
                }
            } catch (e) { }
            $historySelect.value = '';
        });
    }

    // Copy to clipboard
    if ($btnCopy) {
        $btnCopy.addEventListener('click', () => {
            if (_parsedTracks.length === 0) {
                if (window.showToast) window.showToast('No tracks parsed yet', 'error');
                return;
            }
            const txt = _parsedTracks.map(t => `${t.timeStr} ${t.artist ? t.artist + ' - ' : ''}${t.title}`).join('\n');
            navigator.clipboard.writeText(txt).then(() => {
                if (window.showToast) window.showToast('Tracklist copied to clipboard', 'success');
            });
        });
    }

    // Drag & Drop files into textarea
    if ($textarea) {
        $textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            $textarea.style.border = '2px dashed var(--accent)';
        });
        $textarea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            $textarea.style.border = '';
        });
        $textarea.addEventListener('drop', async (e) => {
            e.preventDefault();
            $textarea.style.border = '';
            const file = e.dataTransfer.files[0];
            if (file) {
                if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.cue')) {
                    try {
                        const text = await file.text();
                        // Strip BOM
                        $textarea.value = text.replace(/^\uFEFF/, '');
                        if ($btnParse) $btnParse.click();
                        if (window.showToast) window.showToast(`Loaded ${file.name}`, 'success');
                    } catch (err) {
                        alert('Could not read file: ' + err.message);
                    }
                } else {
                    if (window.showToast) window.showToast('Only .txt and .cue files are supported.', 'error');
                }
            }
        });
    }

    // Open Modal
    if ($btnOpen) {
        $btnOpen.addEventListener('click', () => {
            $textarea.value = localStorage.getItem('smart_import_draft') || '';
            _parsedTracks = [];
            loadHistory();
            renderPreview([]);

            if ($btnApply) $btnApply.disabled = true;
            if ($trackCount) $trackCount.style.display = 'none';
            if ($modal) $modal.classList.remove('hidden');
            if ($textarea) $textarea.focus();

            if ($textarea.value.trim() && $btnParse) {
                $btnParse.click();
            }
        });
    }

    // Save draft on input
    if ($textarea) {
        $textarea.addEventListener('input', () => {
            localStorage.setItem('smart_import_draft', $textarea.value);
        });
    }

    // Close Modal
    const closeModal = () => {
        if ($modal) $modal.classList.add('hidden');
    };
    if ($btnClose) $btnClose.addEventListener('click', closeModal);
    if ($btnCancel) $btnCancel.addEventListener('click', closeModal);

    // Parse
    if ($btnParse) {
        $btnParse.addEventListener('click', () => {
            let text = $textarea.value.replace(/^\uFEFF/, ''); // Strip BOM
            if (!text.trim()) {
                renderPreview([]);
                if ($trackCount) $trackCount.style.display = 'none';
                if ($btnApply) $btnApply.disabled = true;
                return;
            }

            if ($spinner) $spinner.classList.remove('hidden');
            if ($parseText) $parseText.textContent = 'Parsing...';
            $btnParse.disabled = true;

            // Timeout to allow UI layout frame
            setTimeout(() => {
                _parsedTracks = parseTracklist(text);
                renderPreview(_parsedTracks);

                if ($btnApply) $btnApply.disabled = _parsedTracks.length === 0;

                if ($spinner) $spinner.classList.add('hidden');
                if ($parseText) $parseText.textContent = 'Parse';
                $btnParse.disabled = false;

                if ($trackCount) {
                    $trackCount.textContent = `${_parsedTracks.length} track${_parsedTracks.length !== 1 ? 's' : ''}`;
                    $trackCount.style.display = 'inline';
                }

                // Warn duration
                if (_state && _state.audioInfo && _state.audioInfo.duration > 0) {
                    const lastTrack = _parsedTracks[_parsedTracks.length - 1];
                    if (lastTrack && lastTrack.time > _state.audioInfo.duration) {
                        if (window.showToast) window.showToast('Warning: Imported track time exceeds audio duration!', 'error');
                    }
                }

            }, 50); // fake delay
        });
    }

    // Apply
    if ($btnApply) {
        $btnApply.addEventListener('click', () => {
            const replace = $checkReplace ? $checkReplace.checked : true;
            applyTracks(_parsedTracks, replace);
            saveHistory($textarea.value, _parsedTracks.length);
            localStorage.setItem('smart_import_draft', ''); // Clear draft on apply
            closeModal();
            if (window.showToast) window.showToast(`Imported ${_parsedTracks.length} tracks`, 'success');
        });
    }

    function renderPreview(tracks) {
        if (tracks.length === 0) {
            $preview.innerHTML = '<div class="empty-state">No tracks found or parsed. Make sure you have valid timestamps.</div>';
            return;
        }

        $preview.innerHTML = tracks.map(t => {
            let timeClass = (t.time !== null && !isNaN(t.time)) ? 'preview-time' : 'preview-time text-muted';
            // highlight if exceeding audio dur
            let isExceeded = false;
            if (_state && _state.audioInfo && t.time > _state.audioInfo.duration) {
                timeClass += ' preview-exceeds';
                isExceeded = true;
            }
            return `
            <div class="preview-row">
                <span class="${timeClass}" style="${isExceeded ? 'color: var(--danger);' : ''}">${t.timeStr || '-'}</span>
                <span class="preview-artist" title="${escapeHtml(t.artist || '')}">${escapeHtml(t.artist || '')}</span>
                <span class="preview-title" title="${escapeHtml(t.title || '')}">${escapeHtml(t.title || '')}</span>
            </div>
        `}).join('');
    }
}

/**
 * Parse text into array of { time: number|null, timeStr: string|null, artist: string, title: string }
 */
export function parseTracklist(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    // Check if it's a CUE sheet
    if (lines.some(l => l.trim().startsWith('FILE ') || l.trim().startsWith('TRACK ') || l.trim().startsWith('INDEX 01'))) {
        return parseCueSheet(lines);
    }

    // Regexes
    const durationRegex = /\((\d{1,2}:\d{2}(?::\d{2})?)\)/; // (MM:SS) or (HH:MM:SS)
    const timeRegex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/;        // MM:SS or [MM:SS] (Start time)
    const trailingDurationRegex = /[-–—|]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*$/; // Track - Name - 3:45

    let hasDurations = false;

    const parsedLines = lines.map(line => {
        let content = line.trim();

        // Remove numbering (1. , 01. , 1 - , 1 )
        const numberingMatch = content.match(/^\d+[\.\)\-]?\s+/);
        if (numberingMatch) {
            content = content.replace(numberingMatch[0], '');
        }

        let timeStr = null;
        let seconds = null;
        let isDuration = false;

        // Check trailing duration
        const trailMatch = content.match(trailingDurationRegex);
        if (trailMatch) {
            timeStr = trailMatch[1];
            isDuration = true;
            hasDurations = true;
            content = content.replace(trailMatch[0], '').trim();
        }
        else {
            // Check for Duration in parens
            const durMatch = content.match(durationRegex);
            if (durMatch) {
                timeStr = durMatch[1];
                isDuration = true;
                hasDurations = true;
                content = content.replace(durMatch[0], '').trim();
            } else {
                // Check for Time Pattern (e.g., [0:00], 0:00)
                const timeMatch = content.match(timeRegex);
                if (timeMatch) {
                    timeStr = timeMatch[1]; // Get inside group
                    content = content.replace(timeMatch[0], '').trim();
                }
            }
        }

        if (timeStr) {
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) {
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else {
                seconds = parts[0] * 60 + parts[1];
            }
        }

        return { content, timeStr, seconds, isDuration };
    });

    let currentCumulativeTime = 0;

    const tracks = parsedLines.map((p, idx) => {
        let startTime = null;

        if (hasDurations || (p.isDuration && p.seconds)) {
            if (currentCumulativeTime !== null) {
                startTime = currentCumulativeTime;
                if (p.seconds) {
                    currentCumulativeTime += p.seconds;
                } else {
                    currentCumulativeTime = null;
                }
            } else {
                startTime = null;
            }
        } else {
            startTime = p.seconds;
        }

        return { ...p, startTime };
    });

    return tracks.map(p => {
        let artist = '';
        let title = p.content;

        const sepRegex = /\s*[-–—]\s*/;
        const parts = p.content.split(sepRegex);

        if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }

        title = title.replace(/^[-–—]\s+/, '').trim();

        let displayTime = '-';
        if (p.startTime !== null && !isNaN(p.startTime)) {
            displayTime = window.formatTime ? window.formatTime(p.startTime) : formatTimeLocal(p.startTime);
        } else if (p.isDuration) {
            displayTime = `Dur: ${p.timeStr}`;
        }

        if (!title && !artist && !p.timeStr) return null;

        return {
            time: p.startTime,
            timeStr: displayTime,
            artist,
            title
        };
    }).filter(t => t !== null);
}

function parseCueSheet(lines) {
    const tracks = [];
    let currentTrack = null;
    let globalPerformer = '';

    for (const line of lines) {
        const tLine = line.trim();
        if (tLine.startsWith('PERFORMER')) {
            const match = tLine.match(/PERFORMER\s+"?(.+?)"?$/);
            if (match && !currentTrack) {
                globalPerformer = match[1];
            } else if (match && currentTrack) {
                currentTrack.artist = match[1];
            }
        } else if (tLine.startsWith('TRACK')) {
            if (currentTrack) tracks.push(currentTrack);
            currentTrack = { title: '', artist: globalPerformer, time: null, timeStr: null };
        } else if (tLine.startsWith('TITLE') && currentTrack) {
            const match = tLine.match(/TITLE\s+"?(.+?)"?$/);
            if (match) currentTrack.title = match[1];
        } else if (tLine.startsWith('INDEX 01') && currentTrack) {
            const match = tLine.match(/INDEX 01\s+(\d{2}):(\d{2}):(\d{2})/);
            if (match) {
                const m = parseInt(match[1]);
                const s = parseInt(match[2]);
                const f = parseInt(match[3]);
                currentTrack.time = (m * 60) + s + (f / 75); // CUE frames are 1/75s
                currentTrack.timeStr = formatTimeLocal(currentTrack.time);
            }
        }
    }
    if (currentTrack) tracks.push(currentTrack);
    return tracks;
}

function applyTracks(tracks, replace) {
    // Ignore marker placements at the very start of the file (< 0.1s)
    const validTimes = tracks.filter(t => t.time !== null && !isNaN(t.time) && t.time >= 0.1);
    const hasEnoughTimes = validTimes.length > 0;

    if (replace && hasEnoughTimes) {
        if (window.pushHistory) window.pushHistory('Smart Import (Replace)');

        const newMarkers = validTimes.map(t => t.time).sort((a, b) => a - b);
        const uniqueMarkers = [...new Set(newMarkers)];

        if (window.setMarkers) window.setMarkers(uniqueMarkers, true);

        // Map to exact track count (N markers = N+1 tracks usually, but let's just use exact)
        _state.trackNames = tracks.map(t => t.title);
        _state.trackArtists = tracks.map(t => t.artist);

    } else if (!replace && hasEnoughTimes) {
        // APPEND MODE
        if (window.pushHistory) window.pushHistory('Smart Import (Append)');

        const newMarkers = validTimes.map(t => t.time);
        const combinedMarkers = [..._state.markers, ...newMarkers].sort((a, b) => a - b);
        const uniqueMarkers = [...new Set(combinedMarkers)];

        if (window.setMarkers) window.setMarkers(uniqueMarkers, true);

        _state.trackNames = [..._state.trackNames, ...tracks.map(t => t.title)];
        _state.trackArtists = [..._state.trackArtists, ...tracks.map(t => t.artist)];

    } else {
        if (window.pushHistory) window.pushHistory('Smart Import (Metadata Only)');

        const count = Math.min(tracks.length, _state.markers.length + 1);
        for (let i = 0; i < count; i++) {
            _state.trackNames[i] = tracks[i].title;
            if (tracks[i].artist) {
                _state.trackArtists[i] = tracks[i].artist;
            }
        }
    }

    if (window._tracklistModule) {
        window._tracklistModule.updateTracklist(_state);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimeLocal(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
