'use strict';

const path = require('path');

function registerFileIPC({ ipcMain, dialog, fsp }, state) {
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
      try {
        mainWindow.webContents.send('file:saved', { filePath: targetPath });
        mainWindow.webContents.send('file:current-file', { path: state.currentFilePath });
      } catch {}
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
      try { mainWindow.webContents.send('file:current-file', { path: state.currentFilePath }); } catch {}
      return { ok: true, canceled: false, filePath };
    } catch (e) {
      dialog.showErrorBox('Save Failed', String(e));
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
}

module.exports = { registerFileIPC };

