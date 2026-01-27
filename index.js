const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require("electron");
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
// Modularized main process pieces
const state = require('./src/main/state');
const { setupMenu: setupAppMenu } = require('./src/main/menu');
const { registerFileIPC } = require('./src/main/ipc/file-ipc');
const { registerAppIPC } = require('./src/main/ipc/app-ipc');
const { registerAIIPC } = require('./src/main/ipc/ai-ipc');
const { registerSettingsIPC } = require('./src/main/ipc/settings-ipc');
const { registerMapIPC } = require('./src/main/ipc/map-ipc');

// Electron apps launched from Finder on macOS may not have writable stdout/stderr.
// Guard against EPIPE/EIO errors when console.* writes to these streams.
const muteBrokenPipe = (stream) => {
  if (!stream || typeof stream.on !== 'function') return;
  stream.on('error', (err) => {
    if (err && (err.code === 'EPIPE' || err.code === 'EIO')) return;
    throw err;
  });
};
muteBrokenPipe(process.stdout);
muteBrokenPipe(process.stderr);

let mainWindow = null;

try {
  app.name = 'Command';
  app.setName?.('Command');
  app.setAppUserModelId?.('com.cynoops.command');
} catch (err) {
  console.warn('Failed to prime app name', err);
}

const cleanServiceWorkerStorage = async () => {
  try {
    const serviceWorkerPath = path.join(app.getPath('userData'), 'Service Worker');
    await fsp.rm(serviceWorkerPath, { recursive: true, force: true });
  } catch (err) {
    console.warn('Failed to clean service worker storage', err);
  }
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200, height: 700,
    title: 'Command - CYNOOPS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      preload: __dirname + "/preload.js"
    }
  });
  win.loadFile("index.html");
  mainWindow = win;
  state.mainWindow = win;
  setupMenu();

  // Context menu for copy/paste and inspect
  win.webContents.on('context-menu', (event, params) => {
    const template = [];
    const { isEditable, editFlags, selectionText, x, y } = params;
    if (isEditable) {
      if (editFlags.canUndo) template.push({ role: 'undo' });
      if (editFlags.canRedo) template.push({ role: 'redo' });
      if (template.length) template.push({ type: 'separator' });
      if (editFlags.canCut) template.push({ role: 'cut' });
      if (editFlags.canCopy) template.push({ role: 'copy' });
      if (editFlags.canPaste) template.push({ role: 'paste' });
      template.push({ type: 'separator' }, { role: 'selectAll' });
    } else if (selectionText && selectionText.trim().length > 0) {
      template.push({ role: 'copy' });
    }
    template.push({ type: 'separator' }, { label: 'Inspect Element', click: () => win.webContents.inspectElement(x, y) });
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
  });
};

app.whenReady().then(async () => {
  await cleanServiceWorkerStorage();
  createWindow();
  // Register IPC using modular handlers
  registerFileIPC({ ipcMain, dialog, fsp }, state);
  registerAppIPC({ ipcMain, shell }, state);
  registerAIIPC({ ipcMain }, state);
  registerSettingsIPC({ ipcMain }, state);
  registerMapIPC({ ipcMain, dialog, BrowserWindow }, state);
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// --- Menu setup ---
function setupMenu() {
  try { setupAppMenu({ Menu }, state); }
  catch (e) { console.error('Menu setup failed', e); }
}

// Graceful close: ask renderer to confirm close if needed
let _allowClose = false;
let _quitRequested = false;
app.on('before-quit', () => { _quitRequested = true; });

state.requestQuit = () => {
  _quitRequested = true;
  if (state.mainWindow) {
    try { state.mainWindow.close(); } catch {}
  } else {
    try { app.quit(); } catch {}
  }
};

app.on('browser-window-created', (_e, win) => {
  win.on('close', (evt) => {
    if (_allowClose) return;
    evt.preventDefault();
    win.webContents.send('app:confirm-close');
  });
});

ipcMain.on('app:confirm-close-result', (_e, payload) => {
  if (!mainWindow) return;
  if (payload && payload.ok) {
    _allowClose = true;
    const shouldQuit = _quitRequested;
    _quitRequested = false;
    try { mainWindow.close(); } catch {}
    if (shouldQuit) {
      // Ensure full app exit (especially on macOS where window-all-closed doesn't quit)
      try { app.quit(); } catch {}
    }
  } else {
    _quitRequested = false;
  }
});

// Receive data from renderer and save to disk
// file:provide-save handled in src/main/ipc/file-ipc.js

// Save-as handler to allow renderer to await result
// file:save-as handled in src/main/ipc/file-ipc.js

// Ask Save / Discard / Cancel
// file:ask-sdc handled in src/main/ipc/file-ipc.js

// Toggle full screen
// app:toggleFullScreen handled in src/main/ipc/app-ipc.js

// --- AI: transform a drawing via OpenAI ---
// AI IPC delegated to src/main/ipc/ai-ipc.js
