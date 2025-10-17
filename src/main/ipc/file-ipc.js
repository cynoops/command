'use strict';

function registerFileIPC({ ipcMain, dialog, fsp }, state) {
  const sendToRenderer = (channel, payload) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow || mainWindow.isDestroyed?.()) return;
    try {
      mainWindow.webContents.send(channel, payload);
    } catch (err) {
      console.error(`file-ipc: failed sending ${channel}`, err);
    }
  };

  state.fileBridge = state.fileBridge || {};
  state.fileBridge.requestSaveFromRenderer = () => sendToRenderer('file:request-save');
  state.fileBridge.broadcastOpenData = (featureCollection) => sendToRenderer('file:open-data', featureCollection);
  state.fileBridge.broadcastNewFile = () => {
    state.currentFilePath = null;
    sendToRenderer('file:new');
    sendToRenderer('file:current-file', { path: null });
  };

  // Renderer provides data back to main for saving
  ipcMain.on('file:provide-save', async (_e, payload) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return;
    try {
      const data = (payload && payload.data) ? payload.data : payload;
      const suggested = (payload && payload.defaultPath) ? payload.defaultPath : undefined;
      let targetPath = state.currentFilePath;
      if (!targetPath || state.forceSaveAs) {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: 'Save Drawings',
          defaultPath: suggested || state.currentFilePath || undefined,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (canceled || !filePath) { state.forceSaveAs = false; return; }
        targetPath = filePath;
      }
      const text = JSON.stringify(data, null, 2);
      await fsp.writeFile(targetPath, text, 'utf8');
      state.currentFilePath = targetPath;
      state.forceSaveAs = false;
      sendToRenderer('file:saved', { filePath: targetPath });
      sendToRenderer('file:current-file', { path: state.currentFilePath });
    } catch (e) {
      dialog.showErrorBox('Save Failed', String(e));
    }
  });

  // Save-as handler to allow renderer to await result
  ipcMain.handle('file:save-as', async (_e, { data, defaultPath } = {}) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return { ok: false, canceled: true };
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Drawings',
        defaultPath: defaultPath || state.currentFilePath || undefined,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      const text = JSON.stringify(data, null, 2);
      await fsp.writeFile(filePath, text, 'utf8');
      state.currentFilePath = filePath;
      sendToRenderer('file:current-file', { path: state.currentFilePath });
      sendToRenderer('file:saved', { filePath });
      return { ok: true, canceled: false, filePath };
    } catch (e) {
      dialog.showErrorBox('Save Failed', String(e));
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('file:save-trackers', async (_e, { data, defaultPath } = {}) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return { ok: false, canceled: true };
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Tracker Recording',
        defaultPath: defaultPath || state.currentFilePath || undefined,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      const text = JSON.stringify(data, null, 2);
      await fsp.writeFile(filePath, text, 'utf8');
      return { ok: true, canceled: false, filePath };
    } catch (e) {
      dialog.showErrorBox('Save Failed', String(e));
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('file:open-dialog', async (_e, { defaultPath } = {}) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return { ok: false, canceled: true };
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Drawings',
        defaultPath: defaultPath || state.currentFilePath || undefined,
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
      const filePath = filePaths[0];
      const raw = await fsp.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      state.currentFilePath = filePath;
      sendToRenderer('file:current-file', { path: state.currentFilePath });
      if (data && data.type === 'FeatureCollection') {
        sendToRenderer('file:open-data', data);
      }
      return { ok: true, canceled: false, filePath, data };
    } catch (e) {
      dialog.showErrorBox('Open Failed', String(e));
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('file:open-trackers', async (_e, { defaultPath } = {}) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return { ok: false, canceled: true };
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Tracker Recording',
        defaultPath: defaultPath || state.currentFilePath || undefined,
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
      const filePath = filePaths[0];
      const raw = await fsp.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      return { ok: true, canceled: false, filePath, data };
    } catch (e) {
      dialog.showErrorBox('Open Failed', String(e));
      return { ok: false, error: String(e) };
    }
  });

  // Ask Save / Discard / Cancel
  ipcMain.handle('file:ask-sdc', async (_e, { message, detail } = {}) => {
    const mainWindow = state.mainWindow;
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

  ipcMain.handle('file:ask-merge-replace', async (_e, { message, detail } = {}) => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return { choice: 'cancel' };
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Merge', 'Replace All', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      message: message || 'Existing features detected.',
      detail: detail || 'Choose MERGE to keep current features and append the selections, or REPLACE ALL to discard current features before loading.'
    });
    const map = { 0: 'merge', 1: 'replace', 2: 'cancel' };
    return { choice: map[response] || 'cancel' };
  });
}

module.exports = { registerFileIPC };
