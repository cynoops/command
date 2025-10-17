const { contextBridge, ipcRenderer, clipboard } = require("electron");

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
  },
  onAutoProbe: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('serial:autoProbeResponse', listener);
    return () => ipcRenderer.off('serial:autoProbeResponse', listener);
  },
  onAutoProbeError: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('serial:autoProbeError', listener);
    return () => ipcRenderer.off('serial:autoProbeError', listener);
  }
});

contextBridge.exposeInMainWorld("app", {
  toggleFullScreen: () => ipcRenderer.invoke("app:toggleFullScreen"),
  onConfirmClose: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('app:confirm-close', listener);
    return () => ipcRenderer.off('app:confirm-close', listener);
  },
  confirmCloseResult: (ok) => ipcRenderer.send('app:confirm-close-result', { ok }),
});

// File open/save bridge
contextBridge.exposeInMainWorld("file", {
  // Renderer receives a save request from main
  onRequestSave: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('file:request-save', listener);
    return () => ipcRenderer.off('file:request-save', listener);
  },
  // Renderer provides data back to main for saving
  // Accepts either the raw FeatureCollection or { data, defaultPath }
  provideSave: (payload) => ipcRenderer.send('file:provide-save', payload),
  // Renderer receives loaded data from main
  onOpenData: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('file:open-data', listener);
    return () => ipcRenderer.off('file:open-data', listener);
  },
  onSaved: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('file:saved', listener);
    return () => ipcRenderer.off('file:saved', listener);
  },
  saveAs: (data, defaultPath) => ipcRenderer.invoke('file:save-as', { data, defaultPath }),
  saveTrackers: (data, defaultPath) => ipcRenderer.invoke('file:save-trackers', { data, defaultPath }),
  openFeatureCollection: (defaultPath) => ipcRenderer.invoke('file:open-dialog', { defaultPath }),
  openTrackers: (defaultPath) => ipcRenderer.invoke('file:open-trackers', { defaultPath }),
  askSaveDiscardCancel: (message, detail) => ipcRenderer.invoke('file:ask-sdc', { message, detail }),
  askMergeReplace: (message, detail) => ipcRenderer.invoke('file:ask-merge-replace', { message, detail }),
  onNew: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('file:new', listener);
    return () => ipcRenderer.off('file:new', listener);
  },
  onCurrentFile: (cb) => {
    const listener = (_e, payload) => cb(payload?.path || null);
    ipcRenderer.on('file:current-file', listener);
    return () => ipcRenderer.off('file:current-file', listener);
  }
});

// AI bridge
contextBridge.exposeInMainWorld("ai", {
  transformDrawing: (feature, prompt, apiKey) => ipcRenderer.invoke('ai:transform-drawing', { feature, prompt, apiKey })
});

contextBridge.exposeInMainWorld("clipboard", {
  writeText: (text) => {
    try {
      clipboard.writeText(String(text ?? ''));
      return true;
    } catch (err) {
      console.error('clipboard.writeText failed', err);
      return false;
    }
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  writeClipboard: (text) => {
    try {
      clipboard.writeText(String(text ?? ''));
      return true;
    } catch (err) {
      console.error('electronAPI.writeClipboard failed', err);
      return false;
    }
  },
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', { url })
});

contextBridge.exposeInMainWorld("settings", {
  setLanguage: (language) => ipcRenderer.invoke('settings:setLanguage', { language }),
  getLanguage: () => ipcRenderer.invoke('settings:getLanguage')
});
