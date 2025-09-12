const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("serial", {
  listPorts: () => ipcRenderer.invoke("serial:listPorts"),
  open: (path, baudRate) => ipcRenderer.invoke("serial:open", { path, baudRate }),
  close: () => ipcRenderer.invoke("serial:close"),
  onData: (cb) => {
    const listener = (_e, line) => cb(line);
    ipcRenderer.on("serial:data", listener);
    return () => ipcRenderer.off("serial:data", listener);
  },
  onStatus: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on("serial:status", listener);
    return () => ipcRenderer.off("serial:status", listener);
  }
});

contextBridge.exposeInMainWorld("app", {
  toggleFullScreen: () => ipcRenderer.invoke("app:toggleFullScreen"),
});
