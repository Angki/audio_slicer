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
    $btnParse.addEventListener('click', () => {
        const text = $textarea.value;
        _parsedTracks = parseTracklist(text);
        renderPreview(_parsedTracks);
        $btnApply.disabled = _parsedTracks.length === 0;
    });

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
            const timeClass = t.time !== null ? 'preview-time' : 'preview-time text-muted';
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
                // We'll treat unparenthesized time as Start Time unless inferred otherwise.
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
    // Strategy: If explicit durations found, use Cumulative Mode for those tracks.
    // Otherwise, use Absolute Mode.

    let currentCumulativeTime = 0;

    const tracks = parsedLines.map((p, idx) => {
        let startTime = null;

        if (hasDurations || (p.isDuration && p.seconds)) {
            // Cumulative Mode Logic
            // Start time is current cumulative time
            startTime = currentCumulativeTime;

            // Advance cumulative time by this track's duration
            if (p.seconds) {
                currentCumulativeTime += p.seconds;
            } else {
                // If duration missing, we can't accurately predict next start.
                // But we still assign a start time to THIS track (end of previous).
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

        // Separators: " - ", " – " (en-dash), "Artist- Title"
        // Allow tight dashes if followed by space? Or just split by dash.
        // User example: "Putrido– Intro" (En-dash, space after)
        // We look for dash surrounded by spaces, OR attached to first word if distinct?
        // Safe regex: `\s*[-–]\s*` matches " - ", " – ", "- ", " –"
        const sepRegex = /\s*[-–]\s+/;
        const parts = p.content.split(sepRegex);

        if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }

        // Cleanup
        title = title.replace(/^[-–]\s+/, '').trim();

        // Format display string
        let displayTime = '-';
        if (p.startTime !== null && p.startTime !== undefined) {
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
    // We need at least some times > 0.
    const validTimes = tracks.filter(t => t.time !== null && t.time > 0.1);
    const hasEnoughTimes = validTimes.length > 0;

    if (replace && hasEnoughTimes) {
        // REPLACE MARKERS
        // validTimes are Split Points (Track 2 start, Track 3 start...)
        const newMarkers = validTimes.map(t => t.time).sort((a, b) => a - b);
        const uniqueMarkers = [...new Set(newMarkers)];

        window.setMarkers(uniqueMarkers);

        // Apply Metadata
        // Align tracks with markers.
        // Track 1 -> tracks[0]
        // Track 2 -> tracks[1] (starts at marker 0)
        _state.trackNames = tracks.map(t => t.title);
        _state.trackArtists = tracks.map(t => t.artist);

    } else {
        // SEQUENTIAL METADATA ONLY (No marker change)
        // Just fill in names/artists for existing tracks (or new ones if user manually adds later)
        // We populate the state arrays. AutoSlice uses index matching.
        // If user has 5 tracks defined in UI, we update 5 names.
        // If user has 0 tracks (no markers), we can't do much except store them?
        // Actually, if replace=false, we just update existing.

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
