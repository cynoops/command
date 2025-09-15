'use strict';

function registerAppIPC({ ipcMain }, state) {
  // Toggle full screen
  ipcMain.handle("app:toggleFullScreen", () => {
    const mainWindow = state.mainWindow;
    if (!mainWindow) return false;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  });
}

module.exports = { registerAppIPC };

