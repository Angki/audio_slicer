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
    $btnOpen.addEventListener('click', () => {
        $textarea.value = '';
        _parsedTracks = [];
        renderPreview([]);
        $btnApply.disabled = true;
        $modal.classList.remove('hidden');
        $textarea.focus();
    });

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

        $preview.innerHTML = tracks.map(t => `
            <div class="preview-row">
                <span class="preview-time">${t.timeStr || '-'}</span>
                <span class="preview-artist" title="${escapeHtml(t.artist || '')}">${escapeHtml(t.artist || '')}</span>
                <span class="preview-title" title="${escapeHtml(t.title || '')}">${escapeHtml(t.title || '')}</span>
            </div>
        `).join('');
    }
}

/**
 * Parse text into array of { time: number|null, timeStr: string|null, artist: string, title: string }
 */
export function parseTracklist(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const tracks = [];
    // Regex for timestamp: 0:00, 01:23, 1:23:45
    const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/;

    for (let line of lines) {
        let content = line.trim();

        // Remove leading numbering (1. , 01. , 1 - , 1) )
        // We use a safe regex that expects a dot, paren, or hyphen after digits at start of line
        content = content.replace(/^\d{1,3}[\.\)\-]\s+/, '');

        let timeStr = null;
        let seconds = null;

        // Extract time (first occurrence)
        const timeMatch = content.match(timeRegex);
        if (timeMatch) {
            timeStr = timeMatch[1];
            // Remove time from content string
            content = content.replace(timeStr, '').trim();

            // Parse seconds
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) {
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else {
                seconds = parts[0] * 60 + parts[1];
            }
        }

        // Extract Artist - Title
        let artist = '';
        let title = content;

        // Common separators: " - ", " – " (en-dash)
        // If separators exist, split.
        // Heuristic: If we have "Part A - Part B", usually "Artist - Title".
        // Example: "Gangrene Discharge - Conjoined At the Ass"
        const sepRegex = /\s+[-–]\s+/;
        const parts = content.split(sepRegex);

        if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim(); // Join rest in case title has hyphens
        }

        // Clean any leading/trailing symbols from title
        title = title.replace(/^[-–]\s+/, '').trim();

        // Only add if meaningful content found
        if (title.length > 0 || timeStr) {
            tracks.push({ time: seconds, timeStr, artist, title });
        }
    }
    return tracks;
}

function applyTracks(tracks, replace) {
    // Check if parse results have valid times
    const hasTimes = tracks.some(t => t.time !== null);

    if (replace && hasTimes) {
        // REPLACE MARKERS logic
        // We treat times as TRACK START times.
        // AutoSlice markers are SPLIT points (end of prev track / start of next).
        // Track 1 always starts at 0.
        // If input has 0:00, it corresponds to Track 1.
        // If input has 0:22, it corresponds to Track 2 start -> Marker at 0:22.

        // 1. Extract split times (ignore 0:00 or Start of File)
        const newMarkers = tracks
            .map(t => t.time)
            .filter(t => t !== null && t > 0.1) // Filter out 0 or very small
            .sort((a, b) => a - b);

        // Deduplicate
        const uniqueMarkers = [...new Set(newMarkers)];

        // Apply markers
        window.setMarkers(uniqueMarkers);

        // 2. Apply Names/Artists
        // We assume tracks array maps 1:1 to the detected segments if markers align.
        // However, if we just set markers from input, we know they align perfectly (except last track end).
        // tracks[0] -> Track 1
        // tracks[1] -> Track 2 (marker 1)

        _state.trackNames = tracks.map(t => t.title);
        _state.trackArtists = tracks.map(t => t.artist);

    } else {
        // Just Update Text (Sequential)
        // Applies titles/artists to existing markers
        // Stop at whichever length is shorter
        const count = Math.min(tracks.length, _state.markers.length + 1);
        for (let i = 0; i < count; i++) {
            _state.trackNames[i] = tracks[i].title;
            if (tracks[i].artist) {
                _state.trackArtists[i] = tracks[i].artist;
            }
        }
    }

    // Refresh UI
    window._tracklistModule.updateTracklist(_state);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
