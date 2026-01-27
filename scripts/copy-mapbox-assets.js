#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copy(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log('Copied', src, '->', dst);
}

function main() {
  const root = process.cwd();
  const srcDir = path.join(root, 'node_modules', 'mapbox-gl', 'dist');
  const outDir = path.join(root, 'dist', 'vendor', 'mapbox-gl');

  const files = [
    'mapbox-gl.css',
    'mapbox-gl.js',
    'mapbox-gl-csp.js',
    'mapbox-gl-csp-worker.js',
  ];

  if (!fs.existsSync(srcDir)) {
    console.error('mapbox-gl not found at', srcDir);
    process.exit(0);
  }

  ensureDir(outDir);
  files.forEach((f) => {
    const src = path.join(srcDir, f);
    const dst = path.join(outDir, f);
    if (fs.existsSync(src)) copy(src, dst);
  });

  const qrSrc = path.join(root, 'vendor', 'qrcode-generator.js');
  if (fs.existsSync(qrSrc)) {
    const qrDst = path.join(root, 'dist', 'vendor', 'qrcode-generator.js');
    copy(qrSrc, qrDst);
  }

  const firebaseSrcDir = path.join(root, 'node_modules', 'firebase');
  const firebaseOutDir = path.join(root, 'dist', 'vendor', 'firebase');
  const firebaseFiles = ['firebase-app-compat.js', 'firebase-firestore-compat.js'];
  if (fs.existsSync(firebaseSrcDir)) {
    ensureDir(firebaseOutDir);
    firebaseFiles.forEach((f) => {
      const src = path.join(firebaseSrcDir, f);
      const dst = path.join(firebaseOutDir, f);
      if (fs.existsSync(src)) copy(src, dst);
    });
  }
}

main();
