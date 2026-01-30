const { contextBridge, ipcRenderer, clipboard } = require("electron");

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
  openGpx: (defaultPath) => ipcRenderer.invoke('file:open-gpx', { defaultPath }),
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

contextBridge.exposeInMainWorld("mapTools", {
  saveMapSnapshot: (payload) => ipcRenderer.invoke('map:save-map-snapshot', payload),
  saveMapPdf: (payload) => ipcRenderer.invoke('map:save-map-pdf', payload)
});

contextBridge.exposeInMainWorld("settings", {
  setLanguage: (language) => ipcRenderer.invoke('settings:setLanguage', { language }),
  getLanguage: () => ipcRenderer.invoke('settings:getLanguage')
});

contextBridge.exposeInMainWorld("firebaseAdmin", {
  selectCredentials: () => ipcRenderer.invoke('firebase-admin:select-credentials'),
  getStatus: () => ipcRenderer.invoke('firebase-admin:get-status'),
  clearCredentials: () => ipcRenderer.invoke('firebase-admin:clear-credentials'),
  ingestCredentials: (payload) => ipcRenderer.invoke('firebase-admin:ingest-credentials', payload),
  clearSessions: () => ipcRenderer.invoke('firebase-admin:clear-sessions'),
  clearAnonymousUsers: () => ipcRenderer.invoke('firebase-admin:clear-anonymous-users'),
  createAnonymousToken: (payload) => ipcRenderer.invoke('firebase-admin:create-anonymous-token', payload),
  getFirebaseConfig: () => ipcRenderer.invoke('firebase-admin:get-firebase-config'),
  deployFirestoreRules: (payload) => ipcRenderer.invoke('firebase-admin:deploy-firestore-rules', payload),
  deployStorageRules: (payload) => ipcRenderer.invoke('firebase-admin:deploy-storage-rules', payload),
  deployTrackerUpdatesFunction: (payload) => ipcRenderer.invoke('firebase-admin:deploy-tracker-updates-function', payload),
  onDeployLog: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('firebase-admin:deploy-log', listener);
    return () => ipcRenderer.off('firebase-admin:deploy-log', listener);
  }
});
