/**
 * AutoSlice — Tracklist Module
 * Displays detected tracks with editable names, durations, and play buttons.
 */

let _state = null;

export function initTracklist(state) {
    _state = state;
    // Expose for waveform module
    window._tracklistModule = { updateTracklist };
}

/**
 * Update the track list display from current markers.
 */
export function updateTracklist(state) {
    _state = state;
    const $trackList = document.getElementById('trackList');
    const $badge = document.getElementById('trackCountBadge');
    const markers = state.markers;
    const duration = state.audioInfo ? state.audioInfo.duration : 0;

    if (markers.length === 0) {
        $trackList.innerHTML = '<div class="empty-state">Run Auto Detect to find tracks</div>';
        $badge.textContent = '0';
        return;
    }

    // Build track segments
    const segments = [];
    for (let i = 0; i <= markers.length; i++) {
        const start = i === 0 ? 0 : markers[i - 1];
        const end = i === markers.length ? duration : markers[i];
        const trackNum = i + 1;
        const trackNumStr = String(trackNum).padStart(2, '0');
        const defaultName = state.trackNames[i] || `Track ${trackNumStr}`;

        segments.push({ start, end, trackNum, trackNumStr, name: defaultName, duration: end - start });
    }

    $badge.textContent = segments.length;

    // Render
    $trackList.innerHTML = segments.map((seg, idx) => `
    <div class="track-row" data-index="${idx}">
      <button class="track-play-btn" data-start="${seg.start}" data-end="${seg.end}" title="Preview">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
      <span class="track-num">${seg.trackNumStr}</span>
      <div class="track-title">
        <input type="text" value="${escapeHtml(seg.name)}" data-index="${idx}" spellcheck="false">
      </div>
      <span class="track-time">${window.formatTime(seg.start)}</span>
      <span class="track-time">${window.formatTime(seg.end)}</span>
      <span class="track-duration">${window.formatDuration(seg.duration)}</span>
      <button class="track-remove-btn" data-marker-index="${idx < segments.length - 1 ? idx : -1}" title="${idx < segments.length - 1 ? 'Remove marker after this track' : ''}">
        ${idx < segments.length - 1 ? '×' : ''}
      </button>
    </div>
  `).join('');

    // Attach play button events
    $trackList.querySelectorAll('.track-play-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const start = parseFloat(btn.dataset.start);
            const end = parseFloat(btn.dataset.end);
            window.playSegment(start, end);

            // Highlight row
            $trackList.querySelectorAll('.track-row').forEach(r => r.classList.remove('playing'));
            btn.closest('.track-row').classList.add('playing');
        });
    });

    // Attach remove marker events
    $trackList.querySelectorAll('.track-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const markerIdx = parseInt(btn.dataset.markerIndex);
            if (markerIdx >= 0 && markerIdx < _state.markers.length) {
                window.removeMarker(markerIdx);
                window.syncMarkersToRegions();
            }
        });
    });

    // Attach track name edit events
    $trackList.querySelectorAll('.track-title input').forEach(input => {
        input.addEventListener('change', () => {
            const idx = parseInt(input.dataset.index);
            _state.trackNames[idx] = input.value;
        });
    });
}

/**
 * Apply Discogs track names to the state.
 */
export function applyDiscogsNames(tracklist) {
    if (!_state) return;
    _state.trackNames = tracklist.map(t => t.title);
    updateTracklist(_state);
}

window.applyDiscogsNames = applyDiscogsNames;

// ── Helper ──
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
