'use strict';

function setupMenu({ Menu, dialog, fsp }, state) {
  const mainWindowRef = () => state.mainWindow;
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New', accelerator: 'CmdOrCtrl+N', click: async () => {
            const win = mainWindowRef(); if (!win) return;
            win.webContents.send('file:new');
          }
        },
        {
          label: 'Open…', accelerator: 'CmdOrCtrl+O', click: async () => {
            const win = mainWindowRef(); if (!win) return;
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              title: 'Open Drawings', properties: ['openFile'],
              filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (canceled || !filePaths || !filePaths[0]) return;
            try {
              const raw = await fsp.readFile(filePaths[0], 'utf8');
              const data = JSON.parse(raw);
              state.currentFilePath = filePaths[0];
              win.webContents.send('file:open-data', data);
              win.webContents.send('file:current-file', { path: state.currentFilePath });
            } catch (e) {
              dialog.showErrorBox('Open Failed', String(e));
            }
          }
        },
        {
          label: 'Save…', accelerator: 'CmdOrCtrl+S', click: async () => {
            const win = mainWindowRef(); if (!win) return;
            state.forceSaveAs = false;
            win.webContents.send('file:request-save');
          }
        },
        {
          label: 'Save As…', accelerator: 'Shift+CmdOrCtrl+S', click: async () => {
            const win = mainWindowRef(); if (!win) return;
            state.forceSaveAs = true;
            win.webContents.send('file:request-save');
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
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { setupMenu };

