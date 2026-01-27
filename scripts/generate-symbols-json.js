const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'assets', 'symbols', 'png', '256');
const outputPath = path.join(__dirname, '..', 'assets', 'symbols.json');

const readDirSafe = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return null;
  }
};

const dirEntries = readDirSafe(baseDir);
if (!dirEntries) {
  console.error(`symbols: base directory not found: ${baseDir}`);
  process.exit(1);
}

const folderNames = dirEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const symbols = {};
folderNames.forEach((folder) => {
  const folderPath = path.join(baseDir, folder);
  const entries = readDirSafe(folderPath) || [];
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  symbols[folder] = files;
});

fs.writeFileSync(outputPath, JSON.stringify(symbols, null, 2) + '\n');
console.log(`symbols: wrote ${folderNames.length} folders to ${outputPath}`);
