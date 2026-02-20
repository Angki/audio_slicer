/**
 * AutoSlice — Frontend State Management
 * Centralized store for all application state.
 */

export const state = {
    filePath: null,
    wavPath: null,
    audioInfo: null,
    markers: [],         // Array of marker times (seconds), sorted
    trackNames: [],      // Track names (from Discogs or manual)
    trackArtists: [],    // Per-track artist names
    excludedRegions: [], // Array of {start, end} to skip during export
    discogsInfo: null,   // Discogs release info if loaded
    isPlaying: false,
    isProcessing: false,
};

// Also expose globally for backwards compatibility during refactor
window.appState = state;
