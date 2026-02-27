const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const AudioService = require('./services/AudioService');
const ExportService = require('./services/ExportService');
const DiscogsService = require('./services/DiscogsService');
const StoreService = require('./services/StoreService');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f0f14',
    title: 'AutoSlice',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify().catch(console.error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Audio File',
    filters: [
      { name: 'Audio/Video Files', extensions: ['wav', 'flac', 'aiff', 'aif', 'mp3', 'mp4', 'mkv', 'avi', 'mov', 'webm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('store:get', (_event, key, defaultValue) => StoreService.getStoreValue(key, defaultValue));
ipcMain.handle('store:set', (_event, key, value) => StoreService.setStoreValue(key, value));

ipcMain.handle('dialog:selectExportDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Export Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Cover Art',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('audio:getInfo', async (_event, filePath) => {
  try {
    return await AudioService.getAudioInfo(filePath);
  } catch (err) {
    console.error('audio:getInfo error:', err);
    throw err;
  }
});

ipcMain.handle('audio:decode', async (_event, filePath) => {
  try {
    return await AudioService.decodeToWav(filePath);
  } catch (err) {
    console.error('audio:decode error:', err);
    throw err;
  }
});

ipcMain.handle('audio:detectGaps', async (_event, filePath, params) => {
  try {
    return await AudioService.detectGaps(filePath, params);
  } catch (err) {
    console.error('audio:detectGaps error:', err);
    throw err;
  }
});

ipcMain.handle('audio:analyzeRMS', async (_event, filePath, windowMs) => {
  try {
    return await AudioService.analyzeRMSFromFile(filePath, windowMs);
  } catch (err) {
    console.error('audio:analyzeRMS error:', err);
    throw err;
  }
});

ipcMain.handle('export:tracks', async (_event, options) => {
  try {
    return await ExportService.exportTracks(options, _event);
  } catch (err) {
    console.error('export:tracks error:', err);
    throw err;
  }
});

ipcMain.handle('discogs:search', async (_event, query) => {
  try {
    return await DiscogsService.searchRelease(query.artist, query.album, query.token);
  } catch (err) {
    console.error('discogs:search error:', err);
    throw err;
  }
});

ipcMain.handle('discogs:getTracklist', async (_event, releaseId, token) => {
  try {
    return await DiscogsService.getTracklist(releaseId, token);
  } catch (err) {
    console.error('discogs:getTracklist error:', err);
    throw err;
  }
});

ipcMain.handle('shell:openPath', async (_event, dirPath) => {
  shell.openPath(dirPath);
});
