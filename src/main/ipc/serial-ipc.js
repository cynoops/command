'use strict';

const { app } = require('electron');
const { SerialPort, RegexParser } = require('serialport');

const AUTO_SERIAL_ENABLED = true;
const AUTO_SERIAL_INTERVAL_MS = 5000;
const AUTO_SERIAL_BAUD = 115200;
const AUTO_SERIAL_COMMAND = 'WHOAMI\n';
const AUTO_SERIAL_RESPONSE_TIMEOUT_MS = 3000;

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

  const knownAutoPorts = new Set();
  const probingPorts = new Map();
  let autoScanTimer = null;

  const notifyRenderer = (channel, payload) => {
    try {
      state.mainWindow?.webContents?.send(channel, payload);
    } catch (err) {
      console.error('serial notify failed', err);
    }
  };

  const cleanupProbe = (path, options = {}) => {
    const entry = probingPorts.get(path);
    if (!entry) return;
    const { port, parser, timeout } = entry;
    if (timeout) clearTimeout(timeout);
    if (parser) {
      try { parser.removeAllListeners(); }
      catch {}
    }
    if (port) {
      try {
        port.removeAllListeners();
        if (port.isOpen) port.close(() => {});
      } catch {}
    }
    probingPorts.delete(path);
    if (options.error) {
      notifyRenderer('serial:autoProbeError', { path, error: options.error });
    } else if (typeof options.response === 'string') {
      notifyRenderer('serial:autoProbeResponse', { path, response: options.response });
    }
  };

  const probePort = (portInfo) => {
    if (!AUTO_SERIAL_ENABLED) return;
    const path = portInfo?.path;
    if (!path) return;
    if (probingPorts.has(path)) return;
    if (state.currentPort && state.currentPort.path === path) return;

    let port;
    try {
      port = new SerialPort({ path, baudRate: AUTO_SERIAL_BAUD, autoOpen: false });
    } catch (err) {
      notifyRenderer('serial:autoProbeError', { path, error: String(err?.message || err) });
      return;
    }

    const parser = port.pipe(new RegexParser({ regex: /\r\n|\r|\n/ }));
    const entry = { port, parser, timeout: null };
    probingPorts.set(path, entry);

    parser.once('data', (line) => {
      cleanupProbe(path, { response: String(line || '').trim() });
    });

    const handleError = (err) => {
      cleanupProbe(path, { error: String(err?.message || err || 'Unknown error') });
    };

    port.on('error', handleError);
    port.on('open', () => {
      port.write(AUTO_SERIAL_COMMAND, (writeErr) => {
        if (writeErr) handleError(writeErr);
      });
    });

    entry.timeout = setTimeout(() => {
      cleanupProbe(path, { error: 'Timed out waiting for response' });
    }, AUTO_SERIAL_RESPONSE_TIMEOUT_MS);

    port.open((openErr) => {
      if (openErr) handleError(openErr);
    });
  };

  const scanForNewPorts = async () => {
    try {
      const ports = await SerialPort.list();
      const currentPaths = new Set();
      ports.forEach((info) => {
        const path = info.path;
        if (!path) return;
        currentPaths.add(path);
        if (!knownAutoPorts.has(path)) {
          knownAutoPorts.add(path);
          probePort(info);
        }
      });
      knownAutoPorts.forEach((path) => {
        if (!currentPaths.has(path) && !probingPorts.has(path) && (!state.currentPort || state.currentPort.path !== path)) {
          knownAutoPorts.delete(path);
        }
      });
    } catch (err) {
      notifyRenderer('serial:autoProbeError', { path: null, error: String(err?.message || err) });
    }
  };

  const startAutoSerialMonitor = () => {
    if (!AUTO_SERIAL_ENABLED || autoScanTimer) return;
    scanForNewPorts();
    autoScanTimer = setInterval(scanForNewPorts, AUTO_SERIAL_INTERVAL_MS);
  };

  const stopAutoSerialMonitor = () => {
    if (autoScanTimer) {
      clearInterval(autoScanTimer);
      autoScanTimer = null;
    }
    probingPorts.forEach((_, path) => cleanupProbe(path));
    probingPorts.clear();
    knownAutoPorts.clear();
  };

  if (AUTO_SERIAL_ENABLED) {
    startAutoSerialMonitor();
    process.once('exit', stopAutoSerialMonitor);
    app?.once?.('before-quit', stopAutoSerialMonitor);
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
