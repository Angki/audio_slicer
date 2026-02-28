const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // ── File dialogs ──
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    selectExportDir: () => ipcRenderer.invoke('dialog:selectExportDir'),
    openImage: () => ipcRenderer.invoke('dialog:openImage'),

    // ── Audio ──
    getAudioInfo: (filePath) => ipcRenderer.invoke('audio:getInfo', filePath),
    decodeToWav: (filePath) => ipcRenderer.invoke('audio:decode', filePath),
    detectGaps: (filePath, params) => ipcRenderer.invoke('audio:detectGaps', filePath, params),
    analyzeRMS: (filePath, windowMs) => ipcRenderer.invoke('audio:analyzeRMS', filePath, windowMs),

    // ── Export ──
    exportTracks: (options) => ipcRenderer.invoke('export:tracks', options),
    onExportProgress: (callback) => ipcRenderer.on('export:progress', (event, data) => callback(data)),
    onExportInit: (callback) => ipcRenderer.on('export:init', (event, data) => callback(data)),
    removeExportListeners: () => {
        ipcRenderer.removeAllListeners('export:progress');
        ipcRenderer.removeAllListeners('export:init');
    },

    // ── Settings ──
    storeGet: (key, defaultValue) => ipcRenderer.invoke('store:get', key, defaultValue),
    storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

    // ── Discogs ──
    discogsSearch: (query) => ipcRenderer.invoke('discogs:search', query),
    discogsGetTracklist: (releaseId, token) => ipcRenderer.invoke('discogs:getTracklist', releaseId, token),
    discogsDownloadCover: (url, token) => ipcRenderer.invoke('discogs:downloadCover', url, token),

    // ── Shell ──
    openPath: (dirPath) => ipcRenderer.invoke('shell:openPath', dirPath),

    // ── Drag and drop support ──
    onFileDrop: (callback) => {
        // This will be handled on the renderer side via HTML5 drag events
    },
});
