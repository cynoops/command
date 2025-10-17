'use strict';

function registerAppIPC({ ipcMain, shell }, state) {
  // Toggle full screen
  ipcMain.handle("app:toggleFullScreen", () => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });

  ipcMain.handle('app:openExternal', async (_event, payload = {}) => {
    const target = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!target) return { ok: false, error: 'Invalid URL' };
    const ALLOWED_PROTOCOL = /^(https?|mailto):/i;
    if (!ALLOWED_PROTOCOL.test(target)) {
      return { ok: false, error: 'Blocked protocol' };
    }
    try {
      await shell.openExternal(target);
      return { ok: true };
    } catch (err) {
      console.error('openExternal failed', err);
      return { ok: false, error: String(err?.message || err) };
    }
  });
}

module.exports = { registerAppIPC };
