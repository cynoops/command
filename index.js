const { app, BrowserWindow, ipcMain } = require("electron");
const { SerialPort, ReadlineParser } = require("serialport");

let mainWindow = null;
let currentPort = null;
let currentParser = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000, height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: __dirname + "/preload.js"
    }
  });
  win.loadFile("index.html");
  mainWindow = win;
};

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

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
      currentParser = currentPort.pipe(new ReadlineParser({ delimiter: "\n" }));

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

      currentParser.on("data", (line) => {
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
