'use strict';

const { SerialPort, RegexParser } = require('serialport');

function registerSerialIPC({ ipcMain }, state) {
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
      if (!state.currentPort) return resolve(true);
      try {
        state.currentPort.removeAllListeners();
        state.currentPort.close(() => {
          state.currentPort = null;
          state.currentParser = null;
          if (state.mainWindow) state.mainWindow.webContents.send("serial:status", { state: "disconnected" });
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
        state.currentPort = new SerialPort({ path, baudRate: Number(baudRate) || 115200, autoOpen: false });

        // Be tolerant of CR, LF, or CRLF
        state.currentParser = state.currentPort.pipe(new RegexParser({ regex: /\r\n|\r|\n/ }));

        state.currentPort.once("open", () => {
          if (state.mainWindow) state.mainWindow.webContents.send("serial:status", { state: "connected", path });
          resolve({ ok: true });
        });
        state.currentPort.on("error", (err) => {
          if (state.mainWindow) state.mainWindow.webContents.send("serial:status", { state: "error", message: String(err?.message || err) });
        });
        state.currentPort.on("close", () => {
          if (state.mainWindow) state.mainWindow.webContents.send("serial:status", { state: "disconnected" });
        });

        state.currentParser.on("data", (line) => {
          if (state.mainWindow) state.mainWindow.webContents.send("serial:data", line);
        });

        state.currentPort.open((openErr) => {
          if (openErr) {
            if (state.mainWindow) state.mainWindow.webContents.send("serial:status", { state: "error", message: String(openErr.message || openErr) });
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
}

module.exports = { registerSerialIPC };

