'use strict';

const { app } = require('electron');

function setupMenu({ Menu }, state) {
  const template = [
    {
      label: 'Command',
      submenu: [
        {
          label: 'Command',
          click: () => {
            const options = {
              applicationName: 'Command - CYNOOPS',
              applicationVersion: app.getVersion?.() || '1.0.0',
            };
            try {
              if (app.showAboutPanel) app.showAboutPanel(options);
            } catch (err) {
              console.error('showAboutPanel failed', err);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit Command',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            if (state && typeof state.requestQuit === 'function') {
              state.requestQuit();
            } else {
              app.quit();
            }
          }
        }
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
