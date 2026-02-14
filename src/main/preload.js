const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // ── File dialogs ──
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    selectExportDir: () => ipcRenderer.invoke('dialog:selectExportDir'),

    // ── Audio ──
    getAudioInfo: (filePath) => ipcRenderer.invoke('audio:getInfo', filePath),
    decodeToWav: (filePath) => ipcRenderer.invoke('audio:decode', filePath),
    detectGaps: (filePath, params) => ipcRenderer.invoke('audio:detectGaps', filePath, params),
    analyzeRMS: (filePath, windowMs) => ipcRenderer.invoke('audio:analyzeRMS', filePath, windowMs),

    // ── Export ──
    exportTracks: (options) => ipcRenderer.invoke('export:tracks', options),

    // ── Discogs ──
    discogsSearch: (query) => ipcRenderer.invoke('discogs:search', query),
    discogsGetTracklist: (releaseId, token) => ipcRenderer.invoke('discogs:getTracklist', releaseId, token),

    // ── Shell ──
    openPath: (dirPath) => ipcRenderer.invoke('shell:openPath', dirPath),

    // ── Drag and drop support ──
    onFileDrop: (callback) => {
        // This will be handled on the renderer side via HTML5 drag events
    },
});
