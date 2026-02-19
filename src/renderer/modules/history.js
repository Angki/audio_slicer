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

    console.log(`History pushed: ${actionDescription} (Stack: ${_historyStack.length})`);
}

export function undo() {
    if (_historyStack.length === 0) {
        console.log('Nothing to undo');
        return;
    }

    // Current state -> Redo stack
    const currentSnapshot = {
        markers: [..._state.markers],
        trackNames: [..._state.trackNames],
        trackArtists: [..._state.trackArtists],
        desc: 'Before Undo'
    };
    _redoStack.push(currentSnapshot);

    // Pop history
    const snapshot = _historyStack.pop();
    applySnapshot(snapshot);
    console.log(`Undone: ${snapshot.desc}`);
}

export function redo() {
    if (_redoStack.length === 0) {
        console.log('Nothing to redo');
        return;
    }

    // Current state -> History stack
    const currentSnapshot = {
        markers: [..._state.markers],
        trackNames: [..._state.trackNames],
        trackArtists: [..._state.trackArtists],
        desc: 'Before Redo'
    };
    _historyStack.push(currentSnapshot);

    // Pop redo
    const snapshot = _redoStack.pop();
    applySnapshot(snapshot);
    console.log(`Redone: ${snapshot.desc}`);
}

function applySnapshot(snapshot) {
    if (!_state) return;

    _state.markers = [...snapshot.markers];
    _state.trackNames = [...snapshot.trackNames];
    _state.trackArtists = [...snapshot.trackArtists];

    // Update UI
    // Markers need to be synced to WaveSurfer regions
    if (window.setMarkers) {
        // Use setMarkers to update state (redundant but refreshes regions)
        // But setMarkers pushes to history? No, setMarkers in app.js doesn't pushHistory yet.
        // We need a way to set markers WITHOUT pushing history.
        // Or we update state manually and call update functions.

        // Manual update of regions
        const ws = window.getWavesurfer && window.getWavesurfer();
        if (ws && ws.regions) {
            ws.regions.clearRegions();
            snapshot.markers.forEach(time => {
                ws.regions.addRegion({
                    start: time,
                    color: 'rgba(124, 92, 252, 0.5)',
                    drag: true,
                    resize: false
                });
            });
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
