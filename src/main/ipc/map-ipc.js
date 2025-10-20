'use strict';

const fs = require('fs');
const path = require('path');

const fsp = fs.promises;

const DATA_URL_REGEX = /^data:image\/png;base64,/i;
const MAX_DIMENSION = 8192;
const MIN_DIMENSION = 16;

const clampDimension = (value, fallback = 1024) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(MIN_DIMENSION, Math.min(Math.round(num), MAX_DIMENSION));
};

const cssPixelsToMicrons = (px) => {
  const num = Number(px);
  if (!Number.isFinite(num) || num <= 0) return 25400; // default to 1 inch
  return Math.max(1, Math.round((num / 96) * 25400));
};

const appendExtension = (filePath, extension) => {
  if (!filePath) return filePath;
  const normalized = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (path.extname(filePath).toLowerCase() === normalized) return filePath;
  return `${filePath}${normalized}`;
};

const decodePngDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string' || !DATA_URL_REGEX.test(dataUrl)) return null;
  const base64 = dataUrl.replace(DATA_URL_REGEX, '');
  try {
    return Buffer.from(base64, 'base64');
  } catch (err) {
    console.warn('decodePngDataUrl failed', err);
    return null;
  }
};

async function createPdfFromPng({ buffer, width, height, targetPath, BrowserWindow }) {
  if (!BrowserWindow) throw new Error('BrowserWindow unavailable for PDF export');
  const base64 = buffer.toString('base64');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="data:image/png;base64,${base64}" alt="Map snapshot" />
</body>
</html>`;

  const windowWidth = Math.min(Math.max(Math.round(width / 2), 400), 1200);
  const windowHeight = Math.min(Math.max(Math.round(height / 2), 400), 1200);
  const pdfWindow = new BrowserWindow({
    show: false,
    width: windowWidth,
    height: windowHeight,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    const encodedHtml = Buffer.from(html, 'utf8').toString('base64');
    await pdfWindow.loadURL(`data:text/html;base64,${encodedHtml}`);
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      landscape: width >= height,
      marginsType: 1,
      pageSize: {
        width: cssPixelsToMicrons(width),
        height: cssPixelsToMicrons(height)
      }
    });
    await fsp.writeFile(targetPath, pdfBuffer);
  } finally {
    try { if (!pdfWindow.isDestroyed()) pdfWindow.close(); } catch {}
    try { if (!pdfWindow.isDestroyed()) pdfWindow.destroy(); } catch {}
  }
}

function registerMapIPC({ ipcMain, dialog, BrowserWindow }, state) {
  if (!ipcMain) return;

  ipcMain.handle('map:save-map-snapshot', async (_event, payload = {}) => {
    try {
      const {
        dataUrl,
        width,
        height,
        devicePixelRatio,
        defaultFileName = null
      } = payload;

      const buffer = decodePngDataUrl(dataUrl);
      if (!buffer || !buffer.length) {
        return { ok: false, error: 'Invalid snapshot data.' };
      }

      const rawWidth = clampDimension(width, 1024);
      const rawHeight = clampDimension(height, 768);
      const aspect = rawHeight > 0 ? rawWidth / rawHeight : 1;
      let dimWidth = rawWidth;
      let dimHeight = rawHeight;

      // Ensure reasonable bounds while preserving aspect ratio.
      if (dimWidth > MAX_DIMENSION) {
        dimWidth = MAX_DIMENSION;
        dimHeight = Math.max(MIN_DIMENSION, Math.round(dimWidth / (aspect || 1)));
      }
      if (dimHeight > MAX_DIMENSION) {
        dimHeight = MAX_DIMENSION;
        dimWidth = Math.max(MIN_DIMENSION, Math.round(dimHeight * (aspect || 1)));
      }

      const dpi = Number(devicePixelRatio);
      const meta = {
        width: dimWidth,
        height: dimHeight,
        devicePixelRatio: Number.isFinite(dpi) ? dpi : null
      };

      const defaultName = typeof defaultFileName === 'string' && defaultFileName.trim()
        ? defaultFileName.trim()
        : `map-snapshot-${Date.now()}.png`;

      const saveDialog = await dialog.showSaveDialog(state?.mainWindow || null, {
        title: 'Save Map Snapshot',
        defaultPath: defaultName,
        filters: [
          { name: 'PNG Image', extensions: ['png'] },
          { name: 'PDF Document', extensions: ['pdf'] }
        ]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { ok: false, canceled: true };
      }

      let targetPath = saveDialog.filePath;
      const ext = path.extname(targetPath).toLowerCase();
      const wantsPdf = ext === '.pdf';

      if (wantsPdf) {
        await createPdfFromPng({
          buffer,
          width: dimWidth,
          height: dimHeight,
          targetPath,
          BrowserWindow
        });
        return { ok: true, path: targetPath, meta };
      }

      if (!ext) {
        targetPath = appendExtension(targetPath, '.png');
      } else if (ext !== '.png') {
        const withoutExt = targetPath.slice(0, -ext.length);
        targetPath = appendExtension(withoutExt, '.png');
      }

      await fsp.writeFile(targetPath, buffer);
      return { ok: true, path: targetPath, meta };
    } catch (err) {
      console.error('map:save-map-snapshot failed', err);
      return { ok: false, error: err?.message || 'Failed to save map snapshot.' };
    }
  });
}

module.exports = { registerMapIPC };
