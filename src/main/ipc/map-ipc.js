'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const fsp = fs.promises;

const DATA_URL_REGEX = /^data:image\/png;base64,/i;
const MAX_DIMENSION = 8192;
const MIN_DIMENSION = 16;

const clampDimension = (value, fallback = 1024) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(MIN_DIMENSION, Math.min(Math.round(num), MAX_DIMENSION));
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

const PDF_PAGE_MM = {
  width: 210,
  height: 297
};

async function createPdfFromPng({ buffer, width, height, targetPath, BrowserWindow, forceLandscape = false }) {
  if (!BrowserWindow) throw new Error('BrowserWindow unavailable for PDF export');
  const pageWidthMm = forceLandscape ? PDF_PAGE_MM.height : PDF_PAGE_MM.width;
  const pageHeightMm = forceLandscape ? PDF_PAGE_MM.width : PDF_PAGE_MM.height;
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cynoops-map-pdf-'));
  const htmlPath = path.join(tempDir, 'index.html');
  const imagePath = path.join(tempDir, 'snapshot.png');
  const imageUrl = pathToFileURL(imagePath).toString();
  await fsp.writeFile(imagePath, buffer);
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }
    .page {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }
    img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <div class="page">
    <img src="${imageUrl}" alt="Map snapshot" />
  </div>
</body>
</html>`;
  await fsp.writeFile(htmlPath, html);

  const windowScale = 3;
  const windowWidth = Math.min(Math.max(Math.round(pageWidthMm * windowScale), 600), 1600);
  const windowHeight = Math.min(Math.max(Math.round(pageHeightMm * windowScale), 600), 1200);
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
    await pdfWindow.loadFile(htmlPath);
    await pdfWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const img = document.querySelector('img');
        const done = () => resolve();
        if (!img) return done();
        if (img.complete) {
          if (img.decode) {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
          return;
        }
        img.addEventListener('load', () => {
          if (img.decode) {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
        }, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 2000);
      })
    `);
    await pdfWindow.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
    );
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      landscape: forceLandscape,
      marginsType: 0,
      pageSize: 'A4'
    });
    await fsp.writeFile(targetPath, pdfBuffer);
  } finally {
    try { if (!pdfWindow.isDestroyed()) pdfWindow.close(); } catch {}
    try { if (!pdfWindow.isDestroyed()) pdfWindow.destroy(); } catch {}
    try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch {}
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
          BrowserWindow,
          forceLandscape: true
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

  ipcMain.handle('map:save-map-pdf', async (_event, payload = {}) => {
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
        : `map-snapshot-${Date.now()}.pdf`;

      const saveDialog = await dialog.showSaveDialog(state?.mainWindow || null, {
        title: 'Export Map PDF',
        defaultPath: defaultName,
        filters: [
          { name: 'PDF Document', extensions: ['pdf'] }
        ]
      });

      if (saveDialog.canceled || !saveDialog.filePath) {
        return { ok: false, canceled: true };
      }

      let targetPath = saveDialog.filePath;
      const ext = path.extname(targetPath).toLowerCase();

      if (!ext) {
        targetPath = appendExtension(targetPath, '.pdf');
      } else if (ext !== '.pdf') {
        targetPath = appendExtension(targetPath.slice(0, -ext.length), '.pdf');
      }

      await createPdfFromPng({
        buffer,
        width: dimWidth,
        height: dimHeight,
        targetPath,
        BrowserWindow,
        forceLandscape: true
      });
      return { ok: true, path: targetPath, meta };
    } catch (err) {
      console.error('map:save-map-pdf failed', err);
      return { ok: false, error: err?.message || 'Failed to export map PDF.' };
    }
  });
}

module.exports = { registerMapIPC };
