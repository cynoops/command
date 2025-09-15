const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const fs = require('fs');
const fsp = fs.promises;
const { SerialPort, ReadlineParser, RegexParser } = require("serialport");
const https = require('https');

let mainWindow = null;
let currentFilePathMain = null;
let forceSaveAsMain = false;
let currentPort = null;
let currentParser = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000, height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      preload: __dirname + "/preload.js"
    }
  });
  win.loadFile("index.html");
  mainWindow = win;
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

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// --- Menu setup ---
function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New', accelerator: 'CmdOrCtrl+N', click: async () => {
            if (!mainWindow) return;
            mainWindow.webContents.send('file:new');
          }
        },
        {
          label: 'Open…', accelerator: 'CmdOrCtrl+O', click: async () => {
            if (!mainWindow) return;
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Open Drawings', properties: ['openFile'],
              filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (canceled || !filePaths || !filePaths[0]) return;
            try {
              const raw = await fsp.readFile(filePaths[0], 'utf8');
              const data = JSON.parse(raw);
              currentFilePathMain = filePaths[0];
              mainWindow.webContents.send('file:open-data', data);
              mainWindow.webContents.send('file:current-file', { path: currentFilePathMain });
            } catch (e) {
              dialog.showErrorBox('Open Failed', String(e));
            }
          }
        },
        {
          label: 'Save…', accelerator: 'CmdOrCtrl+S', click: async () => {
            if (!mainWindow) return;
            // Ask renderer for data (normal save)
            forceSaveAsMain = false;
            mainWindow.webContents.send('file:request-save');
          }
        },
        {
          label: 'Save As…', accelerator: 'Shift+CmdOrCtrl+S', click: async () => {
            if (!mainWindow) return;
            // Ask renderer for data (force save-as)
            forceSaveAsMain = true;
            mainWindow.webContents.send('file:request-save');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools', accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
}

// Graceful close: ask renderer to confirm close if needed
let _allowClose = false;

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
    try { mainWindow.close(); } catch {}
  }
});

// Receive data from renderer and save to disk
ipcMain.on('file:provide-save', async (_e, payload) => {
  if (!mainWindow) return;
  try {
    const data = (payload && payload.data) ? payload.data : payload;
    const suggested = (payload && payload.defaultPath) ? payload.defaultPath : undefined;
    let targetPath = currentFilePathMain;
    if (!targetPath || forceSaveAsMain) {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Drawings',
        defaultPath: suggested || currentFilePathMain || undefined,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePath) { forceSaveAsMain = false; return; }
      targetPath = filePath;
    }
    const text = JSON.stringify(data, null, 2);
    await fsp.writeFile(targetPath, text, 'utf8');
    currentFilePathMain = targetPath;
    forceSaveAsMain = false;
    try {
      mainWindow.webContents.send('file:saved', { filePath: targetPath });
      mainWindow.webContents.send('file:current-file', { path: currentFilePathMain });
    } catch {}
  } catch (e) {
    dialog.showErrorBox('Save Failed', String(e));
  }
});

// Save-as handler to allow renderer to await result
ipcMain.handle('file:save-as', async (_e, { data, defaultPath } = {}) => {
  if (!mainWindow) return { ok: false, canceled: true };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Drawings',
      defaultPath: defaultPath || currentFilePathMain || undefined,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const text = JSON.stringify(data, null, 2);
    await fsp.writeFile(filePath, text, 'utf8');
    currentFilePathMain = filePath;
    try { mainWindow.webContents.send('file:current-file', { path: currentFilePathMain }); } catch {}
    return { ok: true, canceled: false, filePath };
  } catch (e) {
    dialog.showErrorBox('Save Failed', String(e));
    return { ok: false, error: String(e) };
  }
});

// Ask Save / Discard / Cancel
ipcMain.handle('file:ask-sdc', async (_e, { message, detail } = {}) => {
  if (!mainWindow) return { choice: 'cancel' };
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    message: message || 'You have unsaved drawings.',
    detail: detail || 'Do you want to save your changes before continuing?'
  });
  const map = { 0: 'save', 1: 'discard', 2: 'cancel' };
  return { choice: map[response] || 'cancel' };
});

// --- Serial helpers ---
async function listSerialPorts() {
  const ports = await SerialPort.list();
  return ports.map(p => ({
    path: p.path,
    manufacturer: p.manufacturer || "",
    serialNumber: p.serialNumber || "",
    vendorId: p.vendorId || "",
    productId: p.productId || ""
  }));
}

function closeCurrentPort() {
  return new Promise((resolve) => {
    if (!currentPort) return resolve(true);
    try {
      currentPort.removeAllListeners();
      currentPort.close(() => {
        currentPort = null;
        currentParser = null;
        if (mainWindow) mainWindow.webContents.send("serial:status", { state: "disconnected" });
        resolve(true);
      });
    } catch (e) {
      resolve(false);
    }
  });
}

// --- IPC handlers ---
ipcMain.handle("serial:listPorts", async () => {
  return await listSerialPorts();
});

ipcMain.handle("serial:open", async (_evt, { path, baudRate }) => {
  // Close any existing first
  await closeCurrentPort();
  return new Promise((resolve, reject) => {
    try {
      currentPort = new SerialPort({ path, baudRate: Number(baudRate) || 115200, autoOpen: false });

      // Be tolerant of CR, LF, or CRLF
      currentParser = currentPort.pipe(new RegexParser({ regex: /\r\n|\r|\n/ }));

      currentPort.once("open", () => {
        if (mainWindow) mainWindow.webContents.send("serial:status", { state: "connected", path });
        resolve({ ok: true });
      });
      currentPort.on("error", (err) => {
        if (mainWindow) mainWindow.webContents.send("serial:status", { state: "error", message: String(err?.message || err) });
      });
      currentPort.on("close", () => {
        if (mainWindow) mainWindow.webContents.send("serial:status", { state: "disconnected" });
      });

      currentPort.on("data", (line) => {
        console.log({line})
      });

      currentParser.on("data", (line) => {
        console.log({line})
        if (mainWindow) mainWindow.webContents.send("serial:data", line);
      });

      currentPort.open((openErr) => {
        if (openErr) {
          if (mainWindow) mainWindow.webContents.send("serial:status", { state: "error", message: String(openErr.message || openErr) });
          return reject(openErr);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
});

ipcMain.handle("serial:close", async () => {
  await closeCurrentPort();
  return { ok: true };
});

// Toggle full screen
ipcMain.handle("app:toggleFullScreen", () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

// --- AI: transform a drawing via OpenAI ---
ipcMain.handle('ai:transform-drawing', async (_e, { feature, prompt }) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'Missing OPENAI_API_KEY in environment.' };
    }
    // Build a concise system/user prompt instructing strict JSON output
    const geomStr = JSON.stringify(feature?.geometry || null);
    const sys = [
      'You are a mapping assistant. Your task is to transform a given geometry into new geometries as requested.',
      'Output strictly a GeoJSON FeatureCollection in JSON with no additional commentary.',
      'Use WGS84 lon/lat coordinates. Keep topology valid. Ensure arrays are numeric.',
    ].join(' ');
    const user = [
      'Original geometry (GeoJSON):', geomStr,
      'Instruction:', String(prompt || '').trim() || 'Return the given geometry unchanged.',
      'Return only: {"type":"FeatureCollection","features":[...]}',
    ].join('\n');

    const body = JSON.stringify({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      temperature: 0.2,
    });

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: data?.error?.message || String(resp.statusText || 'OpenAI request failed') };
    }
    const text = data?.choices?.[0]?.message?.content || '';
    // Parse JSON from response (expecting pure JSON, but be defensive)
    let jsonStr = text.trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace > 0 || lastBrace >= 0) jsonStr = jsonStr.slice(Math.max(0, firstBrace), lastBrace + 1);
    let fc = null;
    try { fc = JSON.parse(jsonStr); } catch (e) {
      return { ok: false, error: 'Failed to parse model output as JSON FeatureCollection.' };
    }
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      return { ok: false, error: 'Model output is not a valid GeoJSON FeatureCollection.' };
    }
    return { ok: true, featureCollection: fc };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
