/**
 * AutoSlice — Smart Tracklist Import
 * Parses tracklists from text (timestamps, artists, titles).
 */

let _state = null;

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

    let _parsedTracks = [];

    // Open Modal
    if ($btnOpen) {
        $btnOpen.addEventListener('click', () => {
            $textarea.value = '';
            _parsedTracks = [];
            renderPreview([]);
            $btnApply.disabled = true;
            $modal.classList.remove('hidden');
            $textarea.focus();
        });
    }

    // Close Modal
    const closeModal = () => {
        $modal.classList.add('hidden');
    };
    $btnClose.addEventListener('click', closeModal);
    $btnCancel.addEventListener('click', closeModal);

    // Parse
    if ($btnParse) {
        $btnParse.addEventListener('click', () => {
            const text = $textarea.value;
            _parsedTracks = parseTracklist(text);
            renderPreview(_parsedTracks);
            $btnApply.disabled = _parsedTracks.length === 0;
        });
    }

    // Apply
    $btnApply.addEventListener('click', () => {
        const replace = $checkReplace.checked;
        applyTracks(_parsedTracks, replace);
        closeModal();
    });

    function renderPreview(tracks) {
        if (tracks.length === 0) {
            $preview.innerHTML = '<div class="empty-state">No tracks found or parsed</div>';
            return;
        }

        $preview.innerHTML = tracks.map(t => {
            const timeClass = (t.time !== null && !isNaN(t.time)) ? 'preview-time' : 'preview-time text-muted';
            return `
            <div class="preview-row">
                <span class="${timeClass}">${t.timeStr || '-'}</span>
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

    // Regexes
    const durationRegex = /\((\d{1,2}:\d{2}(?::\d{2})?)\)/; // (MM:SS) or (HH:MM:SS)
    const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/;        // MM:SS or HH:MM:SS (Start time assumption)

    // First pass: Parse raw data
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

        // Check for Duration in parens -> (3:45)
        const durMatch = content.match(durationRegex);
        if (durMatch) {
            timeStr = durMatch[1];
            isDuration = true;
            hasDurations = true; // Flag explicit duration mode
            content = content.replace(durMatch[0], '').trim();
        } else {
            // Check for Time Pattern -> 0:00
            const timeMatch = content.match(timeRegex);
            if (timeMatch) {
                timeStr = timeMatch[1];
                // If 0:00 is found, it strongly suggests Start Time mode, unless we are in mixed mode?
                content = content.replace(timeStr, '').trim();
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

    // Second Pass: Calculate Start Times
    // Strategy: If explicit durations found, use Cumulative Mode until broken.
    // Otherwise, use Absolute Mode.

    let currentCumulativeTime = 0;

    const tracks = parsedLines.map((p, idx) => {
        let startTime = null;

        if (hasDurations || (p.isDuration && p.seconds)) {
            // Cumulative Mode Logic
            // If previous chain is valid (currentCumulativeTime !== null), use it.
            if (currentCumulativeTime !== null) {
                startTime = currentCumulativeTime;

                // Calculate NEXT start time
                if (p.seconds) {
                    currentCumulativeTime += p.seconds;
                } else {
                    // If duration missing, we can't determine START of next track properly relative to start
                    // But we DO know start of THIS track.
                    // So break chain for NEXT iteration.
                    currentCumulativeTime = null;
                }
            } else {
                startTime = null; // Broken chain
            }
        } else {
            // Absolute Mode Logic (Start Times provided)
            startTime = p.seconds; // Can be null
        }

        return { ...p, startTime };
    });

    // Third Pass: Extract Metadata & Finalize
    return tracks.map(p => {
        let artist = '';
        let title = p.content;

        // Separators: " - ", " – ", " — ", "Artist- Title"
        // Regex allows 0 or more spaces around dash.
        // Include hyphen, en-dash, em-dash.
        const sepRegex = /\s*[-–—]\s*/;
        const parts = p.content.split(sepRegex);

        if (parts.length >= 2) {
            // Heuristic: usually Artist - Title.
            // If "Putrido– Intro", parts[0]="Putrido", parts[1]="Intro"
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }

        // Cleanup title if dash remains at start
        title = title.replace(/^[-–—]\s+/, '').trim();

        // Format display string
        let displayTime = '-';
        if (p.startTime !== null && !isNaN(p.startTime)) {
            displayTime = window.formatTime ? window.formatTime(p.startTime) : formatTimeLocal(p.startTime);
        } else if (p.isDuration) {
            displayTime = `Dur: ${p.timeStr}`;
        }

        // Filter out empty rows
        if (!title && !artist && !p.timeStr) return null;

        return {
            time: p.startTime,
            timeStr: displayTime,
            artist,
            title
        };
    }).filter(t => t !== null);
}

function applyTracks(tracks, replace) {
    // Check if we have enough valid times to replace markers
    const validTimes = tracks.filter(t => t.time !== null && !isNaN(t.time) && t.time > 0.1);
    const hasEnoughTimes = validTimes.length > 0;

    let historySnapshot = null;
    if (window.pushHistory) {
        // Create snapshot before modification
        // We'll rely on app.js history integration or manual push here if available
    }

    if (replace && hasEnoughTimes) {
        // REPLACE MARKERS
        // Apply undo history snapshot
        if (window.pushHistory) window.pushHistory('Smart Import (Replace Markers)');

        // validTimes are Split Points (Track 2 start, Track 3 start...)
        const newMarkers = validTimes.map(t => t.time).sort((a, b) => a - b);
        const uniqueMarkers = [...new Set(newMarkers)];

        // Pass true to skip internal history push in setMarkers
        if (window.setMarkers) window.setMarkers(uniqueMarkers, true);

        // Apply Metadata
        _state.trackNames = tracks.map(t => t.title);
        _state.trackArtists = tracks.map(t => t.artist);

    } else {
        // SEQUENTIAL METADATA ONLY
        if (window.pushHistory) window.pushHistory('Smart Import (Metadata Only)');

        const count = Math.min(tracks.length, _state.markers.length + 1);
        for (let i = 0; i < count; i++) {
            _state.trackNames[i] = tracks[i].title;
            if (tracks[i].artist) {
                _state.trackArtists[i] = tracks[i].artist;
            }
        }
    }

    // Refresh UI
    if (window._tracklistModule) {
        window._tracklistModule.updateTracklist(_state);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimeLocal(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
