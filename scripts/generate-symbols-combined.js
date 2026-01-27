const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'assets', 'symbolsCombine.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'assets', 'symbols', 'final');
const DEFAULT_SIZE = 512;

const options = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(ROOT, options.input || DEFAULT_INPUT);
const outputRoot = path.resolve(ROOT, options.output || DEFAULT_OUTPUT);
const size = Number.isFinite(options.size) ? options.size : DEFAULT_SIZE;
const verbose = Boolean(options.verbose);

if (!fs.existsSync(inputPath)) {
  console.error(`symbols: symbolsCombine.json not found at ${inputPath}`);
  process.exit(1);
}

const magick = resolveMagick();
if (verbose) {
  const prefix = magick.argsPrefix.length ? ` ${magick.argsPrefix.join(' ')}` : '';
  console.log(`symbols: using ${magick.cmd}${prefix}`);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`symbols: failed to parse ${inputPath}: ${err.message}`);
  process.exit(1);
}

if (!data || typeof data !== 'object' || Array.isArray(data)) {
  console.error('symbols: symbolsCombine.json must be an object of groups');
  process.exit(1);
}

const trimCache = new Map();
let created = 0;
let skipped = 0;

for (const [groupName, entries] of Object.entries(data)) {
  if (!Array.isArray(entries)) {
    console.warn(`symbols: skipping group "${groupName}" (expected array)`);
    skipped += 1;
    continue;
  }

  const groupDir = path.join(outputRoot, safeName(groupName));
  ensureDir(groupDir);
  const usedNames = new Set();

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') {
      console.warn(`symbols: skipping invalid entry in "${groupName}" at index ${i}`);
      skipped += 1;
      continue;
    }

    const label = entry.label || entry.name || `entry_${i + 1}`;
    const baseName = makeUniqueName(safeName(label), usedNames);
    const outputPath = path.join(groupDir, `${baseName}.png`);

    const orderedLayers = [];
    if (entry.bottom) orderedLayers.push({ key: 'bottom', value: entry.bottom });
    if (entry.top) orderedLayers.push({ key: 'top', value: entry.top });

    if (orderedLayers.length === 0) {
      console.warn(`symbols: skipping "${label}" (no top/bottom defined)`);
      skipped += 1;
      continue;
    }

    try {
      const layers = buildLayers({
        orderedLayers,
        entry,
        size,
        magick,
        trimCache,
      });

      const args = ['-size', `${size}x${size}`, 'xc:none'];
      for (const layer of layers) {
        if (layer.type === 'image') {
          args.push(...buildImageLayerArgs(layer, size));
          continue;
        }

        const style = layer.style;
        const strokeArgs =
          style.stroke && style.stroke !== 'none'
            ? ['-stroke', style.stroke, '-strokewidth', String(style.strokeWidth)]
            : ['-stroke', 'none'];

        const fontArgs = style.font ? ['-font', style.font] : [];
        args.push(
          '(',
          '-background',
          'none',
          '-fill',
          style.fill,
          ...strokeArgs,
          ...fontArgs,
          '-pointsize',
          String(layer.pointSize),
          `label:${layer.text}`,
          '-trim',
          '+repage',
          ')',
          '-geometry',
          `+${layer.x}+${layer.y}`,
          '-compose',
          'over',
          '-composite',
        );
      }

      args.push(outputPath);
      runMagick(magick, args);
      created += 1;
      if (verbose) {
        console.log(`symbols: wrote ${path.relative(ROOT, outputPath)}`);
      }
    } catch (err) {
      skipped += 1;
      console.error(`symbols: failed "${label}" in "${groupName}": ${err.message}`);
    }
  }
}

console.log(
  `symbols: combined ${created} image(s). Skipped ${skipped}. Output: ${path.relative(
    ROOT,
    outputRoot,
  )}`,
);

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    size: DEFAULT_SIZE,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') {
      options.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--output' || arg === '-o') {
      options.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--size' || arg === '-s') {
      options.size = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    console.warn(`symbols: unknown option "${arg}"`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/generate-symbols-combined.js [options]

Options:
  -i, --input   Path to symbolsCombine.json
  -o, --output  Output directory (default: assets/symbols/final)
  -s, --size    Output size (default: 512)
  -v, --verbose Verbose logging
  -h, --help    Show this help
`);
}

function resolveMagick() {
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push({ cmd: 'magick', argsPrefix: [], testArgs: ['-version'] });
    candidates.push({ cmd: 'gm', argsPrefix: ['convert'], testArgs: ['-version'] });
  } else {
    candidates.push({ cmd: 'magick', argsPrefix: [], testArgs: ['-version'] });
    candidates.push({ cmd: 'convert', argsPrefix: [], testArgs: ['-version'] });
    candidates.push({ cmd: 'gm', argsPrefix: ['convert'], testArgs: ['-version'] });
  }

  for (const candidate of candidates) {
    const res = spawnSync(candidate.cmd, candidate.testArgs, { stdio: 'ignore' });
    if (!res.error && res.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    'symbols: ImageMagick not found. Install ImageMagick (magick/convert) or GraphicsMagick (gm).',
  );
}

function runMagick(magickCmd, args, options = {}) {
  const result = spawnSync(magickCmd.cmd, [...magickCmd.argsPrefix, ...args], {
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(message || `ImageMagick exited with code ${result.status}`);
  }
  return options.capture ? result.stdout : '';
}

function buildLayers({ orderedLayers, entry, size, magick, trimCache }) {
  const normalized = orderedLayers.map((layer) => ({
    key: layer.key,
    layer: normalizeLayer(layer.value),
  }));

  const defaultTransform =
    entry && entry.transform !== undefined && entry.transform !== null
      ? normalizeTransform(entry.transform)
      : null;

  const imagePaths = {};
  const imageTransforms = {};
  for (const item of normalized) {
    if (!item.layer || item.layer.type !== 'image') continue;
    const resolved = resolveImagePath(item.layer.src);
    if (!resolved) {
      throw new Error(`missing image for "${item.key}": ${item.layer.src}`);
    }
    imagePaths[item.key] = resolved;
    imageTransforms[item.key] = item.layer.transform ?? defaultTransform;
  }

  const referenceKey = imagePaths.bottom ? 'bottom' : imagePaths.top ? 'top' : null;
  const referencePath = referenceKey ? imagePaths[referenceKey] : null;
  const referenceTransform = referenceKey ? imageTransforms[referenceKey] : null;
  const referenceBox = referencePath
    ? getTrimmedBox(referencePath, size, magick, trimCache, referenceTransform)
    : { x: 0, y: 0, width: size, height: size };

  const layers = [];
  for (const item of normalized) {
    if (!item.layer) continue;
    if (item.layer.type === 'image') {
      const effectiveTransform = item.layer.transform ?? defaultTransform;
      layers.push({
        type: 'image',
        path: imagePaths[item.key],
        transform: effectiveTransform,
      });
      continue;
    }

    const labelLayer = buildLabelLayer({
      label: item.layer,
      referenceBox,
      size,
      magick,
    });
    layers.push(labelLayer);
  }

  return layers;
}

function normalizeLayer(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return { type: 'image', src: value };
  }
  if (typeof value === 'object') {
    if (value.type === 'label') {
      return { ...value, type: 'label', text: value.text };
    }
    if (value.type === 'image' && value.src) {
      return { type: 'image', src: value.src, transform: normalizeTransform(value.transform) };
    }
    if (value.src) {
      return { type: 'image', src: value.src, transform: normalizeTransform(value.transform) };
    }
  }
  return null;
}

function buildLabelLayer({ label, referenceBox, size, magick }) {
  const text = String(label.text ?? '').trim();
  if (!text) {
    throw new Error('label text is missing');
  }

  const hasPosition =
    label.position !== undefined &&
    label.position !== null &&
    String(label.position).trim() !== '';
  const position = hasPosition ? parsePosition(label.position, true) : null;
  const style = {
    fill: label.fill || '#000000',
    stroke: label.stroke || 'none',
    strokeWidth: toNumber(label.strokeWidth, 0),
    font: label.font || null,
    padding: toNumber(label.padding, 12),
    maxPointSize: toNumber(label.maxPointSize, Math.round(size * 0.45)),
    minPointSize: toNumber(label.minPointSize, Math.round(size * 0.12)),
    pointSize: Number.isFinite(Number(label.pointSize)) ? Number(label.pointSize) : null,
    offsetX: toNumber(label.offsetX, toNumber(label.dx, 0)),
    offsetY: toNumber(label.offsetY, toNumber(label.dy, 0)),
  };

  const boxWidth = Math.max(1, referenceBox.width - style.padding * 2);
  const boxHeight = Math.max(1, referenceBox.height - style.padding * 2);

  let metrics;
  let pointSize = style.pointSize;
  if (pointSize) {
    metrics = measureText(magick, text, style, pointSize);
  } else {
    const fit = fitText(magick, text, style, boxWidth, boxHeight);
    pointSize = fit.pointSize;
    metrics = fit.metrics;
  }

  let x;
  let y;
  if (position) {
    const canvasBox = { x: 0, y: 0, width: size, height: size };
    x = position.centerX
      ? canvasBox.x + (canvasBox.width - metrics.width) / 2
      : position.x;
    y = position.centerY
      ? canvasBox.y + (canvasBox.height - metrics.height) / 2
      : position.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`invalid label position "${label.position}"`);
    }
    x += style.offsetX;
    y += style.offsetY;
    x = Math.round(x);
    y = Math.round(y);
  } else {
    x = Math.round(
      referenceBox.x + (referenceBox.width - metrics.width) / 2 + style.offsetX,
    );
    y = Math.round(
      referenceBox.y + (referenceBox.height - metrics.height) / 2 + style.offsetY,
    );
  }

  return {
    type: 'label',
    text,
    style,
    pointSize,
    x,
    y,
  };
}

function measureText(magick, text, style, pointSize) {
  const strokeArgs =
    style.stroke && style.stroke !== 'none'
      ? ['-stroke', style.stroke, '-strokewidth', String(style.strokeWidth)]
      : ['-stroke', 'none'];
  const fontArgs = style.font ? ['-font', style.font] : [];
  const args = [
    '-background',
    'none',
    '-fill',
    style.fill,
    ...strokeArgs,
    ...fontArgs,
    '-pointsize',
    String(pointSize),
    `label:${text}`,
    '-trim',
    '-format',
    '%w %h',
    'info:',
  ];

  const output = runMagick(magick, args, { capture: true }).trim();
  const [width, height] = output.split(/\s+/).map((value) => Number(value));
  return {
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  };
}

function fitText(magick, text, style, maxWidth, maxHeight) {
  const maxPointSize = Math.max(style.maxPointSize, style.minPointSize);
  const minPointSize = Math.max(1, style.minPointSize);
  let best = null;

  for (let size = maxPointSize; size >= minPointSize; size -= 2) {
    const metrics = measureText(magick, text, style, size);
    if (metrics.width <= maxWidth && metrics.height <= maxHeight) {
      return { pointSize: size, metrics };
    }
    if (!best) {
      best = { pointSize: size, metrics };
    }
  }

  return best || {
    pointSize: minPointSize,
    metrics: { width: 0, height: 0 },
  };
}

function getTrimmedBox(imagePath, size, magick, trimCache, transform = null) {
  const cacheKey = transform
    ? `${imagePath}|scale:${transform.scale ?? 1}|rotate:${transform.rotate ?? 0}`
    : imagePath;
  if (trimCache.has(cacheKey)) return trimCache.get(cacheKey);

  const args = buildImageTransformArgs(imagePath, size, transform);
  args.push('-trim', '-format', '%@', 'info:');
  const output = runMagick(magick, args, {
    capture: true,
  }).trim();
  const match = output.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
  if (!match) {
    const fallback = { x: 0, y: 0, width: size, height: size };
    trimCache.set(cacheKey, fallback);
    return fallback;
  }

  const box = {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4]),
  };
  trimCache.set(cacheKey, box);
  return box;
}

function parsePosition(value, strict = false) {
  if (value === undefined || value === null || value === '') return null;

  const parsed = parsePositionTokens(value);
  if (!parsed) {
    if (strict) throw new Error(`invalid label position "${value}"`);
    return null;
  }

  const { x, y } = parsed;
  if (x === null || y === null) {
    if (strict) throw new Error(`invalid label position "${value}"`);
    return null;
  }
  const centerX = x === 'center';
  const centerY = y === 'center';

  return {
    x: centerX ? null : x,
    y: centerY ? null : y,
    centerX,
    centerY,
  };
}

function parsePositionTokens(value) {
  if (Array.isArray(value)) {
    if (value.length < 2) return null;
    return { x: parseToken(value[0]), y: parseToken(value[1]) };
  }

  if (typeof value === 'object') {
    if ('x' in value && 'y' in value) {
      return { x: parseToken(value.x), y: parseToken(value.y) };
    }
    return null;
  }

  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    return { x: parseToken(parts[0]), y: parseToken(parts[1]) };
  }

  return null;
}

function parseToken(token) {
  if (token === undefined || token === null) return null;
  if (typeof token === 'string') {
    const trimmed = token.trim().toLowerCase();
    if (!trimmed) return null;
    if (trimmed === 'center') return 'center';
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  if (typeof token === 'number') {
    return Number.isFinite(token) ? token : null;
  }
  return null;
}

function normalizeTransform(transform) {
  if (transform === undefined || transform === null) return null;
  if (typeof transform !== 'object') {
    throw new Error('transform must be an object with scale/rotate');
  }

  const scale = parseScale(transform.scale);
  const rotate = parseRotate(transform.rotate);

  if (scale === null && rotate === null) {
    throw new Error('transform must include scale and/or rotate');
  }

  return {
    scale: scale === null ? 1 : scale,
    rotate: rotate === null ? 0 : rotate,
  };
}

function parseScale(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const percentMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
      const num = Number(percentMatch[1]);
      return Number.isFinite(num) && num > 0 ? num / 100 : null;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  return null;
}

function parseRotate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    const degMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (degMatch) {
      const num = Number(degMatch[1]);
      return Number.isFinite(num) ? num : null;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function buildImageLayerArgs(layer, size) {
  if (!layer.transform) {
    return [layer.path, '-compose', 'over', '-composite'];
  }

  const args = buildImageTransformArgs(layer.path, size, layer.transform);
  args.push('-compose', 'over', '-composite');
  return args;
}

function buildImageTransformArgs(imagePath, size, transform) {
  if (!transform) {
    return [imagePath];
  }

  const args = ['(', imagePath, '-background', 'none'];

  if (transform && Number.isFinite(transform.scale) && transform.scale !== 1) {
    const percent = Math.max(0, transform.scale) * 100;
    const formatted = Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
    args.push('-resize', formatted);
  }

  if (transform && Number.isFinite(transform.rotate) && transform.rotate !== 0) {
    args.push('-rotate', String(transform.rotate));
  }

  args.push('-gravity', 'center', '-extent', `${size}x${size}`);

  args.push(')');
  return args;
}

function resolveImagePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  const direct = path.isAbsolute(trimmed) ? trimmed : path.resolve(ROOT, trimmed);
  if (fs.existsSync(direct)) return direct;

  const patched = path.normalize(
    direct.replace(/assets[\\/]+symbols[\\/]+512[\\/]/, `assets${path.sep}symbols${path.sep}png${path.sep}512${path.sep}`),
  );
  if (fs.existsSync(patched)) return patched;

  const fallback = path.normalize(
    direct.replace(
      /assets[\\/]+symbols[\\/]+/,
      `assets${path.sep}symbols${path.sep}png${path.sep}`,
    ),
  );
  if (fs.existsSync(fallback)) return fallback;

  return null;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'symbol';
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'symbol';
}

function makeUniqueName(base, used) {
  let name = base || 'symbol';
  let counter = 1;
  while (used.has(name)) {
    counter += 1;
    name = `${base}_${counter}`;
  }
  used.add(name);
  return name;
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
