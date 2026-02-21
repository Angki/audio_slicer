/**
 * AutoSlice — History Module (Undo/Redo)
 * Tracks changes to markers and track metadata.
 */

let _state = null;
const _historyStack = [];
const _redoStack = [];
const MAX_HISTORY = 50;

export function initHistory(state) {
    _state = state;

    // Initial snapshot
    // But wait, initial state is empty.
    // We should push history only after file load?
    // Or just be ready.

    window.pushHistory = pushHistory;
    window.undo = undo;
    window.redo = redo;

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
            e.preventDefault();
            redo();
        }
    });
}

export function pushHistory(actionDescription = 'Change') {
    if (!_state) return;

    // Create snapshot
    const snapshot = {
        markers: [..._state.markers],
        trackNames: [..._state.trackNames],
        trackArtists: [..._state.trackArtists],
        excludedRegions: _state.excludedRegions.map(r => ({ ...r })), // Deep copy
        timestamp: Date.now(),
        desc: actionDescription
    };

    _historyStack.push(snapshot);

    // Limit size
    if (_historyStack.length > MAX_HISTORY) {
        _historyStack.shift();
    }

    // Clear redo
    _redoStack.length = 0;

}

export function undo() {
    if (_historyStack.length === 0) {
        return;
    }

    // Current state -> Redo stack
    const currentSnapshot = {
        markers: [..._state.markers],
        trackNames: [..._state.trackNames],
        trackArtists: [..._state.trackArtists],
        excludedRegions: _state.excludedRegions.map(r => ({ ...r })),
        desc: 'Before Undo'
    };
    _redoStack.push(currentSnapshot);

    // Pop history
    const snapshot = _historyStack.pop();
    applySnapshot(snapshot);
}

export function redo() {
    if (_redoStack.length === 0) {
        return;
    }

    // Current state -> History stack
    const currentSnapshot = {
        markers: [..._state.markers],
        trackNames: [..._state.trackNames],
        trackArtists: [..._state.trackArtists],
        excludedRegions: _state.excludedRegions.map(r => ({ ...r })),
        desc: 'Before Redo'
    };
    _historyStack.push(currentSnapshot);

    // Pop redo
    const snapshot = _redoStack.pop();
    applySnapshot(snapshot);
}

function applySnapshot(snapshot) {
    if (!_state) return;

    _state.markers = [...snapshot.markers];
    _state.trackNames = [...snapshot.trackNames];
    _state.trackArtists = [...snapshot.trackArtists];
    _state.excludedRegions = snapshot.excludedRegions ? snapshot.excludedRegions.map(r => ({ ...r })) : [];

    // Update UI
    // Markers need to be synced to WaveSurfer regions
    if (window.setMarkers) {
        // Use setMarkers to update state (redundant but refreshes regions)
        // Manual update of regions (because setMarkers isn't fully separated from state mutation here)
        if (window.syncMarkersToRegions) {
            window.syncMarkersToRegions(); // We will update this in app/waveform to draw both markers and excluded regions
        }

        // Update tracklist
        if (window._tracklistModule) {
            window._tracklistModule.updateTracklist(_state);
        }

        if (window.updateMarkerCount) {
            window.updateMarkerCount();
        }
    }
}

// Clear history (e.g. on new file load)
export function clearHistory() {
    _historyStack.length = 0;
    _redoStack.length = 0;
}
window.clearHistory = clearHistory;
