/**
 * AutoSlice — Tracklist Module
 * Displays detected tracks with editable names, durations, and play buttons.
 */

let _state = null;
import { pushHistory } from './history.js';

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
        const defaultArtist = state.trackArtists[i] || '';

        segments.push({ start, end, trackNum, trackNumStr, name: defaultName, artist: defaultArtist, duration: end - start });
    }

    $badge.textContent = segments.length;

    // Render
    $trackList.innerHTML = segments.map((seg, idx) => `
    <div class="track-row" data-index="${idx}">
      <button class="track-play-btn" data-start="${seg.start}" data-end="${seg.end}" title="Preview">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
      <span class="track-num">${seg.trackNumStr}</span>
      <div class="track-artist">
        <input type="text" value="${escapeHtml(seg.artist)}" placeholder="Artist" data-index="${idx}" spellcheck="false">
      </div>
      <div class="track-title">
        <input type="text" value="${escapeHtml(seg.name)}" placeholder="Title" data-index="${idx}" spellcheck="false">
      </div>
      <span class="track-time">${window.formatTime(seg.start)}</span>
      <span class="track-time">${window.formatTime(seg.end)}</span>
      <div class="track-duration">
        <input type="text" value="${window.formatDuration(seg.duration)}" data-index="${idx}" class="duration-input" spellcheck="false">
      </div>
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
                window.syncMarkersToRegions(); // Sync immediately
            }
        });
    });

    // Attach track name edit events
    $trackList.querySelectorAll('.track-title input').forEach(input => {
        input.addEventListener('change', () => {
            pushHistory('Edit Track Name');
            const idx = parseInt(input.dataset.index);
            _state.trackNames[idx] = input.value;
        });
    });

    // Attach track artist edit events
    $trackList.querySelectorAll('.track-artist input').forEach(input => {
        input.addEventListener('change', () => {
            pushHistory('Edit Artist');
            const idx = parseInt(input.dataset.index);
            _state.trackArtists[idx] = input.value;
        });
    });

    // Attach duration edit events
    $trackList.querySelectorAll('.duration-input').forEach(input => {
        input.addEventListener('change', () => {
            const idx = parseInt(input.dataset.index);
            const newDuration = parseDuration(input.value);

            if (newDuration === null || newDuration < 0.1) {
                // Invalid, revert
                updateTracklist(_state);
                return;
            }

            if (idx >= _state.markers.length) {
                alert("Cannot change duration of the last track (fixed by file length).");
                updateTracklist(_state);
                return;
            }

            // Current bounds
            const prevTime = idx === 0 ? 0 : _state.markers[idx - 1];
            const oldEndTime = _state.markers[idx];
            const oldDuration = oldEndTime - prevTime;

            const diff = newDuration - oldDuration;

            if (Math.abs(diff) < 0.001) return; // No change

            const audioDuration = _state.audioInfo ? _state.audioInfo.duration : 0;
            const newMarkers = [..._state.markers];

            // Apply diff ONLY to markers[idx] (the end of this track)
            // This changes this track's duration AND the next track's start time.
            newMarkers[idx] += diff;

            // Constrain markers[idx]
            // Cannot be less than previous marker + 0.1
            if (newMarkers[idx] < prevTime + 0.1) {
                newMarkers[idx] = prevTime + 0.1;
            }
            // Cannot be greater than next marker - 0.1 (if it exists)
            if (idx + 1 < newMarkers.length) {
                if (newMarkers[idx] > newMarkers[idx + 1] - 0.1) {
                    newMarkers[idx] = newMarkers[idx + 1] - 0.1;
                }
            } else {
                // Cannot be greater than audioDuration - 0.1
                if (newMarkers[idx] > audioDuration - 0.1) {
                    newMarkers[idx] = audioDuration - 0.1;
                }
            }

            // No need to sort if constraints held, but safe
            newMarkers.sort((a, b) => a - b);

            // setMarkers handles visual sync and history (unless we implement custom history here? setMarkers handles it)
            window.setMarkers(newMarkers);
        });
    });
}

/**
 * Apply Discogs track names to the state.
 */
export function applyDiscogsNames(tracklist) {
    if (!_state) return;
    _state.trackNames = tracklist.map(t => t.title);

    // Handle per-track artists from Discogs (compilations/splits)
    _state.trackArtists = tracklist.map(t => {
        if (t.artists && t.artists.length > 0) {
            return t.artists.map(a => a.name).join(', ');
        }
        return ''; // Default to empty (uses Album Artist)
    });

    updateTracklist(_state);
}

window.applyDiscogsNames = applyDiscogsNames;

// ── Helper ──
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseDuration(str) {
    // MM:SS or MM:SS.ms or HH:MM:SS
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return null;

    let seconds = 0;
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        seconds = parts[0];
    } else {
        return null;
    }
    return seconds;
}
