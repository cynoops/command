(() => {
  const q = (sel) => document.querySelector(sel);
  const ce = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };
  const DEFAULT_HOME_CENTER = [6.3729914, 49.5658574];
  const DEFAULT_MAP_START = [6.13, 49.61];
  const DEFAULT_STYLE_URL = 'mapbox://mapbox.mapbox-terrain-v2';
  const DEFAULT_START_ZOOM = 12;
  const DEFAULT_APP_LANGUAGE = 'en';
  const LANGUAGE_CODES = ['en','de','fr','es','it'];
  const LANGUAGE_LABELS = {
    en: { en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian' },
    de: { en: 'Englisch', de: 'Deutsch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch' },
    fr: { en: 'Anglais', de: 'Allemand', fr: 'Français', es: 'Espagnol', it: 'Italien' },
    es: { en: 'Inglés', de: 'Alemán', fr: 'Francés', es: 'Español', it: 'Italiano' },
    it: { en: 'Inglese', de: 'Tedesco', fr: 'Francese', es: 'Spagnolo', it: 'Italiano' },
  };
  const generateSessionId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const bytes = new Uint8Array(5);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch {}
    const fallback = Math.floor(Math.random() * 0xffffffffff)
      .toString(16)
      .padStart(10, '0');
    return fallback.slice(0, 10);
  };
  let teamsSessionId = null;
  let teamsSessionInfo = null;
  let teamsSessionTrackerIds = new Set();
  let teamsSessionSubscriptionId = null;
  let teamsSessionSubscription = null;
  let teamsSessionTrackersSubscriptionId = null;
  let teamsSessionTrackersSubscription = null;
  let teamsSessionTitleUpdateInFlight = false;
  let teamsSessionEndInFlight = false;
  const generateTrackerId = () => generateSessionId();
  const DRAWING_ICON_PATHS = {
    edit: './assets/icons/regular/pencil-simple.svg',
    hide: './assets/icons/regular/eye-slash.svg',
    show: './assets/icons/regular/eye.svg',
    labelShow: './assets/icons/regular/text-t.svg',
    labelHide: './assets/icons/regular/text-t-slash.svg',
    size: './assets/icons/regular/ruler.svg',
    focus: './assets/icons/regular/crosshair.svg',
    ai: './assets/icons/regular/sparkle.svg',
    delete: './assets/icons/regular/x.svg',
    poiIcon: './assets/icons/regular/image-square.svg',
    trim: './assets/icons/regular/scissors.svg'
  };
  const TEAMS_SESSION_ICON_PATHS = {
    delete: './assets/icons/regular/trash-simple.svg'
  };
  const TEAMS_SESSION_SUBCOLLECTIONS = ['trackers', 'updates', 'tracks'];
  const FEATURE_NAME_MAX = 26;
  const FEATURE_IMPORT_BASE = 24;
  const FEATURE_NAME_ELLIPSIS = '...';
  const FEATURE_IMPORT_MAX = FEATURE_IMPORT_BASE + FEATURE_NAME_ELLIPSIS.length;
  const SESSION_TITLE_OVERLAY_MAX = 44;
  const SESSION_TITLE_ELLIPSIS = '...';
  const SYMBOLS_JSON_PATH = './assets/symbolsCombine.json';
  const SYMBOLS_ICON_ROOT = './assets/symbols/final';
  const SYMBOLS_ICON_FALLBACK_ROOT = '';

  const normalizeLineBreaks = (value) => {
    if (value == null) return '';
    return String(value).replace(/\r\n?/g, '\n');
  };
  const parseFirebaseSettingsText = (rawText) => {
    const normalized = normalizeLineBreaks(rawText || '');
    if (!normalized.trim()) return { value: null, raw: normalized };
    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: new Error('Firebase settings must be a JSON object.'), raw: normalized };
      }
      return { value: parsed, raw: normalized };
    } catch (error) {
      return { error, raw: normalized };
    }
  };
  const sanitizeFeatureName = (value, { allowImportEllipsis = false } = {}) => {
    if (value == null) return '';
    let str = normalizeLineBreaks(value);
    str = str.trim();
    if (!str) return '';
    const lines = str.split('\n');
    if (lines.length > 1) {
      const maxPerLine = FEATURE_NAME_MAX;
      return lines
        .map((line) => {
          let cleaned = line.trim();
          if (cleaned.length > maxPerLine) cleaned = cleaned.slice(0, maxPerLine);
          return cleaned;
        })
        .join('\n');
    }
    const baseLimit = FEATURE_NAME_MAX;
    if (str.length > baseLimit) {
      if (allowImportEllipsis && str.endsWith(FEATURE_NAME_ELLIPSIS)) {
        const ellipsisLimit = Math.max(baseLimit, FEATURE_IMPORT_MAX);
        if (str.length > ellipsisLimit) str = str.slice(0, ellipsisLimit);
      } else {
        str = str.slice(0, baseLimit);
      }
    }
    return str;
  };
  const sanitizeFeatureNameDraft = (value) => {
    if (value == null) return '';
    const str = normalizeLineBreaks(value);
    if (!str) return '';
    const lines = str.split('\n');
    return lines
      .map((line) => {
        if (line.length > FEATURE_NAME_MAX) return line.slice(0, FEATURE_NAME_MAX);
        return line;
      })
      .join('\n');
  };

  const formatImportedFeatureName = (value) => {
    const trimmed = sanitizeFeatureName(value, { allowImportEllipsis: false });
    if (!trimmed) return '';
    if (trimmed.includes('\n')) return trimmed;
    if (trimmed.length > FEATURE_NAME_MAX) {
      const base = trimmed.slice(0, FEATURE_IMPORT_BASE);
      return sanitizeFeatureName(`${base}${FEATURE_NAME_ELLIPSIS}`, { allowImportEllipsis: true });
    }
    return trimmed;
  };
  const formatOverlaySessionTitle = (value) => {
    const normalized = normalizeLineBreaks(value || '');
    const cleaned = normalized.replace(/\s+/g, ' ').trim();
    if (!cleaned) return { text: '', full: '', truncated: false };
    if (cleaned.length <= SESSION_TITLE_OVERLAY_MAX) {
      return { text: cleaned, full: cleaned, truncated: false };
    }
    const limit = Math.max(1, SESSION_TITLE_OVERLAY_MAX - SESSION_TITLE_ELLIPSIS.length);
    const sliced = cleaned.slice(0, limit).trimEnd();
    return { text: `${sliced}${SESSION_TITLE_ELLIPSIS}`, full: cleaned, truncated: true };
  };
  const makeButtonIcon = (src) => {
    const img = document.createElement('img');
    img.className = 'icon';
    img.src = src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    return img;
  };
  const translationState = {
    data: null,
    promise: null,
    language: DEFAULT_APP_LANGUAGE,
    reverseLookup: new Map()
  };
  const ensureTranslationsLoaded = () => {
    if (translationState.promise) return translationState.promise;
    translationState.promise = fetch('./translations.json')
      .then((resp) => (resp && resp.ok) ? resp.json() : null)
      .then((json) => {
        if (json && typeof json === 'object') {
          translationState.data = json;
          const english = json[DEFAULT_APP_LANGUAGE] || {};
          const reverse = new Map();
          Object.entries(english).forEach(([key, value]) => {
            if (typeof value === 'string' && !reverse.has(value)) reverse.set(value, key);
          });
          translationState.reverseLookup = reverse;
        } else {
          translationState.data = null;
          translationState.reverseLookup = new Map();
        }
        return translationState.data;
      })
      .catch((err) => {
        console.error('Failed to load translations', err);
        translationState.data = null;
        translationState.reverseLookup = new Map();
        return null;
      });
    return translationState.promise;
  };
  const t = (key, fallback) => {
    const lang = translationState.language || DEFAULT_APP_LANGUAGE;
    const data = translationState.data;
    if (data && data[lang] && typeof data[lang][key] === 'string') return data[lang][key];
    if (data && data[DEFAULT_APP_LANGUAGE] && typeof data[DEFAULT_APP_LANGUAGE][key] === 'string') return data[DEFAULT_APP_LANGUAGE][key];
    return fallback ?? key;
  };
  const translateString = (english, keyOverride) => {
    if (!english) return english;
    const dataKey = keyOverride || translationState.reverseLookup.get(english);
    return dataKey ? t(dataKey, english) : english;
  };
  const bindText = (el, key, fallback = '') => {
    if (!el) return;
    el.dataset.i18n = key;
    el.textContent = t(key, fallback);
  };
  const bindHtml = (el, key, fallback = '') => {
    if (!el) return;
    el.dataset.i18nHtml = key;
    el.innerHTML = t(key, fallback);
  };
  const bindAttr = (el, attr, key, fallback = '') => {
    if (!el) return;
    const map = {
      title: 'i18nTitle',
      'aria-label': 'i18nAriaLabel',
      'aria-describedby': 'i18nAriaDescribedby',
      'aria-labelledby': 'i18nAriaLabelledby',
      placeholder: 'i18nPlaceholder',
      'data-tooltip': 'i18nDataTooltip'
    };
    const dsKey = map[attr];
    if (!dsKey) return;
    el.dataset[dsKey] = key;
    el.setAttribute(attr, t(key, fallback));
  };
  const bindTextAuto = (el, key) => bindText(el, key, el?.textContent || '');
  const bindHtmlAuto = (el, key) => bindHtml(el, key, el?.innerHTML || '');
  const bindAttrAuto = (el, attr, key) => bindAttr(el, attr, key, el?.getAttribute?.(attr) || '');

  const symbolCatalogState = {
    data: null,
    list: [],
    groups: [],
    byId: new Map(),
    promise: null
  };
  const poiIconImageCache = new Map();
  const normalizeSymbolFile = (value) => {
    if (value == null) return '';
    const str = String(value).trim();
    return str ? str.replace(/\\/g, '/') : '';
  };
  const normalizeSymbolLabel = (value, fallback) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
    return fallback;
  };
  const safeSymbolName = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'symbol';
    let normalized = raw;
    if (typeof normalized.normalize === 'function') normalized = normalized.normalize('NFKD');
    normalized = normalized
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return normalized || 'symbol';
  };
  const makeUniqueSymbolName = (base, used) => {
    let name = base || 'symbol';
    let counter = 1;
    while (used.has(name)) {
      counter += 1;
      name = `${base}_${counter}`;
    }
    used.add(name);
    return name;
  };
  const formatSymbolLabel = (group, base) => {
    const name = (base || '').replace(/_/g, ' ').trim();
    if (!group) return name || base || '';
    if (!name) return String(group);
    return `${group} / ${name}`;
  };
  const buildSymbolCatalog = (json) => {
    const list = [];
    const groups = [];
    const byId = new Map();
    if (!json || typeof json !== 'object') return { list, groups, byId };
    const groupEntries = Object.entries(json);
    const hasOnlyLegacyEntries = groupEntries.every(([, entries]) =>
      Array.isArray(entries) && entries.every((entry) => typeof entry === 'string'),
    );
    groupEntries.forEach(([group, entries]) => {
      if (!Array.isArray(entries) || !entries.length) return;
      const isLegacy = entries.every((entry) => typeof entry === 'string');
      const groupKey = isLegacy ? group : safeSymbolName(group);
      const groupList = [];
      const usedNames = new Set();

      entries.forEach((entry, index) => {
        if (isLegacy) {
          const cleaned = normalizeSymbolFile(entry);
          if (!cleaned) return;
          const base = cleaned.replace(/\.[^/.]+$/i, '');
          if (!base) return;
          const filename = cleaned.toLowerCase().endsWith('.png') ? cleaned : `${base}.png`;
          const id = `${groupKey}/${base}`;
          const entryData = {
            id,
            group,
            base,
            label: formatSymbolLabel(group, base),
            src: `${SYMBOLS_ICON_ROOT}/${groupKey}/${filename}`,
            fallbackSrc: SYMBOLS_ICON_FALLBACK_ROOT
              ? `${SYMBOLS_ICON_FALLBACK_ROOT}/${groupKey}/${base}.svg`
              : ''
          };
          list.push(entryData);
          groupList.push(entryData);
          byId.set(id, entryData);
          return;
        }

        if (!entry || typeof entry !== 'object') return;
        if (!entry.top && !entry.bottom) return;
        const fallbackLabel = `entry_${index + 1}`;
        const label = normalizeSymbolLabel(entry.label || entry.name, fallbackLabel);
        const base = makeUniqueSymbolName(safeSymbolName(label), usedNames);
        const id = `${groupKey}/${base}`;
        const entryData = {
          id,
          group,
          base,
          label,
          src: `${SYMBOLS_ICON_ROOT}/${groupKey}/${base}.png`,
          fallbackSrc: SYMBOLS_ICON_FALLBACK_ROOT
            ? `${SYMBOLS_ICON_FALLBACK_ROOT}/${groupKey}/${base}.png`
            : ''
        };
        list.push(entryData);
        groupList.push(entryData);
        byId.set(id, entryData);
      });

      if (!groupList.length) return;
      if (isLegacy) {
        groupList.sort((a, b) => a.base.localeCompare(b.base));
      }
      groups.push({ label: group, entries: groupList });
    });

    if (hasOnlyLegacyEntries) {
      groups.sort((a, b) => a.label.localeCompare(b.label));
    }
    return { list, groups, byId };
  };
  const ensureSymbolsLoaded = () => {
    if (symbolCatalogState.promise) return symbolCatalogState.promise;
    symbolCatalogState.promise = fetch(SYMBOLS_JSON_PATH)
      .then((resp) => (resp && resp.ok) ? resp.json() : null)
      .then((json) => {
        if (!json || typeof json !== 'object') {
          symbolCatalogState.data = null;
          symbolCatalogState.list = [];
          symbolCatalogState.groups = [];
          symbolCatalogState.byId = new Map();
          return symbolCatalogState.list;
        }
        const { list, groups, byId } = buildSymbolCatalog(json);
        symbolCatalogState.data = json;
        symbolCatalogState.list = list;
        symbolCatalogState.groups = groups;
        symbolCatalogState.byId = byId;
        return list;
      })
      .catch((err) => {
        console.error('Failed to load symbols catalog', err);
        symbolCatalogState.data = null;
        symbolCatalogState.list = [];
        symbolCatalogState.groups = [];
        symbolCatalogState.byId = new Map();
        return symbolCatalogState.list;
      });
    return symbolCatalogState.promise;
  };
  const loadPoiIconImage = (entry) => {
    if (!entry) return Promise.resolve(null);
    if (poiIconImageCache.has(entry.id)) return poiIconImageCache.get(entry.id);
    const loadImage = (src) => new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      } catch (err) {
        console.warn('Failed to prepare POI icon', err);
        resolve(null);
      }
    });
    const promise = (async () => {
      const primary = await loadImage(entry.src);
      if (primary) return primary;
      return loadImage(entry.fallbackSrc);
    })();
    poiIconImageCache.set(entry.id, promise);
    return promise;
  };
  const ensurePoiIconImageOnMap = async (map, entry) => {
    if (!map || !entry || typeof map.hasImage !== 'function' || typeof map.addImage !== 'function') return false;
    if (map.hasImage(entry.id)) return true;
    const img = await loadPoiIconImage(entry);
    if (!img) return false;
    try {
      if (!map.hasImage(entry.id)) {
        map.addImage(entry.id, img);
      }
      return true;
    } catch (err) {
      console.warn('Failed adding POI icon to map', err);
      return false;
    }
  };
  const ensurePoiIconsLoaded = async (map, features) => {
    if (!map) return;
    await ensureSymbolsLoaded();
    const list = Array.isArray(features) ? features : [];
    const ids = new Set();
    list.forEach((f) => {
      const id = typeof f?.properties?.poiIcon === 'string' ? f.properties.poiIcon.trim() : '';
      if (id) ids.add(id);
    });
    if (!ids.size) return;
    await Promise.all([...ids].map((id) => ensurePoiIconImageOnMap(map, symbolCatalogState.byId.get(id))));
  };

  const POI_ICON_NONE_LABEL = 'No icon';
  const POI_ICON_LOADING_LABEL = 'Loading icons...';
  const POI_ICON_EMPTY_LABEL = 'No icons available';
  const updatePoiIconPreview = (previewEl, entry) => {
    if (!previewEl) return;
    if (!entry || !entry.src) {
      previewEl.hidden = true;
      previewEl.removeAttribute('src');
      previewEl.alt = '';
      return;
    }
    previewEl.hidden = false;
    previewEl.src = entry.src;
    previewEl.alt = '';
  };
  const populatePoiIconPreview = (previewEl, currentId) => {
    if (!previewEl) return;
    const selected = typeof currentId === 'string' ? currentId : '';
    updatePoiIconPreview(previewEl, symbolCatalogState.byId.get(selected));
    if (!symbolCatalogState.list.length) {
      ensureSymbolsLoaded()
        .then(() => updatePoiIconPreview(previewEl, symbolCatalogState.byId.get(selected)))
        .catch(() => {});
    }
  };
  const fillPoiIconSelect = (selectEl, previewEl, currentId) => {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = POI_ICON_NONE_LABEL;
    selectEl.appendChild(noneOpt);
    if (!symbolCatalogState.groups.length) {
      const placeholder = document.createElement('option');
      placeholder.disabled = true;
      placeholder.textContent = symbolCatalogState.promise ? POI_ICON_LOADING_LABEL : POI_ICON_EMPTY_LABEL;
      selectEl.appendChild(placeholder);
    } else {
      symbolCatalogState.groups.forEach((group) => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = group.label;
        group.entries.forEach((entry) => {
          const opt = document.createElement('option');
          opt.value = entry.id;
          opt.textContent = entry.label;
          optGroup.appendChild(opt);
        });
        selectEl.appendChild(optGroup);
      });
    }
    const selected = typeof currentId === 'string' ? currentId : '';
    selectEl.value = selected;
    updatePoiIconPreview(previewEl, symbolCatalogState.byId.get(selected));
  };
  const populatePoiIconSelect = (selectEl, previewEl, currentId) => {
    if (!selectEl) return;
    if (symbolCatalogState.list.length) {
      fillPoiIconSelect(selectEl, previewEl, currentId);
      return;
    }
    fillPoiIconSelect(selectEl, previewEl, currentId);
    ensureSymbolsLoaded().then(() => {
      fillPoiIconSelect(selectEl, previewEl, currentId);
    }).catch(() => {});
  };

  const placeCaretAtEnd = (el) => {
    if (!el) return;
    try {
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {}
  };
  const insertEditableText = (el, text) => {
    if (!el || !text) return;
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        el.textContent = (el.textContent || '') + text;
        return;
      }
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {}
  };

  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;
  const clampLatForMercator = (lat) => Math.max(Math.min(lat, 89.999999), -89.999999);
  const EARTH_CIRCUMFERENCE_METERS = 40075016.68557849;
  const DEFAULT_MAP_TILE_SIZE = 512;
  const getMapTileSize = (mapInstance) => {
    const tileSize = mapInstance?.transform?.tileSize;
    return Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_MAP_TILE_SIZE;
  };
  const getMetersPerPixelAtLatitude = (mapInstance, lat, zoom) => {
    if (!Number.isFinite(lat) || !Number.isFinite(zoom)) return null;
    const mapboxHelper = (window).mapboxgl?.getMetersPerPixelAtLatitude;
    if (typeof mapboxHelper === 'function') {
      try {
        return mapboxHelper(lat, zoom);
      } catch {}
    }
    const safeLat = clampLatForMercator(lat);
    const tileSize = getMapTileSize(mapInstance);
    const worldSize = tileSize * Math.pow(2, zoom);
    if (!Number.isFinite(worldSize) || worldSize <= 0) return null;
    return Math.cos(safeLat * DEG_TO_RAD) * EARTH_CIRCUMFERENCE_METERS / worldSize;
  };
  const normalizeLongitude = (lng) => {
    if (!Number.isFinite(lng)) return lng;
    let value = lng;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  };
  const formatFixed = (value, digits = 6) => (Number.isFinite(value) ? value.toFixed(digits) : '—');
  let currentCoordinateSystem = 'latlng';
  const getCentralMeridian = (zoneNumber) => ((zoneNumber - 1) * 6) - 180 + 3;
  const dmsParts = (value) => {
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutesFull = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFull);
    const seconds = (minutesFull - minutes) * 60;
    return { degrees, minutes, seconds };
  };
  const formatDmsCoordinate = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '—';
    const latCardinal = lat >= 0 ? 'N' : 'S';
    const lngCardinal = lng >= 0 ? 'E' : 'W';
    const latParts = dmsParts(lat);
    const lngParts = dmsParts(lng);
    const fmt = ({ degrees, minutes, seconds }) => `${degrees}° ${minutes}' ${seconds.toFixed(2)}"`;
    return `${fmt(latParts)} ${latCardinal}, ${fmt(lngParts)} ${lngCardinal}`;
  };
  const generateQrDataUrl = (text, size = 256, margin = 4) => {
    try {
      if (typeof qrcode !== 'function') throw new Error('QR library unavailable');
      const qr = qrcode(0, 'M');
      qr.addData(String(text ?? ''));
      qr.make();
      const moduleCount = qr.getModuleCount();
      if (!moduleCount) throw new Error('Empty QR matrix');
      const safeMargin = Number.isFinite(margin) ? Math.max(0, Math.floor(margin)) : 4;
      const targetSize = Number.isFinite(size) && size > 0 ? size : 256;
      const totalModules = moduleCount + (safeMargin * 2);
      const moduleSize = Math.max(1, Math.floor(targetSize / totalModules));
      const outputSize = totalModules * moduleSize;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.fillStyle = '#000000';
      const offset = safeMargin * moduleSize;
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          if (!qr.isDark(row, col)) continue;
          ctx.fillRect(offset + col * moduleSize, offset + row * moduleSize, moduleSize, moduleSize);
        }
      }
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('generateQrDataUrl failed', err);
      return null;
    }
  };
  const getUtmZoneLetter = (lat) => {
    const letters = 'CDEFGHJKLMNPQRSTUVWX';
    const clampedLat = Math.max(Math.min(lat, 90), -90);
    if (clampedLat <= -80) return 'C';
    if (clampedLat >= 84) return 'X';
    const idx = Math.floor((clampedLat + 80) / 8);
    return letters.charAt(Math.max(0, Math.min(idx, letters.length - 1))) || 'X';
  };
  const utmFromLatLng = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const wrappedLng = normalizeLongitude(lng);
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const eSq = f * (2 - f);
    const ePrimeSq = eSq / (1 - eSq);
    let zoneNumber = Math.floor((wrappedLng + 180) / 6) + 1;
    if (lat >= 56.0 && lat < 64.0 && wrappedLng >= 3.0 && wrappedLng < 12.0) zoneNumber = 32;
    if (lat >= 72.0 && lat < 84.0) {
      if (wrappedLng >= 0.0 && wrappedLng < 9.0) zoneNumber = 31;
      else if (wrappedLng >= 9.0 && wrappedLng < 21.0) zoneNumber = 33;
      else if (wrappedLng >= 21.0 && wrappedLng < 33.0) zoneNumber = 35;
      else if (wrappedLng >= 33.0 && wrappedLng < 42.0) zoneNumber = 37;
    }
    const latRad = lat * DEG_TO_RAD;
    const lngRad = wrappedLng * DEG_TO_RAD;
    const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
    const lonOriginRad = lonOrigin * DEG_TO_RAD;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const tanLat = Math.tan(latRad);
    const N = a / Math.sqrt(1 - eSq * sinLat * sinLat);
    const T = tanLat * tanLat;
    const C = ePrimeSq * cosLat * cosLat;
    const A = cosLat * (lngRad - lonOriginRad);
    const e4 = eSq * eSq;
    const e6 = e4 * eSq;
    const M = a * ((1 - eSq / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latRad
      - (3 * eSq / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * latRad)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * latRad)
      - (35 * e6 / 3072) * Math.sin(6 * latRad));
    let easting = k0 * N * (A
      + (1 - T + C) * Math.pow(A, 3) / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * Math.pow(A, 5) / 120) + 500000;
    let northing = k0 * (M + N * tanLat * (Math.pow(A, 2) / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * Math.pow(A, 6) / 720));
    const hemisphere = lat >= 0 ? 'N' : 'S';
    if (lat < 0) northing += 10000000;
    return {
      zoneNumber,
      hemisphere,
      zoneLetter: getUtmZoneLetter(lat),
      easting,
      northing
    };
  };
  const parseUtmZoneInput = (value) => {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) return null;
    const match = text.match(/^(\d{1,2})([C-HJ-NP-X])$/);
    if (!match) return null;
    const zoneNumber = Number(match[1]);
    const zoneLetter = match[2];
    if (!Number.isFinite(zoneNumber) || zoneNumber < 1 || zoneNumber > 60) return null;
    return { zoneNumber, zoneLetter };
  };
  const latLngFromUtm = ({ zoneNumber, zoneLetter, easting, northing }) => {
    if (!Number.isFinite(zoneNumber) || zoneNumber < 1 || zoneNumber > 60) return null;
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
    const letter = typeof zoneLetter === 'string' ? zoneLetter.toUpperCase() : '';
    if (!/[C-HJ-NP-X]/.test(letter)) return null;
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const eSq = f * (2 - f);
    const ePrimeSq = eSq / (1 - eSq);
    const eccSquared = eSq;
    const eccPrimeSquared = ePrimeSq;
    const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
    const x = easting - 500000.0;
    let y = northing;
    const northernHemisphere = letter >= 'N';
    if (!northernHemisphere) y -= 10000000.0;
    const M = y / k0;
    const mu = M / (a * (1 - eccSquared / 4 - (3 * eccSquared * eccSquared) / 64 - (5 * eccSquared * eccSquared * eccSquared) / 256));
    const sinMu = Math.sin(mu);
    const sin2Mu = Math.sin(2 * mu);
    const sin4Mu = Math.sin(4 * mu);
    const sin6Mu = Math.sin(6 * mu);
    const sin8Mu = Math.sin(8 * mu);
    const phi1Rad = mu
      + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * sin2Mu
      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * sin4Mu
      + (151 * Math.pow(e1, 3) / 96) * sin6Mu
      + (1097 * Math.pow(e1, 4) / 512) * sin8Mu;
    const sinPhi1 = Math.sin(phi1Rad);
    const cosPhi1 = Math.cos(phi1Rad);
    const tanPhi1 = Math.tan(phi1Rad);
    const N1 = a / Math.sqrt(1 - eccSquared * sinPhi1 * sinPhi1);
    const T1 = tanPhi1 * tanPhi1;
    const C1 = eccPrimeSquared * cosPhi1 * cosPhi1;
    const R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * sinPhi1 * sinPhi1, 1.5);
    const D = x / (N1 * k0);
    let lat = phi1Rad - (N1 * tanPhi1 / R1) * (Math.pow(D, 2) / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * Math.pow(D, 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    lat *= RAD_TO_DEG;
    let lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * Math.pow(D, 5) / 120) / cosPhi1;
    const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
    lon = lonOrigin + lon * RAD_TO_DEG;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lng: lon };
  };
  const webMercatorFromLatLng = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const clampedLat = clampLatForMercator(lat);
    const rMajor = 6378137.0;
    const x = rMajor * (lng * DEG_TO_RAD);
    const y = rMajor * Math.log(Math.tan(Math.PI / 4 + (clampedLat * DEG_TO_RAD) / 2));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  };
  const gaussKruegerFromLatLng = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const wrappedLng = normalizeLongitude(lng);
    const zoneNumber = Math.floor((wrappedLng + 1.5) / 3) + 1;
    const lonOrigin = zoneNumber * 3;
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const eSq = f * (2 - f);
    const ePrimeSq = eSq / (1 - eSq);
    const latRad = lat * DEG_TO_RAD;
    const lngRad = wrappedLng * DEG_TO_RAD;
    const lonOriginRad = lonOrigin * DEG_TO_RAD;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const tanLat = Math.tan(latRad);
    const N = a / Math.sqrt(1 - eSq * sinLat * sinLat);
    const T = tanLat * tanLat;
    const C = ePrimeSq * cosLat * cosLat;
    const A = cosLat * (lngRad - lonOriginRad);
    const e4 = eSq * eSq;
    const e6 = e4 * eSq;
    const M = a * ((1 - eSq / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latRad
      - (3 * eSq / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * latRad)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * latRad)
      - (35 * e6 / 3072) * Math.sin(6 * latRad));
    const x = N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * Math.pow(A, 5) / 120);
    const y = M + N * tanLat * (Math.pow(A, 2) / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * Math.pow(A, 6) / 720);
    const easting = zoneNumber * 1_000_000 + x;
    const northing = y;
    return { zoneNumber, easting, northing };
  };
  const latLngFromGaussKrueger = ({ zoneNumber, easting, northing }) => {
    if (!Number.isFinite(zoneNumber) || zoneNumber < 1 || zoneNumber > 60) return null;
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const eSq = f * (2 - f);
    const ePrimeSq = eSq / (1 - eSq);
    const e1 = (1 - Math.sqrt(1 - eSq)) / (1 + Math.sqrt(1 - eSq));
    const x = easting - zoneNumber * 1_000_000;
    const y = northing;
    const M = y;
    const mu = M / (a * (1 - eSq / 4 - 3 * Math.pow(eSq, 2) / 64 - 5 * Math.pow(eSq, 3) / 256));
    const sinMu = Math.sin(mu);
    const sin2Mu = Math.sin(2 * mu);
    const sin4Mu = Math.sin(4 * mu);
    const sin6Mu = Math.sin(6 * mu);
    const sin8Mu = Math.sin(8 * mu);
    const phi1Rad = mu
      + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * sin2Mu
      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * sin4Mu
      + (151 * Math.pow(e1, 3) / 96) * sin6Mu
      + (1097 * Math.pow(e1, 4) / 512) * sin8Mu;
    const sinPhi1 = Math.sin(phi1Rad);
    const cosPhi1 = Math.cos(phi1Rad);
    const tanPhi1 = Math.tan(phi1Rad);
    const N1 = a / Math.sqrt(1 - eSq * sinPhi1 * sinPhi1);
    const T1 = tanPhi1 * tanPhi1;
    const C1 = ePrimeSq * cosPhi1 * cosPhi1;
    const R1 = a * (1 - eSq) / Math.pow(1 - eSq * sinPhi1 * sinPhi1, 1.5);
    const D = x / N1;
    let lat = phi1Rad - (N1 * tanPhi1 / R1) * (Math.pow(D, 2) / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrimeSq) * Math.pow(D, 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrimeSq - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    lat *= RAD_TO_DEG;
    let lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrimeSq + 24 * T1 * T1) * Math.pow(D, 5) / 120) / cosPhi1;
    const lonOrigin = zoneNumber * 3;
    lon = lonOrigin + lon * RAD_TO_DEG;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lng: lon };
  };

  let refreshCoordModalContent = null;
  let refreshWindIndicatorContent = null;

  const applyTranslations = () => {
    if (!translationState.data) return;
    try {
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        if (!key) return;
        el.textContent = t(key, el.textContent);
      });
      document.querySelectorAll('[data-i18n-html]').forEach((el) => {
        const key = el.dataset.i18nHtml;
        if (!key) return;
        el.innerHTML = t(key, el.innerHTML);
      });
      const attrBindings = [
        { selector: '[data-i18n-title]', attr: 'title', ds: 'i18nTitle' },
        { selector: '[data-i18n-aria-label]', attr: 'aria-label', ds: 'i18nAriaLabel' },
        { selector: '[data-i18n-aria-describedby]', attr: 'aria-describedby', ds: 'i18nAriaDescribedby' },
        { selector: '[data-i18n-aria-labelledby]', attr: 'aria-labelledby', ds: 'i18nAriaLabelledby' },
        { selector: '[data-i18n-placeholder]', attr: 'placeholder', ds: 'i18nPlaceholder' },
        { selector: '[data-i18n-data-tooltip]', attr: 'data-tooltip', ds: 'i18nDataTooltip' }
      ];
      attrBindings.forEach(({ selector, attr, ds }) => {
        document.querySelectorAll(selector).forEach((el) => {
          const key = el.dataset[ds];
          if (!key) return;
          const translated = t(key, el.getAttribute(attr));
          if (typeof translated === 'string') el.setAttribute(attr, translated);
        });
      });
      if (typeof refreshCoordModalContent === 'function') {
        try { refreshCoordModalContent(); }
        catch (err) { console.error('refreshCoordModalContent failed', err); }
      }
      if (typeof refreshWindIndicatorContent === 'function') {
        try { refreshWindIndicatorContent(); }
        catch (err) { console.error('refreshWindIndicatorContent failed', err); }
      }
      if (shortcutsList) {
        try { renderShortcutsList(); }
        catch (err) { console.error('renderShortcutsList failed', err); }
      }
      // Update elements that rely on translateString fallback (e.g., dynamic text) by re-triggering manual updates if needed.
    } catch (err) {
      console.error('applyTranslations error', err);
    }
  };
  const FEATURES_PANEL_WIDTH = 320;
  const TRACKERS_PANEL_WIDTH = 320;
  const TRACKERS_RECORD_ICON = './assets/icons/regular/record.svg';
  const TRACKERS_PAUSE_ICON = './assets/icons/regular/pause.svg';

  // Map stats UI
  const statZoom = q('#statZoom');
  const statScale = q('#statScale');
  const statCenter = q('#statCenter');
  const statBearing = q('#statBearing');
  const statPitch = q('#statPitch');
  const footerAddress = q('#footerAddress');
  const fullscreenBtn = q('#fullscreenBtn');
  const tabMapInput = q('#tab-map');
  const tabSettingsInput = q('#tab-settings');
  const tabMapLabel = document.querySelector('label[for="tab-map"]');
  const tabSettingsLabel = document.querySelector('label[for="tab-settings"]');
  const mapWelcome = q('#mapWelcome');
  const mapWelcomeSettings = q('#mapWelcomeSettings');
  const scaleDialog = q('#scaleDialog');
  const scaleDialogClose = scaleDialog?.querySelector('[data-action="close"]') || null;
  const scaleOptionButtons = scaleDialog ? Array.from(scaleDialog.querySelectorAll('.scale-option')) : [];
  const languageDropdown = q('#languageDropdown');
  const languageToggle = q('#languageToggle');
  const languageMenu = q('#languageMenu');
  const settingsQuickBtn = q('#settingsQuickBtn');
  const toolEdit = q('#toolEdit');
  const toolRect = q('#toolRect');
  const toolPoly = q('#toolPoly');
  const toolCircle = q('#toolCircle');
  const toolLine = q('#toolLine');
  const toolArrow = q('#toolArrow');
  const toolPOI = q('#toolPOI');
  const toolCrosshair = q('#toolCrosshair');
  const toolSetScale = q('#toolSetScale');
  const overlaySelect = q('#overlaySelect');
  const toolLabelIncrease = q('#toolLabelIncrease');
  const toolLabelDecrease = q('#toolLabelDecrease');
  const toolPrint = q('#toolPrint');
  const toolExportPdf = q('#toolExportPdf');
  const toolShortcuts = q('#toolShortcuts');
  const mapUtilityToolbar = q('#mapUtilityToolbar');
  const mapStyleToolbar = q('#mapStyleToolbar');
  const mapContainer = q('#map');
  const mapWindOverlay = q('#mapWindOverlay');
  const mapRainOverlay = q('#mapRainOverlay');
  const mapWindIndicator = q('#mapWindIndicator');
  const mapWindIndicatorLabel = mapWindIndicator?.querySelector('.map-wind-indicator__label') || null;
  const mapSessionOverlay = q('#mapSessionOverlay');
  const mapSessionEmpty = q('#mapSessionEmpty');
  const mapSessionActive = q('#mapSessionActive');
  const mapSessionTitleEl = q('#mapSessionTitle');
  const mapSessionIdEl = q('#mapSessionId');
  const mapSessionStartBtn = q('#mapSessionStartBtn');
  const mapSessionResumeBtn = q('#mapSessionResumeBtn');
  const mapUtilityButtons = Array.from(document.querySelectorAll('.map-utility-btn'));
  const weatherUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'cloud-sun');
  const satelliteUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'satellite');
  const terrainUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'terrain');
  const streetUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'street');
  const mapCrosshair = q('#mapCrosshair');
  const toolSearch = q('#toolSearch');
  const toolGoTo = q('#toolGoTo');
  const exportLoadingModal = q('#exportLoadingModal');
  const exportLoadingText = q('#exportLoadingText');
  const drawingsList = q('#drawingsList');
  const featuresActions = q('#featuresActions');
  const featuresLabelsToggle = q('#featuresLabelsToggle');
  const featuresActionsToggleBtn = q('#featuresActionsToggle');
  const featuresActionsMenu = q('#featuresActionsMenu');
  const featuresSaveBtn = q('#featuresSaveBtn');
  const featuresLoadBtn = q('#featuresLoadBtn');
  const featuresLoadGpxBtn = q('#featuresLoadGpxBtn');
  const featuresClearBtn = q('#featuresClearBtn');
  const toolPin = q('#toolPin');
  const settingLanguage = q('#settingLanguage');
  const settingHomeAddress = q('#settingHomeAddress');
  const settingAccessToken = q('#settingAccessToken');
  const settingGoogleKey = q('#settingGoogleKey');
  const settingOpenAIKey = q('#settingOpenAIKey');
  const settingFirebaseConfig = q('#settingFirebaseConfig');
  const settingFirestoreRules = q('#settingFirestoreRules');
  const settingStorageRules = q('#settingStorageRules');
  const settingFirebaseFunctionIndex = q('#settingFirebaseFunctionIndex');
  const firebaseAdminSelectBtn = q('#firebaseAdminSelectBtn');
  const firebaseAdminClearBtn = q('#firebaseAdminClearBtn');
  const firebaseAdminFileInput = q('#firebaseAdminFileInput');
  const firebaseAdminStatus = q('#firebaseAdminStatus');
  const firebaseAdminProject = q('#firebaseAdminProject');
  const firebaseAdminActionsStatus = q('#firebaseAdminActionsStatus');
  const firebaseAdminClearSessionsBtn = q('#firebaseAdminClearSessionsBtn');
  const firebaseAdminClearAnonymousUsersBtn = q('#firebaseAdminClearAnonymousUsersBtn');
  const firebaseDeployAllBtn = q('#firebaseDeployAllBtn');
  const firebaseDeployFirestoreRulesBtn = q('#firebaseDeployFirestoreRulesBtn');
  const firebaseDeployStorageRulesBtn = q('#firebaseDeployStorageRulesBtn');
  const firebaseDeployFunctionsBtn = q('#firebaseDeployFunctionsBtn');
  const firebaseCollapseFirestoreRulesBtn = q('#firebaseCollapseFirestoreRulesBtn');
  const firebaseCollapseStorageRulesBtn = q('#firebaseCollapseStorageRulesBtn');
  const firebaseCollapseFunctionsBtn = q('#firebaseCollapseFunctionsBtn');
  const firebaseCollapseConfigBtn = q('#firebaseCollapseConfigBtn');
  const firestoreRulesEditor = q('#firestoreRulesEditor');
  const storageRulesEditor = q('#storageRulesEditor');
  const functionsRulesEditor = q('#functionsRulesEditor');
  const firebaseConfigEditor = q('#firebaseConfigEditor');
  const firebaseFirestoreRulesStatus = q('#firebaseFirestoreRulesStatus');
  const firebaseStorageRulesStatus = q('#firebaseStorageRulesStatus');
  const firebaseFunctionsStatus = q('#firebaseFunctionsStatus');
  const firebaseAdminClearSessionsModal = q('#firebaseAdminClearSessionsModal');
  const firebaseAdminClearSessionsClose = q('#firebaseAdminClearSessionsClose');
  const firebaseAdminClearSessionsCancel = q('#firebaseAdminClearSessionsCancel');
  const firebaseAdminClearSessionsConfirm = q('#firebaseAdminClearSessionsConfirm');
  const firebaseAdminClearSessionsStatus = q('#firebaseAdminClearSessionsStatus');
  const firebaseAdminClearAnonymousUsersModal = q('#firebaseAdminClearAnonymousUsersModal');
  const firebaseAdminClearAnonymousUsersClose = q('#firebaseAdminClearAnonymousUsersClose');
  const firebaseAdminClearAnonymousUsersCancel = q('#firebaseAdminClearAnonymousUsersCancel');
  const firebaseAdminClearAnonymousUsersConfirm = q('#firebaseAdminClearAnonymousUsersConfirm');
  const firebaseAdminClearAnonymousUsersStatus = q('#firebaseAdminClearAnonymousUsersStatus');
  const firebaseDeployModal = q('#firebaseDeployModal');
  const firebaseDeployModalClose = q('#firebaseDeployModalClose');
  const firebaseDeployModalDone = q('#firebaseDeployModalDone');
  const firebaseDeployLog = q('#firebaseDeployLog');
  const firebaseDeployStatus = q('#firebaseDeployStatus');
  const settingStyleUrl = q('#settingStyleUrl');
  const settingSatelliteStyleUrl = q('#settingSatelliteStyleUrl');
  const settingTerrainStyleUrl = q('#settingTerrainStyleUrl');
  const settingStartLng = q('#settingStartLng');
  const settingStartLat = q('#settingStartLat');
  const settingStartZoom = q('#settingStartZoom');
  const settingsForm = q('#settingsForm');
  const settingsSaveBtn = q('#settingsSaveBtn');
  const settingsStatus = q('.settings-status');
  const settingsCloseBtn = q('#settingsCloseBtn');
  const settingsGroupButtons = Array.from(document.querySelectorAll('.settings-nav-item[data-settings-group]'));
  const settingsGroups = Array.from(document.querySelectorAll('.settings-group[data-settings-group]'));
  const SETTINGS_GROUP_KEY_MAP = {
    general: 'settings.section.general',
    'api-keys': 'settings.section.apiKeys',
    firebase: 'settings.section.firebase',
    map: 'settings.section.map'
  };
  const defaultAccessToken = settingAccessToken?.defaultValue || '';
  const defaultGoogleKey = settingGoogleKey?.defaultValue || '';
  const defaultOpenAIKey = settingOpenAIKey?.defaultValue || '';
  const FIREBASE_SETTINGS_STORAGE_KEY = 'firebase.settingsRaw';
  const FIRESTORE_RULES_STORAGE_KEY = 'firebase.firestoreRules';
  const STORAGE_RULES_STORAGE_KEY = 'firebase.storageRules';
  const FUNCTIONS_INDEX_STORAGE_KEY = 'firebase.functionsIndex';
  const FIRESTORE_RULES_DEPLOY_KEY = 'firebase.firestoreRulesDeploy';
  const STORAGE_RULES_DEPLOY_KEY = 'firebase.storageRulesDeploy';
  const FUNCTIONS_INDEX_DEPLOY_KEY = 'firebase.functionsIndexDeploy';
  const DEFAULT_FIRESTORE_RULES_PATH = 'src/firebase/firebase.rules';
  const DEFAULT_STORAGE_RULES_PATH = 'src/firebase/storage.rules';
  const DEFAULT_FUNCTIONS_INDEX_PATH = 'src/firebase/functions/index.js';
  const DEFAULT_SATELLITE_STYLE_URL = 'mapbox://styles/mapbox/standard-satellite';
  const DEFAULT_TERRAIN_STYLE_URL = 'mapbox://styles/mapbox/outdoors-v12';
  const MAP_STYLE_KEYS = ['street', 'satellite', 'terrain'];
  const normalizeMapStyleKey = (value) => {
    const key = typeof value === 'string' ? value.toLowerCase() : '';
    return MAP_STYLE_KEYS.includes(key) ? key : null;
  };
  const getStoredMapStyleKey = () => {
    const stored = normalizeMapStyleKey(localStorage.getItem('map.activeStyle'));
    if (stored) return stored;
    if (localStorage.getItem('map.satelliteEnabled') === '1') return 'satellite';
    return 'street';
  };
  let activeMapStyle = getStoredMapStyleKey();
  const defaultStyleUrl = settingStyleUrl?.defaultValue || DEFAULT_STYLE_URL;
  const defaultSatelliteStyleUrl = settingSatelliteStyleUrl?.defaultValue || DEFAULT_SATELLITE_STYLE_URL;
  const defaultTerrainStyleUrl = settingTerrainStyleUrl?.defaultValue || DEFAULT_TERRAIN_STYLE_URL;
  let firebaseSettings = null;
  let firebaseAppInstance = null;
  let firestoreInstance = null;
  let defaultAppLanguage = DEFAULT_APP_LANGUAGE;
  const defaultHomeAddress = settingHomeAddress?.defaultValue || '';
  const defaultStartLng = Number(settingStartLng?.defaultValue || DEFAULT_MAP_START[0]);
  const defaultStartLat = Number(settingStartLat?.defaultValue || DEFAULT_MAP_START[1]);
  const defaultStartZoom = Number(settingStartZoom?.defaultValue || DEFAULT_START_ZOOM);
  const allowedAppLanguages = new Set(LANGUAGE_CODES);
  const normalizeAppLanguage = (value) => {
    const key = String(value ?? '').toLowerCase();
    return allowedAppLanguages.has(key) ? key : DEFAULT_APP_LANGUAGE;
  };
  let weatherOverlayActive = false;
  let lastWindIndicatorDegrees = null;
  let lastWindIndicatorSpeed = null;
  let lastWindIndicatorSpeedUnit = 'km/h';
  const TOOL_CURSOR_SET = new Set(['rect', 'poly', 'circle', 'line', 'arrow', 'poi', 'crosshair']);
  const AI_PRESET_MAP = {
    Point: [
      'Move POI {VALUE} meters north',
      'Move POI {VALUE} meters east',
      'Move POI {VALUE} meters south',
      'Move POI {VALUE} meters west',
      'Create three POIs spaced {VALUE} meters north, east, south, and west of the current location.',
    ],
    LineString: [
      'Extend this line by {VALUE} meters following its current bearing.',
      'Create a parallel line {VALUE} meters to the {DIRECTION} of this line.',
      'Split the line into segments every {VALUE} meters.',
    ],
    Polygon: [
      'Divide this polygon into {VALUE} equal-area quadrants.',
      'Create a {VALUE} meter outward buffer around this polygon.',
      'Place a POI at each corner of this polygon.'
    ]
  };
  const getMap = () => (window)._map;
  const updateMapCursor = () => {
    const map = getMap();
    const canvas = map?.getCanvas?.();
    const container = map?.getCanvasContainer?.();
    const tool = (window)._currentTool;
    const shouldCrosshair = TOOL_CURSOR_SET.has(tool);
    if (canvas) {
      canvas.classList.toggle('cursor-crosshair', shouldCrosshair);
      if (shouldCrosshair) {
        try { canvas.style.setProperty('cursor', 'crosshair', 'important'); }
        catch {}
      } else {
        try { canvas.style.removeProperty('cursor'); }
        catch {}
      }
    }
    if (container) {
      container.classList.toggle('cursor-crosshair', shouldCrosshair);
      if (shouldCrosshair) {
        try { container.style.setProperty('cursor', 'crosshair', 'important'); }
        catch {}
      } else {
        try { container.style.removeProperty('cursor'); }
        catch {}
      }
    }
  };
  const getBaseMapStyleUrl = () => {
    const stored = localStorage.getItem('map.streetStyleUrl');
    const legacyStored = stored === null ? localStorage.getItem('map.styleUrl') : stored;
    const fallback = defaultStyleUrl || DEFAULT_STYLE_URL;
    const value = (typeof legacyStored === 'string' && legacyStored.trim()) ? legacyStored.trim() : (fallback || DEFAULT_STYLE_URL);
    return value || DEFAULT_STYLE_URL;
  };
  const populateAiPresetOptions = (geometryType) => {
    if (!aiPresetSelect) return;
    const presets = AI_PRESET_MAP[geometryType] || [];
    aiPresetSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = presets.length ? 'Custom instruction' : 'No presets available for this geometry';
    aiPresetSelect.appendChild(defaultOption);
    presets.forEach((text) => {
      const option = document.createElement('option');
      option.value = text;
      option.textContent = text;
      aiPresetSelect.appendChild(option);
    });
    aiPresetSelect.disabled = presets.length === 0;
    aiPresetSelect.value = '';
    updateAiDynamicFields('');
  };
  const updateAiDynamicFields = (presetValue) => {
    const needsValue = typeof presetValue === 'string' && presetValue.includes('{VALUE}');
    const needsDirection = typeof presetValue === 'string' && presetValue.includes('{DIRECTION}');
    if (aiValueField) {
      aiValueField.hidden = !needsValue;
      if (!needsValue && aiValueInput) aiValueInput.value = '';
    }
    if (aiDirectionField) {
      aiDirectionField.hidden = !needsDirection;
      if (!needsDirection && aiDirectionSelect) aiDirectionSelect.value = 'north';
    }
  };
  const getSatelliteMapStyleUrl = () => {
    const stored = localStorage.getItem('map.satelliteStyleUrl');
    const fallback = defaultSatelliteStyleUrl || DEFAULT_SATELLITE_STYLE_URL;
    const value = (typeof stored === 'string' && stored.trim()) ? stored.trim() : (fallback || DEFAULT_SATELLITE_STYLE_URL);
    return value || DEFAULT_SATELLITE_STYLE_URL;
  };
  const getTerrainMapStyleUrl = () => {
    const stored = localStorage.getItem('map.terrainStyleUrl');
    const fallback = defaultTerrainStyleUrl || DEFAULT_TERRAIN_STYLE_URL;
    const value = (typeof stored === 'string' && stored.trim()) ? stored.trim() : (fallback || DEFAULT_TERRAIN_STYLE_URL);
    return value || DEFAULT_TERRAIN_STYLE_URL;
  };
  const getMapStyleUrlForKey = (key, { street, satellite, terrain }) => {
    switch (key) {
      case 'satellite':
        return satellite;
      case 'terrain':
        return terrain;
      default:
        return street;
    }
  };
  const getTargetMapStyleUrl = () => getMapStyleUrlForKey(activeMapStyle, {
    street: getBaseMapStyleUrl(),
    satellite: getSatelliteMapStyleUrl(),
    terrain: getTerrainMapStyleUrl(),
  });
  function applyMapStyle(styleUrl) {
    if (!styleUrl) return;
    const map = getMap();
    if (!map) return;
    const target = styleUrl.trim();
    if (!target) return;
    if ((window)._lastStyleUrl === target) return;
    try {
      (window)._lastStyleUrl = target;
      map.setStyle(target, { diff: false });
      if (activeGridOverlay !== 'none') {
        if (typeof map.once === 'function') {
          const refreshToken = (gridOverlayStyleRefreshToken += 1);
          map.once('style.load', () => {
            if (gridOverlayStyleRefreshToken !== refreshToken) return;
            map.once('idle', () => {
              if (gridOverlayStyleRefreshToken !== refreshToken) return;
              refreshGridOverlay();
            });
          });
        } else {
          refreshGridOverlay();
        }
      }
    } catch (err) {
      console.error('Failed to apply map style', err);
    }
  }
  const applyCurrentMapStyle = () => {
    const style = getTargetMapStyleUrl();
    if (style) applyMapStyle(style);
  };
  const setWeatherButtonState = (active) => {
    if (!weatherUtilityBtn) return;
    weatherUtilityBtn.classList.toggle('is-active', !!active);
    weatherUtilityBtn.setAttribute('aria-pressed', String(!!active));
  };
  const mapStyleButtons = {
    street: streetUtilityBtn,
    satellite: satelliteUtilityBtn,
    terrain: terrainUtilityBtn,
  };
  const updateMapStyleButtons = () => {
    Object.entries(mapStyleButtons).forEach(([key, btn]) => {
      if (!btn) return;
      const isActive = activeMapStyle === key;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  };
  const setActiveMapStyle = (style, { persist = true } = {}) => {
    const next = normalizeMapStyleKey(style) || 'street';
    activeMapStyle = next;
    if (persist) {
      try {
        localStorage.setItem('map.activeStyle', next);
        localStorage.setItem('map.satelliteEnabled', next === 'satellite' ? '1' : '0');
      } catch {}
    }
    updateMapStyleButtons();
  };
  setActiveMapStyle(activeMapStyle, { persist: false });
  const loadFirebaseSettingsFromStorage = ({ syncInput = false, warnOnError = false } = {}) => {
    let storedFirebaseRaw = null;
    try {
      storedFirebaseRaw = localStorage.getItem(FIREBASE_SETTINGS_STORAGE_KEY);
    } catch (err) {
      if (warnOnError) console.warn('Failed reading Firebase settings', err);
      firebaseSettings = null;
      return { ok: false, error: err, raw: '' };
    }
    if (syncInput && settingFirebaseConfig) {
      settingFirebaseConfig.value = storedFirebaseRaw !== null ? storedFirebaseRaw : '';
    }
    const parsedFirebase = parseFirebaseSettingsText(storedFirebaseRaw || '');
    if (parsedFirebase.error) {
      if (warnOnError) console.warn('Invalid Firebase settings JSON', parsedFirebase.error);
      firebaseSettings = null;
      return { ok: false, error: parsedFirebase.error, raw: parsedFirebase.raw };
    }
    firebaseSettings = parsedFirebase.value;
    return { ok: !!firebaseSettings, raw: parsedFirebase.raw };
  };
  const readStoredRules = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const fetchRulesText = async (path) => {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  };
  const loadDefaultFirebaseRules = async () => {
    if (firebaseRulesDefaultsLoaded || firebaseRulesDefaultsInFlight) return;
    firebaseRulesDefaultsInFlight = true;
    try {
      const firestoreStored = readStoredRules(FIRESTORE_RULES_STORAGE_KEY);
      const storageStored = readStoredRules(STORAGE_RULES_STORAGE_KEY);
      const functionsStored = readStoredRules(FUNCTIONS_INDEX_STORAGE_KEY);
      const needsFirestore = settingFirestoreRules && !settingFirestoreRules.value.trim() && firestoreStored === null;
      const needsStorage = settingStorageRules && !settingStorageRules.value.trim() && storageStored === null;
      const needsFunctions = settingFirebaseFunctionIndex
        && !settingFirebaseFunctionIndex.value.trim()
        && functionsStored === null;
      if (needsFirestore) {
        const firestoreText = await fetchRulesText(DEFAULT_FIRESTORE_RULES_PATH);
        if (firestoreText && settingFirestoreRules && !settingFirestoreRules.value.trim()) {
          withSuppressedSettingsEvents(() => {
            settingFirestoreRules.value = firestoreText;
          });
        }
      }
      if (needsStorage) {
        const storageText = await fetchRulesText(DEFAULT_STORAGE_RULES_PATH);
        if (storageText && settingStorageRules && !settingStorageRules.value.trim()) {
          withSuppressedSettingsEvents(() => {
            settingStorageRules.value = storageText;
          });
        }
      }
      if (needsFunctions) {
        const functionsText = await fetchRulesText(DEFAULT_FUNCTIONS_INDEX_PATH);
        if (functionsText && settingFirebaseFunctionIndex && !settingFirebaseFunctionIndex.value.trim()) {
          withSuppressedSettingsEvents(() => {
            settingFirebaseFunctionIndex.value = functionsText;
          });
        }
      }
    } finally {
      firebaseRulesDefaultsLoaded = true;
      firebaseRulesDefaultsInFlight = false;
      updateFirebaseAdminActionsState();
    }
  };
  const getStorageBucketFromInput = () => {
    const raw = normalizeLineBreaks(settingFirebaseConfig?.value || '');
    if (!raw.trim()) return null;
    const parsed = parseFirebaseSettingsText(raw);
    if (parsed.error) return null;
    return parsed.value?.storageBucket || null;
  };
  const getRulesText = (el) => {
    const raw = normalizeLineBreaks(el?.value || '');
    return { raw, trimmed: raw.trim() };
  };
  const normalizeRulesContent = (value) => normalizeLineBreaks(value || '');
  const computeContentHash = (value) => {
    const input = String(value || '');
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return `h${(hash >>> 0).toString(16)}`;
  };
  const readDeployState = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.hash === 'string') return parsed;
    } catch {}
    return null;
  };
  const writeDeployState = (key, hash) => {
    if (!hash) return;
    try {
      localStorage.setItem(key, JSON.stringify({ hash, updatedAt: Date.now() }));
    } catch {}
  };
  const getRulesDeployState = (value, key) => {
    const normalized = normalizeRulesContent(value);
    const trimmed = normalized.trim();
    const currentHash = trimmed ? computeContentHash(normalized) : null;
    const stored = readDeployState(key);
    const storedHash = stored?.hash || null;
    if (!currentHash) return { state: 'empty', currentHash, storedHash };
    if (!storedHash) return { state: 'never', currentHash, storedHash };
    if (storedHash !== currentHash) return { state: 'pending', currentHash, storedHash };
    return { state: 'deployed', currentHash, storedHash };
  };
  const storeRulesDeployState = (key, value) => {
    const normalized = normalizeRulesContent(value);
    if (!normalized.trim()) return null;
    const hash = computeContentHash(normalized);
    writeDeployState(key, hash);
    return hash;
  };
  const resolveFirebaseSdk = () => {
    if (window.firebaseSdk && typeof window.firebaseSdk === 'object') {
      return { type: 'modular', sdk: window.firebaseSdk };
    }
    if (window.firebase && typeof window.firebase.initializeApp === 'function') {
      return { type: 'compat', sdk: window.firebase };
    }
    return null;
  };
  const exposeFirebaseState = () => {
    window.firebaseSettings = firebaseSettings;
    window.firebaseApp = firebaseAppInstance;
    window.firestoreDb = firestoreInstance;
    window.getFirebaseSettings = () => firebaseSettings;
    window.getFirestoreDb = () => firestoreInstance;
  };
  const initFirestoreConnection = () => {
    firestoreInstance = null;
    firebaseAppInstance = null;
    if (!firebaseSettings) {
      loadFirebaseSettingsFromStorage();
    }
    if (!firebaseSettings) {
      exposeFirebaseState();
      return null;
    }
    const sdkInfo = resolveFirebaseSdk();
    if (!sdkInfo) {
      console.warn('Firebase SDK not available; Firestore not initialized.');
      exposeFirebaseState();
      return null;
    }
    try {
      if (sdkInfo.type === 'compat') {
        const sdk = sdkInfo.sdk;
        firebaseAppInstance = sdk.apps?.length ? sdk.app() : sdk.initializeApp(firebaseSettings);
        firestoreInstance = typeof sdk.firestore === 'function' ? sdk.firestore() : null;
      } else {
        const sdk = sdkInfo.sdk;
        if (sdk && sdk.__bridge) {
          firebaseAppInstance = sdk.initializeApp(firebaseSettings);
        } else {
          const apps = typeof sdk.getApps === 'function' ? sdk.getApps() : [];
          firebaseAppInstance = apps && apps.length ? sdk.getApp() : sdk.initializeApp(firebaseSettings);
        }
        firestoreInstance = typeof sdk.getFirestore === 'function' ? sdk.getFirestore(firebaseAppInstance) : null;
      }
    } catch (err) {
      console.warn('Failed to initialize Firestore', err);
    }
    exposeFirebaseState();
    return firestoreInstance;
  };
  window.initFirestore = initFirestoreConnection;
  exposeFirebaseState();
  const getLanguageLabels = (lang) => LANGUAGE_LABELS[lang] || LANGUAGE_LABELS[DEFAULT_APP_LANGUAGE];
  const populateLanguageOptions = (activeLanguage) => {
    if (!settingLanguage) return;
    const lang = normalizeAppLanguage(activeLanguage || settingLanguage.value || defaultAppLanguage);
    const labels = getLanguageLabels(lang);
    const fallbackLabels = getLanguageLabels(DEFAULT_APP_LANGUAGE);
    const fragment = document.createDocumentFragment();
    LANGUAGE_CODES.forEach((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = labels[code] || fallbackLabels[code] || code.toUpperCase();
      if (code === lang) option.selected = true;
      fragment.appendChild(option);
    });
    settingLanguage.textContent = '';
    settingLanguage.appendChild(fragment);
  };
  const applyLanguagePreference = (value) => {
    const lang = normalizeAppLanguage(value);
    translationState.language = lang;
    try { document.documentElement?.setAttribute('lang', lang); } catch {}
    ensureTranslationsLoaded().then(() => {
      if (languageMenu) {
        languageMenu.querySelectorAll('.lang-menu-item').forEach((item) => {
          item.classList.toggle('is-active', item.dataset.lang === lang);
        });
      }
      applyTranslations();
    }).catch(() => {});
    try {
      const maybePromise = window.settings?.setLanguage?.(lang);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch((err) => {
          console.warn('setLanguage invoke failed', err);
        });
      }
    } catch (err) {
      console.warn('setLanguage dispatch failed', err);
    }
  };
  const labelOf = (input) => input?.closest('label')?.querySelector('.label');
  const helpOf = (input) => input?.closest('label')?.querySelector('.label-help');
  let firebaseAdminCredentialsReady = false;
  let firebaseAdminClearSessionsInFlight = false;
  let firebaseAdminClearAnonymousUsersInFlight = false;
  let firebaseRulesDefaultsLoaded = false;
  let firebaseRulesDefaultsInFlight = false;
  let firebaseDeployInProgress = false;
  let firebaseDeploySessionId = null;
  const appendDeployLog = (message) => {
    if (!firebaseDeployLog) return;
    const line = String(message ?? '').trim();
    if (!line) return;
    firebaseDeployLog.textContent += `${line}\n`;
    firebaseDeployLog.scrollTop = firebaseDeployLog.scrollHeight;
  };
  const setDeployModalState = (inProgress) => {
    firebaseDeployInProgress = !!inProgress;
    if (firebaseDeployModalClose) {
      firebaseDeployModalClose.disabled = firebaseDeployInProgress;
      firebaseDeployModalClose.setAttribute('aria-disabled', String(firebaseDeployInProgress));
    }
    if (firebaseDeployModalDone) {
      firebaseDeployModalDone.disabled = firebaseDeployInProgress;
      firebaseDeployModalDone.setAttribute('aria-disabled', String(firebaseDeployInProgress));
    }
  };
  const openDeployModal = (titleText) => {
    if (!firebaseDeployModal || !firebaseDeployLog) return;
    if (firebaseDeployModal.hidden) firebaseDeployModal.hidden = false;
    if (firebaseDeployLog) firebaseDeployLog.textContent = '';
    if (firebaseDeployStatus) {
      const key = 'settings.firebaseDeployingHint';
      firebaseDeployStatus.textContent = t(key, 'Deployment in progress. Logs below.');
      firebaseDeployStatus.dataset.i18n = key;
    }
    if (titleText) {
      const titleEl = q('#firebaseDeployTitle');
      if (titleEl) {
        titleEl.textContent = titleText;
        titleEl.dataset.i18n = '';
      }
    }
    setDeployModalState(true);
  };
  const finishDeployModal = (finalMessage) => {
    if (firebaseDeployStatus && finalMessage) {
      firebaseDeployStatus.textContent = finalMessage;
      firebaseDeployStatus.dataset.i18n = '';
    }
    setDeployModalState(false);
    firebaseDeploySessionId = null;
  };
  const closeDeployModal = () => {
    if (firebaseDeployInProgress) return;
    if (firebaseDeployModal) firebaseDeployModal.hidden = true;
  };
  const setRulesEditorExpanded = (editorEl, buttonEl, expanded = true) => {
    if (!editorEl || !buttonEl) return;
    editorEl.classList.toggle('is-collapsed', !expanded);
    const key = expanded ? 'settings.firebaseRulesCollapseLabel' : 'settings.firebaseRulesExpandLabel';
    buttonEl.textContent = expanded ? '▴' : '▾';
    buttonEl.setAttribute('aria-label', t(key, expanded ? 'Collapse editor' : 'Expand editor'));
    buttonEl.setAttribute('aria-expanded', String(!!expanded));
  };
  const setupDeployLogListener = () => {
    if (!window.firebaseAdmin?.onDeployLog) return;
    window.firebaseAdmin.onDeployLog((payload) => {
      if (!payload) return;
      if (firebaseDeploySessionId && payload.id && payload.id !== firebaseDeploySessionId) return;
      appendDeployLog(payload.message || payload.line || '');
    });
  };
  const toggleRulesEditor = (editorEl, buttonEl) => {
    if (!editorEl || !buttonEl) return;
    const isCollapsed = editorEl.classList.toggle('is-collapsed');
    const key = isCollapsed ? 'settings.firebaseRulesExpandLabel' : 'settings.firebaseRulesCollapseLabel';
    buttonEl.textContent = isCollapsed ? '▾' : '▴';
    buttonEl.setAttribute('aria-label', t(key, isCollapsed ? 'Expand editor' : 'Collapse editor'));
    buttonEl.setAttribute('aria-expanded', String(!isCollapsed));
  };
  const setFirebaseAdminStatus = (message, { isError = false, i18nKey = null } = {}) => {
    if (!firebaseAdminStatus) return;
    if (typeof message === 'string') firebaseAdminStatus.textContent = message;
    firebaseAdminStatus.classList.toggle('is-error', !!isError);
    if (i18nKey) {
      firebaseAdminStatus.dataset.i18n = i18nKey;
    } else {
      firebaseAdminStatus.dataset.i18n = '';
    }
  };
  const setFirebaseAdminActionsStatus = (message, { i18nKey = null } = {}) => {
    if (!firebaseAdminActionsStatus) return;
    if (typeof message === 'string') firebaseAdminActionsStatus.textContent = message;
    if (i18nKey) {
      firebaseAdminActionsStatus.dataset.i18n = i18nKey;
    } else {
      firebaseAdminActionsStatus.dataset.i18n = '';
    }
  };
  const setFirebaseRulesStatus = (el, message, { isError = false, i18nKey = null } = {}) => {
    if (!el) return;
    if (typeof message === 'string') el.textContent = message;
    el.classList.toggle('is-error', !!isError);
    if (i18nKey) {
      el.dataset.i18n = i18nKey;
    } else {
      el.dataset.i18n = '';
    }
  };
  const setDefaultRulesStatus = (el, message, options = {}) => {
    if (!el) return;
    if (el.textContent && el.textContent.trim()) return;
    setFirebaseRulesStatus(el, message, options);
  };
  const clearRulesStatusIfDefault = (el) => {
    if (!el) return;
    const key = el.dataset?.i18n || '';
    if (key === 'settings.firebaseRulesStatus.unavailable' || key === 'settings.firebaseRulesStatus.needsAdmin') {
      setFirebaseRulesStatus(el, '');
    }
    el.classList.remove('is-success-icon');
    el.classList.remove('is-pending-icon');
  };
  const setFirebaseAdminProject = (projectId) => {
    if (!firebaseAdminProject) return;
    if (projectId) {
      firebaseAdminProject.hidden = false;
      firebaseAdminProject.textContent = `${t('settings.firebaseAdminProjectLabel', 'Project')}: ${projectId}`;
    } else {
      firebaseAdminProject.hidden = true;
      firebaseAdminProject.textContent = '';
    }
  };
  const setFirebaseAdminClearButton = (visible) => {
    if (!firebaseAdminClearBtn) return;
    firebaseAdminClearBtn.hidden = !visible;
  };
  const isDeployStatusLocked = (el) => {
    const key = el?.dataset?.i18n || '';
    return key === 'status.firebaseRulesDeployingFirestore'
      || key === 'status.firebaseRulesDeployingStorage'
      || key === 'status.firebaseFunctionsDeploying';
  };
  const clearDeployTrackingStatus = (el) => {
    if (!el) return;
    const key = el.dataset?.i18n || '';
    if (key === 'settings.firebaseRulesStatus.neverDeployed'
      || key === 'settings.firebaseRulesStatus.pendingChanges'
      || key === 'status.firebaseRulesDeployedFirestore'
      || key === 'status.firebaseRulesDeployedStorage'
      || key === 'status.firebaseFunctionsDeployed') {
      setFirebaseRulesStatus(el, '');
    }
    el.classList.remove('is-success-icon');
    el.classList.remove('is-pending-icon');
  };
  const applyDeployStateStatus = (el, state, deployedKey, deployedFallback, { useSuccessIcon = false } = {}) => {
    if (!el) return;
    el.classList.toggle('is-success-icon', false);
    el.classList.toggle('is-pending-icon', false);
    if (state === 'never') {
      setFirebaseRulesStatus(el, '', { i18nKey: null });
      el.classList.add('is-pending-icon');
      return;
    }
    if (state === 'pending') {
      setFirebaseRulesStatus(el, '', { i18nKey: null });
      el.classList.add('is-pending-icon');
      return;
    }
    if (state === 'deployed') {
      if (useSuccessIcon) {
        setFirebaseRulesStatus(el, '', { i18nKey: null });
        el.classList.add('is-success-icon');
      } else {
        setFirebaseRulesStatus(el, t(deployedKey, deployedFallback), { i18nKey: deployedKey });
      }
      return;
    }
    clearDeployTrackingStatus(el);
  };
  const clearRulesStatusError = (el) => {
    if (!el || !el.classList.contains('is-error')) return;
    setFirebaseRulesStatus(el, '');
    el.classList.remove('is-success-icon');
    el.classList.remove('is-pending-icon');
  };
  const updateFirebaseDeployStatuses = ({ firestoreReady = false, storageReady = false, functionsReady = false } = {}) => {
    const items = [
      {
        ready: firestoreReady,
        el: firebaseFirestoreRulesStatus,
        value: settingFirestoreRules?.value || '',
        storageKey: FIRESTORE_RULES_DEPLOY_KEY,
        deployedKey: 'status.firebaseRulesDeployedFirestore',
        deployedFallback: 'Firestore rules deployed.'
      },
      {
        ready: storageReady,
        el: firebaseStorageRulesStatus,
        value: settingStorageRules?.value || '',
        storageKey: STORAGE_RULES_DEPLOY_KEY,
        deployedKey: 'status.firebaseRulesDeployedStorage',
        deployedFallback: 'Storage rules deployed.'
      },
      {
        ready: functionsReady,
        el: firebaseFunctionsStatus,
        value: settingFirebaseFunctionIndex?.value || '',
        storageKey: FUNCTIONS_INDEX_DEPLOY_KEY,
        deployedKey: 'status.firebaseFunctionsDeployed',
        deployedFallback: 'Cloud Function deployed.'
      }
    ];
    items.forEach((item) => {
      if (!item.ready) return;
      if (isDeployStatusLocked(item.el)) return;
      if (item.el?.classList.contains('is-error')) return;
      const state = getRulesDeployState(item.value, item.storageKey).state;
      const useSuccessIcon = item.el === firebaseStorageRulesStatus
        || item.el === firebaseFirestoreRulesStatus
        || item.el === firebaseFunctionsStatus;
      applyDeployStateStatus(item.el, state, item.deployedKey, item.deployedFallback, { useSuccessIcon });
    });
  };
  const hasMissingFirebaseDeployments = () => {
    const firestore = readDeployState(FIRESTORE_RULES_DEPLOY_KEY)?.hash;
    const storage = readDeployState(STORAGE_RULES_DEPLOY_KEY)?.hash;
    const functions = readDeployState(FUNCTIONS_INDEX_DEPLOY_KEY)?.hash;
    return !(firestore && storage && functions);
  };
  const updateFirebaseAdminActionsState = () => {
    const hasClearSessionsApi = !!window.firebaseAdmin?.clearSessions;
    const hasClearAnonymousUsersApi = !!window.firebaseAdmin?.clearAnonymousUsers;
    const hasAdminApi = hasClearSessionsApi || hasClearAnonymousUsersApi;
    const canUse = firebaseAdminCredentialsReady;
    if (firebaseAdminClearSessionsBtn) {
      const enabled = hasClearSessionsApi && canUse;
      firebaseAdminClearSessionsBtn.disabled = !enabled;
      firebaseAdminClearSessionsBtn.setAttribute('aria-disabled', String(!enabled));
      firebaseAdminClearSessionsBtn.classList.toggle('is-disabled', !enabled);
    }
    if (firebaseAdminClearAnonymousUsersBtn) {
      const enabled = hasClearAnonymousUsersApi && canUse;
      firebaseAdminClearAnonymousUsersBtn.disabled = !enabled;
      firebaseAdminClearAnonymousUsersBtn.setAttribute('aria-disabled', String(!enabled));
      firebaseAdminClearAnonymousUsersBtn.classList.toggle('is-disabled', !enabled);
    }
    if (!firebaseAdminActionsStatus) return;
    if (!hasAdminApi) {
      setFirebaseAdminActionsStatus(t('settings.firebaseAdminActionsStatus.unavailable', 'Firebase Admin integration is unavailable.'), {
        i18nKey: 'settings.firebaseAdminActionsStatus.unavailable'
      });
    } else if (!firebaseAdminCredentialsReady) {
      setFirebaseAdminActionsStatus(t('settings.firebaseAdminActionsStatus.needsAdmin', 'Requires Firebase Admin credentials.'), {
        i18nKey: 'settings.firebaseAdminActionsStatus.needsAdmin'
      });
    } else {
      setFirebaseAdminActionsStatus(t('settings.firebaseAdminActionsStatus.ready', 'Ready to manage Firebase.'), {
        i18nKey: 'settings.firebaseAdminActionsStatus.ready'
      });
    }
    const rulesUnavailable = t('settings.firebaseRulesStatus.unavailable', 'Firebase Admin integration is unavailable.');
    const rulesNeedsAdmin = t('settings.firebaseRulesStatus.needsAdmin', 'Requires Firebase Admin credentials.');
    const hasFirestoreApi = !!window.firebaseAdmin?.deployFirestoreRules;
    const hasStorageApi = !!window.firebaseAdmin?.deployStorageRules;
    const hasFunctionsApi = !!window.firebaseAdmin?.deployTrackerUpdatesFunction;
    const canDeployFirestore = hasFirestoreApi && firebaseAdminCredentialsReady;
    const canDeployStorage = hasStorageApi && firebaseAdminCredentialsReady;
    const canDeployFunctions = hasFunctionsApi && firebaseAdminCredentialsReady;
    if (firebaseDeployFirestoreRulesBtn) {
      firebaseDeployFirestoreRulesBtn.disabled = !canDeployFirestore;
      firebaseDeployFirestoreRulesBtn.setAttribute('aria-disabled', String(!canDeployFirestore));
      firebaseDeployFirestoreRulesBtn.classList.toggle('is-disabled', !canDeployFirestore);
    }
    if (firebaseDeployStorageRulesBtn) {
      firebaseDeployStorageRulesBtn.disabled = !canDeployStorage;
      firebaseDeployStorageRulesBtn.setAttribute('aria-disabled', String(!canDeployStorage));
      firebaseDeployStorageRulesBtn.classList.toggle('is-disabled', !canDeployStorage);
    }
    if (firebaseDeployFunctionsBtn) {
      firebaseDeployFunctionsBtn.disabled = !canDeployFunctions;
      firebaseDeployFunctionsBtn.setAttribute('aria-disabled', String(!canDeployFunctions));
      firebaseDeployFunctionsBtn.classList.toggle('is-disabled', !canDeployFunctions);
    }
    if (firebaseDeployAllBtn) {
      const enabled = canDeployFirestore && canDeployStorage && canDeployFunctions;
      firebaseDeployAllBtn.disabled = !enabled;
      firebaseDeployAllBtn.setAttribute('aria-disabled', String(!enabled));
      firebaseDeployAllBtn.classList.toggle('is-disabled', !enabled);
    }
    if (!hasFirestoreApi) {
      setDefaultRulesStatus(firebaseFirestoreRulesStatus, rulesUnavailable, { i18nKey: 'settings.firebaseRulesStatus.unavailable' });
    } else if (!firebaseAdminCredentialsReady) {
      setDefaultRulesStatus(firebaseFirestoreRulesStatus, rulesNeedsAdmin, { i18nKey: 'settings.firebaseRulesStatus.needsAdmin' });
    } else {
      clearRulesStatusIfDefault(firebaseFirestoreRulesStatus);
    }
    if (!hasStorageApi) {
      setDefaultRulesStatus(firebaseStorageRulesStatus, rulesUnavailable, { i18nKey: 'settings.firebaseRulesStatus.unavailable' });
    } else if (!firebaseAdminCredentialsReady) {
      setDefaultRulesStatus(firebaseStorageRulesStatus, rulesNeedsAdmin, { i18nKey: 'settings.firebaseRulesStatus.needsAdmin' });
    } else {
      clearRulesStatusIfDefault(firebaseStorageRulesStatus);
    }
    if (!hasFunctionsApi) {
      setDefaultRulesStatus(firebaseFunctionsStatus, rulesUnavailable, { i18nKey: 'settings.firebaseRulesStatus.unavailable' });
    } else if (!firebaseAdminCredentialsReady) {
      setDefaultRulesStatus(firebaseFunctionsStatus, rulesNeedsAdmin, { i18nKey: 'settings.firebaseRulesStatus.needsAdmin' });
    } else {
      clearRulesStatusIfDefault(firebaseFunctionsStatus);
    }
    updateFirebaseDeployStatuses({
      firestoreReady: canDeployFirestore,
      storageReady: canDeployStorage,
      functionsReady: canDeployFunctions
    });
    updateTeamMemberActionsState();
    updateTeamsEmptyState();
    updateWelcomeState();
  };
  const formatFirebaseAdminError = (result, fallback) => {
    if (!result) return fallback;
    const base = result.error || fallback;
    const details = result.details;
    if (!details) return base;
    if (typeof details === 'string') return `${base} (${details})`;
    if (details.error_description) return `${base} (${details.error_description})`;
    if (details.error) return `${base} (${details.error})`;
    return base;
  };
  const applyFirebaseConfigFromAdmin = async () => {
    if (!window.firebaseAdmin?.getFirebaseConfig) return { ok: false, reason: 'unavailable' };
    try {
      const result = await window.firebaseAdmin.getFirebaseConfig();
      if (!result?.ok || !result?.config) {
        const message = result?.error || t('alerts.firebaseConfigFetchFailed', 'Unable to generate Firebase settings.');
        setSettingsStatus(message, 4000);
        showToast(message, 'error');
        return { ok: false, error: message };
      }
      const configRaw = `${JSON.stringify(result.config, null, 2)}\n`;
      if (settingFirebaseConfig) {
        withSuppressedSettingsEvents(() => {
          settingFirebaseConfig.value = configRaw;
        });
      }
      try {
        localStorage.setItem(FIREBASE_SETTINGS_STORAGE_KEY, configRaw);
      } catch {}
      firebaseSettings = result.config;
      initFirestoreConnection();
      setSettingsStatus(t('status.firebaseConfigGenerated', 'Firebase settings generated.'), 4000);
      return { ok: true, config: result.config };
    } catch (err) {
      const message = err?.message || t('alerts.firebaseConfigFetchFailed', 'Unable to generate Firebase settings.');
      setSettingsStatus(message, 4000);
      showToast(message, 'error');
      return { ok: false, error: message };
    }
  };
  const refreshFirebaseAdminStatus = async () => {
    if (!window.firebaseAdmin?.getStatus) return;
    try {
      const result = await window.firebaseAdmin.getStatus();
      if (result?.ok) {
        firebaseAdminCredentialsReady = true;
        setFirebaseAdminStatus(t('settings.firebaseAdminStatus.ready', 'Firebase Admin credentials loaded.'), { i18nKey: 'settings.firebaseAdminStatus.ready' });
        setFirebaseAdminProject(result.projectId || '');
        setFirebaseAdminClearButton(true);
      } else if (result?.missing) {
        firebaseAdminCredentialsReady = false;
        setFirebaseAdminStatus(t('settings.firebaseAdminStatus.empty', 'No Firebase Admin credentials loaded.'), { i18nKey: 'settings.firebaseAdminStatus.empty' });
        setFirebaseAdminProject('');
        setFirebaseAdminClearButton(false);
      } else {
        firebaseAdminCredentialsReady = false;
        const fallback = t('alerts.firebaseAdminReadFailed', 'Unable to read Firebase Admin credentials.');
        setFirebaseAdminStatus(formatFirebaseAdminError(result, fallback), { isError: true });
        setFirebaseAdminProject('');
        setFirebaseAdminClearButton(false);
      }
      updateFirebaseAdminActionsState();
    } catch (err) {
      firebaseAdminCredentialsReady = false;
      const fallback = t('alerts.firebaseAdminReadFailed', 'Unable to read Firebase Admin credentials.');
      setFirebaseAdminStatus(fallback, { isError: true });
      setFirebaseAdminProject('');
      setFirebaseAdminClearButton(false);
      updateFirebaseAdminActionsState();
    }
  };

  const bindStaticTranslations = () => {
    bindTextAuto(tabMapLabel, 'nav.map');
    bindTextAuto(tabSettingsLabel, 'nav.settings');

    const toolbarBindings = [
      [toolSearch, 'toolbar.search'],
      [toolGoTo, 'toolbar.goto'],
      [toolZoomIn, 'toolbar.zoomIn'],
      [toolZoomOut, 'toolbar.zoomOut'],
      [toolResetView, 'toolbar.resetView'],
      [toolPin, 'toolbar.pin'],
      [toolEdit, 'toolbar.editFeatures'],
      [toolRect, 'toolbar.drawRectangle'],
      [toolPoly, 'toolbar.drawPolygon'],
      [toolCircle, 'toolbar.drawCircle'],
      [toolLine, 'toolbar.drawLine'],
      [toolArrow, 'toolbar.drawArrow'],
      [toolPOI, 'toolbar.addPoi'],
      [toolCrosshair, 'toolbar.showCoordinates'],
      [toolSetScale, 'toolbar.setScale'],
      [toolLabelIncrease, 'toolbar.increaseLabelSize'],
      [toolLabelDecrease, 'toolbar.decreaseLabelSize'],
      [toolPrint, 'toolbar.saveSnapshot'],
      [toolExportPdf, 'toolbar.exportPdf'],
      [toolShortcuts, 'toolbar.shortcuts']
    ];
    toolbarBindings.forEach(([btn, key]) => {
      bindAttrAuto(btn, 'title', key);
      bindAttrAuto(btn, 'aria-label', key);
      bindAttrAuto(btn, 'data-tooltip', key);
    });

    bindAttrAuto(fullscreenBtn, 'title', 'toolbar.fullscreen');
    bindAttrAuto(fullscreenBtn, 'aria-label', 'toolbar.fullscreen');
    bindAttrAuto(coordClose, 'title', 'common.close');
    bindAttrAuto(coordClose, 'aria-label', 'common.close');
    if (coordProvider) {
      coordProvider.querySelectorAll('option').forEach((option) => {
        const key = option.dataset.i18n;
        if (key) bindTextAuto(option, key);
      });
    }
    bindTextAuto(coordOpenProvider, 'coordModal.openInBrowser');

    if (languageToggle) {
      bindAttrAuto(languageToggle, 'title', 'settings.appLanguage');
      bindAttrAuto(languageToggle, 'aria-label', 'settings.appLanguage');
    }

    bindTextAuto(document.getElementById('mapWelcomeTitle'), 'map.welcomeTitle');
    bindHtmlAuto(document.getElementById('mapWelcomeDesc'), 'map.welcomeIntro');
    const welcomeSteps = mapWelcome?.querySelectorAll('.map-welcome-todo li');
    if (welcomeSteps?.[0]) bindHtmlAuto(welcomeSteps[0], 'map.welcomeStep1');
    if (welcomeSteps?.[1]) bindTextAuto(welcomeSteps[1], 'map.welcomeStep2');
    if (welcomeSteps?.[2]) bindHtmlAuto(welcomeSteps[2], 'map.welcomeStep3');
    bindTextAuto(mapWelcomeSettings, 'map.welcomeAction');

    bindAttrAuto(mapUtilityToolbar, 'aria-label', 'map.utilities');
    bindAttrAuto(mapStyleToolbar, 'aria-label', 'map.utilities.styles');

    const featuresUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'features');
    if (featuresUtilityBtn) {
      bindAttrAuto(featuresUtilityBtn, 'data-tooltip', 'map.utilities.features');
      bindAttrAuto(featuresUtilityBtn, 'aria-label', 'map.utilities.toggleFeatures');
      bindTextAuto(featuresUtilityBtn.querySelector('.visually-hidden'), 'map.utilities.toggleFeatures');
    }
    if (weatherUtilityBtn) {
      bindAttrAuto(weatherUtilityBtn, 'data-tooltip', 'map.utilities.weather');
      bindAttrAuto(weatherUtilityBtn, 'aria-label', 'map.utilities.toggleWeather');
      bindTextAuto(weatherUtilityBtn.querySelector('.visually-hidden'), 'map.utilities.toggleWeather');
    }
    if (satelliteUtilityBtn) {
      bindAttrAuto(satelliteUtilityBtn, 'data-tooltip', 'map.utilities.satellite');
      bindAttrAuto(satelliteUtilityBtn, 'aria-label', 'map.utilities.toggleSatellite');
      bindTextAuto(satelliteUtilityBtn.querySelector('.visually-hidden'), 'map.utilities.toggleSatellite');
    }
    if (terrainUtilityBtn) {
      bindAttrAuto(terrainUtilityBtn, 'data-tooltip', 'map.utilities.terrain');
      bindAttrAuto(terrainUtilityBtn, 'aria-label', 'map.utilities.toggleTerrain');
      bindTextAuto(terrainUtilityBtn.querySelector('.visually-hidden'), 'map.utilities.toggleTerrain');
    }
    if (streetUtilityBtn) {
      bindAttrAuto(streetUtilityBtn, 'data-tooltip', 'map.utilities.street');
      bindAttrAuto(streetUtilityBtn, 'aria-label', 'map.utilities.toggleStreet');
      bindTextAuto(streetUtilityBtn.querySelector('.visually-hidden'), 'map.utilities.toggleStreet');
    }
    const trackersUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'trackers');
    if (trackersUtilityBtn) {
      bindAttrAuto(trackersUtilityBtn, 'data-tooltip', 'map.utilities.trackers');
      bindAttrAuto(trackersUtilityBtn, 'aria-label', 'map.utilities.toggleTrackers');
      bindTextAuto(trackersUtilityBtn.querySelector('.visually-hidden'), 'map.utilities.toggleTrackers');
    }

    bindAttrAuto(featuresSidebar, 'aria-label', 'sidebar.featuresTitle');
    bindTextAuto(featuresSidebar?.querySelector('.features-title'), 'sidebar.featuresTitle');
    bindAttrAuto(featuresCollapse, 'title', 'sidebar.featuresHide');
    bindAttrAuto(featuresCollapse, 'aria-label', 'sidebar.featuresHide');
    const featuresToggleLabel = featuresToggleBtn?.querySelector('.sidebar-toggle-label');
    const featuresToggleHidden = featuresToggleBtn?.querySelector('.visually-hidden');
    bindTextAuto(featuresToggleLabel, 'sidebar.featuresToggleLabel');
    bindTextAuto(featuresToggleHidden, 'sidebar.featuresShow');
    bindAttrAuto(featuresActionsToggleBtn, 'aria-label', 'features.menu.open');
    bindTextAuto(featuresActionsToggleBtn?.querySelector('.visually-hidden'), 'features.menu.open');
    bindTextAuto(featuresSaveBtn?.querySelector('span'), 'features.menu.save');
    bindTextAuto(featuresLoadBtn?.querySelector('span'), 'features.menu.load');
    bindTextAuto(featuresLoadGpxBtn?.querySelector('span'), 'features.menu.loadGpx');
    bindTextAuto(featuresClearBtn?.querySelector('span'), 'features.menu.clear');
    bindAttrAuto(featuresResizer, 'title', 'sidebar.dragResize');

    bindAttrAuto(trackersSidebar, 'aria-label', 'sidebar.trackersTitle');
    bindTextAuto(trackersSidebar?.querySelector('.trackers-title'), 'sidebar.trackersTitle');
    bindAttrAuto(trackersCollapse, 'title', 'sidebar.trackersHide');
    bindAttrAuto(trackersCollapse, 'aria-label', 'sidebar.trackersHide');
    const trackersToggleLabel = trackersToggleBtn?.querySelector('.sidebar-toggle-label');
    const trackersToggleHidden = trackersToggleBtn?.querySelector('.visually-hidden');
    bindTextAuto(trackersToggleLabel, 'sidebar.trackersToggleLabel');
    bindTextAuto(trackersToggleHidden, 'sidebar.trackersShow');
    bindTextAuto(document.getElementById('trackersRecordText'), 'trackers.record');
    bindTextAuto(trackersMenuToggle?.querySelector('.visually-hidden'), 'trackers.openMenu');
    bindTextAuto(trackersSaveBtn?.querySelector('span'), 'trackers.save');
    bindTextAuto(trackersOpenBtn?.querySelector('span'), 'trackers.open');

    bindTextAuto(document.querySelector('.settings-panel h2'), 'settings.title');
    const settingsNavTitle = document.querySelector('.settings-nav-title');
    if (settingsNavTitle) bindTextAuto(settingsNavTitle, 'settings.groupsTitle');
    document.querySelectorAll('.settings-nav-item[data-settings-group]').forEach((btn) => {
      const key = SETTINGS_GROUP_KEY_MAP[btn.dataset.settingsGroup];
      if (key) bindTextAuto(btn, key);
    });
    document.querySelectorAll('.settings-group[data-settings-group] h3').forEach((heading) => {
      const group = heading.closest('.settings-group')?.dataset?.settingsGroup;
      const key = SETTINGS_GROUP_KEY_MAP[group];
      if (key) bindTextAuto(heading, key);
    });

    bindText(labelOf(settingLanguage), 'settings.appLanguage', labelOf(settingLanguage)?.textContent || 'App Language');
    bindText(labelOf(settingAccessToken), 'settings.mapboxToken', labelOf(settingAccessToken)?.textContent || 'Mapbox Access Token');
    const accessTokenHelp = helpOf(settingAccessToken);
    bindAttr(accessTokenHelp, 'aria-label', 'settings.mapboxToken.help', accessTokenHelp?.getAttribute('aria-label') || '');
    bindAttr(accessTokenHelp, 'data-tooltip', 'settings.mapboxToken.help', accessTokenHelp?.getAttribute('data-tooltip') || '');
    bindText(labelOf(settingGoogleKey), 'settings.googleKey', labelOf(settingGoogleKey)?.textContent || 'Google Maps API Key');
    const googleHelp = helpOf(settingGoogleKey);
    bindAttr(googleHelp, 'aria-label', 'settings.googleKey.help', googleHelp?.getAttribute('aria-label') || '');
    bindAttr(googleHelp, 'data-tooltip', 'settings.googleKey.help', googleHelp?.getAttribute('data-tooltip') || '');
    bindText(labelOf(settingOpenAIKey), 'settings.openaiKey', labelOf(settingOpenAIKey)?.textContent || 'OpenAI API Key');
    const openaiHelp = helpOf(settingOpenAIKey);
    bindAttr(openaiHelp, 'aria-label', 'settings.openaiKey.help', openaiHelp?.getAttribute('aria-label') || '');
    bindAttr(openaiHelp, 'data-tooltip', 'settings.openaiKey.help', openaiHelp?.getAttribute('data-tooltip') || '');
    bindText(labelOf(settingFirebaseConfig), 'settings.firebaseConfig', labelOf(settingFirebaseConfig)?.textContent || 'Firebase Settings (JSON)');
    bindText(labelOf(settingStyleUrl), 'settings.streetStyleUrl', labelOf(settingStyleUrl)?.textContent || 'Street Map Style URL');
    bindText(labelOf(settingSatelliteStyleUrl), 'settings.satelliteStyleUrl', labelOf(settingSatelliteStyleUrl)?.textContent || 'Satellite Map Style URL');
    bindText(labelOf(settingTerrainStyleUrl), 'settings.terrainStyleUrl', labelOf(settingTerrainStyleUrl)?.textContent || 'Terrain Map Style URL');
    bindText(labelOf(settingHomeAddress), 'settings.homeAddress', labelOf(settingHomeAddress)?.textContent || 'Home Address');
    bindText(labelOf(settingStartLat), 'settings.startLatitude', labelOf(settingStartLat)?.textContent || 'Start Latitude');
    bindText(labelOf(settingStartLng), 'settings.startLongitude', labelOf(settingStartLng)?.textContent || 'Start Longitude');
    bindText(labelOf(settingStartZoom), 'settings.startZoom', labelOf(settingStartZoom)?.textContent || 'Start Zoom');
    bindTextAuto(settingsSaveBtn, 'settings.save');

    bindTextAuto(document.getElementById('searchTitle'), 'searchModal.title');
    bindAttrAuto(searchClose, 'title', 'common.close');
    bindText(labelOf(searchQuery), 'searchModal.address', labelOf(searchQuery)?.textContent || 'Address');
    bindAttrAuto(searchQuery, 'placeholder', 'searchModal.placeholder');
    bindAttrAuto(searchResults, 'aria-label', 'searchModal.results');

    bindTextAuto(document.getElementById('gotoTitle'), 'gotoModal.title');
    bindAttrAuto(gotoClose, 'title', 'common.close');
    bindText(labelOf(gotoLat), 'gotoModal.latitude', labelOf(gotoLat)?.textContent || 'Latitude');
    bindAttrAuto(gotoLat, 'placeholder', 'gotoModal.placeholderLat');
    bindText(labelOf(gotoLng), 'gotoModal.longitude', labelOf(gotoLng)?.textContent || 'Longitude');
    bindAttrAuto(gotoLng, 'placeholder', 'gotoModal.placeholderLng');
    const gotoUtmZoneLabel = labelOf(gotoUtmZone);
    if (gotoUtmZoneLabel) bindText(gotoUtmZoneLabel, 'gotoModal.utmZone', gotoUtmZoneLabel.textContent || 'UTM Zone');
    bindAttrAuto(gotoUtmZone, 'placeholder', 'gotoModal.placeholderUtmZone');
    const gotoUtmEastingLabel = labelOf(gotoUtmEasting);
    if (gotoUtmEastingLabel) bindText(gotoUtmEastingLabel, 'gotoModal.utmEasting', gotoUtmEastingLabel.textContent || 'Easting (mE)');
    bindAttrAuto(gotoUtmEasting, 'placeholder', 'gotoModal.placeholderUtmEasting');
    const gotoUtmNorthingLabel = labelOf(gotoUtmNorthing);
    if (gotoUtmNorthingLabel) bindText(gotoUtmNorthingLabel, 'gotoModal.utmNorthing', gotoUtmNorthingLabel.textContent || 'Northing (mN)');
    bindAttrAuto(gotoUtmNorthing, 'placeholder', 'gotoModal.placeholderUtmNorthing');
    const gotoGkZoneLabel = labelOf(gotoGkZone);
    if (gotoGkZoneLabel) bindText(gotoGkZoneLabel, 'gotoModal.gkZone', gotoGkZoneLabel.textContent || 'GK Zone');
    bindAttrAuto(gotoGkZone, 'placeholder', 'gotoModal.placeholderGkZone');
    const gotoGkEastingLabel = labelOf(gotoGkEasting);
    if (gotoGkEastingLabel) bindText(gotoGkEastingLabel, 'gotoModal.gkEasting', gotoGkEastingLabel.textContent || 'Easting (m)');
    bindAttrAuto(gotoGkEasting, 'placeholder', 'gotoModal.placeholderGkEasting');
    const gotoGkNorthingLabel = labelOf(gotoGkNorthing);
    if (gotoGkNorthingLabel) bindText(gotoGkNorthingLabel, 'gotoModal.gkNorthing', gotoGkNorthingLabel.textContent || 'Northing (m)');
    bindAttrAuto(gotoGkNorthing, 'placeholder', 'gotoModal.placeholderGkNorthing');
    const gotoAddPoiLabel = document.getElementById('gotoAddPoiLabel');
    bindTextAuto(gotoAddPoiLabel, 'gotoModal.addPoi');
    bindText(labelOf(gotoPoiName), 'gotoModal.poiName', labelOf(gotoPoiName)?.textContent || 'POI name');
    bindAttrAuto(gotoPoiName, 'placeholder', 'gotoModal.poiPlaceholder');
    bindTextAuto(gotoSubmit, 'gotoModal.go');

    bindTextAuto(document.getElementById('shortcutsTitle'), 'shortcutsModal.title');
    bindAttrAuto(shortcutsClose, 'title', 'common.close');

    bindTextAuto(document.getElementById('colorTitle'), 'colorModal.title');
    bindAttrAuto(colorClose, 'title', 'common.close');
    bindAttrAuto(document.getElementById('colorGrid'), 'aria-label', 'colorModal.colors');

    bindTextAuto(document.getElementById('aiTitle'), 'aiModal.title');
    bindAttrAuto(aiClose, 'title', 'common.close');
    bindText(labelOf(document.getElementById('aiInput')), 'aiModal.instruction', labelOf(document.getElementById('aiInput'))?.textContent || 'Instruction');
    bindAttrAuto(document.getElementById('aiInput'), 'placeholder', 'aiModal.placeholder');
    bindTextAuto(document.getElementById('aiSubmit'), 'aiModal.submit');


    if (footerStatLabels?.[1]) bindTextAuto(footerStatLabels[1], 'footer.zoom');
    if (footerStatLabels?.[2]) bindTextAuto(footerStatLabels[2], 'footer.scale');
    if (footerStatLabels?.[3]) bindTextAuto(footerStatLabels[3], 'footer.bearing');
    if (footerStatLabels?.[4]) bindTextAuto(footerStatLabels[4], 'footer.pitch');
    if (footerStatLabels?.[5]) bindTextAuto(footerStatLabels[5], 'footer.address');
    applyFooterCoordLabel(getFooterLabelKeyForSystem(currentCoordinateSystem));
  };

  const searchModal = q('#searchModal');
  const searchClose = q('#searchClose');
  const searchQuery = q('#searchQuery');
  const searchResults = q('#searchResults');
  // Go To modal
  const gotoModal = q('#gotoModal');
  const gotoClose = q('#gotoClose');
  const gotoLng = q('#gotoLng');
  const gotoLat = q('#gotoLat');
  const gotoFieldsLatLng = q('#gotoFieldsLatLng');
  const gotoFieldsUTM = q('#gotoFieldsUTM');
  const gotoFieldsGK = q('#gotoFieldsGK');
  const gotoUtmZone = q('#gotoUtmZone');
  const gotoUtmEasting = q('#gotoUtmEasting');
  const gotoUtmNorthing = q('#gotoUtmNorthing');
  const gotoGkZone = q('#gotoGkZone');
  const gotoGkEasting = q('#gotoGkEasting');
  const gotoGkNorthing = q('#gotoGkNorthing');
  const gotoAddPoi = q('#gotoAddPoi');
  const gotoSubmit = q('#gotoSubmit');
  const gotoPoiNameField = q('#gotoPoiNameField');
  const gotoPoiName = q('#gotoPoiName');
  const teamMemberModal = q('#teamMemberModal');
  const teamMemberClose = q('#teamMemberClose');
  const teamMemberStatus = q('#teamMemberStatus');
  const teamMemberQrLoading = q('#teamMemberQrLoading');
  const teamMemberQr = q('#teamMemberQr');
  const trimMemberModal = q('#trimMemberModal');
  const trimMemberClose = q('#trimMemberClose');
  const trimMemberTitle = q('#trimMemberTitle');
  const trimMemberMapEl = q('#trimMemberMap');
  const trimMemberMapEmpty = q('#trimMemberMapEmpty');
  const trimMemberSlider = q('#trimMemberSlider');
  const trimMemberRangeFill = q('#trimMemberRangeFill');
  const trimMemberRangeStart = q('#trimMemberRangeStart');
  const trimMemberRangeEnd = q('#trimMemberRangeEnd');
  const trimMemberRangeStartLabel = q('#trimMemberRangeStartLabel');
  const trimMemberRangeStartDate = q('#trimMemberRangeStartDate');
  const trimMemberRangeEndLabel = q('#trimMemberRangeEndLabel');
  const trimMemberRangeEndDate = q('#trimMemberRangeEndDate');
  const trimMemberRangeLength = q('#trimMemberRangeLength');
  const trimMemberRangePoints = q('#trimMemberRangePoints');
  const trimMemberStatus = q('#trimMemberStatus');
  const trimMemberExtract = q('#trimMemberExtract');
  const teamsStartSessionModal = q('#teamsStartSessionModal');
  const teamsStartSessionClose = q('#teamsStartSessionClose');
  const teamsStartSessionForm = q('#teamsStartSessionForm');
  const teamsStartSessionTitleInput = q('#teamsStartSessionTitleInput');
  const teamsStartSessionSubmit = q('#teamsStartSessionSubmit');
  const teamsStartSessionCancel = q('#teamsStartSessionCancel');
  const teamsResumeSessionModal = q('#teamsResumeSessionModal');
  const teamsResumeSessionClose = q('#teamsResumeSessionClose');
  const teamsLoadSessionStatus = q('#teamsLoadSessionStatus');
  const teamsLoadSessionList = q('#teamsLoadSessionList');
  const teamsResumeSessionCancel = q('#teamsResumeSessionCancel');
  const teamsResumeSessionInlineStart = q('#teamsResumeSessionInlineStart');
  const teamsResumeSessionStart = q('#teamsResumeSessionStart');
  const teamsSessionActionsModal = q('#teamsSessionActionsModal');
  const teamsSessionActionsClose = q('#teamsSessionActionsClose');
  const teamsSessionActionsId = q('#teamsSessionActionsId');
  const teamsSessionRenameForm = q('#teamsSessionRenameForm');
  const teamsSessionRenameInput = q('#teamsSessionRenameInput');
  const teamsSessionRenameSubmit = q('#teamsSessionRenameSubmit');
  const teamsSessionStopAction = q('#teamsSessionStopAction');
  const teamsSessionCloseAction = q('#teamsSessionCloseAction');
  const teamsDeleteSessionModal = q('#teamsDeleteSessionModal');
  const teamsDeleteSessionClose = q('#teamsDeleteSessionClose');
  const teamsDeleteSessionMessage = q('#teamsDeleteSessionMessage');
  const teamsDeleteSessionWarning = q('#teamsDeleteSessionWarning');
  const teamsDeleteSessionMeta = q('#teamsDeleteSessionMeta');
  const teamsDeleteSessionStatus = q('#teamsDeleteSessionStatus');
  const teamsDeleteSessionCancel = q('#teamsDeleteSessionCancel');
  const teamsDeleteSessionConfirm = q('#teamsDeleteSessionConfirm');
  const shortcutsModal = q('#shortcutsModal');
  const shortcutsClose = q('#shortcutsClose');
  const shortcutsList = q('#shortcutsList');
  if (teamMemberModal) teamMemberModal.setAttribute('aria-hidden', 'true');
  if (trimMemberModal) trimMemberModal.setAttribute('aria-hidden', 'true');
  if (teamsStartSessionModal) teamsStartSessionModal.setAttribute('aria-hidden', 'true');
  if (teamsResumeSessionModal) teamsResumeSessionModal.setAttribute('aria-hidden', 'true');
  if (teamsSessionActionsModal) teamsSessionActionsModal.setAttribute('aria-hidden', 'true');
  if (teamsDeleteSessionModal) teamsDeleteSessionModal.setAttribute('aria-hidden', 'true');
  if (firebaseAdminClearSessionsModal) firebaseAdminClearSessionsModal.setAttribute('aria-hidden', 'true');
  if (firebaseAdminClearAnonymousUsersModal) firebaseAdminClearAnonymousUsersModal.setAttribute('aria-hidden', 'true');
  if (shortcutsModal) shortcutsModal.setAttribute('aria-hidden', 'true');
  // Sidebar elements
  const featuresSidebar = q('#featuresSidebar');
  const featuresResizer = q('#featuresResizer');
  const featuresCollapse = q('#featuresCollapse');
  const featuresToggleBtn = q('#featuresToggleBtn');
  const trackersSidebar = q('#trackersSidebar');
  const trackersToggleBtn = q('#trackersToggleBtn');
  const trackersCollapse = q('#trackersCollapse');
  const teamsSessionIdEl = q('#teamsSessionId');
  const teamsSessionTitleEl = q('#teamsSessionTitle');
  const teamsEmptyState = q('#teamsEmptyState');
  const teamsEmptyTitle = q('#teamsEmptyTitle');
  const teamsEmptySubtitle = q('#teamsEmptySubtitle');
  const teamsEmptyActions = q('#teamsEmptyActions');
  const teamsStartSessionBtn = q('#teamsStartSessionBtn');
  const teamsResumeSessionBtn = q('#teamsResumeSessionBtn');
  const teamsAddBtn = q('#teamsAddBtn');
  const trackersList = q('#trackersList');
  const trackersItems = q('#trackersItems');
  const trackersControls = q('#trackersControls');
  const trackersMenuWrapper = q('#trackersMenuWrapper');
  const trackersMenuToggle = q('#trackersMenuToggle');
  const trackersMenu = q('#trackersMenu');
  const trackersRecordBtn = q('#trackersRecordBtn');
  const trackersSaveBtn = q('#trackersSaveBtn');
  const trackersOpenBtn = q('#trackersOpenBtn');
  const trackersRecordIcon = q('#trackersRecordIcon');
  const trackersRecordText = q('#trackersRecordText');
  const trackersRecordIndicator = q('#trackersRecordIndicator');
  // Color picker modal
  const colorModal = q('#colorModal');
  const colorClose = q('#colorClose');
  const colorGrid = q('#colorGrid');
  const colorState = { onPick: null, current: null };
  // POI icon modal
  const poiIconModal = q('#poiIconModal');
  const poiIconClose = q('#poiIconClose');
  const poiIconGrid = q('#poiIconGrid');
  const poiIconStatus = q('#poiIconStatus');
  const poiIconPickerState = { targetId: null, currentId: null, mode: null, trackerId: null };
  // AI modal
  const aiModal = q('#aiModal');
  const aiClose = q('#aiClose');
  const aiMeta = q('#aiMeta');
  const aiInput = q('#aiInput');
  const aiSubmit = q('#aiSubmit');
  const aiError = q('#aiError');
  const aiSpinner = q('#aiSpinner');
  const aiPresetSelect = q('#aiPreset');
  const aiModifiersInput = q('#aiModifiers');
  const aiReplaceCheckbox = q('#aiReplaceOriginal');
  const aiValueField = q('#aiValueField');
  const aiValueInput = q('#aiValueInput');
  const aiDirectionField = q('#aiDirectionField');
  const aiDirectionSelect = q('#aiDirectionSelect');
  let aiTarget = null;
  const toastContainer = q('#toastContainer');
  const coordModal = q('#coordModal');
  const coordClose = q('#coordClose');
  const coordList = q('#coordList');
  const coordProvider = q('#coordProvider');
  const coordOpenProvider = q('#coordOpenProvider');
  const footerStatLabels = document.querySelectorAll('.app-footer .stat .k');
  const statCenterLabel = footerStatLabels?.[0] || null;

  const getFooterLabelKeyForSystem = (system) => {
    switch ((system || '').toLowerCase()) {
      case 'utm':
        return 'footer.utm';
      case 'gk':
        return 'footer.gk';
      default:
        return 'footer.latLong';
    }
  };
  const applyFooterCoordLabel = (labelKey) => {
    if (!statCenterLabel) return;
    statCenterLabel.dataset.i18n = labelKey;
    let fallback = 'Lat/Long';
    if (labelKey === 'footer.utm') fallback = 'UTM';
    else if (labelKey === 'footer.gk') fallback = 'GK';
    statCenterLabel.textContent = t(labelKey, fallback);
  };
  const formatUtmFooterValue = (lat, lng) => {
    const utm = utmFromLatLng(lat, lng);
    if (!utm) return null;
    const eastingVal = Math.round(utm.easting);
    const northingVal = Math.round(utm.northing);
    return `${utm.zoneNumber}${utm.zoneLetter} ${eastingVal} mE ${northingVal} mN`;
  };
  const formatGkFooterValue = (lat, lng) => {
    const gk = gaussKruegerFromLatLng(lat, lng);
    if (!gk) return null;
    const eastingVal = Math.round(gk.easting);
    const northingVal = Math.round(gk.northing);
    return `GK${gk.zoneNumber} ${eastingVal} mE ${northingVal} mN`;
  };
  const getFooterCenterDisplay = (lat, lng) => {
    switch ((currentCoordinateSystem || '').toLowerCase()) {
      case 'utm': {
        const utmText = formatUtmFooterValue(lat, lng);
        return { labelKey: 'footer.utm', text: utmText || '—' };
      }
      case 'gk': {
        const gkText = formatGkFooterValue(lat, lng);
        return { labelKey: 'footer.gk', text: gkText || '—' };
      }
      default:
        return { labelKey: 'footer.latLong', text: `${formatFixed(lat, 5)}, ${formatFixed(lng, 5)}` };
    }
  };
  const updateFooterCenterDisplay = (lat, lng) => {
    const display = getFooterCenterDisplay(lat, lng);
    applyFooterCoordLabel(display.labelKey);
    if (statCenter) statCenter.textContent = display.text;
  };

  if (aiPresetSelect) {
    aiPresetSelect.addEventListener('change', () => {
      const selected = aiPresetSelect.value || '';
      updateAiDynamicFields(selected);
    });
  }

  const crosshairState = {
    active: false,
    lastFocus: null,
    lastPoint: null
  };
  const buildMapUrl = (service, { lng, lat }) => {
    const precision = 6;
    const latStr = Number.isFinite(lat) ? lat.toFixed(precision) : null;
    const lngStr = Number.isFinite(lng) ? lng.toFixed(precision) : null;
    if (!latStr || !lngStr) return null;
    switch (service) {
      case 'google-maps':
        return `https://www.google.com/maps/@${latStr},${lngStr},17z`;
      case 'openstreetmap':
        return `https://www.openstreetmap.org/?mlat=${latStr}&mlon=${lngStr}#map=17/${latStr}/${lngStr}`;
      case 'bing':
        return `https://www.bing.com/maps?cp=${latStr}~${lngStr}&lvl=17`;
      case 'arcgis':
        return `https://www.arcgis.com/home/webmap/viewer.html?center=${lngStr},${latStr}&zoom=15`;
      default:
        return null;
    }
  };
  const coordinateIconPath = './assets/icons/regular/copy-simple.svg';
  const shortcutDefinitions = [
    { key: '1', labelKey: 'shortcuts.drawRectangle', fallback: 'Draw rectangle' },
    { key: '2', labelKey: 'shortcuts.drawPolygon', fallback: 'Draw polygon' },
    { key: '3', labelKey: 'shortcuts.drawCircle', fallback: 'Draw circle' },
    { key: '4', labelKey: 'shortcuts.drawPolyline', fallback: 'Draw polyline' },
    { key: '5', labelKey: 'shortcuts.drawArrow', fallback: 'Draw arrow' },
    { key: '6', labelKey: 'shortcuts.addPoi', fallback: 'Add POI' },
    { key: 'E', labelKey: 'shortcuts.edit', fallback: 'Edit features' },
    { key: '8', labelKey: 'shortcuts.showCoordinates', fallback: 'Show coordinates' },
    { key: '9', labelKey: 'shortcuts.setScale', fallback: 'Set scale' },
    { key: '↑', labelKey: 'shortcuts.panUp', fallback: 'Pan map up' },
    { key: '↓', labelKey: 'shortcuts.panDown', fallback: 'Pan map down' },
    { key: '←', labelKey: 'shortcuts.panLeft', fallback: 'Pan map left' },
    { key: '→', labelKey: 'shortcuts.panRight', fallback: 'Pan map right' },
    { key: 'S', labelKey: 'shortcuts.search', fallback: 'Search address' },
    { key: 'C', labelKey: 'shortcuts.goto', fallback: 'Go to coordinate' },
    { key: '+', labelKey: 'shortcuts.zoomIn', fallback: 'Zoom in' },
    { key: '-', labelKey: 'shortcuts.zoomOut', fallback: 'Zoom out' },
    { key: 'F', labelKey: 'shortcuts.featuresPanel', fallback: 'Toggle features panel' },
    { key: 'T', labelKey: 'shortcuts.trackersPanel', fallback: 'Toggle teams panel' },
    { key: 'G', labelKey: 'shortcuts.gridOverlay', fallback: 'Cycle grid overlay' },
    { key: 'P', labelKey: 'shortcuts.saveSnapshot', fallback: 'Save snapshot' }
  ];
  const renderShortcutsList = () => {
    if (!shortcutsList) return;
    shortcutsList.textContent = '';
    shortcutDefinitions.forEach((shortcut) => {
      const row = document.createElement('div');
      row.className = 'shortcut-item';
      row.setAttribute('role', 'listitem');
      const keyCell = document.createElement('div');
      keyCell.className = 'shortcut-key';
      keyCell.textContent = shortcut.key;
      const descriptionCell = document.createElement('div');
      descriptionCell.className = 'shortcut-description';
      descriptionCell.textContent = t(shortcut.labelKey, shortcut.fallback);
      row.appendChild(keyCell);
      row.appendChild(descriptionCell);
      shortcutsList.appendChild(row);
    });
  };
  const MAPBOX_STYLE_URL_RE = /^mapbox:\/\/styles\/([^/]+)\/([^/?#]+)/i;
  const buildMapboxStyleCheckUrl = (styleUrl, token) => {
    if (!token || typeof styleUrl !== 'string') return null;
    const match = MAPBOX_STYLE_URL_RE.exec(styleUrl);
    if (!match) return null;
    const user = match[1];
    const styleId = match[2];
    if (!user || !styleId) return null;
    return `https://api.mapbox.com/styles/v1/${user}/${styleId}?access_token=${encodeURIComponent(token)}`;
  };
  const validateMapboxStyleUrl = async (styleUrl, token) => {
    const url = buildMapboxStyleCheckUrl(styleUrl, token);
    if (!url) return true;
    try {
      const resp = await fetch(url, { method: 'GET' });
      return !!(resp && resp.ok);
    } catch (err) {
      console.warn('validateMapboxStyleUrl failed', err);
      return false;
    }
  };
  const buildCoordEntries = (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    const entries = [];
    const latFixed = formatFixed(lat, 6);
    const lngFixed = formatFixed(lng, 6);
    entries.push({
      id: 'wgs84-dec',
      labelKey: 'coordModal.wgs84Decimal',
      fallbackLabel: 'WGS84 (decimal degrees)',
      value: `${latFixed}°, ${lngFixed}°`,
      copy: `${latFixed}, ${lngFixed}`
    });
    const dmsValue = formatDmsCoordinate(lat, lng);
    entries.push({
      id: 'wgs84-dms',
      labelKey: 'coordModal.wgs84Dms',
      fallbackLabel: 'WGS84 (DMS)',
      value: dmsValue,
      copy: dmsValue
    });
    const utm = utmFromLatLng(lat, lng);
    if (utm) {
      const eastingVal = Math.round(utm.easting);
      const northingVal = Math.round(utm.northing);
      const utmString = `${utm.zoneNumber}${utm.zoneLetter} ${eastingVal} mE ${northingVal} mN`;
      entries.push({
        id: 'utm',
        labelKey: 'coordModal.utm',
        fallbackLabel: 'UTM',
        value: utmString,
        copy: utmString
      });
    }
    const mercator = webMercatorFromLatLng(lat, lng);
    if (mercator) {
      const mercatorValue = `${mercator.x.toFixed(2)} mE, ${mercator.y.toFixed(2)} mN`;
      entries.push({
        id: 'web-mercator',
        labelKey: 'coordModal.webMercator',
        fallbackLabel: 'Web Mercator (EPSG:3857)',
        value: mercatorValue,
        copy: `${mercator.x}, ${mercator.y}`
      });
    }
    return entries;
  };
  const renderCoordRowsInternal = (lng, lat) => {
    if (!coordList) return;
    coordList.textContent = '';
    const entries = buildCoordEntries(lng, lat);
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = t('coordModal.unavailable', 'Unable to compute coordinates for this location.');
      coordList.appendChild(empty);
      return;
    }
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'coord-row';
      const info = document.createElement('div');
      const labelEl = document.createElement('div');
      labelEl.className = 'coord-label';
      labelEl.textContent = t(entry.labelKey, entry.fallbackLabel);
      const valueEl = document.createElement('div');
      valueEl.className = 'coord-value';
      valueEl.textContent = entry.value;
      info.appendChild(labelEl);
      info.appendChild(valueEl);
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'coord-copy';
      const copyLabel = t('coordModal.copy', 'Copy');
      const entryLabel = labelEl.textContent || entry.fallbackLabel;
      copyBtn.title = copyLabel;
      copyBtn.setAttribute('aria-label', `${copyLabel} ${entryLabel}`.trim());
      const icon = document.createElement('img');
      icon.className = 'icon';
      icon.src = coordinateIconPath;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      copyBtn.appendChild(icon);
      const sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = `${copyLabel} ${entryLabel}`.trim();
      copyBtn.appendChild(sr);
      copyBtn.addEventListener('click', async () => {
        try {
          const text = entry.copy ?? entry.value;
          const ok = await writeToClipboard(text);
          if (!ok) throw new Error('clipboard unavailable');
          showToast(t('coordModal.copied', 'Copied!'));
        } catch (err) {
          console.error('Copy coordinate failed', err);
          showToast(t('messages.copyFailed', 'Copy failed'), 'error');
        }
      });
      row.appendChild(info);
      row.appendChild(copyBtn);
      coordList.appendChild(row);
    });
  };
  const refreshCoordContent = () => {
    if (!coordModal || coordModal.hidden) return;
    if (!crosshairState.lastPoint) return;
    renderCoordRowsInternal(crosshairState.lastPoint.lng, crosshairState.lastPoint.lat);
  };
  refreshCoordModalContent = refreshCoordContent;
  const openCoordModal = () => {
    if (!coordModal) return;
    if (!coordModal.hidden) { refreshCoordContent(); return; }
    crosshairState.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    coordModal.hidden = false;
    coordModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      try {
        const firstBtn = coordModal.querySelector('.coord-copy');
        if (firstBtn instanceof HTMLElement) firstBtn.focus();
      } catch {}
    }, 0);
  };
  const closeCoordModal = () => {
    if (!coordModal || coordModal.hidden) return;
    coordModal.hidden = true;
    coordModal.setAttribute('aria-hidden', 'true');
    const target = crosshairState.lastFocus;
    crosshairState.lastFocus = null;
    if (target && typeof target.focus === 'function') {
      setTimeout(() => {
        try { target.focus(); } catch {}
      }, 0);
    }
  };
  const showCoordinatesDialog = (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    crosshairState.lastPoint = { lng, lat };
    renderCoordRowsInternal(lng, lat);
    openCoordModal();
  };
  const openExternalMap = (service) => {
    if (!crosshairState.lastPoint) return;
    const url = buildMapUrl(service, crosshairState.lastPoint);
    if (!url) return;
    let handled = false;
    try {
      if (window.electronAPI?.openExternal) {
        const maybePromise = window.electronAPI.openExternal(url);
        handled = true;
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch((err) => console.error('openExternal failed', err));
        }
      }
    } catch (err) {
      console.error('openExternal threw', err);
    }
    if (!handled) {
      try {
        const win = window.open('', '_blank');
        if (!win) throw new Error('window.open returned null');
        win.opener = null;
        win.location.href = url;
      } catch (err) {
        console.error('window.open failed', err);
      }
    }
  };
  const setCrosshairMode = (active) => {
    crosshairState.active = !!active;
    if (mapCrosshair) {
      mapCrosshair.hidden = false;
      mapCrosshair.setAttribute('aria-hidden', String(false));
    }
    if (active) {
      crosshairState.lastPoint = null;
      if (coordList) coordList.textContent = '';
    }
    if (!active && coordModal && !coordModal.hidden) {
      closeCoordModal();
    }
    updateMapCursor();
  };

  coordClose?.addEventListener('click', () => closeCoordModal());
  coordModal?.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset?.action === 'close') {
      closeCoordModal();
    }
  });
  coordModal?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCoordModal();
      event.stopPropagation();
    }
  });
  coordOpenProvider?.addEventListener('click', () => {
    const value = coordProvider?.value || 'google-maps';
    openExternalMap(value);
  });


  bindStaticTranslations();
  defaultAppLanguage = normalizeAppLanguage(settingLanguage?.value || defaultAppLanguage);
  translationState.language = defaultAppLanguage;
  populateLanguageOptions(defaultAppLanguage);
  ensureTranslationsLoaded().then(() => applyTranslations()).catch(() => {});

  const toastIcons = {
    success: './assets/icons/regular/check-circle.svg',
    error: './assets/icons/regular/x-circle.svg',
  };
  if (languageToggle && languageMenu) {
    languageToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLanguageMenu(languageMenu.hidden);
    });
    languageMenu.querySelectorAll('.lang-menu-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = btn.dataset.lang;
        handleLanguageSelect(lang);
      });
    });
    document.addEventListener('click', (e) => {
      if (!languageDropdown || !languageMenu || languageMenu.hidden) return;
      const target = e.target;
      if (target instanceof Node && languageDropdown.contains(target)) return;
      toggleLanguageMenu(false);
    });
  }
  const toggleLanguageMenu = (show) => {
    if (!languageDropdown || !languageMenu || !languageToggle) return;
    const next = typeof show === 'boolean' ? show : languageMenu.hidden;
    languageMenu.hidden = !next;
    languageToggle.setAttribute('aria-expanded', String(next));
    languageDropdown.classList.toggle('is-open', next);
  };

  const handleLanguageSelect = (lang) => {
    const normalized = normalizeAppLanguage(lang);
    if (!normalized) return;
    if (settingLanguage) {
      settingLanguage.value = normalized;
      populateLanguageOptions(normalized);
    }
    try { localStorage.setItem('app.language', normalized); } catch {}
    applyLanguagePreference(normalized);
    toggleLanguageMenu(false);
  };
  const weatherIconPaths = {
    CLEAR_DAY: './assets/icons/regular/sun.svg',
    CLEAR_NIGHT: './assets/icons/regular/moon-stars.svg',
    MOSTLY_CLEAR_DAY: './assets/icons/regular/cloud-sun.svg',
    MOSTLY_CLEAR_NIGHT: './assets/icons/regular/cloud-moon.svg',
    PARTLY_CLOUDY_DAY: './assets/icons/regular/cloud-sun.svg',
    PARTLY_CLOUDY_NIGHT: './assets/icons/regular/cloud-moon.svg',
    OVERCAST: './assets/icons/regular/cloud.svg',
    FOG: './assets/icons/regular/cloud-fog.svg',
    LIGHT_RAIN: './assets/icons/regular/cloud-rain.svg',
    MODERATE_RAIN: './assets/icons/regular/cloud-rain.svg',
    HEAVY_RAIN: './assets/icons/regular/cloud-rain.svg',
    RAIN_SLEET: './assets/icons/regular/rainbow-cloud.svg',
    LIGHT_SLEET: './assets/icons/regular/rainbow-cloud.svg',
    HEAVY_SLEET: './assets/icons/regular/rainbow-cloud.svg',
    LIGHT_SNOW: './assets/icons/regular/cloud-snow.svg',
    MODERATE_SNOW: './assets/icons/regular/cloud-snow.svg',
    HEAVY_SNOW: './assets/icons/regular/cloud-snow.svg',
    THUNDERSTORM: './assets/icons/regular/cloud-lightning.svg',
    HAIL: './assets/icons/regular/cloud-warning.svg'
  };
  let weatherOverlayMarkers = [];
  let weatherManualMarkers = [];
  let weatherMoveHandler = null;
  let weatherMoveStartHandler = null;
  let weatherWindHandler = null;
  let weatherAbortController = null;
  let weatherRefreshTimer = null;
  let lastRainOverlayIntensity = 0;
  let lastRainOverlayDegrees = null;
  const WEATHER_REFRESH_DELAY_MS = 1000;
  let featuresLayersVisible = true;
  let featureLabelsVisible = true;
  let trackersLayersVisible = true;
  const FEATURE_LAYER_IDS = ['draw-fill', 'draw-fill-outline', 'draw-line', 'draw-line-arrows', 'draw-point-circle', 'draw-line-start-inner', 'draw-point-icon-bg', 'draw-point-icon', 'draw-point', 'draw-hl-fill', 'draw-hl-line', 'draw-hl-point'];
  const LABEL_LAYER_IDS = ['draw-labels-polygon', 'draw-labels-line-name', 'draw-labels-line-length', 'draw-labels-polygon-side-length'];
  const TRACKER_LAYER_IDS = ['tracker-paths', 'tracker-goto', 'tracker-goto-end', 'tracker-dots', 'tracker-icon-bg', 'tracker-icon', 'tracker-labels'];
  const FEATURE_LABEL_BG_IMAGE_ID = 'feature-label-bg';
  const POI_ICON_BG_IMAGE_ID = 'poi-icon-bg';
  const POI_ICON_SCALE = 1.2;
  const POI_ICON_BASE_SIZE = 0.072;
  const POI_ICON_SIZE = POI_ICON_BASE_SIZE * POI_ICON_SCALE;
  const POI_ICON_BG_SCALE = 1.2;
  const POI_ICON_BG_SIZE = POI_ICON_SIZE * POI_ICON_BG_SCALE;
  const POI_ICON_BG_CANVAS_SIZE = 512;
  const POI_ICON_BG_PIXEL_RATIO = 1;
  const POI_ICON_BG_BORDER_COLOR = '#8a8a8a';
  const POI_ICON_BG_BORDER_RATIO = 0.02;
  const FEATURE_LABEL_BG_BORDER_COLOR = '#8a8a8a';
  const FEATURE_LABEL_BG_BORDER_WIDTH = 1;
  const FEATURE_LABEL_BG_PIXEL_RATIO = 1;
  const LABEL_SCALE_STORAGE_KEY = 'map.labelScale';
  const LABEL_SCALE_MIN = 0.7;
  const LABEL_SCALE_MAX = 1.6;
  const LABEL_SCALE_STEP = 0.1;
  const BASE_FEATURE_LABEL_SIZE = 16;
  const BASE_TRACKER_LABEL_SIZE = 17;
  const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeLabelScale = (value) => {
    if (!Number.isFinite(value)) return 1;
    return clampNumber(value, LABEL_SCALE_MIN, LABEL_SCALE_MAX);
  };
  let labelScale = normalizeLabelScale(Number(localStorage.getItem(LABEL_SCALE_STORAGE_KEY)));
  const scaleLabelValue = (value) => Math.round(value * labelScale * 1000) / 1000;
  const applyMapLabelScale = (map = getMap()) => {
    if (!map) return;
    const textSize = scaleLabelValue(BASE_FEATURE_LABEL_SIZE);
    const trackerTextSize = scaleLabelValue(BASE_TRACKER_LABEL_SIZE);
    const poiIconSize = scaleLabelValue(POI_ICON_SIZE);
    const poiIconBgSize = scaleLabelValue(POI_ICON_BG_SIZE);
    const applyLayout = (layerId, prop, val) => {
      if (!map.getLayer(layerId)) return;
      try { map.setLayoutProperty(layerId, prop, val); } catch {}
    };
    applyLayout('draw-point', 'text-size', textSize);
    applyLayout('draw-labels-polygon', 'text-size', textSize);
    applyLayout('draw-labels-line-name', 'text-size', textSize);
    applyLayout('draw-labels-line-length', 'text-size', textSize);
    applyLayout('draw-labels-polygon-side-length', 'text-size', textSize);
    applyLayout('tracker-labels', 'text-size', trackerTextSize);
    applyLayout('draw-point-icon', 'icon-size', poiIconSize);
    applyLayout('draw-point-icon-bg', 'icon-size', poiIconBgSize);
    applyLayout('tracker-icon', 'icon-size', poiIconSize);
    applyLayout('tracker-icon-bg', 'icon-size', poiIconBgSize);
  };
  const updateLabelScaleButtons = () => {
    const atMin = labelScale <= LABEL_SCALE_MIN + 1e-6;
    const atMax = labelScale >= LABEL_SCALE_MAX - 1e-6;
    if (toolLabelDecrease) {
      toolLabelDecrease.disabled = atMin;
      toolLabelDecrease.classList.toggle('is-disabled', atMin);
      toolLabelDecrease.setAttribute('aria-disabled', String(atMin));
    }
    if (toolLabelIncrease) {
      toolLabelIncrease.disabled = atMax;
      toolLabelIncrease.classList.toggle('is-disabled', atMax);
      toolLabelIncrease.setAttribute('aria-disabled', String(atMax));
    }
  };
  const setLabelScale = (value) => {
    const next = normalizeLabelScale(value);
    if (next === labelScale) {
      updateLabelScaleButtons();
      return;
    }
    labelScale = next;
    try { localStorage.setItem(LABEL_SCALE_STORAGE_KEY, String(labelScale)); } catch {}
    applyMapLabelScale();
    updateLabelScaleButtons();
  };
  updateLabelScaleButtons();

  const ensureTriangleMarkerImage = (map) => {
    try {
      if (!map || typeof map.hasImage !== 'function' || map.hasImage('triangle-15')) return;
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(size / 2, size * 0.15);
      ctx.lineTo(size * 0.85, size * 0.85);
      ctx.lineTo(size * 0.15, size * 0.85);
      ctx.closePath();
      ctx.fill();
      const imageData = ctx.getImageData(0, 0, size, size);
      map.addImage('triangle-15', imageData, { pixelRatio: 2 });
    } catch (err) {
      console.warn('Failed adding fallback triangle image', err);
    }
  };

  const ensureFeatureLabelBackgroundImage = (map) => {
    try {
      if (!map || typeof map.hasImage !== 'function' || map.hasImage(FEATURE_LABEL_BG_IMAGE_ID)) return;
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(0, 0, size, size);
      const borderWidth = FEATURE_LABEL_BG_BORDER_WIDTH;
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(0.5, 0.5);
      ctx.strokeStyle = FEATURE_LABEL_BG_BORDER_COLOR;
      ctx.lineWidth = borderWidth;
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      ctx.strokeRect(0, 0, size - borderWidth, size - borderWidth);
      ctx.restore();
      const imageData = ctx.getImageData(0, 0, size, size);
      map.addImage(FEATURE_LABEL_BG_IMAGE_ID, imageData, { pixelRatio: FEATURE_LABEL_BG_PIXEL_RATIO });
    } catch (err) {
      console.warn('Failed adding feature label background image', err);
    }
  };

  const ensurePoiIconBackgroundImage = (map) => {
    try {
      if (!map || typeof map.hasImage !== 'function' || map.hasImage(POI_ICON_BG_IMAGE_ID)) return;
      const size = POI_ICON_BG_CANVAS_SIZE;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(0, 0, size, size);
      const borderWidth = Math.max(1, Math.round(size * POI_ICON_BG_BORDER_RATIO));
      const inset = borderWidth / 2;
      ctx.strokeStyle = POI_ICON_BG_BORDER_COLOR;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(inset, inset, size - borderWidth, size - borderWidth);
      const imageData = ctx.getImageData(0, 0, size, size);
      map.addImage(POI_ICON_BG_IMAGE_ID, imageData, { pixelRatio: POI_ICON_BG_PIXEL_RATIO });
    } catch (err) {
      console.warn('Failed adding POI icon background image', err);
    }
  };

  mapUtilityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const map = getMap();
      if (tool === 'satellite' || tool === 'terrain' || tool === 'street') {
        setActiveMapStyle(tool);
        applyCurrentMapStyle();
        updateMapCursor();
        return;
      }
      const next = !btn.classList.contains('is-active');
      btn.classList.toggle('is-active', next);
      btn.setAttribute('aria-pressed', String(next));
      switch (tool) {
        case 'cloud-sun':
          if (next) {
            const ok = enableWeatherOverlay();
            if (!ok) {
              setWeatherButtonState(false);
            } else {
              setWeatherButtonState(true);
            }
          } else {
            disableWeatherOverlay();
            setWeatherButtonState(false);
          }
          break;
        case 'features':
          featuresLayersVisible = next;
          applyFeaturesVisibility(map);
          if (next) {
            try { refreshDraw(); } catch (err) { console.error('refreshDraw failed after enabling features', err); }
          }
          break;
        case 'trackers':
          trackersLayersVisible = next;
          applyTrackersVisibility(map);
          if (next) {
            try {
              updateTrackerSource();
              updateTrackerPathSource();
            } catch (err) { console.error('updateTrackerSource failed after enabling trackers', err); }
          }
          break;
        default:
          break;
      }
      updateMapCursor();
    });
  });

  const showToast = (message, variant = 'success', duration = 1500) => {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    const type = variant === 'error' ? 'toast--error' : 'toast--success';
    toast.className = `toast ${type}`;
    const iconSrc = toastIcons[variant] || toastIcons.success;
    if (iconSrc) {
      const icon = document.createElement('img');
      icon.className = 'toast-icon';
      icon.src = iconSrc;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      icon.draggable = false;
      toast.appendChild(icon);
    }
    const textNode = document.createElement('span');
    textNode.textContent = message;
    toast.appendChild(textNode);
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 200);
    }, duration);
  };

  function resolveWeatherIcon(code) {
    if (!code) return weatherIconPaths.OVERCAST;
    return weatherIconPaths[code] || weatherIconPaths.OVERCAST;
  }

  function weatherDescription(code) {
    switch (code) {
      case 'CLEAR_DAY':
      case 'CLEAR_NIGHT':
        return 'Clear';
      case 'MOSTLY_CLEAR_DAY':
      case 'MOSTLY_CLEAR_NIGHT':
      case 'PARTLY_CLOUDY_DAY':
      case 'PARTLY_CLOUDY_NIGHT':
        return 'Partly cloudy';
      case 'OVERCAST':
        return 'Overcast';
      case 'FOG':
        return 'Fog';
      case 'LIGHT_RAIN':
      case 'MODERATE_RAIN':
      case 'HEAVY_RAIN':
        return 'Rain';
      case 'RAIN_SLEET':
      case 'LIGHT_SLEET':
      case 'HEAVY_SLEET':
        return 'Sleet';
      case 'LIGHT_SNOW':
      case 'MODERATE_SNOW':
      case 'HEAVY_SNOW':
        return 'Snow';
      case 'THUNDERSTORM':
        return 'Thunderstorm';
      case 'HAIL':
        return 'Hail';
      default:
        return 'Weather';
    }
  }

  const rainIntensityFromCode = (code) => {
    if (!code || typeof code !== 'string') return 0;
    const normalized = code.toUpperCase();
    switch (normalized) {
      case 'HEAVY_RAIN':
        return 1;
      case 'MODERATE_RAIN':
        return 0.75;
      case 'LIGHT_RAIN':
        return 0.55;
      case 'THUNDERSTORM':
        return 0.85;
      case 'RAIN_SLEET':
        return 0.65;
      default:
        return normalized.includes('RAIN') ? 0.6 : 0;
    }
  };

  const WIND_CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const WIND_CARDINAL_TO_DEGREES = new Map(WIND_CARDINALS.map((label, idx) => [label, idx * 22.5]));
  const normalizeWindDegrees = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const normalized = ((num % 360) + 360) % 360;
    return normalized;
  };
  const windDegreesToCardinal = (degrees) => {
    const normalized = normalizeWindDegrees(degrees);
    if (!Number.isFinite(normalized)) return '';
    const idx = Math.round(normalized / 22.5) % WIND_CARDINALS.length;
    return WIND_CARDINALS[idx];
  };
  const parseWindDirectionValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim().toUpperCase();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return numeric;
      if (WIND_CARDINAL_TO_DEGREES.has(trimmed)) return WIND_CARDINAL_TO_DEGREES.get(trimmed);
      return null;
    }
    if (typeof value === 'object') {
      const maybeDegrees = Number(value.degrees);
      if (Number.isFinite(maybeDegrees)) return maybeDegrees;
      const maybeValue = Number(value.value);
      if (Number.isFinite(maybeValue)) return maybeValue;
      if (typeof value.cardinal === 'string') return parseWindDirectionValue(value.cardinal);
      if (value.direction !== undefined) return parseWindDirectionValue(value.direction);
    }
    return null;
  };
  const parseWindSpeedCandidate = (value, unitHint) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return { value, unit: unitHint };
    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return { value: numeric, unit: unitHint };
      return null;
    }
    if (typeof value === 'object') {
      if (Number.isFinite(value.value)) return { value: value.value, unit: value.unit || value.units || unitHint };
      if (Number.isFinite(value.speed)) return { value: value.speed, unit: value.unit || value.units || unitHint };
      if (Number.isFinite(value.metersPerSecond)) return { value: value.metersPerSecond, unit: 'METERS_PER_SECOND' };
      if (Number.isFinite(value.mps)) return { value: value.mps, unit: 'METERS_PER_SECOND' };
      if (Number.isFinite(value.kph)) return { value: value.kph, unit: 'KILOMETERS_PER_HOUR' };
      if (Number.isFinite(value.kmh)) return { value: value.kmh, unit: 'KILOMETERS_PER_HOUR' };
      if (Number.isFinite(value.mph)) return { value: value.mph, unit: 'MILES_PER_HOUR' };
      if (Number.isFinite(value.knots)) return { value: value.knots, unit: 'KNOTS' };
    }
    return null;
  };
  const normalizeWindSpeed = (speedInfo) => {
    if (!speedInfo || !Number.isFinite(speedInfo.value)) return null;
    const unitRaw = speedInfo.unit ? String(speedInfo.unit).toUpperCase() : '';
    let value = Number(speedInfo.value);
    let unitLabel = 'km/h';
    if (unitRaw) {
      if (['KILOMETERS_PER_HOUR', 'KILOMETER_PER_HOUR', 'KPH', 'KM/H', 'KMH'].includes(unitRaw)) {
        unitLabel = 'km/h';
      } else if (['METERS_PER_SECOND', 'METER_PER_SECOND', 'M/S', 'MPS'].includes(unitRaw)) {
        value = value * 3.6;
        unitLabel = 'km/h';
      } else if (['MILES_PER_HOUR', 'MILE_PER_HOUR', 'MPH'].includes(unitRaw)) {
        value = value * 1.609344;
        unitLabel = 'km/h';
      } else if (['KNOT', 'KNOTS', 'KT', 'KTS'].includes(unitRaw)) {
        value = value * 1.852;
        unitLabel = 'km/h';
      } else {
        unitLabel = unitRaw.toLowerCase();
      }
    }
    if (!Number.isFinite(value)) return null;
    return { value, unitLabel };
  };
  const readWindDirectionDegrees = (conditions) => {
    if (!conditions || typeof conditions !== 'object') return null;
    const candidates = [
      conditions.wind?.direction,
      conditions.windDirection,
      conditions.wind?.directionDegrees,
      conditions.wind?.direction?.degrees,
      conditions.wind?.direction?.value,
      conditions.windDirectionDegrees,
      conditions.wind?.bearing,
      conditions.wind?.degrees
    ];
    for (const candidate of candidates) {
      const parsed = parseWindDirectionValue(candidate);
      if (Number.isFinite(parsed)) return normalizeWindDegrees(parsed);
    }
    return null;
  };
  const readWindSpeed = (conditions) => {
    if (!conditions || typeof conditions !== 'object') return null;
    const candidates = [
      { value: conditions.wind?.speed, unit: conditions.wind?.speedUnit },
      { value: conditions.windSpeed, unit: conditions.windSpeedUnit },
      { value: conditions.wind?.speed?.value, unit: conditions.wind?.speed?.unit },
      { value: conditions.wind?.speed?.value, unit: conditions.wind?.speed?.units },
      { value: conditions.wind?.speed, unit: conditions.wind?.unit },
      { value: conditions.wind?.speed, unit: conditions.wind?.units }
    ];
    for (const candidate of candidates) {
      const parsed = parseWindSpeedCandidate(candidate.value, candidate.unit);
      const normalized = normalizeWindSpeed(parsed);
      if (normalized) return normalized;
    }
    return null;
  };
  const averageWindDirectionDegrees = (values) => {
    const filtered = values.filter((value) => Number.isFinite(value));
    if (!filtered.length) return null;
    let sumSin = 0;
    let sumCos = 0;
    filtered.forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);
    });
    if (!Number.isFinite(sumSin) || !Number.isFinite(sumCos)) return null;
    if (sumSin === 0 && sumCos === 0) return null;
    const angle = Math.atan2(sumSin, sumCos) * (180 / Math.PI);
    return normalizeWindDegrees(angle);
  };
  const averageWindSpeedValue = (values) => {
    const filtered = values.filter((value) => Number.isFinite(value));
    if (!filtered.length) return null;
    const total = filtered.reduce((sum, val) => sum + val, 0);
    const average = total / filtered.length;
    return Number.isFinite(average) ? average : null;
  };
  const isWeatherOverlayEnabled = () => {
    if (!weatherOverlayActive) return false;
    if (!weatherUtilityBtn) return true;
    return weatherUtilityBtn.classList.contains('is-active');
  };
  const renderRainOverlay = () => {
    if (!mapRainOverlay) return;
    // Rain animation disabled when weather overlay is enabled.
    mapRainOverlay.hidden = true;
    mapRainOverlay.setAttribute('aria-hidden', 'true');
    mapRainOverlay.classList.remove('is-active');
  };
  const renderWindIndicator = () => {
    if (!mapWindIndicator && !mapWindOverlay) return;
    const hasDirection = Number.isFinite(lastWindIndicatorDegrees);
    const hasSpeed = Number.isFinite(lastWindIndicatorSpeed);
    const isVisible = isWeatherOverlayEnabled() && (hasDirection || hasSpeed);
    if (mapWindIndicator) {
      mapWindIndicator.hidden = !isVisible;
      mapWindIndicator.setAttribute('aria-hidden', String(!isVisible));
    }
    if (mapWindOverlay) {
      // Wind animation disabled when weather overlay is enabled.
      mapWindOverlay.hidden = true;
      mapWindOverlay.setAttribute('aria-hidden', 'true');
      mapWindOverlay.classList.remove('is-active');
    }
    if (!isVisible) return;
    if (mapWindIndicator) {
      mapWindIndicator.classList.toggle('no-direction', !hasDirection);
    }
    const windLabel = t('map.weather.wind', 'Wind');
    const windDirectionLabel = t('map.weather.windDirection', 'Wind direction');
    const windSpeedLabel = t('map.weather.windSpeed', 'Wind speed');
    const degrees = normalizeWindDegrees(lastWindIndicatorDegrees);
    const rounded = Number.isFinite(degrees) ? Math.round(degrees) : null;
    const cardinal = Number.isFinite(degrees) ? windDegreesToCardinal(degrees) : '';
    const directionSuffix = cardinal || (Number.isFinite(rounded) ? `${rounded}°` : '');
    const speedValue = Number.isFinite(lastWindIndicatorSpeed) ? Math.round(lastWindIndicatorSpeed) : null;
    const speedSuffix = Number.isFinite(speedValue) ? `${speedValue} ${lastWindIndicatorSpeedUnit || 'km/h'}` : '';
    const parts = [directionSuffix, speedSuffix].filter(Boolean);
    const displaySuffix = parts.length ? ` ${parts.join(' · ')}` : '';
    if (mapWindIndicatorLabel) {
      mapWindIndicatorLabel.textContent = `${windLabel}${displaySuffix}`;
    }
    if (hasDirection) {
      const map = getMap();
      const bearing = map && typeof map.getBearing === 'function' ? Number(map.getBearing()) : 0;
      const rotation = normalizeWindDegrees((degrees ?? 0) - (Number.isFinite(bearing) ? bearing : 0));
      if (mapWindIndicator) {
        mapWindIndicator.style.setProperty('--wind-rotation', `${rotation}deg`);
      }
      if (mapWindOverlay) {
        mapWindOverlay.style.setProperty('--wind-rotation', `${rotation}deg`);
      }
      const speedFactor = Number.isFinite(lastWindIndicatorSpeed)
        ? Math.max(0.6, Math.min(3.2, lastWindIndicatorSpeed / 14))
        : 1;
      const opacity = Number.isFinite(lastWindIndicatorSpeed)
        ? Math.max(0.2, Math.min(0.42, 0.22 + lastWindIndicatorSpeed / 120))
        : 0.26;
      if (mapWindOverlay) {
        mapWindOverlay.style.setProperty('--wind-speed-factor', speedFactor.toFixed(2));
        mapWindOverlay.style.setProperty('--wind-opacity', opacity.toFixed(3));
      }
    }
    const ariaDirection = hasDirection
      ? `${windDirectionLabel}: ${cardinal ? `${cardinal}, ${rounded}°` : `${rounded}°`}`
      : '';
    const ariaSpeed = hasSpeed ? `${windSpeedLabel}: ${speedSuffix}` : '';
    const ariaParts = [ariaDirection, ariaSpeed].filter(Boolean);
    if (ariaParts.length) {
      mapWindIndicator.setAttribute('aria-label', ariaParts.join('. '));
      mapWindIndicator.title = ariaParts.join('. ');
    }
    renderRainOverlay();
  };
  const setWindIndicatorData = ({ degrees, speedValue, speedUnitLabel } = {}) => {
    lastWindIndicatorDegrees = Number.isFinite(degrees) ? normalizeWindDegrees(degrees) : null;
    lastWindIndicatorSpeed = Number.isFinite(speedValue) ? speedValue : null;
    if (speedUnitLabel) lastWindIndicatorSpeedUnit = speedUnitLabel;
    renderWindIndicator();
  };
  const clearWindIndicator = () => setWindIndicatorData({ degrees: null, speedValue: null });
  refreshWindIndicatorContent = () => renderWindIndicator();

  const removeMarkersFromList = (list) => {
    list.forEach((marker) => {
      try { marker.remove(); } catch {}
    });
    return [];
  };

  function clearWeatherOverlayMarkers() {
    weatherOverlayMarkers = removeMarkersFromList(weatherOverlayMarkers);
  }

  function clearManualWeatherMarkers() {
    weatherManualMarkers = removeMarkersFromList(weatherManualMarkers);
  }

  function removeAllWeatherMarkers() {
    clearWeatherOverlayMarkers();
    clearManualWeatherMarkers();
  }

  function attachWeatherMarkerInteractions(marker, listRef) {
    try {
      const el = marker.getElement();
      if (!el) return;
      el.style.pointerEvents = 'auto';
      el.addEventListener('click', (ev) => {
        if ((window)._currentTool !== 'weather') return;
        ev.stopPropagation();
        try { marker.remove(); } catch {}
        const idx = listRef.indexOf(marker);
        if (idx >= 0) listRef.splice(idx, 1);
      });
    } catch (err) {
      console.error('Failed binding weather marker interaction', err);
    }
  }

  function createWeatherMarker(map, entry) {
    const el = document.createElement('div');
    el.className = 'weather-marker';
    el.style.pointerEvents = 'auto';
    el.style.opacity = '0.6';
    const icon = document.createElement('img');
    icon.className = 'weather-marker__icon';
    icon.alt = '';
    const iconSrc = entry.iconUri ? `${entry.iconUri}.png` : resolveWeatherIcon(entry.code);
    icon.src = iconSrc;
    const temp = document.createElement('div');
    temp.className = 'weather-marker__temp';
    temp.textContent = `${Math.round(entry.temperature)}°C`;
    el.appendChild(icon);
    el.appendChild(temp);
    const label = entry.description || weatherDescription(entry.code);
    el.title = `${label} · ${Math.round(entry.temperature)}°C`;
    try {
      el.dataset.weatherIcon = iconSrc || '';
      el.dataset.weatherTemp = temp.textContent || '';
      el.dataset.weatherLabel = label || '';
    } catch {}
    return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([entry.lng, entry.lat]).addTo(map);
  }

  function renderWeatherOverlayMarkers(map, entries) {
    clearWeatherOverlayMarkers();
    if (typeof mapboxgl === 'undefined') {
      console.warn('mapboxgl not available for weather overlay');
      return;
    }
    entries.forEach((entry) => {
      try {
        const marker = createWeatherMarker(map, entry);
        attachWeatherMarkerInteractions(marker, weatherOverlayMarkers);
        weatherOverlayMarkers.push(marker);
      } catch (err) {
        console.error('Weather marker failed', err);
      }
    });
  }

  const weatherMarkerImageCache = new Map();
  const loadWeatherMarkerImage = (src) => {
    if (!src) return Promise.resolve(null);
    if (weatherMarkerImageCache.has(src)) return weatherMarkerImageCache.get(src);
    const promise = new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      } catch (err) {
        console.warn('Failed to prepare weather icon for snapshot', err);
        resolve(null);
      }
    });
    weatherMarkerImageCache.set(src, promise);
    return promise;
  };

  const collectWeatherMarkerSnapshotEntries = (map) => {
    if (!map) return [];
    const lists = [weatherOverlayMarkers, weatherManualMarkers];
    const collected = [];
    lists.forEach((list) => {
      list.forEach((marker) => {
        try {
          if (!marker || typeof marker.getLngLat !== 'function' || typeof map.project !== 'function') return;
          const lngLat = marker.getLngLat();
          if (!lngLat) return;
          const projected = map.project(lngLat);
          if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return;
          const element = marker.getElement?.();
          const dataset = element?.dataset || {};
          const iconSrc = dataset.weatherIcon || element?.querySelector?.('.weather-marker__icon')?.src || '';
          const tempLabel = dataset.weatherTemp || element?.querySelector?.('.weather-marker__temp')?.textContent?.trim() || '';
          const description = dataset.weatherLabel || element?.getAttribute?.('title') || '';
          if (!iconSrc && !tempLabel) return;
          collected.push({
            point: projected,
            iconSrc,
            tempLabel,
            description
          });
        } catch (err) {
          console.warn('collectWeatherMarkerSnapshotEntries failed', err);
        }
      });
    });
    return collected;
  };

  const WEATHER_MARKER_FONT = '"Inter", "Segoe UI", "Helvetica Neue", sans-serif';

  const drawRoundedRectPath = (ctx, x, y, width, height, radius) => {
    if (!ctx) return;
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const drawWeatherMarkerBubble = (ctx, entry, metrics) => {
    if (!ctx || !entry || !metrics) return;
    const { ratioX, ratioY, scale, canvasWidth, canvasHeight } = metrics;
    const pxRatioX = Number.isFinite(ratioX) && ratioX > 0 ? ratioX : 1;
    const pxRatioY = Number.isFinite(ratioY) && ratioY > 0 ? ratioY : pxRatioX;
    const pxScale = Number.isFinite(scale) && scale > 0 ? scale : Math.max(pxRatioX, pxRatioY, 1);
    const pt = entry.point || {};
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
    const deviceX = pt.x * pxRatioX;
    const deviceY = pt.y * pxRatioY;
    const boundary = Math.max(48 * pxScale, 24);
    if (deviceX < -boundary || deviceY < -boundary || deviceX > canvasWidth + boundary || deviceY > canvasHeight + boundary) return;

    const label = entry.tempLabel || '';
    const hasLabel = !!label;
    const hasIcon = !!entry.image;
    const fontSize = Math.max(12 * pxScale, 9);
    const paddingX = Math.max(8 * pxScale, 5);
    const paddingY = Math.max(5 * pxScale, 3);
    const iconSize = hasIcon ? Math.max(18 * pxScale, 12) : 0;
    const gap = hasIcon && hasLabel ? Math.max(6 * pxScale, 3) : 0;

    ctx.save();
    ctx.font = `600 ${fontSize}px ${WEATHER_MARKER_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const textWidth = hasLabel ? ctx.measureText(label).width : 0;
    const innerWidth = (hasIcon ? iconSize : 0) + (hasIcon && hasLabel ? gap : 0) + textWidth;
    const width = Math.max(innerWidth + paddingX * 2, hasIcon ? iconSize + paddingX * 2 : 0);
    const height = Math.max(Math.max(iconSize, hasLabel ? fontSize : 0) + paddingY * 2, iconSize + paddingY * 2);
    const left = deviceX - width / 2;
    const top = deviceY - height / 2;
    const cornerRadius = Math.min(height / 2, Math.max(12 * pxScale, 8));

    ctx.shadowColor = 'rgba(8, 15, 26, 0.5)';
    ctx.shadowBlur = 12 * pxScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6 * pxScale;
    ctx.fillStyle = 'rgba(8, 12, 18, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = Math.max(1, pxScale);
    drawRoundedRectPath(ctx, left, top, width, height, cornerRadius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();

    let cursorX = left + paddingX;
    if (hasIcon && entry.image) {
      const iconY = top + (height - iconSize) / 2;
      try {
        ctx.drawImage(entry.image, cursorX, iconY, iconSize, iconSize);
      } catch {}
      cursorX += iconSize + (hasLabel ? gap : 0);
    }
    if (hasLabel) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, cursorX, top + height / 2);
    }
    ctx.restore();
  };

  const drawWeatherMarkersForSnapshot = async ({ ctx, canvas, rect, map }) => {
    if (!ctx || !canvas || !map) return;
    const entries = collectWeatherMarkerSnapshotEntries(map);
    if (!entries.length) return;
    const fallbackRatio = (typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio))
      ? window.devicePixelRatio
      : 1;
    const ratioX = rect && rect.width ? canvas.width / rect.width : fallbackRatio;
    const ratioY = rect && rect.height ? canvas.height / rect.height : fallbackRatio;
    const pxScale = Math.max((ratioX + ratioY) / 2, 1);
    const resolvedEntries = await Promise.all(entries.map(async (entry) => ({
      ...entry,
      image: entry.iconSrc ? await loadWeatherMarkerImage(entry.iconSrc) : null
    })));
    resolvedEntries.forEach((entry) => {
      try {
        drawWeatherMarkerBubble(ctx, entry, {
          ratioX,
          ratioY,
          scale: pxScale,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        });
      } catch (err) {
        console.warn('Failed to draw weather marker snapshot', err);
      }
    });
  };

  let buildFeatureLabelFeatures = () => [];
  let updateFeatureLabels = () => {};

  const POLYGON_SIDE_LABEL_MIN_ZOOM = 17;
  function applyLabelVisibility(mapParam) {
    const map = mapParam || getMap();
    if (!map) return;
    const visibility = (featuresLayersVisible && featureLabelsVisible) ? 'visible' : 'none';
    const zoom = Number(map.getZoom?.());
    const polygonSideVisible = Number.isFinite(zoom) ? zoom > POLYGON_SIDE_LABEL_MIN_ZOOM : true;
    LABEL_LAYER_IDS.forEach((layerId) => {
      try {
        if (!map.getLayer(layerId)) return;
        let nextVisibility = visibility;
        if (nextVisibility === 'visible' && layerId === 'draw-labels-polygon-side-length' && !polygonSideVisible) {
          nextVisibility = 'none';
        }
        map.setLayoutProperty(layerId, 'visibility', nextVisibility);
      } catch (err) {
        console.warn('applyLabelVisibility failed', layerId, err);
      }
    });
  }

  const setFeatureLabelsToggleState = (active) => {
    featureLabelsVisible = !!active;
    if (featuresLabelsToggle) {
      featuresLabelsToggle.classList.toggle('is-active', featureLabelsVisible);
      featuresLabelsToggle.setAttribute('aria-pressed', String(featureLabelsVisible));
    }
    if (featureLabelsVisible) updateFeatureLabels();
    applyLabelVisibility();
  };

  function applyFeaturesVisibility(mapParam) {
    const map = mapParam || getMap();
    if (!map) return;
    const visibility = featuresLayersVisible ? 'visible' : 'none';
    FEATURE_LAYER_IDS.forEach((layerId) => {
      try {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
      } catch (err) {
        console.warn('applyFeaturesVisibility failed', layerId, err);
      }
    });
    applyLabelVisibility(map);
  }

  function applyTrackersVisibility(mapParam) {
    const map = mapParam || getMap();
    if (!map) return;
    const visibility = trackersLayersVisible ? 'visible' : 'none';
    TRACKER_LAYER_IDS.forEach((layerId) => {
      try {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
      } catch (err) {
        console.warn('applyTrackersVisibility failed', layerId, err);
      }
    });
  }

  const ensureFeaturesVisible = () => {
    featuresLayersVisible = true;
    const map = getMap();
    applyFeaturesVisibility(map);
    mapUtilityButtons.forEach((btn) => {
      if (btn.dataset.tool === 'features') {
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  };

  async function fetchGoogleWeather(point, apiKey, signal) {
    const params = new URLSearchParams({
      key: apiKey,
      'location.latitude': point.lat.toFixed(4),
      'location.longitude': point.lng.toFixed(4)
    });
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?${params.toString()}`;
    const resp = await fetch(url, {
      method: 'GET',
      signal
    });
    if (!resp.ok) {
      throw new Error(`Google weather ${resp.status}`);
    }
    const data = await resp.json();
    const conditions = data?.currentConditions || data || null;
    if (!conditions) throw new Error('No current conditions');
    let temperature = null;
    let unitLabel = 'CELSIUS';
    const tempField = conditions.temperature;
    if (tempField !== undefined && tempField !== null) {
      if (typeof tempField === 'number') {
        temperature = tempField;
      } else if (typeof tempField === 'object') {
        if (tempField.degrees !== undefined) temperature = tempField.degrees;
        else if (tempField.value !== undefined) temperature = tempField.value;
        if (tempField.unit) unitLabel = String(tempField.unit).toUpperCase();
      }
    }
    if (!Number.isFinite(Number(temperature))) throw new Error('Invalid temperature');
    if (unitLabel === 'FAHRENHEIT') {
      temperature = (Number(temperature) - 32) * (5 / 9);
    } else if (unitLabel === 'KELVIN' || unitLabel === 'KELVINS') {
      temperature = Number(temperature) - 273.15;
    }
    const codeRaw = conditions.weatherCondition?.type || conditions.conditionCode;
    const code = typeof codeRaw === 'string' ? codeRaw.toUpperCase() : '';
    const description = conditions.weatherCondition?.description?.text || weatherDescription(code);
    const iconUri = conditions.weatherCondition?.iconBaseUri || null;
    const windDegrees = readWindDirectionDegrees(conditions);
    const windSpeed = readWindSpeed(conditions);
    return { ...point, temperature: Number(temperature), code, description, iconUri, windDegrees, windSpeed };
  }

  function computeWeatherSamplePoints(map) {
    if (!map) return [];
    const clampLat = (lat) => Math.max(-85, Math.min(85, lat));
    const wrapLng = (lng) => {
      if (lng > 180) return lng - 360;
      if (lng < -180) return lng + 360;
      return lng;
    };
    const projectPoint = (point) => {
      if (!point || typeof map.unproject !== 'function') return null;
      try {
        const lngLat = map.unproject(point);
        if (!lngLat || !Number.isFinite(lngLat.lng) || !Number.isFinite(lngLat.lat)) return null;
        return { lng: wrapLng(lngLat.lng), lat: clampLat(lngLat.lat) };
      } catch {
        return null;
      }
    };

    const canvas = map.getCanvas?.();
    const width = Number(canvas?.clientWidth || canvas?.width || 0);
    const height = Number(canvas?.clientHeight || canvas?.height || 0);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      const insetX = Math.max(18, width * 0.15);
      const insetY = Math.max(18, height * 0.15);
      const corners = [
        { x: insetX, y: insetY },
        { x: width - insetX, y: insetY },
        { x: width - insetX, y: height - insetY },
        { x: insetX, y: height - insetY }
      ];
      const points = corners.map(projectPoint).filter(Boolean);
      if (points.length) return points;
    }

    const bounds = map.getBounds?.();
    if (!bounds) return [];
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    let east = bounds.getEast();
    let west = bounds.getWest();
    if (east < west) east += 360;
    return [
      { lng: wrapLng(west), lat: clampLat(north) },
      { lng: wrapLng(east), lat: clampLat(north) },
      { lng: wrapLng(east), lat: clampLat(south) },
      { lng: wrapLng(west), lat: clampLat(south) }
    ];
  }

  async function refreshWeatherOverlay() {
    if (!weatherOverlayActive) return;
    const map = getMap();
    if (!map) return;
    const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
    if (!key) {
      showToast(t('status.weatherNeedsKey', 'Weather needs Google Maps API key'), 'error');
      disableWeatherOverlay();
      return;
    }
    if (weatherAbortController) {
      try { weatherAbortController.abort(); } catch {}
      weatherAbortController = null;
    }
    const controller = new AbortController();
    weatherAbortController = controller;
    clearWeatherOverlayMarkers();
    const points = computeWeatherSamplePoints(map);
    if (!points.length) {
      if (weatherAbortController === controller) weatherAbortController = null;
      return;
    }
    try {
      const results = await Promise.allSettled(points.map((point) => fetchGoogleWeather(point, key, controller.signal)));
      if (controller.signal.aborted || !weatherOverlayActive) return;
      const entries = results
        .filter((res) => res.status === 'fulfilled' && res.value)
        .map((res) => res.value);
      if (!entries.length) {
        lastRainOverlayIntensity = 0;
        lastRainOverlayDegrees = null;
        renderRainOverlay();
        showToast(t('status.weatherOverlayFailed', 'Weather overlay refresh failed'), 'error');
        return;
      }
      renderWeatherOverlayMarkers(map, entries);
      const windDegrees = averageWindDirectionDegrees(entries.map((entry) => entry.windDegrees));
      const speedValues = entries
        .map((entry) => entry.windSpeed)
        .filter((speed) => speed && Number.isFinite(speed.value))
        .map((speed) => speed.value);
      const windSpeedValue = averageWindSpeedValue(speedValues);
      const speedUnitLabel = entries.find((entry) => entry.windSpeed?.unitLabel)?.windSpeed?.unitLabel;
      const rainIntensity = entries.reduce((max, entry) => Math.max(max, rainIntensityFromCode(entry.code)), 0);
      lastRainOverlayIntensity = rainIntensity;
      lastRainOverlayDegrees = windDegrees;
      setWindIndicatorData({ degrees: windDegrees, speedValue: windSpeedValue, speedUnitLabel });
      renderRainOverlay();
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Weather overlay refresh failed', err);
      showToast(t('status.weatherOverlayFailed', 'Weather overlay refresh failed'), 'error');
    } finally {
      if (weatherAbortController === controller) {
        weatherAbortController = null;
      }
    }
  }

  function scheduleWeatherRefresh() {
    if (!weatherOverlayActive) return;
    if (weatherRefreshTimer) clearTimeout(weatherRefreshTimer);
    weatherRefreshTimer = setTimeout(() => {
      weatherRefreshTimer = null;
      refreshWeatherOverlay();
    }, WEATHER_REFRESH_DELAY_MS);
  }

  function enableWeatherOverlay() {
    if (!googleServicesEnabled) {
      showToast(t('status.weatherNeedsAccess', 'Weather needs Google Maps API access'), 'error');
      setWeatherButtonState(false);
      return false;
    }
    const map = getMap();
    if (!map) {
      showToast(t('status.mapNotReady', 'Map not ready'), 'error');
      setWeatherButtonState(false);
      return false;
    }
    const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
    if (!key) {
      showToast(t('status.weatherNeedsKey', 'Weather needs Google Maps API key'), 'error');
      setWeatherButtonState(false);
      return false;
    }
    weatherOverlayActive = true;
    clearWeatherOverlayMarkers();
    clearWindIndicator();
    lastRainOverlayIntensity = 0;
    lastRainOverlayDegrees = null;
    renderRainOverlay();
    setWeatherButtonState(true);
    refreshWeatherOverlay();
    if (!weatherMoveStartHandler) {
      weatherMoveStartHandler = () => {
        if (!weatherOverlayActive) return;
        if (weatherAbortController) {
          try { weatherAbortController.abort(); } catch {}
          weatherAbortController = null;
        }
        clearWeatherOverlayMarkers();
      };
      map.on('movestart', weatherMoveStartHandler);
    }
    if (!weatherWindHandler) {
      weatherWindHandler = () => {
        if (!weatherOverlayActive) return;
        renderWindIndicator();
      };
      map.on('move', weatherWindHandler);
    }
    if (!weatherMoveHandler) {
      weatherMoveHandler = () => refreshWeatherOverlay();
      map.on('moveend', weatherMoveHandler);
    }
    updateMapCursor();
    return true;
  }

  function disableWeatherOverlay() {
    const map = getMap();
    weatherOverlayActive = false;
    if (weatherRefreshTimer) {
      clearTimeout(weatherRefreshTimer);
      weatherRefreshTimer = null;
    }
    if (weatherAbortController) {
      try { weatherAbortController.abort(); } catch {}
      weatherAbortController = null;
    }
    if (weatherMoveStartHandler && map) {
      try { map.off('movestart', weatherMoveStartHandler); } catch {}
      weatherMoveStartHandler = null;
    }
    if (weatherWindHandler && map) {
      try { map.off('move', weatherWindHandler); } catch {}
      weatherWindHandler = null;
    }
    if (weatherMoveHandler && map) {
      try { map.off('moveend', weatherMoveHandler); } catch {}
      weatherMoveHandler = null;
    }
    removeAllWeatherMarkers();
    clearWindIndicator();
    lastRainOverlayIntensity = 0;
    lastRainOverlayDegrees = null;
    renderRainOverlay();
    setWeatherButtonState(false);
    updateMapCursor();
  }

  const ensureWeatherOverlayEnabled = () => {
    if (weatherOverlayActive) {
      setWeatherButtonState(true);
      return true;
    }
    const ok = enableWeatherOverlay();
    if (!ok) {
      setWeatherButtonState(false);
      return false;
    }
    setWeatherButtonState(true);
    return true;
  };

  function addManualWeatherMarker(map, entry) {
    try {
      const marker = createWeatherMarker(map, entry);
      attachWeatherMarkerInteractions(marker, weatherManualMarkers);
      weatherManualMarkers.push(marker);
    } catch (err) {
      console.error('Weather marker failed', err);
    }
  }

  async function sampleWeatherAtPoint(lngLat) {
    const map = getMap();
    if (!map) {
      showToast(t('status.mapNotReady', 'Map not ready'), 'error');
      return;
    }
    if (!lngLat || !Number.isFinite(lngLat.lng) || !Number.isFinite(lngLat.lat)) return;
    const overlayReady = ensureWeatherOverlayEnabled();
    if (!overlayReady) return;
    const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
    if (!key) {
      showToast(t('status.weatherNeedsKey', 'Weather needs Google Maps API key'), 'error');
      return;
    }
    const controller = new AbortController();
    try {
      const entry = await fetchGoogleWeather({ lng: lngLat.lng, lat: lngLat.lat }, key, controller.signal);
      if (!entry) return;
      addManualWeatherMarker(map, entry);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Weather fetch failed', err);
      showToast(t('status.weatherFetchFailed', 'Weather fetch failed'), 'error');
    }
  }

  const GRID_OVERLAY_STORAGE_KEY = 'map.gridOverlay';
  const GRID_OVERLAY_LINE_SOURCE_ID = 'grid-overlay-lines-src';
  const GRID_OVERLAY_LABEL_SOURCE_ID = 'grid-overlay-labels-src';
  const GRID_OVERLAY_MINOR_LINE_LAYER_ID = 'grid-overlay-lines-minor';
  const GRID_OVERLAY_LINE_LAYER_ID = 'grid-overlay-lines';
  const GRID_OVERLAY_LABEL_LAYER_ID = 'grid-overlay-labels';
  const GRID_OVERLAY_REFRESH_DELAY_MS = 140;
  const GRID_OVERLAY_OPTIONS = new Set(['none', 'utm', 'gcs']);
  const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };
  const normalizeGridOverlayType = (value) => {
    const key = String(value ?? '').toLowerCase();
    return GRID_OVERLAY_OPTIONS.has(key) ? key : 'none';
  };
  let activeGridOverlay = 'none';
  try {
    activeGridOverlay = normalizeGridOverlayType(localStorage.getItem(GRID_OVERLAY_STORAGE_KEY));
  } catch {}
  if (overlaySelect) overlaySelect.value = activeGridOverlay;
  let gridOverlayUpdateTimer = null;
  let gridOverlayMoveHandler = null;
  let gridPointerLabelEl = null;
  let gridPointerMoveHandler = null;
  let gridPointerLeaveHandler = null;
  let gridOverlayStyleRefreshToken = 0;

  const ensureGridPointerLabel = () => {
    if (gridPointerLabelEl) return gridPointerLabelEl;
    if (!mapContainer) return null;
    const el = document.createElement('div');
    el.className = 'grid-pointer-label';
    el.setAttribute('aria-hidden', 'true');
    el.hidden = true;
    mapContainer.appendChild(el);
    gridPointerLabelEl = el;
    return el;
  };

  const hideGridPointerLabel = () => {
    if (!gridPointerLabelEl) return;
    gridPointerLabelEl.hidden = true;
    gridPointerLabelEl.style.transform = 'translate(-9999px, -9999px)';
  };

  const GRID_TARGET_PIXEL_SPACING = 130;
  const GRID_MAX_LINES = 80;
  const GCS_GRID_STEPS = [60, 30, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
  const UTM_GRID_STEPS = [1000000, 500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
  const chooseGridStep = (targetStep, span, candidates) => {
    if (!Number.isFinite(targetStep) || targetStep <= 0) return candidates[candidates.length - 1];
    let best = candidates[candidates.length - 1];
    let bestScore = Infinity;
    candidates.forEach((step) => {
      const lines = Number.isFinite(span) && span > 0 ? span / step : null;
      const tooFewPenalty = (lines !== null && lines < 2) ? (2 - lines) * 3 : 0;
      const tooManyPenalty = (lines !== null && lines > GRID_MAX_LINES) ? (lines - GRID_MAX_LINES) * 0.08 : 0;
      const score = Math.abs(Math.log(step / targetStep)) + tooFewPenalty + tooManyPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = step;
      }
    });
    return best;
  };
  const getGcsGridStep = ({ span, degreesPerPixel }) => {
    const targetStep = Number.isFinite(degreesPerPixel) ? degreesPerPixel * GRID_TARGET_PIXEL_SPACING : null;
    return chooseGridStep(targetStep, span, GCS_GRID_STEPS);
  };
  const getGcsMinorGridStep = ({ span, degreesPerPixel, majorStep }) => {
    const targetStep = Number.isFinite(degreesPerPixel) ? (degreesPerPixel * GRID_TARGET_PIXEL_SPACING) / 5 : null;
    const candidate = chooseGridStep(targetStep, span, GCS_GRID_STEPS);
    if (!Number.isFinite(candidate) || !Number.isFinite(majorStep)) return null;
    return candidate < majorStep ? candidate : null;
  };
  const getGcsLabelPrecision = (step) => {
    if (step >= 1) return 0;
    if (step >= 0.5) return 1;
    if (step >= 0.25) return 2;
    if (step >= 0.1) return 1;
    if (step >= 0.05) return 2;
    return 3;
  };
  const formatDegreeLabel = (value, precision, isLat) => {
    if (!Number.isFinite(value)) return '';
    const abs = Math.abs(value);
    const cardinal = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    const raw = abs.toFixed(precision);
    const trimmed = precision ? raw.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : raw;
    return `${trimmed}°${cardinal}`;
  };
  const getUtmGridStep = ({ spanMeters, metersPerPixel }) => {
    const targetStep = Number.isFinite(metersPerPixel) ? metersPerPixel * GRID_TARGET_PIXEL_SPACING : null;
    return chooseGridStep(targetStep, spanMeters, UTM_GRID_STEPS);
  };
  const formatUtmLabel = (value, suffix) => {
    if (!Number.isFinite(value)) return '';
    return `${Math.round(value).toLocaleString()} ${suffix}`;
  };
  const createLineFeature = (coordinates, properties) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: properties || {}
  });
  const createPointFeature = (coordinates, properties) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: properties || {}
  });

  const getGcsPointerPrecision = (map) => {
    const bounds = map?.getBounds?.();
    if (!bounds) return 0;
    let west = Number(bounds.getWest());
    let east = Number(bounds.getEast());
    let south = Number(bounds.getSouth());
    let north = Number(bounds.getNorth());
    if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) return 0;
    south = clampLatForMercator(south);
    north = clampLatForMercator(north);
    if (east < west) east += 360;
    const spanLng = Math.max(0.000001, east - west);
    const canvas = map.getCanvas?.();
    const width = Number(canvas?.clientWidth || canvas?.width || 1024);
    const degreesPerPixel = Number.isFinite(width) && width > 0 ? spanLng / width : null;
    const step = getGcsGridStep({ span: spanLng, degreesPerPixel });
    const basePrecision = getGcsLabelPrecision(step);
    return Math.max(2, Math.min(6, basePrecision + 2));
  };

  const formatGridPointerLabel = (lngLat, map) => {
    if (!lngLat) return '';
    if (activeGridOverlay === 'utm') {
      const utmText = formatUtmFooterValue?.(lngLat.lat, lngLat.lng);
      return utmText || '';
    }
    if (activeGridOverlay === 'gcs') {
      const precision = getGcsPointerPrecision(map);
      const latText = formatDegreeLabel(lngLat.lat, precision, true);
      const lngText = formatDegreeLabel(normalizeLongitude(lngLat.lng), precision, false);
      return latText && lngText ? `${latText} ${lngText}` : '';
    }
    return '';
  };

  const getGridInsertBeforeLayer = (map) => {
    if (!map) return undefined;
    const candidates = [
      'draw-fill',
      'draw-line',
      'draw-point',
      'draw-labels-polygon',
      'tracker-paths',
      'tracker-dots',
      'tracker-labels'
    ];
    return candidates.find((id) => map.getLayer(id));
  };

  const ensureGridOverlayLayers = (map) => {
    if (!map) return;
    if (!map.getSource(GRID_OVERLAY_LINE_SOURCE_ID)) {
      map.addSource(GRID_OVERLAY_LINE_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
    }
    if (!map.getSource(GRID_OVERLAY_LABEL_SOURCE_ID)) {
      map.addSource(GRID_OVERLAY_LABEL_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
    }
    const beforeId = getGridInsertBeforeLayer(map);
    if (!map.getLayer(GRID_OVERLAY_MINOR_LINE_LAYER_ID)) {
      map.addLayer({
        id: GRID_OVERLAY_MINOR_LINE_LAYER_ID,
        type: 'line',
        source: GRID_OVERLAY_LINE_SOURCE_ID,
        filter: ['==', ['get', 'minor'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.4,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 0.9, 16, 1.2],
          'line-dasharray': [1, 2.4],
          'line-blur': 0.2
        }
      }, beforeId);
    }
    if (!map.getLayer(GRID_OVERLAY_LINE_LAYER_ID)) {
      map.addLayer({
        id: GRID_OVERLAY_LINE_LAYER_ID,
        type: 'line',
        source: GRID_OVERLAY_LINE_SOURCE_ID,
        filter: ['!=', ['get', 'minor'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.72,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 10, 1.2, 16, 1.6],
          'line-dasharray': [1.5, 1.5],
          'line-blur': 0.2
        }
      }, beforeId);
    }
    if (!map.getLayer(GRID_OVERLAY_LABEL_LAYER_ID)) {
      map.addLayer({
        id: GRID_OVERLAY_LABEL_LAYER_ID,
        type: 'symbol',
        source: GRID_OVERLAY_LABEL_SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 10, 11, 16, 13],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-anchor': [
            'case',
            ['==', ['get', 'kind'], 'lat'], 'left',
            ['==', ['get', 'kind'], 'lon'], 'top',
            ['==', ['get', 'kind'], 'utm-e'], 'top',
            ['==', ['get', 'kind'], 'utm-n'], 'left',
            'center'
          ],
          'text-offset': [
            'case',
            ['==', ['get', 'kind'], 'lat'], ['literal', [0.6, 0]],
            ['==', ['get', 'kind'], 'utm-n'], ['literal', [0.6, 0]],
            ['==', ['get', 'kind'], 'lon'], ['literal', [0, 0.6]],
            ['==', ['get', 'kind'], 'utm-e'], ['literal', [0, 0.6]],
            ['literal', [0, 0]]
          ]
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0, 0, 0, 0.75)',
          'text-halo-width': 1.6,
          'text-halo-blur': 0.8
        }
      }, beforeId);
    }
  };

  const setGridOverlayVisibility = (map, visible) => {
    if (!map) return;
    const visibility = visible ? 'visible' : 'none';
    [GRID_OVERLAY_MINOR_LINE_LAYER_ID, GRID_OVERLAY_LINE_LAYER_ID, GRID_OVERLAY_LABEL_LAYER_ID].forEach((layerId) => {
      if (!map.getLayer(layerId)) return;
      try { map.setLayoutProperty(layerId, 'visibility', visibility); } catch {}
    });
  };

  const positionGridPointerLabel = (point, map) => {
    const label = ensureGridPointerLabel();
    if (!label || !mapContainer || !point) return;
    const width = mapContainer.clientWidth || 0;
    const height = mapContainer.clientHeight || 0;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const pad = 12;
    const edgePad = 6;
    const labelWidth = label.offsetWidth || 0;
    const labelHeight = label.offsetHeight || 0;
    let x = point.x + pad;
    let y = point.y + pad;
    if (x + labelWidth > width - edgePad) x = point.x - pad - labelWidth;
    if (y + labelHeight > height - edgePad) y = point.y - pad - labelHeight;
    x = Math.max(edgePad, Math.min(width - labelWidth - edgePad, x));
    y = Math.max(edgePad, Math.min(height - labelHeight - edgePad, y));
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };

  const updateGridPointerLabel = (event) => {
    const map = getMap();
    if (!map || activeGridOverlay === 'none') return;
    const label = ensureGridPointerLabel();
    if (!label) return;
    const lngLat = event?.lngLat;
    const text = formatGridPointerLabel(lngLat, map);
    if (!text) {
      hideGridPointerLabel();
      return;
    }
    label.textContent = text;
    label.hidden = false;
    positionGridPointerLabel(event?.point, map);
  };

  const attachGridPointerListeners = () => {
    const map = getMap();
    if (!map || gridPointerMoveHandler) return;
    gridPointerMoveHandler = (event) => updateGridPointerLabel(event);
    gridPointerLeaveHandler = () => hideGridPointerLabel();
    map.on('mousemove', gridPointerMoveHandler);
    map.on('mouseleave', gridPointerLeaveHandler);
  };

  const detachGridPointerListeners = () => {
    const map = getMap();
    if (!map || !gridPointerMoveHandler) return;
    map.off('mousemove', gridPointerMoveHandler);
    map.off('mouseleave', gridPointerLeaveHandler);
    gridPointerMoveHandler = null;
    gridPointerLeaveHandler = null;
    hideGridPointerLabel();
  };

  const setGridOverlayData = (map, lines, labels) => {
    if (!map) return;
    const lineSource = map.getSource(GRID_OVERLAY_LINE_SOURCE_ID);
    const labelSource = map.getSource(GRID_OVERLAY_LABEL_SOURCE_ID);
    try {
      if (lineSource && typeof lineSource.setData === 'function') {
        lineSource.setData(lines || EMPTY_FEATURE_COLLECTION);
      }
      if (labelSource && typeof labelSource.setData === 'function') {
        labelSource.setData(labels || EMPTY_FEATURE_COLLECTION);
      }
    } catch (err) {
      console.warn('Failed updating grid overlay sources', err);
    }
  };

  const buildGcsGridFeatures = (map) => {
    const bounds = map?.getBounds?.();
    if (!bounds) return { lines: EMPTY_FEATURE_COLLECTION, labels: EMPTY_FEATURE_COLLECTION };
    let west = Number(bounds.getWest());
    let east = Number(bounds.getEast());
    let south = Number(bounds.getSouth());
    let north = Number(bounds.getNorth());
    if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
      return { lines: EMPTY_FEATURE_COLLECTION, labels: EMPTY_FEATURE_COLLECTION };
    }
    south = clampLatForMercator(south);
    north = clampLatForMercator(north);
    if (east < west) east += 360;
    const spanLng = Math.max(0.000001, east - west);
    const canvas = map.getCanvas?.();
    const width = Number(canvas?.clientWidth || canvas?.width || 1024);
    const degreesPerPixel = Number.isFinite(width) && width > 0 ? spanLng / width : null;
    const step = getGcsGridStep({ span: spanLng, degreesPerPixel });
    const minorStep = getGcsMinorGridStep({ span: spanLng, degreesPerPixel, majorStep: step });
    const precision = getGcsLabelPrecision(step);
    const spanLat = Math.max(0.000001, north - south);
    const offsetLng = spanLng * 0.015;
    const offsetLat = spanLat * 0.015;
    const labelLngLeft = west + offsetLng;
    const labelLatTop = Math.max(south, Math.min(north, north - offsetLat));

    const lines = [];
    const labels = [];
    const isMajorLine = (value, major) => {
      if (!Number.isFinite(value) || !Number.isFinite(major) || major === 0) return false;
      const ratio = value / major;
      return Math.abs(ratio - Math.round(ratio)) < 1e-6;
    };
    const startLng = Math.floor(west / step) * step;
    const endLng = Math.ceil(east / step) * step;
    if (minorStep && minorStep < step) {
      const minorStartLng = Math.floor(west / minorStep) * minorStep;
      const minorEndLng = Math.ceil(east / minorStep) * minorStep;
      for (let lng = minorStartLng; lng <= minorEndLng + minorStep * 0.5; lng += minorStep) {
        if (!Number.isFinite(lng)) continue;
        if (isMajorLine(lng, step)) continue;
        lines.push(createLineFeature([[lng, south], [lng, north]], { kind: 'lon', value: lng, minor: true }));
      }
    }
    for (let lng = startLng; lng <= endLng + step * 0.5; lng += step) {
      if (!Number.isFinite(lng)) continue;
      lines.push(createLineFeature([[lng, south], [lng, north]], { kind: 'lon', value: lng }));
      const displayLng = normalizeLongitude(lng);
      const text = formatDegreeLabel(displayLng, precision, false);
      if (text) labels.push(createPointFeature([lng, labelLatTop], { kind: 'lon', label: text }));
    }
    const startLat = Math.floor(south / step) * step;
    const endLat = Math.ceil(north / step) * step;
    if (minorStep && minorStep < step) {
      const minorStartLat = Math.floor(south / minorStep) * minorStep;
      const minorEndLat = Math.ceil(north / minorStep) * minorStep;
      for (let lat = minorStartLat; lat <= minorEndLat + minorStep * 0.5; lat += minorStep) {
        const latValue = clampLatForMercator(lat);
        if (latValue < south - 1e-6 || latValue > north + 1e-6) continue;
        if (isMajorLine(latValue, step)) continue;
        lines.push(createLineFeature([[west, latValue], [east, latValue]], { kind: 'lat', value: latValue, minor: true }));
      }
    }
    for (let lat = startLat; lat <= endLat + step * 0.5; lat += step) {
      const latValue = clampLatForMercator(lat);
      if (latValue < south - 1e-6 || latValue > north + 1e-6) continue;
      lines.push(createLineFeature([[west, latValue], [east, latValue]], { kind: 'lat', value: latValue }));
      const text = formatDegreeLabel(latValue, precision, true);
      if (text) labels.push(createPointFeature([labelLngLeft, latValue], { kind: 'lat', label: text }));
    }
    return {
      lines: { type: 'FeatureCollection', features: lines },
      labels: { type: 'FeatureCollection', features: labels }
    };
  };

  const buildUtmGridFeatures = (map) => {
    const center = map?.getCenter?.();
    if (!center) return { lines: EMPTY_FEATURE_COLLECTION, labels: EMPTY_FEATURE_COLLECTION };
    const centerUtm = utmFromLatLng(center.lat, center.lng);
    if (!centerUtm) return { lines: EMPTY_FEATURE_COLLECTION, labels: EMPTY_FEATURE_COLLECTION };
    const zoom = Number(map.getZoom?.());
    const metersPerPixel = getMetersPerPixelAtLatitude(map, center.lat, zoom);
    if (!Number.isFinite(metersPerPixel)) return { lines: EMPTY_FEATURE_COLLECTION, labels: EMPTY_FEATURE_COLLECTION };
    const canvas = map.getCanvas?.();
    const width = Number(canvas?.clientWidth || canvas?.width || 1024);
    const height = Number(canvas?.clientHeight || canvas?.height || 768);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return { lines: EMPTY_FEATURE_COLLECTION, labels: EMPTY_FEATURE_COLLECTION };
    }
    const widthMeters = metersPerPixel * width;
    const heightMeters = metersPerPixel * height;
    const spanMeters = Math.max(widthMeters, heightMeters);
    const step = getUtmGridStep({ spanMeters, metersPerPixel });
    const clampRange = (value, min, max) => Math.min(max, Math.max(min, value));
    const minE = clampRange(centerUtm.easting - widthMeters / 2, 0, 1_000_000);
    const maxE = clampRange(centerUtm.easting + widthMeters / 2, 0, 1_000_000);
    const minN = clampRange(centerUtm.northing - heightMeters / 2, 0, 10_000_000);
    const maxN = clampRange(centerUtm.northing + heightMeters / 2, 0, 10_000_000);
    const startE = Math.floor(minE / step) * step;
    const endE = Math.ceil(maxE / step) * step;
    const startN = Math.floor(minN / step) * step;
    const endN = Math.ceil(maxN / step) * step;
    const segmentStep = Math.max(5000, Math.min(20000, step));
    const spanE = Math.max(1, maxE - minE);
    const spanN = Math.max(1, maxN - minN);
    const offsetE = Math.max(step * 0.4, spanE * 0.02);
    const offsetN = Math.max(step * 0.4, spanN * 0.02);
    const labelEastingLeft = clampRange(minE + offsetE, minE, maxE);
    const labelNorthingTop = clampRange(maxN - offsetN, minN, maxN);

    const lines = [];
    const labels = [];
    for (let easting = startE; easting <= endE + step * 0.5; easting += step) {
      const coords = [];
      for (let northing = minN; northing <= maxN + segmentStep; northing += segmentStep) {
        const point = latLngFromUtm({
          zoneNumber: centerUtm.zoneNumber,
          zoneLetter: centerUtm.zoneLetter,
          easting,
          northing
        });
        if (point) coords.push([point.lng, point.lat]);
      }
      if (coords.length >= 2) {
        lines.push(createLineFeature(coords, { kind: 'utm-e', value: easting }));
      }
      const labelPoint = latLngFromUtm({
        zoneNumber: centerUtm.zoneNumber,
        zoneLetter: centerUtm.zoneLetter,
        easting,
        northing: labelNorthingTop
      });
      if (labelPoint) {
        const label = formatUtmLabel(easting, 'mE');
        if (label) labels.push(createPointFeature([labelPoint.lng, labelPoint.lat], { kind: 'utm-e', label }));
      }
    }
    for (let northing = startN; northing <= endN + step * 0.5; northing += step) {
      const coords = [];
      for (let easting = minE; easting <= maxE + segmentStep; easting += segmentStep) {
        const point = latLngFromUtm({
          zoneNumber: centerUtm.zoneNumber,
          zoneLetter: centerUtm.zoneLetter,
          easting,
          northing
        });
        if (point) coords.push([point.lng, point.lat]);
      }
      if (coords.length >= 2) {
        lines.push(createLineFeature(coords, { kind: 'utm-n', value: northing }));
      }
      const labelPoint = latLngFromUtm({
        zoneNumber: centerUtm.zoneNumber,
        zoneLetter: centerUtm.zoneLetter,
        easting: labelEastingLeft,
        northing
      });
      if (labelPoint) {
        const label = formatUtmLabel(northing, 'mN');
        if (label) labels.push(createPointFeature([labelPoint.lng, labelPoint.lat], { kind: 'utm-n', label }));
      }
    }
    const zoneLabelPoint = latLngFromUtm({
      zoneNumber: centerUtm.zoneNumber,
      zoneLetter: centerUtm.zoneLetter,
      easting: labelEastingLeft,
      northing: labelNorthingTop
    });
    if (zoneLabelPoint) {
      labels.push(createPointFeature([zoneLabelPoint.lng, zoneLabelPoint.lat], {
        kind: 'utm-zone',
        label: `${centerUtm.zoneNumber}${centerUtm.zoneLetter}`
      }));
    }
    return {
      lines: { type: 'FeatureCollection', features: lines },
      labels: { type: 'FeatureCollection', features: labels }
    };
  };

  const updateGridOverlay = () => {
    const map = getMap();
    if (!map) return;
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;
    if (activeGridOverlay === 'none') {
      if (map.getLayer(GRID_OVERLAY_LINE_LAYER_ID) || map.getLayer(GRID_OVERLAY_LABEL_LAYER_ID)) {
        setGridOverlayData(map, EMPTY_FEATURE_COLLECTION, EMPTY_FEATURE_COLLECTION);
        setGridOverlayVisibility(map, false);
      }
      hideGridPointerLabel();
      return;
    }
    ensureGridOverlayLayers(map);
    const data = activeGridOverlay === 'utm' ? buildUtmGridFeatures(map) : buildGcsGridFeatures(map);
    setGridOverlayData(map, data.lines, data.labels);
    setGridOverlayVisibility(map, true);
  };

  const scheduleGridOverlayUpdate = () => {
    if (activeGridOverlay === 'none') return;
    if (gridOverlayUpdateTimer) clearTimeout(gridOverlayUpdateTimer);
    gridOverlayUpdateTimer = setTimeout(() => {
      gridOverlayUpdateTimer = null;
      updateGridOverlay();
    }, GRID_OVERLAY_REFRESH_DELAY_MS);
  };

  const attachGridOverlayListeners = () => {
    const map = getMap();
    if (!map || gridOverlayMoveHandler) return;
    gridOverlayMoveHandler = () => scheduleGridOverlayUpdate();
    map.on('moveend', gridOverlayMoveHandler);
    map.on('zoomend', gridOverlayMoveHandler);
    map.on('resize', gridOverlayMoveHandler);
  };

  const detachGridOverlayListeners = () => {
    const map = getMap();
    if (!map || !gridOverlayMoveHandler) return;
    map.off('moveend', gridOverlayMoveHandler);
    map.off('zoomend', gridOverlayMoveHandler);
    map.off('resize', gridOverlayMoveHandler);
    gridOverlayMoveHandler = null;
  };

  const refreshGridOverlay = () => {
    if (activeGridOverlay === 'none') {
      updateGridOverlay();
      return;
    }
    attachGridOverlayListeners();
    attachGridPointerListeners();
    updateGridOverlay();
  };

  const setActiveGridOverlay = (value, { persist = true } = {}) => {
    const next = normalizeGridOverlayType(value);
    activeGridOverlay = next;
    if (overlaySelect && overlaySelect.value !== next) overlaySelect.value = next;
    if (persist) {
      try { localStorage.setItem(GRID_OVERLAY_STORAGE_KEY, next); } catch {}
    }
    if (next === 'none') {
      detachGridOverlayListeners();
      detachGridPointerListeners();
      updateGridOverlay();
      return;
    }
    refreshGridOverlay();
  };

  const cycleGridOverlay = () => {
    const order = ['none', 'utm', 'gcs'];
    const idx = order.indexOf(activeGridOverlay);
    const next = order[(idx + 1) % order.length];
    setActiveGridOverlay(next);
  };

  if (overlaySelect) {
    overlaySelect.addEventListener('change', () => {
      setActiveGridOverlay(overlaySelect.value);
    });
  }
  setActiveGridOverlay(activeGridOverlay, { persist: false });

  let suppressFeatureToasts = false;
  let lastFeatureModifiedToast = 0;
  const featureToastCooldown = 600;

  const labelForKind = (kind = 'feature') => {
    if (!kind) return 'Feature';
    const lower = String(kind).toLowerCase();
    if (lower === 'poi') return 'POI';
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const notifyFeatureAdded = (kind = 'Feature') => {
    requestFirestoreFeaturesSync(0);
    if (suppressFeatureToasts) return;
    const label = labelForKind(kind);
    showToast(`${label} added`);
  };

  const notifyFeatureModified = (label = 'Feature updated') => {
    requestFirestoreFeaturesSync(0);
    if (suppressFeatureToasts) return;
    const now = Date.now();
    if (now - lastFeatureModifiedToast < featureToastCooldown) return;
    lastFeatureModifiedToast = now;
    showToast(label);
  };

  const writeToClipboard = async (text) => {
    let lastError = null;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        lastError = err;
        console.error('navigator.clipboard.writeText failed', err);
      }
    }
    if (window.clipboard?.writeText) {
      try {
        const res = window.clipboard.writeText(text);
        return res !== false;
      } catch (err) {
        lastError = err;
        console.error('window.clipboard.writeText failed', err);
      }
    }
    if (window.electronAPI?.writeClipboard) {
      try {
        const res = window.electronAPI.writeClipboard(text);
        return res !== false;
      } catch (err) {
        lastError = err;
        console.error('electronAPI.writeClipboard failed', err);
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = String(text ?? '');
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    } catch (err) {
      lastError = err;
      console.error('execCommand copy failed', err);
    }
    if (lastError) throw lastError;
    return false;
  };

  const readMapboxToken = () => (localStorage.getItem('map.accessToken') || defaultAccessToken || '').trim();
  const readFirebaseConfigValue = () => {
    if (firebaseSettings && typeof firebaseSettings === 'object') return firebaseSettings;
    let raw = '';
    try { raw = localStorage.getItem(FIREBASE_SETTINGS_STORAGE_KEY) || ''; } catch {}
    let parsed = parseFirebaseSettingsText(raw);
    if (!parsed.error && parsed.value) return parsed.value;
    const fallbackRaw = normalizeLineBreaks(settingFirebaseConfig?.value || '');
    parsed = parseFirebaseSettingsText(fallbackRaw);
    if (!parsed.error && parsed.value) return parsed.value;
    return null;
  };
  const readFirebaseConfigString = () => {
    const value = readFirebaseConfigValue();
    if (!value) return '';
    try { return JSON.stringify(value); } catch {}
    return '';
  };
  const readGoogleKey = () => (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
  const readOpenAIKey = () => (localStorage.getItem('openai.key') || defaultOpenAIKey || '').trim();
  const shouldShowWelcome = () => {
    const hasMapbox = !!readMapboxToken();
    const needsAdmin = !firebaseAdminCredentialsReady;
    const missingDeploy = hasMissingFirebaseDeployments();
    return !hasMapbox || needsAdmin || missingDeploy;
  };
  const updateWelcomeState = () => {
    if (!mapWelcome) return;
    mapWelcome.hidden = !shouldShowWelcome();
  };

  let googleServicesEnabled = false;
  let aiEnabled = false;
  let lastKnownCenter = null;
  let lastKnownAddress = '';

  const refreshAiButtonsVisibility = () => {
    const buttons = document.querySelectorAll('.drawing-ai');
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const shouldShow = !!aiEnabled;
      btn.disabled = !shouldShow;
      btn.hidden = !shouldShow;
      btn.style.display = shouldShow ? '' : 'none';
    });
  };

  const applyServiceAvailability = () => {
    googleServicesEnabled = !!readGoogleKey();
    aiEnabled = !!readOpenAIKey();

    updateWelcomeState();

    if (toolSearch) {
      toolSearch.disabled = !googleServicesEnabled;
      toolSearch.setAttribute('aria-disabled', String(!googleServicesEnabled));
      toolSearch.classList.toggle('is-disabled', !googleServicesEnabled);
      toolSearch.title = googleServicesEnabled ? 'Search address' : 'Search disabled (Google Maps API key required)';
    }
    if (searchQuery) searchQuery.disabled = !googleServicesEnabled;
    if (searchResults) {
      if (!googleServicesEnabled) {
        searchResults.innerHTML = '<div class="muted">Search is unavailable. Add a Google Maps API key in Settings.</div>';
        searchResults.dataset.state = 'disabled';
      } else if (searchResults.dataset.state === 'disabled') {
        searchResults.innerHTML = '<div class="muted">Type at least 3 characters…</div>';
        delete searchResults.dataset.state;
      }
    }
    if (!googleServicesEnabled) {
      if (searchModal) searchModal.hidden = true;
      lastKnownAddress = '';
    }

    refreshAiButtonsVisibility();
    updateTrackersPanelState();
  };

  const FIRESTORE_FEATURES_UPLOAD_DELAY = 800;
  let firestoreFeaturesUploadTimer = null;
  let firestoreFeaturesUploadInFlight = false;
  let firestoreFeaturesUploadPending = false;

  const cloneForSessionSync = (value) => {
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch (err) {
      console.warn('structuredClone failed for session sync, using JSON clone', err);
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      console.error('Failed to clone value for session sync', err);
      return null;
    }
  };

  const buildFeaturesPayload = () => {
    let storeRef = null;
    try { storeRef = (window)._drawStore || drawStore; }
    catch { storeRef = null; }
    if (!storeRef) return null;
    return cloneForSessionSync(storeRef);
  };

  const filterSessionFeatures = (features) => {
    if (!Array.isArray(features)) return [];
    return features.filter((feature) => {
      if (!feature || feature.type !== 'Feature' || !feature.geometry) return false;
      const geomType = feature.geometry.type;
      if (geomType !== 'Point' && geomType !== 'LineString' && geomType !== 'Polygon') return false;
      const props = feature.properties || {};
      if (props.isLineEndpoint === true) return false;
      if (props.kind === 'line-start' || props.kind === 'line-end') return false;
      return true;
    });
  };

  const stringifyNestedArrays = (value) => {
    if (Array.isArray(value)) {
      const hasNestedArray = value.some(Array.isArray);
      if (hasNestedArray) {
        try { return JSON.stringify(value); } catch { return value; }
      }
      return value.map((entry) => stringifyNestedArrays(entry));
    }
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((key) => {
        out[key] = stringifyNestedArrays(value[key]);
      });
      return out;
    }
    return value;
  };

  const reviveNestedArrayStrings = (value) => {
    if (Array.isArray(value)) return value.map((entry) => reviveNestedArrayStrings(entry));
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((key) => {
        out[key] = reviveNestedArrayStrings(value[key]);
      });
      return out;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.some(Array.isArray)) {
            return parsed;
          }
        } catch {}
      }
    }
    return value;
  };

  const buildSessionFeaturesPayload = () => {
    const payload = buildFeaturesPayload();
    let features = [];
    if (payload && typeof payload === 'object') {
      if (payload.type === 'FeatureCollection' && Array.isArray(payload.features)) {
        features = payload.features;
      } else if (payload.features && typeof payload.features === 'object') {
        const nested = payload.features;
        if (nested.type === 'FeatureCollection' && Array.isArray(nested.features)) {
          features = nested.features;
        } else if (Array.isArray(nested.features)) {
          features = nested.features;
        }
      } else if (Array.isArray(payload.features)) {
        features = payload.features;
      }
    }
    const filtered = filterSessionFeatures(features);
    return { type: 'FeatureCollection', features: filtered.map((feature) => stringifyNestedArrays(feature)) };
  };

  const getSessionIdsForFeatureSync = () => {
    const ids = new Set();
    const addId = (value) => {
      const trimmed = String(value || '').trim();
      if (trimmed) ids.add(trimmed);
    };
    addId(teamsSessionId);
    return Array.from(ids);
  };

  const pushFirestoreFeatures = async () => {
    const sessionIds = getSessionIdsForFeatureSync();
    if (!sessionIds.length) return;
    const sdkInfo = resolveFirebaseSdk();
    const db = firestoreInstance || initFirestoreConnection();
    if (!sdkInfo || !db) {
      console.warn('Firestore not available for session features sync.');
      return;
    }
    const features = buildSessionFeaturesPayload();
    firestoreFeaturesUploadInFlight = true;
    try {
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc !== 'function') {
          console.warn('Firebase compat SDK missing doc().');
          return;
        }
        for (const sessionId of sessionIds) {
          try {
            const docRef = db.doc(`sessions/${sessionId}`);
            await docRef.set({ features }, { merge: true });
          } catch (err) {
            console.warn('Failed to sync features to session document', sessionId, err);
          }
        }
      } else {
        const { doc, setDoc } = sdkInfo.sdk || {};
        if (typeof doc !== 'function' || typeof setDoc !== 'function') {
          console.warn('Firebase modular SDK missing doc/setDoc.');
          return;
        }
        for (const sessionId of sessionIds) {
          try {
            const docRef = doc(db, 'sessions', sessionId);
            await setDoc(docRef, { features }, { merge: true });
          } catch (err) {
            console.warn('Failed to sync features to session document', sessionId, err);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to sync session features', err);
    } finally {
      firestoreFeaturesUploadInFlight = false;
      if (firestoreFeaturesUploadPending) {
        firestoreFeaturesUploadPending = false;
        scheduleFirestoreFeaturesUpload();
      }
    }
  };

  const scheduleFirestoreFeaturesUpload = (delay = FIRESTORE_FEATURES_UPLOAD_DELAY) => {
    if (firestoreFeaturesUploadInFlight) {
      firestoreFeaturesUploadPending = true;
      return;
    }
    const sessionIds = getSessionIdsForFeatureSync();
    if (!sessionIds.length) return;
    if (firestoreFeaturesUploadTimer) clearTimeout(firestoreFeaturesUploadTimer);
    firestoreFeaturesUploadTimer = setTimeout(() => {
      firestoreFeaturesUploadTimer = null;
      pushFirestoreFeatures();
    }, Math.max(0, Number.isFinite(delay) ? delay : FIRESTORE_FEATURES_UPLOAD_DELAY));
  };

  const requestFirestoreFeaturesSync = (delay) => {
    scheduleFirestoreFeaturesUpload(typeof delay === 'number' ? delay : FIRESTORE_FEATURES_UPLOAD_DELAY);
  };

  const scheduleMapResize = (delay = 0) => {
    try {
      const map = getMap();
      if (!map) return;
      const run = () => {
        try { map.resize(); } catch {}
      };
      if (delay > 0) setTimeout(run, delay);
      else requestAnimationFrame(run);
    } catch {}
  };

  let isDirty = false;
  const setDirty = (v=true) => { isDirty = !!v; (window)._dirty = isDirty; };
  let settingsDirty = false;
  let suppressSettingsEvents = false;
  let settingsStatusTimer = null;
  let featuresActionsMenuOpen = false;
  const setFeaturesActionsMenu = (open) => {
    const next = !!open;
    featuresActionsMenuOpen = next;
    if (featuresActionsMenu) featuresActionsMenu.hidden = !next;
    if (featuresActionsToggleBtn) {
      featuresActionsToggleBtn.setAttribute('aria-expanded', String(next));
      featuresActionsToggleBtn.classList.toggle('is-active', next);
    }
    if (featuresActions) featuresActions.classList.toggle('features-actions--open', next);
  };
  const closeFeaturesActionsMenu = () => {
    if (!featuresActionsMenuOpen) return;
    setFeaturesActionsMenu(false);
  };
  const toggleFeaturesActionsMenu = () => setFeaturesActionsMenu(!featuresActionsMenuOpen);
  let trackersMenuOpen = false;
  const setTrackersMenu = (open) => {
    const next = !!open;
    trackersMenuOpen = next;
    if (trackersMenu) trackersMenu.hidden = !next;
    if (trackersMenuToggle) trackersMenuToggle.setAttribute('aria-expanded', String(next));
    if (trackersMenuWrapper) trackersMenuWrapper.classList.toggle('is-open', next);
  };
  const closeTrackersMenu = () => {
    if (!trackersMenuOpen) return;
    setTrackersMenu(false);
  };
  const toggleTrackersMenu = () => setTrackersMenu(!trackersMenuOpen);

  const trackerStore = new Map();
  const trackerBlinkQueue = new Set();
  const trackerPositionsStore = new Map();
  const trackerGoToLocations = new Map();
  const TRIM_MEMBER_PATH_SOURCE_ID = 'trim-member-path';
  const TRIM_MEMBER_POINTS_SOURCE_ID = 'trim-member-points';
  const TRIM_MEMBER_PATH_LAYER_ID = 'trim-member-path-line';
  const TRIM_MEMBER_POINTS_LAYER_ID = 'trim-member-points';
  let trimMemberMap = null;
  let trimMemberMapReady = false;
  let trimMemberActiveId = null;
  let trimMemberPositions = [];
  let trimMemberStartIndex = 0;
  let trimMemberEndIndex = 0;
  let trimMemberFitNextUpdate = false;
  let trimMemberDisplayName = '';
  let trimMemberColor = null;
  let trimMemberMapUnavailable = false;
  let trimMemberSourceType = null;
  let trimMemberSourceFeatureId = null;
  (window)._trackerPositions = trackerPositionsStore;
  (window)._trackerStore = trackerStore;
  (window).getTrackerData = () => Array.from(trackerStore.values());
  let trackerSourceReady = false;
  let trackerPathSourceReady = false;
  let trackerGoToSourceReady = false;
  let activeTrackerGoToId = null;
  let activeTrackerGoToButton = null;
  const trackersRecordingState = {
    active: false,
    startedAt: null,
    updatedAt: null,
    entries: new Map(),
    imported: false
  };
  let trackersRecordingHasData = false;
  (window)._trackerRecording = trackersRecordingState;

  function resetTrackersRecordingData() {
    trackersRecordingState.entries.clear();
    trackersRecordingState.startedAt = null;
    trackersRecordingState.updatedAt = null;
    trackersRecordingState.imported = false;
    trackersRecordingHasData = false;
  }

  function refreshTrackersControlsState() {
    const hasTeams = trackerStore.size > 0;
    const showControls = hasTeams || trackersRecordingHasData || trackersRecordingState.imported || trackersRecordingState.active;
    if (trackersControls) trackersControls.hidden = !showControls;
    if (!showControls) closeTrackersMenu();
    if (trackersRecordBtn) {
      const canRecord = hasTeams || trackersRecordingState.active;
      const hasPausedData = trackersRecordingHasData && !trackersRecordingState.active;
      trackersRecordBtn.disabled = !canRecord;
      trackersRecordBtn.setAttribute('aria-disabled', String(!canRecord));
      trackersRecordBtn.setAttribute('aria-pressed', String(trackersRecordingState.active));
      trackersRecordBtn.classList.toggle('is-active', trackersRecordingState.active);
      const textLabel = trackersRecordingState.active ? 'Pause' : hasPausedData ? 'Resume' : 'Record';
      if (trackersRecordText) trackersRecordText.textContent = textLabel;
      if (trackersRecordIcon) {
        const nextIcon = trackersRecordingState.active ? TRACKERS_PAUSE_ICON : TRACKERS_RECORD_ICON;
        if (trackersRecordIcon.getAttribute('src') !== nextIcon) trackersRecordIcon.setAttribute('src', nextIcon);
      }
      const label = trackersRecordingState.active ? 'Pause recording' : hasPausedData ? 'Resume recording' : 'Start recording';
      trackersRecordBtn.title = label;
      trackersRecordBtn.setAttribute('aria-label', label);
    }
    if (trackersRecordIndicator) trackersRecordIndicator.hidden = !trackersRecordingState.active;
    if (trackersSaveBtn) {
      const disabled = !trackersRecordingHasData;
      trackersSaveBtn.disabled = disabled;
      trackersSaveBtn.classList.toggle('is-disabled', disabled);
      if (disabled) trackersSaveBtn.setAttribute('aria-disabled', 'true');
      else trackersSaveBtn.removeAttribute('aria-disabled');
    }
    if (trackersMenuToggle) {
      trackersMenuToggle.disabled = !showControls;
      trackersMenuToggle.setAttribute('aria-disabled', String(!showControls));
    }
    if (trackersToggleBtn) trackersToggleBtn.classList.toggle('is-recording', trackersRecordingState.active);
  }

  const trackerSubscriptions = new Map();
  const trackerSubscriptionRetries = new Map();
  const TRACKER_SUBSCRIPTION_RETRY_MS = 5000;
  let pendingTeamMemberTrackerId = null;
  let teamMemberQrInFlight = false;
  let teamMemberQrRequestId = 0;
  let firestoreUnavailableToasted = false;
  const trackerAutoReveal = new Set();

  const clearTrackerSubscriptionRetry = (trackerId) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return;
    const entry = trackerSubscriptionRetries.get(trimmed);
    if (entry?.timer) clearTimeout(entry.timer);
    trackerSubscriptionRetries.delete(trimmed);
  };

  const scheduleTrackerSubscriptionRetry = (trackerId, reason) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return;
    if (trackerSubscriptions.has(trimmed)) return;
    if (trackerSubscriptionRetries.has(trimmed)) return;
    if (reason) console.warn('Scheduling tracker subscription retry', trimmed, reason);
    const timer = setTimeout(() => {
      trackerSubscriptionRetries.delete(trimmed);
      startTrackerSubscription(trimmed);
    }, TRACKER_SUBSCRIPTION_RETRY_MS);
    trackerSubscriptionRetries.set(trimmed, { timer });
  };

  const normalizeSessionDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.toDate === 'function') {
      try {
        const parsed = value.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
      } catch {}
    }
    if (typeof value.seconds === 'number') {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value._seconds === 'number') {
      const parsed = new Date(value._seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const normalizeSessionCoordinates = (value) => {
    if (!value || typeof value !== 'object') return null;
    const coords = extractCoordsPayload(value);
    if (!coords) return null;
    if (!Number.isFinite(coords.longitude) || !Number.isFinite(coords.latitude)) return null;
    return {
      longitude: coords.longitude,
      latitude: coords.latitude,
      altitude: Number.isFinite(coords.altitude) ? coords.altitude : null
    };
  };

  const createBoundsTracker = () => ({
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
    has: false
  });

  const extendBoundsWithCoord = (bounds, lng, lat) => {
    if (!bounds) return;
    const nextLng = Number(lng);
    const nextLat = Number(lat);
    if (!Number.isFinite(nextLng) || !Number.isFinite(nextLat)) return;
    if (nextLng < bounds.minLng) bounds.minLng = nextLng;
    if (nextLng > bounds.maxLng) bounds.maxLng = nextLng;
    if (nextLat < bounds.minLat) bounds.minLat = nextLat;
    if (nextLat > bounds.maxLat) bounds.maxLat = nextLat;
    bounds.has = true;
  };

  const mergeBounds = (target, source) => {
    if (!target || !source || !source.has) return;
    if (!target.has) {
      target.minLng = source.minLng;
      target.minLat = source.minLat;
      target.maxLng = source.maxLng;
      target.maxLat = source.maxLat;
      target.has = true;
      return;
    }
    if (source.minLng < target.minLng) target.minLng = source.minLng;
    if (source.minLat < target.minLat) target.minLat = source.minLat;
    if (source.maxLng > target.maxLng) target.maxLng = source.maxLng;
    if (source.maxLat > target.maxLat) target.maxLat = source.maxLat;
    target.has = true;
  };

  const finalizeBounds = (bounds) => {
    if (!bounds || !bounds.has) return null;
    if (![bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat].every((v) => Number.isFinite(v))) return null;
    return {
      minLng: bounds.minLng,
      minLat: bounds.minLat,
      maxLng: bounds.maxLng,
      maxLat: bounds.maxLat
    };
  };

  const computeBoundsFromFeatures = (features) => {
    if (!Array.isArray(features) || features.length === 0) return null;
    const bounds = createBoundsTracker();
    const walk = (geom) => {
      if (!geom) return;
      const type = geom.type;
      const coords = geom.coordinates;
      if (type === 'Point') {
        if (Array.isArray(coords)) extendBoundsWithCoord(bounds, coords[0], coords[1]);
      } else if (type === 'MultiPoint' || type === 'LineString') {
        if (Array.isArray(coords)) coords.forEach((pt) => Array.isArray(pt) && extendBoundsWithCoord(bounds, pt[0], pt[1]));
      } else if (type === 'Polygon' || type === 'MultiLineString') {
        if (Array.isArray(coords)) {
          coords.forEach((ring) => {
            if (!Array.isArray(ring)) return;
            ring.forEach((pt) => Array.isArray(pt) && extendBoundsWithCoord(bounds, pt[0], pt[1]));
          });
        }
      } else if (type === 'MultiPolygon') {
        if (Array.isArray(coords)) {
          coords.forEach((poly) => {
            if (!Array.isArray(poly)) return;
            poly.forEach((ring) => {
              if (!Array.isArray(ring)) return;
              ring.forEach((pt) => Array.isArray(pt) && extendBoundsWithCoord(bounds, pt[0], pt[1]));
            });
          });
        }
      } else if (type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
        geom.geometries.forEach((child) => walk(child));
      }
    };
    features.forEach((feature) => {
      if (!feature || feature.type !== 'Feature' || !feature.geometry) return;
      const revived = reviveNestedArrayStrings(feature.geometry);
      walk(revived);
    });
    return bounds.has ? bounds : null;
  };

  const computeBoundsFromTrackerLocations = (locations) => {
    if (!Array.isArray(locations) || locations.length === 0) return null;
    const bounds = createBoundsTracker();
    locations.forEach((coords) => {
      if (!coords) return;
      extendBoundsWithCoord(bounds, coords.longitude, coords.latitude);
    });
    return bounds.has ? bounds : null;
  };

  const computeCenterFromBounds = (bounds) => {
    if (!bounds) return null;
    const { minLng, minLat, maxLng, maxLat } = bounds;
    if (![minLng, minLat, maxLng, maxLat].every((v) => Number.isFinite(v))) return null;
    return {
      longitude: (minLng + maxLng) / 2,
      latitude: (minLat + maxLat) / 2
    };
  };

  const getSessionCenterCoordinates = () => {
    const map = getMap();
    if (map && typeof map.getCenter === 'function') {
      const center = map.getCenter();
      const lng = Number(center?.lng ?? center?.longitude);
      const lat = Number(center?.lat ?? center?.latitude);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return { longitude: lng, latitude: lat };
    }
    const fallbackLng = Number(defaultStartLng);
    const fallbackLat = Number(defaultStartLat);
    if (Number.isFinite(fallbackLng) && Number.isFinite(fallbackLat)) {
      return { longitude: fallbackLng, latitude: fallbackLat };
    }
    return null;
  };

  const focusSessionCoordinates = (coords) => {
    if (!coords) return;
    const lng = Number(coords.longitude);
    const lat = Number(coords.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const map = getMap();
    if (!map) return;
    const zoom = Number(map.getZoom?.() ?? 0) || 12;
    try {
      map.flyTo({ center: [lng, lat], zoom: Math.max(zoom, 12), duration: 800, essential: true });
    } catch (err) {
      console.warn('Failed to center map on session coordinates', err);
    }
  };

  const fetchSessionTrackerLocations = async (sessionId) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return [];
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return [];
    const { sdkInfo, db } = handle;
    try {
      const locations = [];
      if (sdkInfo.type === 'compat') {
        if (typeof db.collection !== 'function') return [];
        const snap = await db.collection('sessions').doc(trimmed).collection('trackers').get();
        snap.forEach((doc) => {
          const data = typeof doc.data === 'function' ? doc.data() : doc.data;
          const coords = extractCoordsPayload(data || {});
          if (coords) locations.push(coords);
        });
      } else {
        const { collection, getDocs } = sdkInfo.sdk || {};
        if (typeof collection !== 'function' || typeof getDocs !== 'function') return [];
        const colRef = collection(db, 'sessions', trimmed, 'trackers');
        const snap = await getDocs(colRef);
        snap.forEach((doc) => {
          const data = typeof doc.data === 'function' ? doc.data() : doc.data;
          const coords = extractCoordsPayload(data || {});
          if (coords) locations.push(coords);
        });
      }
      return locations;
    } catch (err) {
      console.warn('Failed to fetch tracker locations for session', trimmed, err);
      return [];
    }
  };

  const focusResumedSessionCenter = async (sessionId, data, fallbackCoords) => {
    try {
      const bounds = createBoundsTracker();
      const featureBounds = computeBoundsFromFeatures(extractSessionFeatures(data));
      if (featureBounds) mergeBounds(bounds, featureBounds);
      const trackerLocations = await fetchSessionTrackerLocations(sessionId);
      const trackerBounds = computeBoundsFromTrackerLocations(trackerLocations);
      if (trackerBounds) mergeBounds(bounds, trackerBounds);
      const resolved = computeCenterFromBounds(finalizeBounds(bounds));
      if (resolved) {
        focusSessionCoordinates(resolved);
        return true;
      }
      if (fallbackCoords) {
        focusSessionCoordinates(fallbackCoords);
        return true;
      }
    } catch (err) {
      console.warn('Failed to focus map on resumed session center', err);
    }
    return false;
  };

  const normalizeSessionTrackerIds = (value) => {
    const raw = Array.isArray(value)
      ? value
      : Array.isArray(value?.trackerIds)
        ? value.trackerIds
        : Array.isArray(value?.trackers)
          ? value.trackers
          : [];
    const ids = new Set();
    raw.forEach((entry) => {
      const trimmed = String(entry || '').trim();
      if (trimmed) ids.add(trimmed);
    });
    return Array.from(ids);
  };

  const replaceTeamsSessionTrackerIds = (value) => {
    const next = normalizeSessionTrackerIds(value);
    teamsSessionTrackerIds.clear();
    let added = false;
    next.forEach((id) => {
      registerTeamsSessionTrackerId(id, { updateUI: false, subscribe: false });
      const trimmed = String(id || '').trim();
      if (!trimmed) return;
      if (!trackerStore.has(trimmed)) {
        ensureTeamTracker(trimmed, { skipUpdate: true });
        added = true;
      }
      startTrackerSubscription(trimmed);
    });
    if (added) {
      updateTrackerSource();
      updateTrackerPathSource();
      renderTrackersList();
      updateTrackersPanelState();
      refreshTrackersControlsState();
    } else {
      updateTeamsEmptyState();
    }
  };

  const normalizeTeamsGoToMap = (value) => {
    const result = new Map();
    if (!value) return result;
    if (value instanceof Map) {
      value.forEach((coords, trackerId) => {
        if (!coords) return;
        const lng = Number(coords.longitude);
        const lat = Number(coords.latitude);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        result.set(String(trackerId), { longitude: lng, latitude: lat });
      });
      return result;
    }
    const raw = unwrapFirestoreFields(value);
    if (!raw || typeof raw !== 'object') return result;
    Object.entries(raw).forEach(([trackerId, entry]) => {
      const coords = extractCoordsPayload(entry);
      if (!coords || !Number.isFinite(coords.longitude) || !Number.isFinite(coords.latitude)) return;
      result.set(String(trackerId), { longitude: coords.longitude, latitude: coords.latitude });
    });
    return result;
  };

  const replaceTeamsSessionGoTo = (value) => {
    trackerGoToLocations.clear();
    const next = normalizeTeamsGoToMap(value);
    next.forEach((coords, trackerId) => trackerGoToLocations.set(trackerId, coords));
    updateTrackerGoToSource();
  };

  const clearTeamsSessionSubscription = () => {
    if (!teamsSessionSubscription) {
      teamsSessionSubscriptionId = null;
      return;
    }
    const unsubscribe = teamsSessionSubscription;
    teamsSessionSubscription = null;
    teamsSessionSubscriptionId = null;
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (typeof unsubscribe === 'string') {
        const sdkInfo = resolveFirebaseSdk();
        if (sdkInfo?.type === 'modular' && typeof sdkInfo.sdk?.unsubscribe === 'function') {
          sdkInfo.sdk.unsubscribe(unsubscribe);
        }
      }
    } catch {}
  };

  const clearTeamsSessionTrackersSubscription = () => {
    if (!teamsSessionTrackersSubscription) {
      teamsSessionTrackersSubscriptionId = null;
      return;
    }
    const unsubscribe = teamsSessionTrackersSubscription;
    teamsSessionTrackersSubscription = null;
    teamsSessionTrackersSubscriptionId = null;
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (typeof unsubscribe === 'string') {
        const sdkInfo = resolveFirebaseSdk();
        if (sdkInfo?.type === 'modular' && typeof sdkInfo.sdk?.unsubscribe === 'function') {
          sdkInfo.sdk.unsubscribe(unsubscribe);
        }
      }
    } catch {}
  };

  const startTeamsSessionTrackersSubscription = (sessionId) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return false;
    if (teamsSessionTrackersSubscription && teamsSessionTrackersSubscriptionId === trimmed) return true;
    clearTeamsSessionTrackersSubscription();
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    let unsubscribe = null;
    try {
      const handleSnapshot = (snapshot) => {
        if (!snapshot) return;
        if (teamsSessionId !== trimmed) return;
        let added = false;
        snapshot.forEach((docSnap) => {
          if (!docSnap) return;
          const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
          const docId = String(docSnap.id || data?.id || '').trim();
          if (!docId) return;
          const wasKnown = trackerStore.has(docId);
          registerTeamsSessionTrackerId(docId, { updateUI: false, subscribe: false });
          ensureTeamTracker(docId, { skipUpdate: true });
          startTrackerSubscription(docId);
          if (!wasKnown) added = true;
          const profile = extractProfilePayload(data || {});
          if (profile) applyTrackerProfileUpdate(docId, profile);
          const coords = extractCoordsPayload(data || {});
          if (coords) applyTrackerCoordsUpdate(docId, coords);
        });
        if (added) {
          updateTrackerSource();
          updateTrackerPathSource();
          renderTrackersList();
          updateTrackersPanelState();
          refreshTrackersControlsState();
        } else {
          updateTeamsEmptyState();
        }
      };
      const handleError = (err) => {
        console.warn('Firestore trackers subscription failed', trimmed, err);
        clearTeamsSessionTrackersSubscription();
      };
      if (sdkInfo.type === 'compat') {
        if (typeof db.collection !== 'function') return false;
        const colRef = db.collection('sessions').doc(trimmed).collection('trackers');
        unsubscribe = colRef.onSnapshot(handleSnapshot, handleError);
      } else {
        const { collection, onSnapshot } = sdkInfo.sdk || {};
        if (typeof collection !== 'function' || typeof onSnapshot !== 'function') {
          console.warn('Firebase modular SDK missing collection/onSnapshot');
          return false;
        }
        const colRef = collection(db, 'sessions', trimmed, 'trackers');
        unsubscribe = onSnapshot(colRef, handleSnapshot, handleError);
      }
    } catch (err) {
      console.warn('Failed to subscribe to session trackers', trimmed, err);
    }
    if (typeof unsubscribe === 'function' || typeof unsubscribe === 'string') {
      teamsSessionTrackersSubscription = unsubscribe;
      teamsSessionTrackersSubscriptionId = trimmed;
      return true;
    }
    return false;
  };

  const startTeamsSessionSubscription = (sessionId) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return false;
    if (teamsSessionSubscription && teamsSessionSubscriptionId === trimmed) return true;
    clearTeamsSessionSubscription();
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    let unsubscribe = null;
    try {
      const handleSnapshot = (snapshot) => {
        if (!snapshot) return;
        const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
        if (exists === false) return;
        if (teamsSessionId !== trimmed) return;
        const data = typeof snapshot.data === 'function' ? snapshot.data() : snapshot.data;
        replaceTeamsSessionGoTo(data?.goTo);
      };
      const handleError = (err) => {
        console.warn('Firestore session subscription failed', trimmed, err);
        clearTeamsSessionSubscription();
      };
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc !== 'function') return false;
        const docRef = db.doc(`sessions/${trimmed}`);
        unsubscribe = docRef.onSnapshot(handleSnapshot, handleError);
      } else {
        const { doc, onSnapshot } = sdkInfo.sdk || {};
        if (typeof doc !== 'function' || typeof onSnapshot !== 'function') {
          console.warn('Firebase modular SDK missing doc/onSnapshot');
          return false;
        }
        const docRef = doc(db, 'sessions', trimmed);
        unsubscribe = onSnapshot(docRef, handleSnapshot, handleError);
      }
    } catch (err) {
      console.warn('Failed to subscribe to session updates', trimmed, err);
    }
    if (typeof unsubscribe === 'function' || typeof unsubscribe === 'string') {
      teamsSessionSubscription = unsubscribe;
      teamsSessionSubscriptionId = trimmed;
      return true;
    }
    return false;
  };

  const registerTeamsSessionTrackerId = (trackerId, { updateUI = true, subscribe = true } = {}) => {
    if (!teamsSessionId) return;
    const trimmed = String(trackerId || '').trim();
    if (!trimmed || teamsSessionTrackerIds.has(trimmed)) return;
    teamsSessionTrackerIds.add(trimmed);
    if (subscribe) startTrackerSubscription(trimmed);
    if (updateUI) updateTeamsEmptyState();
  };

  const getTeamMemberDisabledReason = () => {
    if (!firebaseAdminCredentialsReady) {
      return t('teams.addMemberRequiresAdmin', 'Load Firebase Admin credentials to add team members.');
    }
    if (teamMemberQrInFlight) {
      return t('teams.memberModal.generating', 'Generating secure QR code...');
    }
    return '';
  };

  const updateTeamMemberActionsState = () => {
    const hasSession = !!teamsSessionId;
    const disabledReason = getTeamMemberDisabledReason();
    const canAdd = hasSession && !disabledReason;
    if (teamsAddBtn) {
      teamsAddBtn.hidden = !hasSession;
      teamsAddBtn.disabled = !canAdd;
      teamsAddBtn.setAttribute('aria-disabled', String(!canAdd));
      if (!canAdd && hasSession && disabledReason) {
        teamsAddBtn.title = disabledReason;
        teamsAddBtn.setAttribute('aria-label', disabledReason);
      } else {
        teamsAddBtn.removeAttribute('title');
        teamsAddBtn.removeAttribute('aria-label');
      }
    }
    const qrDisabled = !firebaseAdminCredentialsReady || teamMemberQrInFlight;
    const qrReason = !firebaseAdminCredentialsReady
      ? t('teams.addMemberRequiresAdmin', 'Load Firebase Admin credentials to add team members.')
      : (teamMemberQrInFlight ? t('teams.memberModal.generating', 'Generating secure QR code...') : '');
    document.querySelectorAll('.tracker-action.tracker-qr').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = qrDisabled;
      btn.classList.toggle('is-disabled', qrDisabled);
      btn.setAttribute('aria-disabled', String(qrDisabled));
      if (qrDisabled && qrReason) {
        btn.title = qrReason;
        btn.setAttribute('aria-label', qrReason);
      } else {
        const defaultTitle = btn.dataset.defaultTitle;
        const defaultLabel = btn.dataset.defaultAriaLabel;
        if (defaultTitle) btn.title = defaultTitle;
        else btn.removeAttribute('title');
        if (defaultLabel) btn.setAttribute('aria-label', defaultLabel);
        else btn.removeAttribute('aria-label');
      }
    });
  };

  const updateTeamsEmptyState = () => {
    if (!teamsEmptyState || !teamsEmptyTitle || !teamsEmptySubtitle) return;
    const listEl = trackersItems || q('#trackersItems');
    const listHasItems = !!(listEl && listEl.children && listEl.children.length > 0);
    const listHasTrackers = !!(listEl && listEl.querySelector && listEl.querySelector('.tracker-row'));
    const hasSessionTrackers = teamsSessionTrackerIds.size > 0;
    const hasTrackers = trackerStore.size > 0 || listHasTrackers || listHasItems || hasSessionTrackers;
    const hasSession = !!teamsSessionId;
    const hasPendingFirstMember = !hasTrackers && hasSession && !!pendingTeamMemberTrackerId;
    teamsEmptyState.hidden = hasTrackers || hasPendingFirstMember;
    if (teamsEmptyActions) teamsEmptyActions.hidden = hasSession;
    if (hasSession) {
      bindText(teamsEmptyTitle, 'teams.emptyActiveTitle', 'No team members yet');
      if (!firebaseAdminCredentialsReady) {
        bindText(teamsEmptySubtitle, 'teams.emptyActiveNeedsAdmin', 'Load Firebase Admin credentials to add members.');
      } else {
        bindText(teamsEmptySubtitle, 'teams.emptyActiveSubtitle', 'Add a member to start tracking.');
      }
    } else {
      bindText(teamsEmptyTitle, 'teams.emptyTitle', 'No active session');
      bindText(teamsEmptySubtitle, 'teams.emptySubtitle', 'Start or resume a session to track team members.');
    }
  };

  const updateMapSessionOverlay = () => {
    if (!mapSessionOverlay) return;
    const hasSession = !!teamsSessionId;
    mapSessionOverlay.classList.toggle('has-session', hasSession);
    if (mapSessionEmpty) mapSessionEmpty.hidden = hasSession;
    if (mapSessionActive) mapSessionActive.hidden = !hasSession;
    if (mapSessionStartBtn) mapSessionStartBtn.hidden = hasSession;
    if (mapSessionResumeBtn) mapSessionResumeBtn.hidden = hasSession;
    if (mapSessionTitleEl) {
      mapSessionTitleEl.disabled = !hasSession;
      mapSessionTitleEl.setAttribute('aria-disabled', String(!hasSession));
      if (!hasSession) {
        mapSessionTitleEl.textContent = '';
        mapSessionTitleEl.removeAttribute('title');
        mapSessionTitleEl.removeAttribute('aria-label');
        delete mapSessionTitleEl.dataset.i18n;
      } else {
        const title = typeof teamsSessionInfo?.title === 'string' ? teamsSessionInfo.title.trim() : '';
        if (title) {
          delete mapSessionTitleEl.dataset.i18n;
          const formatted = formatOverlaySessionTitle(title);
          mapSessionTitleEl.textContent = formatted.text;
          if (formatted.truncated) {
            mapSessionTitleEl.title = formatted.full;
            mapSessionTitleEl.setAttribute('aria-label', formatted.full);
          } else {
            mapSessionTitleEl.removeAttribute('title');
            mapSessionTitleEl.removeAttribute('aria-label');
          }
        } else {
          mapSessionTitleEl.dataset.i18n = 'teams.sessionTitleFallback';
          const fallback = t('teams.sessionTitleFallback', 'Untitled session');
          const formatted = formatOverlaySessionTitle(fallback);
          mapSessionTitleEl.textContent = formatted.text;
          if (formatted.truncated) {
            mapSessionTitleEl.title = formatted.full;
            mapSessionTitleEl.setAttribute('aria-label', formatted.full);
          } else {
            mapSessionTitleEl.removeAttribute('title');
            mapSessionTitleEl.removeAttribute('aria-label');
          }
        }
      }
    }
    if (mapSessionIdEl) {
      mapSessionIdEl.textContent = hasSession ? teamsSessionId : '—';
    }
  };

  function updateTeamsSessionUI() {
    const hasSession = !!teamsSessionId;
    if (teamsSessionIdEl) teamsSessionIdEl.textContent = hasSession ? teamsSessionId : '—';
    if (teamsSessionTitleEl) {
      if (!hasSession) {
        teamsSessionTitleEl.dataset.i18n = 'teams.noActiveSession';
        teamsSessionTitleEl.textContent = t('teams.noActiveSession', 'No active session');
      } else if (teamsSessionInfo?.title) {
        delete teamsSessionTitleEl.dataset.i18n;
        teamsSessionTitleEl.textContent = teamsSessionInfo.title;
      } else {
        teamsSessionTitleEl.dataset.i18n = 'teams.sessionTitleFallback';
        teamsSessionTitleEl.textContent = t('teams.sessionTitleFallback', 'Untitled session');
      }
    }
    updateTeamMemberActionsState();
    if (teamsStartSessionBtn) teamsStartSessionBtn.hidden = hasSession;
    if (teamsResumeSessionBtn) teamsResumeSessionBtn.hidden = hasSession;
    updateTeamsEmptyState();
    updateMapSessionOverlay();
    updateSessionActionsModalState();
  }

  const updateSessionActionsModalState = () => {
    const hasSession = !!teamsSessionId;
    if (teamsSessionActionsId) teamsSessionActionsId.textContent = hasSession ? teamsSessionId : '—';
    const renameDisabled = !hasSession || teamsSessionTitleUpdateInFlight;
    if (teamsSessionRenameInput) {
      teamsSessionRenameInput.disabled = renameDisabled;
      teamsSessionRenameInput.setAttribute('aria-disabled', String(renameDisabled));
    }
    if (teamsSessionRenameSubmit) {
      teamsSessionRenameSubmit.disabled = renameDisabled;
      teamsSessionRenameSubmit.setAttribute('aria-disabled', String(renameDisabled));
    }
    const stopped = !!teamsSessionInfo?.endDate;
    const stopDisabled = !hasSession || teamsSessionEndInFlight || stopped;
    if (teamsSessionStopAction) {
      teamsSessionStopAction.disabled = stopDisabled;
      teamsSessionStopAction.setAttribute('aria-disabled', String(stopDisabled));
    }
    if (teamsSessionCloseAction) {
      const closeDisabled = !hasSession;
      teamsSessionCloseAction.disabled = closeDisabled;
      teamsSessionCloseAction.setAttribute('aria-disabled', String(closeDisabled));
    }
  };

  const openTeamsSessionActionsModal = () => {
    if (!teamsSessionActionsModal || !teamsSessionId) return;
    if (teamsSessionRenameInput) {
      const currentTitle = typeof teamsSessionInfo?.title === 'string' ? teamsSessionInfo.title.trim() : '';
      teamsSessionRenameInput.value = currentTitle;
    }
    updateSessionActionsModalState();
    teamsSessionActionsModal.hidden = false;
    teamsSessionActionsModal.setAttribute('aria-hidden', 'false');
    try {
      teamsSessionRenameInput?.focus();
      teamsSessionRenameInput?.select();
    } catch {}
  };

  const closeTeamsSessionActionsModal = () => {
    if (!teamsSessionActionsModal) return;
    teamsSessionActionsModal.hidden = true;
    teamsSessionActionsModal.setAttribute('aria-hidden', 'true');
  };

  const handleTeamsSessionRenameSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!teamsSessionId || !teamsSessionRenameInput) return;
    const nextTitle = String(teamsSessionRenameInput.value || '').trim();
    if (!nextTitle) {
      showToast(t('teams.sessionTitleRequired', 'Please enter a session title.'), 'error');
      try { teamsSessionRenameInput.focus(); } catch {}
      return;
    }
    teamsSessionRenameInput.value = nextTitle;
    const currentTitle = typeof teamsSessionInfo?.title === 'string' ? teamsSessionInfo.title.trim() : '';
    if (nextTitle === currentTitle || teamsSessionTitleUpdateInFlight) {
      if (teamsSessionRenameInput) teamsSessionRenameInput.value = currentTitle || nextTitle;
      return;
    }
    teamsSessionTitleUpdateInFlight = true;
    updateSessionActionsModalState();
    try {
      const ok = await writeTeamsSessionDocument(teamsSessionId, { title: nextTitle });
      if (!ok) {
        showToast(t('teams.sessionTitleUpdateFailed', 'Unable to update session title. Check Firebase settings.'), 'error');
        if (teamsSessionRenameInput) teamsSessionRenameInput.value = currentTitle;
        return;
      }
      if (!teamsSessionInfo || typeof teamsSessionInfo !== 'object') {
        teamsSessionInfo = { id: teamsSessionId, title: nextTitle, startDate: null, endDate: null, coordinates: null };
      } else {
        teamsSessionInfo.title = nextTitle;
      }
      updateTeamsSessionUI();
    } finally {
      teamsSessionTitleUpdateInFlight = false;
      updateSessionActionsModalState();
    }
  };

  const setTeamsSessionState = (session, { skipFeaturesSync = false } = {}) => {
    if (session && typeof session === 'object') {
      const title = typeof session.title === 'string' ? session.title.trim() : '';
      teamsSessionInfo = {
        id: session.id,
        title,
        startDate: session.startDate || null,
        endDate: session.endDate || null,
        coordinates: session.coordinates || null
      };
      teamsSessionId = session.id || null;
      replaceTeamsSessionTrackerIds(session);
      replaceTeamsSessionGoTo(session.goTo);
    } else {
      teamsSessionInfo = null;
      teamsSessionId = null;
      teamsSessionTrackerIds.clear();
      replaceTeamsSessionGoTo(null);
    }
    updateTeamsSessionUI();
    if (teamsSessionId) {
      startTeamsSessionSubscription(teamsSessionId);
      startTeamsSessionTrackersSubscription(teamsSessionId);
      if (!skipFeaturesSync) {
        requestFirestoreFeaturesSync(0);
      }
    } else {
      clearTeamsSessionSubscription();
      clearTeamsSessionTrackersSubscription();
    }
  };

  const resetTeamsSessionData = () => {
    teamsSessionTrackerIds.clear();
    clearTeamsSessionTrackersSubscription();
    trackerStore.clear();
    trackerPositionsStore.clear();
    trackerGoToLocations.clear();
    clearActiveTrackerGoTo({ skipToolReset: true });
    trackerAutoReveal.clear();
    trackerSubscriptions.forEach((entry) => {
      safeUnsubscribe(entry?.unsubscribe);
      if (entry?.trackUnsubscribes instanceof Map) {
        entry.trackUnsubscribes.forEach((unsub) => safeUnsubscribe(unsub));
        entry.trackUnsubscribes.clear();
      }
    });
    trackerSubscriptions.clear();
    trackerSubscriptionRetries.forEach((entry) => {
      if (entry?.timer) clearTimeout(entry.timer);
    });
    trackerSubscriptionRetries.clear();
    pendingTeamMemberTrackerId = null;
    try { closeTeamMemberModal(); } catch {}
    resetTrackersRecordingData();
    trackersRecordingState.active = false;
    trackersRecordingHasData = false;
    try { updateTrackerSource(); } catch {}
    try { updateTrackerPathSource(); } catch {}
    try { updateTrackerGoToSource(); } catch {}
    renderTrackersList();
    updateTrackersPanelState();
  };

  const getFirestoreHandle = ({ warn = true } = {}) => {
    const sdkInfo = resolveFirebaseSdk();
    const db = firestoreInstance || initFirestoreConnection();
    if (!sdkInfo || !db) {
      if (warn && !firestoreUnavailableToasted) {
        firestoreUnavailableToasted = true;
        showToast(t('teams.firestoreUnavailable', 'Firestore is not available. Check Firebase settings.'), 'error');
      }
      return null;
    }
    return { sdkInfo, db };
  };

  const buildSessionPayload = ({ title, coordinates, startDate, endDate, trackerIds } = {}) => ({
    startDate: startDate instanceof Date ? startDate : new Date(),
    endDate: endDate instanceof Date ? endDate : null,
    title: title ? title : null,
    coordinates: coordinates || null,
    trackerIds: Array.isArray(trackerIds) ? trackerIds : []
  });

  const appendTrackerToSessionDocument = async (trackerId) => {
    const trimmedTrackerId = String(trackerId || '').trim();
    const trimmedSessionId = String(teamsSessionId || '').trim();
    if (!trimmedTrackerId || !trimmedSessionId) return false;
    registerTeamsSessionTrackerId(trimmedTrackerId);
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    try {
      if (sdkInfo.type === 'compat') {
        const fieldValue = sdkInfo.sdk?.firestore?.FieldValue;
        if (fieldValue && typeof fieldValue.arrayUnion === 'function' && typeof db.doc === 'function') {
          const docRef = db.doc(`sessions/${trimmedSessionId}`);
          await docRef.set({ trackerIds: fieldValue.arrayUnion(trimmedTrackerId) }, { merge: true });
          return true;
        }
      } else {
        const { doc, setDoc, arrayUnion } = sdkInfo.sdk || {};
        if (typeof doc === 'function' && typeof setDoc === 'function' && typeof arrayUnion === 'function') {
          const docRef = doc(db, 'sessions', trimmedSessionId);
          await setDoc(docRef, { trackerIds: arrayUnion(trimmedTrackerId) }, { merge: true });
          return true;
        }
      }
      const existing = await fetchTeamsSessionDocument(trimmedSessionId);
      if (!existing.ok) return false;
      const current = Array.isArray(existing.data?.trackerIds)
        ? existing.data.trackerIds
        : Array.isArray(existing.data?.trackers) ? existing.data.trackers : [];
      const next = current.includes(trimmedTrackerId) ? current.slice() : current.concat(trimmedTrackerId);
      return await writeTeamsSessionDocument(trimmedSessionId, { trackerIds: next });
    } catch (err) {
      console.warn('Failed to append tracker to session document', trimmedSessionId, trimmedTrackerId, err);
      return false;
    }
  };

  const removeTrackerFromSessionDocument = async (trackerId) => {
    const trimmedTrackerId = String(trackerId || '').trim();
    const trimmedSessionId = String(teamsSessionId || '').trim();
    if (!trimmedTrackerId || !trimmedSessionId) return false;
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    try {
      if (sdkInfo.type === 'compat') {
        const fieldValue = sdkInfo.sdk?.firestore?.FieldValue;
        if (fieldValue && typeof fieldValue.arrayRemove === 'function' && typeof db.doc === 'function') {
          const docRef = db.doc(`sessions/${trimmedSessionId}`);
          await docRef.set({ trackerIds: fieldValue.arrayRemove(trimmedTrackerId) }, { merge: true });
          return true;
        }
      } else {
        const { doc, setDoc, arrayRemove } = sdkInfo.sdk || {};
        if (typeof doc === 'function' && typeof setDoc === 'function' && typeof arrayRemove === 'function') {
          const docRef = doc(db, 'sessions', trimmedSessionId);
          await setDoc(docRef, { trackerIds: arrayRemove(trimmedTrackerId) }, { merge: true });
          return true;
        }
      }
      const existing = await fetchTeamsSessionDocument(trimmedSessionId);
      if (!existing.ok) return false;
      const current = Array.isArray(existing.data?.trackerIds)
        ? existing.data.trackerIds
        : Array.isArray(existing.data?.trackers) ? existing.data.trackers : [];
      const next = current.filter((entry) => String(entry || '').trim() !== trimmedTrackerId);
      return await writeTeamsSessionDocument(trimmedSessionId, { trackerIds: next });
    } catch (err) {
      console.warn('Failed to remove tracker from session document', trimmedSessionId, trimmedTrackerId, err);
      return false;
    }
  };

  const deleteTeamTrackerDocument = async (trackerId) => {
    const trimmedTrackerId = String(trackerId || '').trim();
    const trimmedSessionId = String(teamsSessionId || '').trim();
    if (!trimmedTrackerId || !trimmedSessionId) return false;
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    try {
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc !== 'function') return false;
        const docRef = db.doc(`sessions/${trimmedSessionId}/trackers/${trimmedTrackerId}`);
        await docRef.delete();
        return true;
      }
      const { doc, deleteDoc } = sdkInfo.sdk || {};
      if (typeof doc !== 'function' || typeof deleteDoc !== 'function') return false;
      const docRef = doc(db, 'sessions', trimmedSessionId, 'trackers', trimmedTrackerId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('Failed to delete team tracker document', trimmedSessionId, trimmedTrackerId, err);
      return false;
    }
  };

  const writeTeamsSessionDocument = async (sessionId, payload) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return false;
    const handle = getFirestoreHandle();
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    try {
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc !== 'function') {
          console.warn('Firebase compat SDK missing doc().');
          return false;
        }
        const docRef = db.doc(`sessions/${trimmed}`);
        await docRef.set(payload, { merge: true });
      } else {
        const { doc, setDoc } = sdkInfo.sdk || {};
        if (typeof doc !== 'function' || typeof setDoc !== 'function') {
          console.warn('Firebase modular SDK missing doc/setDoc.');
          return false;
        }
        const docRef = doc(db, 'sessions', trimmed);
        await setDoc(docRef, payload, { merge: true });
      }
      return true;
    } catch (err) {
      console.warn('Failed to write team session document', trimmed, err);
      return false;
    }
  };

  const buildTeamsGoToPayload = () => {
    const payload = {};
    trackerGoToLocations.forEach((coords, trackerId) => {
      if (!coords) return;
      const lng = Number(coords.longitude);
      const lat = Number(coords.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      payload[String(trackerId)] = { longitude: lng, latitude: lat };
    });
    return payload;
  };

  const persistTeamsGoToLocations = async () => {
    if (!teamsSessionId) return false;
    const sessionId = String(teamsSessionId || '').trim();
    if (!sessionId) return false;
    const payload = buildTeamsGoToPayload();
    return await writeTeamsSessionDocument(sessionId, { goTo: payload });
  };

  const removeTrackerGoToFromSessionDocument = async (trackerId) => {
    const trimmedTrackerId = String(trackerId || '').trim();
    const trimmedSessionId = String(teamsSessionId || '').trim();
    if (!trimmedTrackerId || !trimmedSessionId) return false;
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    const fieldPath = `goTo.${trimmedTrackerId}`;
    try {
      if (sdkInfo.type === 'compat') {
        const fieldValue = sdkInfo.sdk?.firestore?.FieldValue;
        if (fieldValue && typeof fieldValue.delete === 'function' && typeof db.doc === 'function') {
          const docRef = db.doc(`sessions/${trimmedSessionId}`);
          if (typeof docRef.update === 'function') {
            await docRef.update({ [fieldPath]: fieldValue.delete() });
          } else {
            await docRef.set({ [fieldPath]: fieldValue.delete() }, { merge: true });
          }
          return true;
        }
      } else {
        const { doc, updateDoc, deleteField } = sdkInfo.sdk || {};
        if (typeof doc === 'function' && typeof updateDoc === 'function' && typeof deleteField === 'function') {
          const docRef = doc(db, 'sessions', trimmedSessionId);
          await updateDoc(docRef, { [fieldPath]: deleteField() });
          return true;
        }
      }
      const existing = await fetchTeamsSessionDocument(trimmedSessionId);
      if (!existing.ok) return false;
      const nextMap = normalizeTeamsGoToMap(existing.data?.goTo);
      nextMap.delete(trimmedTrackerId);
      const payload = {};
      nextMap.forEach((coords, id) => {
        if (!coords) return;
        const lng = Number(coords.longitude);
        const lat = Number(coords.latitude);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        payload[String(id)] = { longitude: lng, latitude: lat };
      });
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc === 'function') {
          const docRef = db.doc(`sessions/${trimmedSessionId}`);
          if (typeof docRef.update === 'function') {
            await docRef.update({ goTo: payload });
            return true;
          }
          if (typeof docRef.set === 'function') {
            await docRef.set({ goTo: payload }, { mergeFields: ['goTo'] });
            return true;
          }
        }
      } else {
        const { doc, updateDoc, setDoc } = sdkInfo.sdk || {};
        if (typeof doc === 'function' && typeof updateDoc === 'function') {
          const docRef = doc(db, 'sessions', trimmedSessionId);
          await updateDoc(docRef, { goTo: payload });
          return true;
        }
        if (typeof doc === 'function' && typeof setDoc === 'function') {
          const docRef = doc(db, 'sessions', trimmedSessionId);
          await setDoc(docRef, { goTo: payload }, { mergeFields: ['goTo'] });
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('Failed to remove go-to from session document', trimmedSessionId, trimmedTrackerId, err);
      return false;
    }
  };

  const setTrackerGoToLocation = async (trackerId, coords) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed || !coords) return false;
    const lng = Number(coords.longitude);
    const lat = Number(coords.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    trackerGoToLocations.set(trimmed, { longitude: lng, latitude: lat });
    const current = trackerStore.get(trimmed);
    if (current && Number.isFinite(current.longitude) && Number.isFinite(current.latitude)) {
      maybeAutoClearTrackerGoTo(trimmed, current, { skipUpdate: true, skipPersist: true });
    }
    updateTrackerGoToSource();
    const ok = await persistTeamsGoToLocations();
    if (!ok && teamsSessionId) {
      console.warn('Failed to persist go-to location', trimmed);
    }
    return ok;
  };

  const clearTrackerGoToLocation = async (trackerId) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return false;
    if (!trackerGoToLocations.has(trimmed)) return false;
    trackerGoToLocations.delete(trimmed);
    updateTrackerGoToSource();
    const ok = await removeTrackerGoToFromSessionDocument(trimmed);
    if (!ok && teamsSessionId) {
      console.warn('Failed to persist go-to removal', trimmed);
    }
    return ok;
  };

  const fetchTeamsSessionDocument = async (sessionId) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return { ok: false, reason: 'missing' };
    const handle = getFirestoreHandle();
    if (!handle) return { ok: false, reason: 'firestore' };
    const { sdkInfo, db } = handle;
    try {
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc !== 'function') {
          console.warn('Firebase compat SDK missing doc().');
          return { ok: false, reason: 'sdk' };
        }
        const docRef = db.doc(`sessions/${trimmed}`);
        const snap = await docRef.get();
        const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
        if (!exists) return { ok: false, reason: 'not-found' };
        const data = typeof snap.data === 'function' ? snap.data() : snap.data;
        return { ok: true, data: data || {} };
      }
      const { doc, getDoc } = sdkInfo.sdk || {};
      if (typeof doc !== 'function' || typeof getDoc !== 'function') {
        console.warn('Firebase modular SDK missing doc/getDoc.');
        return { ok: false, reason: 'sdk' };
      }
      const docRef = doc(db, 'sessions', trimmed);
      const snap = await getDoc(docRef);
      const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
      if (!exists) return { ok: false, reason: 'not-found' };
      const data = typeof snap.data === 'function' ? snap.data() : snap.data;
      return { ok: true, data: data || {} };
    } catch (err) {
      console.warn('Failed to fetch team session document', trimmed, err);
      return { ok: false, reason: 'error', error: err };
    }
  };

  const extractSessionFeatures = (data) => {
    if (!data || typeof data !== 'object') return [];
    const candidates = [
      data.features,
      data.data?.features,
      data.data?.data?.features,
      data.featureCollection,
      data.data?.featureCollection
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (Array.isArray(candidate)) return candidate;
      if (candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)) {
        return candidate.features;
      }
      if (Array.isArray(candidate.features)) return candidate.features;
      if (candidate.features && candidate.features.type === 'FeatureCollection' && Array.isArray(candidate.features.features)) {
        return candidate.features.features;
      }
    }
    return [];
  };

  const cloneSessionFeature = (feature) => {
    try {
      return JSON.parse(JSON.stringify(feature));
    } catch {
      return feature;
    }
  };

  const normalizeSessionFeature = (feature, existingIds, existingEndpoints) => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) return null;
    const clone = cloneSessionFeature(feature);
    const restored = reviveNestedArrayStrings(clone);
    restored.properties = { ...(restored.properties || {}) };
    const geomType = restored.geometry?.type;
    if (!restored.properties.kind) {
      if (geomType === 'Polygon') restored.properties.kind = 'polygon';
      else if (geomType === 'LineString') restored.properties.kind = 'line';
      else if (geomType === 'Point') restored.properties.kind = 'poi';
    }
    if (!restored.properties.color) {
      restored.properties.color = (typeof nextColor === 'function') ? nextColor() : '#1565C0';
    }
    const rawId = typeof restored.properties.id === 'string' ? restored.properties.id.trim() : '';
    if (rawId && existingIds.has(rawId)) return null;
    const relatedLineId = restored.properties.relatedLineId || restored.properties.related_line_id;
    const kind = restored.properties.kind;
    const isEndpoint = restored.properties.isLineEndpoint === true || kind === 'line-start' || kind === 'line-end';
    if (isEndpoint && relatedLineId && kind) {
      const key = `${relatedLineId}:${kind}`;
      if (existingEndpoints.has(key)) return null;
      existingEndpoints.add(key);
    }
    let finalId = rawId;
    if (!finalId || existingIds.has(finalId)) {
      const generateId = () => (typeof newId === 'function')
        ? newId()
        : `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      do { finalId = generateId(); } while (existingIds.has(finalId));
      restored.properties.id = finalId;
    }
    existingIds.add(finalId);
    return restored;
  };

  const applySessionFeaturesFromDoc = (data, { mode = 'auto' } = {}) => {
    const features = extractSessionFeatures(data);
    if (!features.length) return { ok: false, reason: 'empty', total: 0 };
    let storeRef = null;
    try { storeRef = (window)._drawStore || drawStore; } catch { storeRef = null; }
    if (!storeRef || !Array.isArray(storeRef.features)) return { ok: false, reason: 'store', total: features.length };

    const hasExisting = storeRef.features.some((feature) => feature && !feature?.properties?.isLineEndpoint);
    const replace = mode === 'replace' ? true : mode === 'merge' ? false : !hasExisting;

    const existingIds = new Set();
    const existingEndpoints = new Set();
    if (!replace) {
      storeRef.features.forEach((feature) => {
        const id = feature?.properties?.id;
        if (id) existingIds.add(String(id));
        const kind = feature?.properties?.kind;
        const relatedLineId = feature?.properties?.relatedLineId || feature?.properties?.related_line_id;
        const isEndpoint = feature?.properties?.isLineEndpoint === true || kind === 'line-start' || kind === 'line-end';
        if (isEndpoint && relatedLineId && kind) {
          existingEndpoints.add(`${relatedLineId}:${kind}`);
        }
      });
    }

    if (replace) storeRef.features = [];

    const added = [];
    features.forEach((feature) => {
      const normalized = normalizeSessionFeature(feature, existingIds, existingEndpoints);
      if (normalized) added.push(normalized);
    });

    if (!added.length) return { ok: false, reason: 'no-new', total: features.length, mode: replace ? 'replace' : 'merge' };
    added.forEach((feature) => storeRef.features.push(feature));

    let refreshed = false;
    try {
      if (typeof refreshDraw === 'function') {
        refreshDraw();
        refreshed = true;
      }
    } catch {}
    if (!refreshed) {
      try {
        if (typeof window._refreshDraw === 'function') {
          window._refreshDraw();
          refreshed = true;
        }
      } catch {}
    }
    if (!refreshed) {
      try { if (typeof updateDrawingsPanel === 'function') updateDrawingsPanel(); } catch {}
    }
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}

    return { ok: true, added: added.length, total: features.length, mode: replace ? 'replace' : 'merge' };
  };

  const buildSessionStateFromDoc = (sessionId, data) => {
    const title = typeof data?.title === 'string' ? data.title.trim() : '';
    const startDate = normalizeSessionDate(data?.startDate);
    const endDate = normalizeSessionDate(data?.endDate);
    const coordinates = normalizeSessionCoordinates(data?.coordinates);
    const trackerIds = normalizeSessionTrackerIds(data);
    const goTo = normalizeTeamsGoToMap(data?.goTo);
    return {
      id: sessionId,
      title,
      startDate,
      endDate,
      coordinates,
      trackerIds,
      goTo
    };
  };

  let teamsStartSessionInFlight = false;
  let teamsResumeSessionInFlight = false;
  let teamsDeleteSessionInFlight = false;
  let teamsDeleteSessionTargetId = null;
  let teamsDeleteSessionTargetTitle = '';
  let teamsLoadSessionInFlight = false;

  const formatSessionDateTime = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
    try {
      return value.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return value.toLocaleString();
    }
  };

  const formatSessionStartDateText = (value) => {
    if (!value) return t('teams.loadSessionModal.unknownDate', 'Unknown');
    const formatted = formatSessionDateTime(value);
    return formatted || t('teams.loadSessionModal.unknownDate', 'Unknown');
  };

  const formatSessionEndDateText = (value) => {
    if (!value) return t('teams.loadSessionModal.active', 'Active');
    const formatted = formatSessionDateTime(value);
    return formatted || t('teams.loadSessionModal.active', 'Active');
  };

  const setTeamsLoadSessionStatus = (key, fallback) => {
    if (!teamsLoadSessionStatus) return;
    if (!key) {
      teamsLoadSessionStatus.hidden = true;
      return;
    }
    teamsLoadSessionStatus.hidden = false;
    teamsLoadSessionStatus.textContent = t(key, fallback);
  };

  const setTeamsDeleteSessionStatus = (key, fallback) => {
    if (!teamsDeleteSessionStatus) return;
    if (!key) {
      teamsDeleteSessionStatus.hidden = true;
      teamsDeleteSessionStatus.textContent = '';
      return;
    }
    teamsDeleteSessionStatus.hidden = false;
    teamsDeleteSessionStatus.textContent = t(key, fallback);
  };

  const setTeamsLoadSessionBusy = (busy) => {
    if (!teamsLoadSessionList) return;
    teamsLoadSessionList.classList.toggle('is-busy', !!busy);
    teamsLoadSessionList.setAttribute('aria-busy', String(!!busy));
  };

  const clearTeamsLoadSessionList = () => {
    if (!teamsLoadSessionList) return;
    teamsLoadSessionList.innerHTML = '';
  };

  const fetchTeamsSessionsList = async () => {
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return { ok: false, reason: 'firestore' };
    const { sdkInfo, db } = handle;
    try {
      const items = [];
      if (sdkInfo.type === 'compat') {
        if (typeof db.collection !== 'function') return { ok: false, reason: 'sdk' };
        let ref = db.collection('sessions');
        if (typeof ref.orderBy === 'function') {
          ref = ref.orderBy('startDate', 'desc');
        }
        const snap = await ref.get();
        snap.forEach((doc) => {
          const data = typeof doc.data === 'function' ? doc.data() : doc.data;
          items.push({ id: doc.id, data: data || {} });
        });
      } else {
        const { collection, getDocs, query, orderBy } = sdkInfo.sdk || {};
        if (typeof collection !== 'function' || typeof getDocs !== 'function') return { ok: false, reason: 'sdk' };
        const colRef = collection(db, 'sessions');
        let qref = colRef;
        if (typeof query === 'function' && typeof orderBy === 'function') {
          qref = query(colRef, orderBy('startDate', 'desc'));
        }
        const snap = await getDocs(qref);
        snap.forEach((doc) => {
          const data = typeof doc.data === 'function' ? doc.data() : doc.data;
          items.push({ id: doc.id, data: data || {} });
        });
      }
      return { ok: true, items };
    } catch (err) {
      console.warn('Failed to fetch session list', err);
      return { ok: false, reason: 'error', error: err };
    }
  };

  const deleteTeamsSessionSubcollection = async (sessionId, subcollection) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed || !subcollection) return false;
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return false;
    const { sdkInfo, db } = handle;
    try {
      if (sdkInfo.type === 'compat') {
        if (typeof db.collection !== 'function') return false;
        const colRef = db.collection('sessions').doc(trimmed).collection(subcollection);
        const snap = await colRef.get();
        const deletions = [];
        snap.forEach((docSnap) => {
          if (docSnap?.ref && typeof docSnap.ref.delete === 'function') {
            deletions.push(docSnap.ref.delete());
          }
        });
        await Promise.all(deletions);
        return true;
      }
      const { collection, getDocs, deleteDoc } = sdkInfo.sdk || {};
      if (typeof collection !== 'function' || typeof getDocs !== 'function' || typeof deleteDoc !== 'function') return false;
      const colRef = collection(db, 'sessions', trimmed, subcollection);
      const snap = await getDocs(colRef);
      const deletions = [];
      snap.forEach((docSnap) => {
        deletions.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(deletions);
      return true;
    } catch (err) {
      console.warn('Failed to delete session subcollection', trimmed, subcollection, err);
      return false;
    }
  };

  const deleteTeamsSessionById = async (sessionId) => {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return { ok: false, reason: 'missing' };
    const handle = getFirestoreHandle({ warn: false });
    if (!handle) return { ok: false, reason: 'firestore' };
    const { sdkInfo, db } = handle;
    try {
      const subcollections = TEAMS_SESSION_SUBCOLLECTIONS;
      const subResults = await Promise.all(
        subcollections.map((name) => deleteTeamsSessionSubcollection(trimmed, name))
      );
      if (subResults.some((ok) => !ok)) {
        return { ok: false, reason: 'subcollection' };
      }
      if (sdkInfo.type === 'compat') {
        if (typeof db.doc !== 'function') return { ok: false, reason: 'sdk' };
        const docRef = db.doc(`sessions/${trimmed}`);
        if (typeof docRef.delete !== 'function') return { ok: false, reason: 'sdk' };
        await docRef.delete();
        return { ok: true };
      }
      const { doc, deleteDoc } = sdkInfo.sdk || {};
      if (typeof doc !== 'function' || typeof deleteDoc !== 'function') return { ok: false, reason: 'sdk' };
      const docRef = doc(db, 'sessions', trimmed);
      await deleteDoc(docRef);
      return { ok: true };
    } catch (err) {
      console.warn('Failed to delete team session', trimmed, err);
      return { ok: false, reason: 'error', error: err };
    }
  };

  const setFirebaseAdminClearSessionsStatus = (message, { i18nKey = null } = {}) => {
    if (!firebaseAdminClearSessionsStatus) return;
    if (!message) {
      firebaseAdminClearSessionsStatus.hidden = true;
      firebaseAdminClearSessionsStatus.textContent = '';
      return;
    }
    firebaseAdminClearSessionsStatus.hidden = false;
    firebaseAdminClearSessionsStatus.textContent = i18nKey ? t(i18nKey, message) : message;
    if (i18nKey) {
      firebaseAdminClearSessionsStatus.dataset.i18n = i18nKey;
    } else {
      firebaseAdminClearSessionsStatus.dataset.i18n = '';
    }
  };

  const clearAllTeamsSessions = async () => {
    if (!window.firebaseAdmin?.clearSessions) return { ok: false, reason: 'unavailable' };
    const result = await window.firebaseAdmin.clearSessions();
    if (!result || !result.ok) {
      return { ok: false, reason: 'error', error: result?.error };
    }
    return { ok: true, count: result.count || 0 };
  };

  const setFirebaseAdminClearAnonymousUsersStatus = (message, { i18nKey = null } = {}) => {
    if (!firebaseAdminClearAnonymousUsersStatus) return;
    if (!message) {
      firebaseAdminClearAnonymousUsersStatus.hidden = true;
      firebaseAdminClearAnonymousUsersStatus.textContent = '';
      return;
    }
    firebaseAdminClearAnonymousUsersStatus.hidden = false;
    firebaseAdminClearAnonymousUsersStatus.textContent = i18nKey ? t(i18nKey, message) : message;
    if (i18nKey) {
      firebaseAdminClearAnonymousUsersStatus.dataset.i18n = i18nKey;
    } else {
      firebaseAdminClearAnonymousUsersStatus.dataset.i18n = '';
    }
  };

  const clearAllAnonymousUsers = async () => {
    if (!window.firebaseAdmin?.clearAnonymousUsers) return { ok: false, reason: 'unavailable' };
    const result = await window.firebaseAdmin.clearAnonymousUsers();
    if (!result || !result.ok) {
      return { ok: false, reason: 'error', error: result?.error };
    }
    return { ok: true, deleted: result.deleted || 0, failures: result.failures || 0 };
  };

  const openFirebaseAdminClearSessionsModal = () => {
    if (!firebaseAdminClearSessionsModal) return;
    setFirebaseAdminClearSessionsStatus(null);
    if (firebaseAdminClearSessionsConfirm) firebaseAdminClearSessionsConfirm.disabled = false;
    if (firebaseAdminClearSessionsCancel) firebaseAdminClearSessionsCancel.disabled = false;
    firebaseAdminClearSessionsModal.hidden = false;
    firebaseAdminClearSessionsModal.setAttribute('aria-hidden', 'false');
    try { firebaseAdminClearSessionsConfirm?.focus(); } catch {}
  };

  const closeFirebaseAdminClearSessionsModal = () => {
    if (!firebaseAdminClearSessionsModal) return;
    firebaseAdminClearSessionsModal.hidden = true;
    firebaseAdminClearSessionsModal.setAttribute('aria-hidden', 'true');
    setFirebaseAdminClearSessionsStatus(null);
    firebaseAdminClearSessionsInFlight = false;
  };

  const openFirebaseAdminClearAnonymousUsersModal = () => {
    if (!firebaseAdminClearAnonymousUsersModal) return;
    setFirebaseAdminClearAnonymousUsersStatus(null);
    if (firebaseAdminClearAnonymousUsersConfirm) firebaseAdminClearAnonymousUsersConfirm.disabled = false;
    if (firebaseAdminClearAnonymousUsersCancel) firebaseAdminClearAnonymousUsersCancel.disabled = false;
    firebaseAdminClearAnonymousUsersModal.hidden = false;
    firebaseAdminClearAnonymousUsersModal.setAttribute('aria-hidden', 'false');
    try { firebaseAdminClearAnonymousUsersConfirm?.focus(); } catch {}
  };

  const closeFirebaseAdminClearAnonymousUsersModal = () => {
    if (!firebaseAdminClearAnonymousUsersModal) return;
    firebaseAdminClearAnonymousUsersModal.hidden = true;
    firebaseAdminClearAnonymousUsersModal.setAttribute('aria-hidden', 'true');
    setFirebaseAdminClearAnonymousUsersStatus(null);
    firebaseAdminClearAnonymousUsersInFlight = false;
  };

  const handleFirebaseAdminClearSessionsConfirm = async () => {
    if (firebaseAdminClearSessionsInFlight) return;
    firebaseAdminClearSessionsInFlight = true;
    if (firebaseAdminClearSessionsConfirm) firebaseAdminClearSessionsConfirm.disabled = true;
    if (firebaseAdminClearSessionsCancel) firebaseAdminClearSessionsCancel.disabled = true;
    setFirebaseAdminClearSessionsStatus('Deleting sessions...', {
      i18nKey: 'settings.firebaseAdminClearSessionsModal.deleting'
    });
    setTeamsLoadSessionBusy(true);
    try {
      const result = await clearAllTeamsSessions();
      if (!result.ok) {
        const fallback = t('settings.firebaseAdminClearSessionsModal.error', 'Unable to clear sessions. Check Firebase settings.');
        const message = result.error || fallback;
        setFirebaseAdminClearSessionsStatus(message, {
          i18nKey: result.error ? null : 'settings.firebaseAdminClearSessionsModal.error'
        });
        showToast(result.error || t('settings.firebaseAdminClearSessionsModal.errorToast', 'Unable to clear sessions.'), 'error');
        return;
      }
      if (teamsSessionId) {
        resetTeamsSessionData();
        setTeamsSessionState(null);
        clearTeamsSessionMapState({ keepGpx: true });
        closeTeamsSessionActionsModal();
      }
      closeFirebaseAdminClearSessionsModal();
      const clearedMessage = result.count
        ? t('settings.firebaseAdminClearSessionsModal.cleared', 'All sessions cleared.')
        : t('settings.firebaseAdminClearSessionsModal.none', 'No sessions to clear.');
      showToast(clearedMessage);
      await refreshTeamsLoadSessionList();
    } finally {
      firebaseAdminClearSessionsInFlight = false;
      if (firebaseAdminClearSessionsConfirm) firebaseAdminClearSessionsConfirm.disabled = false;
      if (firebaseAdminClearSessionsCancel) firebaseAdminClearSessionsCancel.disabled = false;
      setTeamsLoadSessionBusy(false);
    }
  };

  const handleFirebaseAdminClearAnonymousUsersConfirm = async () => {
    if (firebaseAdminClearAnonymousUsersInFlight) return;
    firebaseAdminClearAnonymousUsersInFlight = true;
    if (firebaseAdminClearAnonymousUsersConfirm) firebaseAdminClearAnonymousUsersConfirm.disabled = true;
    if (firebaseAdminClearAnonymousUsersCancel) firebaseAdminClearAnonymousUsersCancel.disabled = true;
    setFirebaseAdminClearAnonymousUsersStatus('Deleting anonymous users...', {
      i18nKey: 'settings.firebaseAdminClearAnonymousUsersModal.deleting'
    });
    try {
      const result = await clearAllAnonymousUsers();
      if (!result.ok) {
        const fallback = t('settings.firebaseAdminClearAnonymousUsersModal.error', 'Unable to clear anonymous users. Check Firebase settings.');
        const message = result.error || fallback;
        setFirebaseAdminClearAnonymousUsersStatus(message, {
          i18nKey: result.error ? null : 'settings.firebaseAdminClearAnonymousUsersModal.error'
        });
        showToast(result.error || t('settings.firebaseAdminClearAnonymousUsersModal.errorToast', 'Unable to clear anonymous users.'), 'error');
        return;
      }
      closeFirebaseAdminClearAnonymousUsersModal();
      const clearedMessage = result.deleted
        ? t('settings.firebaseAdminClearAnonymousUsersModal.cleared', 'Anonymous users cleared.')
        : t('settings.firebaseAdminClearAnonymousUsersModal.none', 'No anonymous users to clear.');
      showToast(clearedMessage);
    } finally {
      firebaseAdminClearAnonymousUsersInFlight = false;
      if (firebaseAdminClearAnonymousUsersConfirm) firebaseAdminClearAnonymousUsersConfirm.disabled = false;
      if (firebaseAdminClearAnonymousUsersCancel) firebaseAdminClearAnonymousUsersCancel.disabled = false;
    }
  };

  const resumeTeamsSessionById = async (sessionId) => {
    if (teamsResumeSessionInFlight || teamsSessionId) return;
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return;
    teamsResumeSessionInFlight = true;
    setTeamsLoadSessionBusy(true);
    try {
      const result = await fetchTeamsSessionDocument(trimmed);
      if (!result.ok) {
        if (result.reason === 'not-found') {
          showToast(t('teams.sessionNotFound', 'Session not found.'), 'error');
        } else {
          showToast(t('teams.sessionResumeFailed', 'Unable to resume session. Check the session ID and Firebase settings.'), 'error');
        }
        return;
      }
      resetTeamsSessionData();
      const sessionState = buildSessionStateFromDoc(trimmed, result.data);
      const featureApplyResult = applySessionFeaturesFromDoc(result.data);
      setTeamsSessionState(sessionState, { skipFeaturesSync: true });
      if (featureApplyResult.ok || featureApplyResult.reason === 'empty' || featureApplyResult.reason === 'no-new') {
        requestFirestoreFeaturesSync(0);
      }
      focusResumedSessionCenter(trimmed, result.data, sessionState.coordinates).catch((err) => {
        console.warn('Failed to focus on resumed session center', err);
      });
      closeTeamsResumeSessionModal();
      showToast(t('teams.sessionResumed', 'Session resumed.'));
    } finally {
      teamsResumeSessionInFlight = false;
      setTeamsLoadSessionBusy(false);
    }
  };

  const openTeamsDeleteSessionModal = (sessionId, title) => {
    if (!teamsDeleteSessionModal) return;
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return;
    teamsDeleteSessionTargetId = trimmed;
    teamsDeleteSessionTargetTitle = String(title || '').trim();
    setTeamsDeleteSessionStatus(null);
    if (teamsDeleteSessionConfirm) teamsDeleteSessionConfirm.disabled = false;
    if (teamsDeleteSessionMeta) {
      const titleFallback = t('teams.sessionTitleFallback', 'Untitled session');
      const idLabel = t('teams.loadSessionModal.idLabel', 'ID');
      const sessionLabel = t('teams.deleteSessionModal.sessionLabel', 'Session');
      const titleText = teamsDeleteSessionTargetTitle || titleFallback;
      teamsDeleteSessionMeta.textContent = `${sessionLabel}: ${titleText} - ${idLabel}: ${trimmed}`;
    }
    teamsDeleteSessionModal.hidden = false;
    teamsDeleteSessionModal.setAttribute('aria-hidden', 'false');
    try { teamsDeleteSessionConfirm?.focus(); } catch {}
  };

  const closeTeamsDeleteSessionModal = () => {
    if (!teamsDeleteSessionModal) return;
    teamsDeleteSessionModal.hidden = true;
    teamsDeleteSessionModal.setAttribute('aria-hidden', 'true');
    teamsDeleteSessionTargetId = null;
    teamsDeleteSessionTargetTitle = '';
    if (teamsDeleteSessionMeta) teamsDeleteSessionMeta.textContent = '';
    setTeamsDeleteSessionStatus(null);
  };

  const handleTeamsDeleteSessionConfirm = async () => {
    if (teamsDeleteSessionInFlight) return;
    const trimmed = String(teamsDeleteSessionTargetId || '').trim();
    if (!trimmed) return;
    teamsDeleteSessionInFlight = true;
    if (teamsDeleteSessionConfirm) teamsDeleteSessionConfirm.disabled = true;
    setTeamsDeleteSessionStatus('teams.deleteSessionModal.deleting', 'Deleting session...');
    setTeamsLoadSessionBusy(true);
    try {
      const result = await deleteTeamsSessionById(trimmed);
      if (!result.ok) {
        setTeamsDeleteSessionStatus('teams.deleteSessionModal.error', 'Unable to delete session. Check Firebase settings.');
        showToast(t('teams.deleteSessionModal.errorToast', 'Unable to delete session.'), 'error');
        return;
      }
      if (teamsSessionId === trimmed) {
        resetTeamsSessionData();
        setTeamsSessionState(null);
        clearTeamsSessionMapState({ keepGpx: true });
        closeTeamsSessionActionsModal();
      }
      closeTeamsDeleteSessionModal();
      showToast(t('teams.deleteSessionModal.deleted', 'Session deleted.'));
      await refreshTeamsLoadSessionList();
    } finally {
      teamsDeleteSessionInFlight = false;
      if (teamsDeleteSessionConfirm) teamsDeleteSessionConfirm.disabled = false;
      setTeamsLoadSessionBusy(false);
    }
  };

  const renderTeamsLoadSessionList = (entries) => {
    if (!teamsLoadSessionList) return;
    clearTeamsLoadSessionList();
    if (!entries.length) {
      setTeamsLoadSessionStatus(null);
      if (teamsResumeSessionInlineStart) teamsResumeSessionInlineStart.hidden = true;
      const emptyWrap = document.createElement('div');
      emptyWrap.className = 'session-empty';
      emptyWrap.setAttribute('role', 'listitem');

      const emptyTitle = document.createElement('div');
      emptyTitle.className = 'session-empty-title';
      emptyTitle.textContent = t('teams.loadSessionModal.emptyTitle', 'No sessions yet');

      const emptyBody = document.createElement('div');
      emptyBody.className = 'session-empty-body';
      emptyBody.textContent = t(
        'teams.loadSessionModal.emptyBody',
        'Start a new session to begin tracking and share updates.'
      );

      const emptyActions = document.createElement('div');
      emptyActions.className = 'session-empty-actions';
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'btn btn-primary';
      startBtn.textContent = t('teams.loadSessionModal.emptyAction', 'Start Session');
      startBtn.addEventListener('click', () => {
        closeTeamsResumeSessionModal();
        openTeamsStartSessionModal();
      });
      emptyActions.appendChild(startBtn);

      emptyWrap.appendChild(emptyTitle);
      emptyWrap.appendChild(emptyBody);
      emptyWrap.appendChild(emptyActions);
      teamsLoadSessionList.appendChild(emptyWrap);
      return;
    }
    if (teamsResumeSessionInlineStart) teamsResumeSessionInlineStart.hidden = false;
    setTeamsLoadSessionStatus(null);
    const titleFallback = t('teams.sessionTitleFallback', 'Untitled session');
    const idLabel = t('teams.loadSessionModal.idLabel', 'ID');
    const startLabel = t('teams.loadSessionModal.startLabel', 'Start');
    const endLabel = t('teams.loadSessionModal.endLabel', 'End');
    const featuresLabel = t('teams.loadSessionModal.featuresLabel', 'Features');
    const teamsLabel = t('teams.loadSessionModal.teamsLabel', 'Teams');
    const statusLabels = {
      stopped: t('teams.loadSessionModal.statusStopped', 'Stopped'),
      open: t('teams.loadSessionModal.statusOpen', 'Open'),
      running: t('teams.loadSessionModal.statusRunning', 'Running')
    };
    entries.forEach((entry) => {
      const wrap = document.createElement('div');
      wrap.className = 'session-row-wrap';
      wrap.setAttribute('role', 'listitem');

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'session-row';
      row.dataset.sessionId = entry.id;
      row.addEventListener('click', () => resumeTeamsSessionById(entry.id));

      const main = document.createElement('div');
      main.className = 'session-row-main';

      const titleEl = document.createElement('div');
      titleEl.className = 'session-row-title';
      const titleText = entry.title || titleFallback;
      const status = entry.endDate ? 'stopped' : entry.hasFeatures ? 'running' : 'open';
      const statusLabel = statusLabels[status] || statusLabels.open;
      const statusDot = document.createElement('span');
      statusDot.className = `session-row-status session-row-status--${status}`;
      statusDot.setAttribute('role', 'img');
      statusDot.setAttribute('aria-label', statusLabel);
      statusDot.title = statusLabel;
      const titleTextEl = document.createElement('span');
      titleTextEl.className = 'session-row-title-text';
      titleTextEl.textContent = titleText;
      titleTextEl.title = titleText;
      titleEl.appendChild(statusDot);
      titleEl.appendChild(titleTextEl);

      const idEl = document.createElement('div');
      idEl.className = 'session-row-id';
      idEl.textContent = `${idLabel}: ${entry.id}`;
      idEl.title = entry.id;

      const stats = document.createElement('div');
      stats.className = 'session-row-stats';
      const featuresStat = document.createElement('div');
      featuresStat.className = 'session-row-stat';
      const featuresLabelEl = document.createElement('div');
      featuresLabelEl.className = 'session-row-stat-label';
      featuresLabelEl.textContent = featuresLabel;
      const featuresValueEl = document.createElement('div');
      featuresValueEl.className = 'session-row-stat-value';
      const featuresCount = Number.isFinite(entry.featuresCount) ? entry.featuresCount : 0;
      featuresValueEl.textContent = String(featuresCount);
      featuresStat.appendChild(featuresLabelEl);
      featuresStat.appendChild(featuresValueEl);

      const teamsStat = document.createElement('div');
      teamsStat.className = 'session-row-stat';
      const teamsLabelEl = document.createElement('div');
      teamsLabelEl.className = 'session-row-stat-label';
      teamsLabelEl.textContent = teamsLabel;
      const teamsValueEl = document.createElement('div');
      teamsValueEl.className = 'session-row-stat-value';
      const teamsCount = Number.isFinite(entry.teamsCount) ? entry.teamsCount : 0;
      teamsValueEl.textContent = String(teamsCount);
      teamsStat.appendChild(teamsLabelEl);
      teamsStat.appendChild(teamsValueEl);

      stats.appendChild(featuresStat);
      stats.appendChild(teamsStat);

      const dates = document.createElement('div');
      dates.className = 'session-row-dates';

      const startLine = document.createElement('div');
      startLine.className = 'session-row-date';
      startLine.textContent = `${startLabel}: ${formatSessionStartDateText(entry.startDate)}`;

      const endLine = document.createElement('div');
      endLine.className = 'session-row-date';
      endLine.textContent = `${endLabel}: ${formatSessionEndDateText(entry.endDate)}`;

      main.appendChild(titleEl);
      main.appendChild(idEl);
      dates.appendChild(startLine);
      dates.appendChild(endLine);
      row.appendChild(main);
      row.appendChild(stats);
      row.appendChild(dates);

      const deleteLabel = t('teams.loadSessionModal.deleteLabel', 'Delete session');
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-icon btn-icon-danger session-row-delete';
      deleteBtn.setAttribute('aria-label', deleteLabel);
      deleteBtn.title = deleteLabel;
      deleteBtn.appendChild(makeButtonIcon(TEAMS_SESSION_ICON_PATHS.delete));
      deleteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openTeamsDeleteSessionModal(entry.id, titleText);
      });

      wrap.appendChild(row);
      wrap.appendChild(deleteBtn);
      teamsLoadSessionList.appendChild(wrap);
    });
  };

  const refreshTeamsLoadSessionList = async () => {
    if (teamsLoadSessionInFlight) return;
    teamsLoadSessionInFlight = true;
    setTeamsLoadSessionBusy(true);
    setTeamsLoadSessionStatus('teams.loadSessionModal.loading', 'Loading sessions...');
    clearTeamsLoadSessionList();
    try {
      const result = await fetchTeamsSessionsList();
      if (!result.ok) {
        if (result.reason === 'firestore') {
          setTeamsLoadSessionStatus('teams.firestoreUnavailable', 'Firestore is not available. Check Firebase settings.');
        } else {
          setTeamsLoadSessionStatus('teams.loadSessionModal.error', 'Unable to load sessions. Check Firebase settings.');
        }
        return;
      }
      const sessions = result.items
        .map((entry) => {
          const title = typeof entry.data?.title === 'string' ? entry.data.title.trim() : '';
          const startDate = normalizeSessionDate(entry.data?.startDate);
          const endDate = normalizeSessionDate(entry.data?.endDate);
          const startTime = startDate instanceof Date ? startDate.getTime() : NaN;
          const endTime = endDate instanceof Date ? endDate.getTime() : NaN;
          const sortValue = Number.isFinite(startTime) ? startTime : Number.isFinite(endTime) ? endTime : 0;
          const featuresCount = filterSessionFeatures(extractSessionFeatures(entry.data)).length;
          const teamsCount = normalizeSessionTrackerIds(entry.data).length;
          return {
            id: entry.id,
            title,
            startDate,
            endDate,
            sortValue,
            featuresCount,
            teamsCount,
            hasFeatures: featuresCount > 0
          };
        })
        .filter((entry) => entry.id);
      sessions.sort((a, b) => b.sortValue - a.sortValue);
      renderTeamsLoadSessionList(sessions);
    } finally {
      teamsLoadSessionInFlight = false;
      setTeamsLoadSessionBusy(false);
    }
  };

  const openTeamsStartSessionModal = () => {
    if (!teamsStartSessionModal) return;
    if (teamsSessionId) return;
    if (teamsStartSessionTitleInput) teamsStartSessionTitleInput.value = '';
    teamsStartSessionModal.hidden = false;
    teamsStartSessionModal.setAttribute('aria-hidden', 'false');
    try { teamsStartSessionTitleInput?.focus(); } catch {}
  };

  const closeTeamsStartSessionModal = () => {
    if (!teamsStartSessionModal) return;
    teamsStartSessionModal.hidden = true;
    teamsStartSessionModal.setAttribute('aria-hidden', 'true');
  };

  const openTeamsResumeSessionModal = () => {
    if (!teamsResumeSessionModal) return;
    if (teamsSessionId) return;
    teamsResumeSessionModal.hidden = false;
    teamsResumeSessionModal.setAttribute('aria-hidden', 'false');
    refreshTeamsLoadSessionList();
  };

  const closeTeamsResumeSessionModal = () => {
    if (!teamsResumeSessionModal) return;
    teamsResumeSessionModal.hidden = true;
    teamsResumeSessionModal.setAttribute('aria-hidden', 'true');
  };

  const handleTeamsStartSessionSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (teamsStartSessionInFlight || teamsSessionId) return;
    const rawTitle = (teamsStartSessionTitleInput?.value || '').trim();
    if (!rawTitle) {
      showToast(t('teams.sessionTitleRequired', 'Please enter a session title.'), 'error');
      try { teamsStartSessionTitleInput?.focus(); } catch {}
      return;
    }
    const title = `${dateYYYYMMDD()} - ${rawTitle}`;
    const coordinates = getSessionCenterCoordinates();
    const sessionId = generateSessionId();
    const payload = buildSessionPayload({ title, coordinates, startDate: new Date(), endDate: null });
    teamsStartSessionInFlight = true;
    if (teamsStartSessionSubmit) teamsStartSessionSubmit.disabled = true;
    try {
      const ok = await writeTeamsSessionDocument(sessionId, payload);
      if (!ok) {
        showToast(t('teams.sessionStartFailed', 'Unable to start session. Check Firebase settings.'), 'error');
        return;
      }
      resetTeamsSessionData();
      setTeamsSessionState({
        id: sessionId,
        title,
        startDate: payload.startDate,
        endDate: payload.endDate,
        coordinates: payload.coordinates
      });
      closeTeamsStartSessionModal();
      showToast(t('teams.sessionStarted', 'Session started.'));
    } finally {
      teamsStartSessionInFlight = false;
      if (teamsStartSessionSubmit) teamsStartSessionSubmit.disabled = false;
    }
  };

  const handleTeamsResumeSessionSubmit = async (event, sessionIdOverride) => {
    if (event?.preventDefault) event.preventDefault();
    const sessionId = String(sessionIdOverride || '').trim();
    if (!sessionId) return;
    await resumeTeamsSessionById(sessionId);
  };

  const filterGpxFeaturesForSessionClose = (features) => {
    if (!Array.isArray(features)) return [];
    const gpxLineIds = new Set();
    features.forEach((feature) => {
      if (feature?.properties?.importSource === 'gpx') {
        const id = feature.properties?.id;
        if (id) gpxLineIds.add(id);
      }
    });
    return features.filter((feature) => {
      if (!feature || !feature.properties) return false;
      if (feature.properties.importSource === 'gpx') return true;
      if (feature.properties.isLineEndpoint && gpxLineIds.has(feature.properties.relatedLineId)) return true;
      return false;
    });
  };

  const clearTeamsSessionMapState = ({ keepGpx = false } = {}) => {
    try {
      let storeRef = null;
      try { storeRef = (window)._drawStore || drawStore; } catch { storeRef = null; }
      if (storeRef && Array.isArray(storeRef.features)) {
        storeRef.features = keepGpx ? filterGpxFeaturesForSessionClose(storeRef.features) : [];
        if (typeof window._refreshDraw === 'function') window._refreshDraw();
      } else if (!keepGpx) {
        (window).draw?.clear?.();
      }
    } catch {}
    try { if (typeof setDirty === 'function') setDirty(false); } catch {}
  };

  const stopTeamsSession = async () => {
    if (teamsSessionEndInFlight || !teamsSessionId || teamsSessionInfo?.endDate) return;
    const confirmMessage = t('teams.sessionEndConfirm', 'Stop this session?');
    let confirmed = true;
    try { confirmed = window.confirm(confirmMessage); } catch { confirmed = true; }
    if (!confirmed) return;
    const sessionId = String(teamsSessionId || '').trim();
    if (!sessionId) return;
    const endDate = new Date();
    teamsSessionEndInFlight = true;
    updateMapSessionOverlay();
    updateSessionActionsModalState();
    try {
      const ok = await writeTeamsSessionDocument(sessionId, { endDate });
      if (!ok) {
        showToast(t('teams.sessionEndFailed', 'Unable to end session. Check Firebase settings.'), 'error');
        return;
      }
      const currentTitle = typeof teamsSessionInfo?.title === 'string' ? teamsSessionInfo.title.trim() : '';
      const currentStart = teamsSessionInfo?.startDate || null;
      const currentCoords = teamsSessionInfo?.coordinates || null;
      if (!teamsSessionInfo || typeof teamsSessionInfo !== 'object') {
        teamsSessionInfo = { id: sessionId, title: currentTitle, startDate: currentStart, endDate, coordinates: currentCoords };
      } else {
        teamsSessionInfo.endDate = endDate;
      }
      updateTeamsSessionUI();
      showToast(t('teams.sessionEnded', 'Session ended.'), 'success');
    } finally {
      teamsSessionEndInFlight = false;
      updateMapSessionOverlay();
      updateSessionActionsModalState();
    }
  };

  const closeTeamsSession = async () => {
    if (!teamsSessionId) return;
    const confirmMessage = t('teams.sessionCloseConfirm', 'Close this session and reset the map, features, and teams?');
    let confirmed = true;
    try { confirmed = window.confirm(confirmMessage); } catch { confirmed = true; }
    if (!confirmed) return;
    resetTeamsSessionData();
    setTeamsSessionState(null);
    clearTeamsSessionMapState({ keepGpx: true });
    closeTeamsSessionActionsModal();
    showToast(t('teams.sessionClosed', 'Session closed.'), 'success');
  };

  const buildTeamMemberPayload = (trackerId, authToken) => {
    const resolvedTrackerId = trackerId || '';
    if (!teamsSessionId) return null;
    if (!authToken) return null;
    const firebaseConfig = readFirebaseConfigValue();
    return JSON.stringify({
      id: teamsSessionId,
      updateDocumentPath: `/sessions/${teamsSessionId}/trackers/${resolvedTrackerId}`,
      trackerId: resolvedTrackerId,
      mapboxApiKey: readMapboxToken(),
      firebaseAuthToken: authToken,
      firebaseConfig: firebaseConfig ?? null
    });
  };

  const requestFirebaseAnonymousToken = async () => {
    if (!window.firebaseAdmin?.createAnonymousToken) {
      return {
        ok: false,
        error: t('settings.firebaseAdminActionsStatus.unavailable', 'Firebase Admin integration is unavailable.'),
        i18nKey: 'settings.firebaseAdminActionsStatus.unavailable'
      };
    }
    const apiKey = firebaseSettings?.apiKey || '';
    if (!apiKey) {
      return {
        ok: false,
        error: t('teams.memberModal.tokenError', 'Firebase API key is missing from settings.'),
        i18nKey: 'teams.memberModal.tokenError'
      };
    }
    try {
      const result = await window.firebaseAdmin.createAnonymousToken({ sessionDays: 5, apiKey });
      if (result?.ok && result.token) return { ok: true, token: result.token };
      return {
        ok: false,
        error: result?.error || t('teams.memberModal.tokenError', 'Unable to create a secure access token.'),
        i18nKey: result?.i18nKey || 'teams.memberModal.tokenError'
      };
    } catch (err) {
      return {
        ok: false,
        error: t('teams.memberModal.tokenError', 'Unable to create a secure access token.'),
        i18nKey: 'teams.memberModal.tokenError'
      };
    }
  };

  const ensureTeamTracker = (trackerId, { color, skipUpdate = false } = {}) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return null;
    let tracker = trackerStore.get(trimmed);
    if (!tracker) {
      const resolvedColor = color || nextTrackerColor();
      tracker = {
        id: trimmed,
        longitude: null,
        latitude: null,
        altitude: null,
        battery: null,
        hops: null,
        updatedAt: Date.now(),
        raw: null,
        name: null,
        title: null,
        color: resolvedColor,
        poiIcon: null,
        visible: true
      };
      trackerStore.set(trimmed, tracker);
      ensureTrackerHistoryEntry(trimmed);
      if (!skipUpdate) {
        updateTrackerSource();
        updateTrackerPathSource();
        renderTrackersList();
        updateTrackersPanelState();
        refreshTrackersControlsState();
      }
      return tracker;
    }
    return tracker;
  };

  const normalizeTrackerLabelText = (value) => {
    if (value == null) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  };

  const readStringField = (value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      if (typeof value.stringValue === 'string') return value.stringValue;
      if (typeof value.textValue === 'string') return value.textValue;
      if (typeof value.value === 'string') return value.value;
    }
    return null;
  };

  const unwrapFirestoreFields = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (value.mapValue && value.mapValue.fields && typeof value.mapValue.fields === 'object') {
      return value.mapValue.fields;
    }
    if (value.fields && typeof value.fields === 'object') return value.fields;
    return value;
  };

  const extractProfilePayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const candidates = [];
    const pushCandidate = (value) => {
      if (!value) return;
      candidates.push(value);
    };
    pushCandidate(payload.profile);
    pushCandidate(payload.data?.profile);
    pushCandidate(payload.fields?.profile);
    pushCandidate(payload.profile?.mapValue?.fields);
    pushCandidate(payload.fields?.profile?.mapValue?.fields);
    pushCandidate(payload.data?.fields?.profile);
    for (const candidate of candidates) {
      const profile = unwrapFirestoreFields(candidate);
      if (!profile || typeof profile !== 'object') continue;
      const nameRaw = readStringField(profile.name);
      const orgRaw = readStringField(profile.organisation)
        || readStringField(profile.organization)
        || readStringField(profile.org);
      const unitRaw = readStringField(profile.unitName)
        || readStringField(profile.unit_name)
        || readStringField(profile.unit);
      const name = normalizeTrackerLabelText(nameRaw);
      const organisation = normalizeTrackerLabelText(orgRaw);
      const unitName = normalizeTrackerLabelText(unitRaw);
      if (name || organisation || unitName) {
        return { name, organisation, unitName };
      }
    }
    return null;
  };

  const formatProfileTitle = (profile) => {
    if (!profile || typeof profile !== 'object') return '';
    const org = normalizeTrackerLabelText(profile.organisation || profile.organization || profile.org);
    const unit = normalizeTrackerLabelText(profile.unitName || profile.unit_name || profile.unit);
    if (org && unit) return `${org} - ${unit}`;
    return org || unit || '';
  };

  const applyTrackerProfileUpdate = (trackerId, profile) => {
    if (!profile) return;
    const trimmedId = String(trackerId || '').trim();
    if (!trimmedId) return;
    ensureTeamTracker(trimmedId);
    const current = trackerStore.get(trimmedId);
    if (!current) return;
    const next = { ...current };
    const name = normalizeTrackerLabelText(profile.name);
    const title = formatProfileTitle(profile);
    let changed = false;
    if (name) {
      const currentName = normalizeTrackerLabelText(current.name || '');
      const priorProfileName = normalizeTrackerLabelText(current.profileName || '');
      if (!currentName || currentName === current.id || (priorProfileName && currentName === priorProfileName)) {
        next.name = name;
        changed = true;
      }
      if (name !== priorProfileName) {
        next.profileName = name;
        changed = true;
      }
    }
    if (title && title !== (current.title || '')) {
      next.title = title;
      changed = true;
    }
    if (changed) {
      trackerStore.set(trimmedId, next);
      updateTrackerSource();
      updateTrackerPathSource();
      renderTrackersList();
      try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
    }
  };

  const extractCoordsPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const readNumber = (value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (value && typeof value === 'object') {
        const candidate = value.doubleValue ?? value.integerValue ?? value.stringValue ?? value.floatValue;
        if (candidate !== undefined) {
          const parsed = Number(candidate);
          return Number.isFinite(parsed) ? parsed : null;
        }
      }
      return null;
    };

    const extractFromArray = (arr) => {
      if (!Array.isArray(arr) || arr.length < 2) return null;
      const a = readNumber(arr[0]);
      const b = readNumber(arr[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const aAbs = Math.abs(a);
      const bAbs = Math.abs(b);
      if (aAbs > 90 && bAbs <= 90) return { longitude: a, latitude: b };
      if (bAbs > 90 && aAbs <= 90) return { longitude: b, latitude: a };
      return { longitude: a, latitude: b };
    };

    const extractFromObject = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.geoPointValue) return extractFromObject(obj.geoPointValue);
      if (obj.mapValue && obj.mapValue.fields) return extractFromObject(obj.mapValue.fields);
      if (Array.isArray(obj)) return extractFromArray(obj);

      const directLat = readNumber(obj.latitude ?? obj.lat ?? obj._lat);
      const directLng = readNumber(obj.longitude ?? obj.lng ?? obj.lon ?? obj.long ?? obj._long ?? obj._lng);
      if (Number.isFinite(directLat) && Number.isFinite(directLng)) {
        return { longitude: directLng, latitude: directLat, altitude: readNumber(obj.altitude ?? obj.alt ?? obj.elevation) };
      }

      if (Number.isFinite(obj.latitude) && Number.isFinite(obj.longitude)) {
        return { longitude: obj.longitude, latitude: obj.latitude };
      }

      return null;
    };

    const candidates = [];
    const pushCandidate = (value) => {
      if (!value) return;
      candidates.push(value);
    };

    pushCandidate(payload.coords);
    pushCandidate(payload.location);
    pushCandidate(payload.position);
    pushCandidate(payload.geo);
    pushCandidate(payload.geopoint);
    pushCandidate(payload.point);
    pushCandidate(payload);

    if (payload.data && typeof payload.data === 'object') {
      pushCandidate(payload.data.coords);
      pushCandidate(payload.data.location);
      pushCandidate(payload.data.position);
      pushCandidate(payload.data);
    }

    if (payload.fields && typeof payload.fields === 'object') {
      const fields = payload.fields;
      pushCandidate(fields);
      ['coords', 'location', 'position', 'geo', 'geopoint', 'point'].forEach((key) => {
        const entry = fields[key];
        if (entry?.mapValue?.fields) pushCandidate(entry.mapValue.fields);
        else pushCandidate(entry);
      });
    }

    for (const candidate of candidates) {
      const coords = extractFromObject(candidate);
      if (coords && Number.isFinite(coords.longitude) && Number.isFinite(coords.latitude)) {
        return {
          longitude: coords.longitude,
          latitude: coords.latitude,
          altitude: Number.isFinite(coords.altitude) ? coords.altitude : null
        };
      }
    }
    return null;
  };

  const applyTrackerCoordsUpdate = (trackerId, coords) => {
    if (!coords) return;
    const trimmedId = String(trackerId || '').trim();
    if (!trimmedId) return;
    ensureTeamTracker(trimmedId);
    const prev = trackerStore.get(trimmedId);
    if (!prev) return;
    const prevLng = prev.longitude;
    const prevLat = prev.latitude;
    const prevAlt = prev.altitude;
    const samePosition = Number.isFinite(prevLng)
      && Number.isFinite(prevLat)
      && prevLng === coords.longitude
      && prevLat === coords.latitude
      && (Number.isFinite(prevAlt) ? prevAlt === coords.altitude : coords.altitude == null);
    if (samePosition) {
      maybeAutoClearTrackerGoTo(trimmedId, coords);
      return;
    }
    const color = prev.color || nextTrackerColor();
    const timestamp = Date.now();
    const merged = {
      ...prev,
      id: trimmedId,
      longitude: coords.longitude,
      latitude: coords.latitude,
      altitude: coords.altitude,
      updatedAt: timestamp,
      color,
      visible: prev.visible === false ? false : true
    };
    trackerStore.set(trimmedId, merged);
    const hasPrev = Number.isFinite(prevLng) && Number.isFinite(prevLat);
    let movementDistance = 0;
    let shouldAppendSegment = false;
    if (hasPrev) {
      movementDistance = haversineMeters(
        { longitude: prevLng, latitude: prevLat },
        { longitude: coords.longitude, latitude: coords.latitude }
      );
      if (movementDistance > 3) shouldAppendSegment = true;
    }
    if (shouldAppendSegment) {
      appendTrackerSegment(
        trimmedId,
        { longitude: prevLng, latitude: prevLat },
        { longitude: coords.longitude, latitude: coords.latitude },
        movementDistance,
        color,
        prev.updatedAt,
        timestamp
      );
      updateTrackerPathSource();
    }
    maybeAutoClearTrackerGoTo(trimmedId, coords, { skipUpdate: true });
    updateTrackerSource();
    renderTrackersList();
    updateTrackersPanelState();
    maybeRevealTrackerOnMap(trimmedId, coords, { force: !hasPrev });
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
  };

  const readTrackNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (value && typeof value === 'object') {
      const candidate = value.doubleValue ?? value.integerValue ?? value.stringValue ?? value.floatValue;
      if (candidate !== undefined) {
        const parsed = Number(candidate);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    return null;
  };

  const normalizeTrackTimestamp = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && value.__time__) {
      return normalizeTrackTimestamp(value.__time__);
    }
    const date = normalizeSessionDate(value);
    if (date) return date.getTime();
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const normalizeTrackSuffix = (value) => {
    if (!value) return null;
    const raw = readStringField(value) || (typeof value === 'string' ? value : null);
    const trimmed = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (trimmed.length !== 1) return null;
    if (trimmed < 'a' || trimmed > 'z') return null;
    return trimmed;
  };

  const buildTrackSuffixes = (lastSuffix, trackDocs) => {
    const normalized = normalizeTrackSuffix(lastSuffix);
    if (!normalized) {
      if (trackDocs && typeof trackDocs.keys === 'function') {
        return Array.from(trackDocs.keys()).sort();
      }
      return ['a'];
    }
    const start = 'a'.charCodeAt(0);
    const end = normalized.charCodeAt(0);
    const result = [];
    for (let i = start; i <= end; i += 1) {
      result.push(String.fromCharCode(i));
    }
    return result;
  };

  const extractTrackEntryCoords = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const coordsField = entry.coords ?? entry.coord ?? entry.location ?? null;
    const arrayCandidate = Array.isArray(coordsField)
      ? coordsField
      : coordsField?.arrayValue?.values
        ? coordsField.arrayValue.values
        : null;
    if (arrayCandidate) {
      const a = readTrackNumber(arrayCandidate[0]);
      const b = readTrackNumber(arrayCandidate[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const aAbs = Math.abs(a);
        const bAbs = Math.abs(b);
        if (aAbs > 90 && bAbs <= 90) return { longitude: a, latitude: b };
        if (bAbs > 90 && aAbs <= 90) return { longitude: b, latitude: a };
        return { longitude: a, latitude: b };
      }
    }
    return extractCoordsPayload(entry);
  };

  const normalizeTrackEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const coords = extractTrackEntryCoords(entry);
    if (!coords || !Number.isFinite(coords.longitude) || !Number.isFinite(coords.latitude)) return null;
    const altitudeValue = readTrackNumber(entry.altitude);
    const altitude = Number.isFinite(altitudeValue)
      ? altitudeValue
      : (Number.isFinite(coords.altitude) ? coords.altitude : null);
    const timestamp = normalizeTrackTimestamp(entry.t ?? entry.time ?? entry.timestamp ?? entry.createdAt);
    return {
      longitude: coords.longitude,
      latitude: coords.latitude,
      altitude,
      timestamp
    };
  };

  const normalizeTrackDocPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return { nextSuffix: null, coords: [] };
    const data = unwrapFirestoreFields(payload);
    const rawCoords = data?.coords?.arrayValue?.values
      ? data.coords.arrayValue.values
      : Array.isArray(data?.coords)
        ? data.coords
        : [];
    const coords = Array.isArray(rawCoords)
      ? rawCoords.map(normalizeTrackEntry).filter(Boolean)
      : [];
    const nextSuffix = normalizeTrackSuffix(data?.next ?? data?.fields?.next ?? null);
    return { nextSuffix, coords };
  };

  const scheduleTrackerTrackRebuild = (trackerId) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return;
    const entry = trackerSubscriptions.get(trimmed);
    if (!entry) return;
    if (entry.trackRebuildQueued) return;
    entry.trackRebuildQueued = true;
    const run = () => {
      const current = trackerSubscriptions.get(trimmed);
      if (!current) return;
      current.trackRebuildQueued = false;
      applyTrackerTrackDocs(trimmed, current);
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  };

  const applyTrackerTrackDocs = (trackerId, entry) => {
    if (!entry) return;
    const history = ensureTrackerHistoryEntry(trackerId);
    history.positions.length = 0;
    history.segments.length = 0;
    const suffixes = buildTrackSuffixes(entry.nextSuffix, entry.trackDocs);
    const points = [];
    suffixes.forEach((suffix) => {
      const docPoints = entry.trackDocs?.get(suffix);
      if (Array.isArray(docPoints)) docPoints.forEach((pt) => points.push(pt));
    });
    if (!points.length) {
      entry.hasTrackCoords = false;
      updateTrackerPathSource();
      return;
    }
    const tracker = ensureTeamTracker(trackerId);
    const resolvedColor = tracker?.color || nextTrackerColor();
    let lastPoint = null;
    const pushPosition = (lng, lat, timestamp) => {
      const last = history.positions[history.positions.length - 1];
      if (last && last.longitude === lng && last.latitude === lat) return;
      history.positions.push({
        longitude: lng,
        latitude: lat,
        timestamp: Number.isFinite(timestamp) ? timestamp : null
      });
    };
    points.forEach((pt) => {
      if (!pt) return;
      const lng = Number(pt.longitude);
      const lat = Number(pt.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      const timestamp = Number.isFinite(pt.timestamp) ? pt.timestamp : null;
      pushPosition(lng, lat, timestamp);
      if (lastPoint) {
        const distance = haversineMeters(lastPoint, { longitude: lng, latitude: lat });
        if (distance > 3) {
          history.segments.push({
            from: { longitude: lastPoint.longitude, latitude: lastPoint.latitude },
            to: { longitude: lng, latitude: lat },
            distance,
            timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
            color: resolvedColor
          });
        }
      }
      lastPoint = {
        longitude: lng,
        latitude: lat,
        altitude: Number.isFinite(pt.altitude) ? pt.altitude : null,
        timestamp
      };
    });
    entry.hasTrackCoords = !!lastPoint;
    if (!lastPoint) {
      updateTrackerPathSource();
      return;
    }
    const prev = trackerStore.get(trackerId);
    const prevLng = prev?.longitude;
    const prevLat = prev?.latitude;
    const hasPrev = Number.isFinite(prevLng) && Number.isFinite(prevLat);
    trackerStore.set(trackerId, {
      ...prev,
      id: trackerId,
      longitude: lastPoint.longitude,
      latitude: lastPoint.latitude,
      altitude: Number.isFinite(lastPoint.altitude) ? lastPoint.altitude : prev?.altitude ?? null,
      updatedAt: Number.isFinite(lastPoint.timestamp) ? lastPoint.timestamp : (prev?.updatedAt || Date.now()),
      color: prev?.color || resolvedColor,
      visible: prev?.visible === false ? false : true
    });
    maybeAutoClearTrackerGoTo(trackerId, {
      longitude: lastPoint.longitude,
      latitude: lastPoint.latitude,
      altitude: lastPoint.altitude
    }, { skipUpdate: true });
    updateTrackerSource();
    updateTrackerPathSource();
    renderTrackersList();
    updateTrackersPanelState();
    maybeRevealTrackerOnMap(trackerId, { longitude: lastPoint.longitude, latitude: lastPoint.latitude }, { force: !hasPrev });
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
  };

  const safeUnsubscribe = (unsubscribe) => {
    if (!unsubscribe) return;
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (typeof unsubscribe === 'string') {
        const sdkInfo = resolveFirebaseSdk();
        if (sdkInfo?.type === 'modular' && typeof sdkInfo.sdk?.unsubscribe === 'function') {
          sdkInfo.sdk.unsubscribe(unsubscribe);
        }
      }
    } catch {}
  };

  const maybeRevealTrackerOnMap = (trackerId, coords, { force = false } = {}) => {
    const map = getMap();
    if (!map || !coords) return;
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;
    try {
      if (!trackersLayersVisible) {
        trackersLayersVisible = true;
        applyTrackersVisibility(map);
      }
    } catch {}
    const lng = coords.longitude;
    const lat = coords.latitude;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (!force) {
      if (trackerAutoReveal.has(trackerId)) return;
      try {
        const bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
        if (bounds && typeof bounds.contains === 'function' && bounds.contains([lng, lat])) return;
      } catch {}
    }
    trackerAutoReveal.add(trackerId);
    const nextZoom = Math.max(Number(map.getZoom?.() ?? 0), 12);
    try {
      map.flyTo({ center: [lng, lat], zoom: nextZoom, duration: 800, essential: true });
    } catch (err) {
      console.warn('Failed to focus tracker on map', err);
    }
  };

  const startTrackerSubscription = (trackerId) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return false;
    if (!teamsSessionId) return false;
    const sessionId = String(teamsSessionId || '').trim();
    if (!sessionId) return false;
    if (trackerSubscriptions.has(trimmed)) return true;
    clearTrackerSubscriptionRetry(trimmed);
    const sdkInfo = resolveFirebaseSdk();
    const db = firestoreInstance || initFirestoreConnection();
    if (!sdkInfo || !db) {
      if (!firestoreUnavailableToasted) {
        firestoreUnavailableToasted = true;
        showToast(t('teams.firestoreUnavailable', 'Firestore is not available. Check Firebase settings.'), 'error');
      }
      console.warn('Firestore not available for tracker subscription', trimmed);
      scheduleTrackerSubscriptionRetry(trimmed, 'firestore unavailable');
      return false;
    }
    const entry = {
      unsubscribe: null,
      trackUnsubscribes: new Map(),
      trackDocs: new Map(),
      nextSuffix: 'a',
      trackRebuildQueued: false,
      hasTrackCoords: false
    };
    trackerSubscriptions.set(trimmed, entry);
    const cleanupAndRetry = (reason) => {
      const current = trackerSubscriptions.get(trimmed);
      if (current) {
        safeUnsubscribe(current.unsubscribe);
        current.unsubscribe = null;
        if (current.trackUnsubscribes instanceof Map) {
          current.trackUnsubscribes.forEach((unsub) => safeUnsubscribe(unsub));
          current.trackUnsubscribes.clear();
        }
        trackerSubscriptions.delete(trimmed);
      }
      scheduleTrackerSubscriptionRetry(trimmed, reason);
    };
    const ensureTrackSuffixes = (lastSuffix) => {
      const suffixes = buildTrackSuffixes(lastSuffix, entry.trackDocs);
      const wanted = new Set(suffixes);
      suffixes.forEach((suffix) => {
        if (entry.trackUnsubscribes.has(suffix)) return;
        let trackUnsubscribe = null;
        try {
          const handleTrackSnapshot = (snapshot) => {
            if (!snapshot) return;
            if (trackerSubscriptions.get(trimmed) !== entry) return;
            const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
            if (exists === false) {
              entry.trackDocs.delete(suffix);
              if (suffix === 'a') {
                entry.nextSuffix = 'a';
                ensureTrackSuffixes('a');
              }
              scheduleTrackerTrackRebuild(trimmed);
              return;
            }
            const data = typeof snapshot.data === 'function' ? snapshot.data() : snapshot.data;
            const normalized = normalizeTrackDocPayload(data || {});
            entry.trackDocs.set(suffix, normalized.coords);
            if (suffix === 'a') {
              const nextSuffix = normalized.nextSuffix || 'a';
              if (nextSuffix !== entry.nextSuffix) {
                entry.nextSuffix = nextSuffix;
                ensureTrackSuffixes(nextSuffix);
              }
            }
            scheduleTrackerTrackRebuild(trimmed);
          };
          const handleTrackError = (err) => {
            console.warn('Firestore track subscription failed', trimmed, suffix, err);
            cleanupAndRetry('track snapshot error');
          };
          if (sdkInfo.type === 'compat') {
            const docRef = db.doc(`sessions/${sessionId}/tracks/${trimmed}_${suffix}`);
            trackUnsubscribe = docRef.onSnapshot(handleTrackSnapshot, handleTrackError);
          } else {
            const { doc, onSnapshot } = sdkInfo.sdk || {};
            if (typeof doc !== 'function' || typeof onSnapshot !== 'function') {
              console.warn('Firebase modular SDK missing doc/onSnapshot');
              if (!firestoreUnavailableToasted) {
                firestoreUnavailableToasted = true;
                showToast(t('teams.firestoreUnavailable', 'Firestore is not available. Check Firebase settings.'), 'error');
              }
              cleanupAndRetry('modular sdk missing');
              return;
            }
            const docRef = doc(db, 'sessions', sessionId, 'tracks', `${trimmed}_${suffix}`);
            trackUnsubscribe = onSnapshot(docRef, handleTrackSnapshot, handleTrackError);
          }
        } catch (err) {
          console.warn('Failed to subscribe to track updates', trimmed, suffix, err);
          cleanupAndRetry('track subscription error');
          return;
        }
        if (typeof trackUnsubscribe === 'function' || typeof trackUnsubscribe === 'string') {
          entry.trackUnsubscribes.set(suffix, trackUnsubscribe);
        }
      });
      entry.trackUnsubscribes.forEach((unsub, suffix) => {
        if (!wanted.has(suffix)) {
          safeUnsubscribe(unsub);
          entry.trackUnsubscribes.delete(suffix);
          entry.trackDocs.delete(suffix);
        }
      });
      const normalized = normalizeTrackSuffix(lastSuffix);
      entry.nextSuffix = normalized || entry.nextSuffix || 'a';
    };
    try {
      ensureTrackSuffixes('a');
    } catch (err) {
      console.warn('Failed to initialize tracker track subscription', trimmed, err);
      cleanupAndRetry('track init error');
      return false;
    }
    try {
      const handleSnapshot = (snapshot) => {
        if (!snapshot) return;
        if (trackerSubscriptions.get(trimmed) !== entry) return;
        const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
        if (exists === false) return;
        const data = typeof snapshot.data === 'function' ? snapshot.data() : snapshot.data;
        const profile = extractProfilePayload(data || {});
        if (profile) applyTrackerProfileUpdate(trimmed, profile);
        if (!entry.hasTrackCoords) {
          const coords = extractCoordsPayload(data || {});
          if (coords) applyTrackerCoordsUpdate(trimmed, coords);
        }
      };
      const handleError = (err) => {
        console.warn('Firestore tracker subscription failed', trimmed, err);
        cleanupAndRetry('snapshot error');
      };
      if (sdkInfo.type === 'compat') {
        const docRef = db.doc(`sessions/${sessionId}/trackers/${trimmed}`);
        entry.unsubscribe = docRef.onSnapshot(handleSnapshot, handleError);
      } else {
        const { doc, onSnapshot } = sdkInfo.sdk || {};
        if (typeof doc !== 'function' || typeof onSnapshot !== 'function') {
          console.warn('Firebase modular SDK missing doc/onSnapshot');
          if (!firestoreUnavailableToasted) {
            firestoreUnavailableToasted = true;
            showToast(t('teams.firestoreUnavailable', 'Firestore is not available. Check Firebase settings.'), 'error');
          }
          cleanupAndRetry('modular sdk missing');
          return false;
        }
        const docRef = doc(db, 'sessions', sessionId, 'trackers', trimmed);
        entry.unsubscribe = onSnapshot(docRef, handleSnapshot, handleError);
      }
    } catch (err) {
      console.warn('Failed to subscribe to tracker updates', trimmed, err);
      cleanupAndRetry('subscription error');
      return false;
    }
    if ((typeof entry.unsubscribe === 'function' || typeof entry.unsubscribe === 'string') || entry.trackUnsubscribes.size > 0) {
      return true;
    }
    cleanupAndRetry('no unsubscribe handle');
    return false;
  };

  const closeTeamMemberModal = () => {
    if (!teamMemberModal) return;
    teamMemberModal.hidden = true;
    teamMemberModal.setAttribute('aria-hidden', 'true');
    pendingTeamMemberTrackerId = null;
    teamMemberQrRequestId += 1;
    teamMemberQrInFlight = false;
    setTeamMemberModalLoading(false);
    updateTeamMemberActionsState();
    updateTeamsEmptyState();
  };

  const setTeamMemberModalStatus = (message, { i18nKey = null } = {}) => {
    if (!teamMemberStatus) return;
    if (typeof message === 'string') teamMemberStatus.textContent = message;
    if (i18nKey) {
      teamMemberStatus.dataset.i18n = i18nKey;
    } else {
      teamMemberStatus.dataset.i18n = '';
    }
  };

  const setTeamMemberModalLoading = (isLoading) => {
    if (teamMemberQrLoading) {
      teamMemberQrLoading.hidden = !isLoading;
      teamMemberQrLoading.setAttribute('aria-hidden', String(!isLoading));
    }
    if (teamMemberQr && isLoading) {
      teamMemberQr.hidden = true;
      teamMemberQr.removeAttribute('src');
    }
  };

  const setTeamMemberModalQr = (payload) => {
    const text = typeof payload === 'string' ? payload : '';
    const qrUrl = text ? generateQrDataUrl(text, 560, 6) : null;
    if (teamMemberQr) {
      if (qrUrl) {
        setTeamMemberModalLoading(false);
        teamMemberQr.hidden = false;
        teamMemberQr.src = qrUrl;
      } else {
        teamMemberQr.hidden = true;
        teamMemberQr.removeAttribute('src');
      }
    }
    if (teamMemberStatus) {
      const key = qrUrl ? 'teams.memberModal.subtitle' : 'teams.memberModal.error';
      teamMemberStatus.dataset.i18n = key;
      teamMemberStatus.textContent = t(
        key,
        qrUrl ? 'Scan this QR code to join the team.' : 'Unable to render QR code.'
      );
    }
    return qrUrl;
  };

  const openTeamMemberModalForTracker = async (trackerId, { startTracking = false } = {}) => {
    if (!teamMemberModal) return;
    if (!teamsSessionId) {
      showToast(t('teams.noActiveSessionAction', 'Start or resume a session to add team members.'), 'error');
      return;
    }
    if (teamMemberQrInFlight) return;
    if (!firebaseAdminCredentialsReady) {
      showToast(t('teams.addMemberRequiresAdmin', 'Load Firebase Admin credentials to add team members.'), 'error');
      return;
    }
    const resolvedId = String(trackerId || '').trim();
    if (!resolvedId) return;
    teamMemberModal.hidden = false;
    teamMemberModal.setAttribute('aria-hidden', 'false');
    pendingTeamMemberTrackerId = resolvedId;
    updateTeamsEmptyState();
    if (teamMemberQr) {
      teamMemberQr.hidden = true;
      teamMemberQr.removeAttribute('src');
    }
    setTeamMemberModalLoading(true);
    const requestId = (teamMemberQrRequestId += 1);
    teamMemberQrInFlight = true;
    updateTeamMemberActionsState();
    setTeamMemberModalStatus(t('teams.memberModal.generating', 'Generating secure QR code...'), {
      i18nKey: 'teams.memberModal.generating'
    });
    try { teamMemberClose?.focus(); } catch {}
    let tokenResult = null;
    try {
      tokenResult = await requestFirebaseAnonymousToken();
    } catch (err) {
      tokenResult = {
        ok: false,
        error: t('teams.memberModal.tokenError', 'Unable to create a secure access token.'),
        i18nKey: 'teams.memberModal.tokenError'
      };
    }
    if (requestId !== teamMemberQrRequestId) return;
    teamMemberQrInFlight = false;
    updateTeamMemberActionsState();
    setTeamMemberModalLoading(false);
    if (!tokenResult || !tokenResult.ok) {
      const message = tokenResult?.error || t('teams.memberModal.tokenError', 'Unable to create a secure access token.');
      setTeamMemberModalStatus(message, { i18nKey: tokenResult?.i18nKey });
      showToast(message, 'error');
      if (startTracking) {
        pendingTeamMemberTrackerId = null;
        updateTeamsEmptyState();
      }
      return;
    }
    const payload = buildTeamMemberPayload(resolvedId, tokenResult.token);
    const qrUrl = setTeamMemberModalQr(payload);
    if (!qrUrl) {
      const message = t('teams.memberModal.error', 'Unable to render QR code.');
      setTeamMemberModalStatus(message, { i18nKey: 'teams.memberModal.error' });
      showToast(message, 'error');
      if (startTracking) {
        pendingTeamMemberTrackerId = null;
        updateTeamsEmptyState();
      }
      return;
    }
    if (startTracking) startTrackingFromModal();
  };

  const openTeamMemberModal = () => {
    const trackerId = generateTrackerId();
    void openTeamMemberModalForTracker(trackerId, { startTracking: true });
  };

  const openTeamMemberQrModal = (trackerId) => {
    void openTeamMemberModalForTracker(trackerId, { startTracking: false });
  };

  const startTrackingFromModal = () => {
    const trackerId = String(pendingTeamMemberTrackerId || '').trim();
    if (!trackerId) return;
    if (!teamsSessionId) {
      showToast(t('teams.noActiveSessionAction', 'Start or resume a session to add team members.'), 'error');
      return;
    }
    const color = pickRandomTrackerColor();
    ensureTeamTracker(trackerId, { color });
    renderTrackersList();
    updateTrackersPanelState();
    appendTrackerToSessionDocument(trackerId).catch((err) => {
      console.warn('Failed to persist tracker ID on session document', err);
    });

    const started = startTrackerSubscription(trackerId);
    if (started) {
      showToast(t('teams.trackingStarted', 'Tracking started'));
    }
  };

  const setTrimMemberMapEmpty = (message) => {
    if (!trimMemberMapEmpty) return;
    const text = typeof message === 'string' ? message : '';
    if (text) {
      trimMemberMapEmpty.textContent = text;
      trimMemberMapEmpty.hidden = false;
    } else {
      trimMemberMapEmpty.hidden = true;
    }
  };

  const formatTrimMemberTime = (timestamp) => {
    if (!Number.isFinite(timestamp)) return '';
    try {
      return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatTrimMemberDate = (timestamp) => {
    if (!Number.isFinite(timestamp)) return '';
    try {
      return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatTrimMemberLabel = (index, total, timestamp) => {
    if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) return '—';
    const count = `${index + 1}/${total}`;
    const time = formatTrimMemberTime(timestamp);
    return time ? `${count} @ ${time}` : count;
  };

  const formatTrimMemberLength = (meters) => {
    if (!Number.isFinite(meters)) return '';
    if (meters >= 1000) {
      const km = meters / 1000;
      const digits = km >= 100 ? 0 : (km >= 10 ? 1 : 2);
      return `${km.toFixed(digits)} km`;
    }
    if (meters >= 100) return `${Math.round(meters)} m`;
    return `${meters.toFixed(1)} m`;
  };

  const computeTrimMemberLengthMeters = (slice) => {
    if (!Array.isArray(slice) || slice.length < 2) return 0;
    let meters = 0;
    for (let i = 1; i < slice.length; i += 1) {
      meters += haversineMeters(slice[i - 1], slice[i]);
    }
    return meters;
  };

  const updateTrimMemberRangeUI = (slice, lengthMeters) => {
    const total = trimMemberPositions.length;
    const max = Math.max(1, total - 1);
    const startPct = total > 1 ? (trimMemberStartIndex / max) * 100 : 0;
    const endPct = total > 1 ? (trimMemberEndIndex / max) * 100 : 100;
    if (trimMemberSlider) {
      trimMemberSlider.style.setProperty('--trim-start', `${startPct}%`);
      trimMemberSlider.style.setProperty('--trim-end', `${endPct}%`);
    }
    const startTs = trimMemberPositions[trimMemberStartIndex]?.timestamp;
    const endTs = trimMemberPositions[trimMemberEndIndex]?.timestamp;
    if (trimMemberRangeStartLabel) {
      trimMemberRangeStartLabel.textContent = formatTrimMemberLabel(trimMemberStartIndex, total, startTs);
    }
    if (trimMemberRangeStartDate) {
      const date = formatTrimMemberDate(startTs);
      trimMemberRangeStartDate.textContent = date || '—';
    }
    if (trimMemberRangeEndLabel) {
      trimMemberRangeEndLabel.textContent = formatTrimMemberLabel(trimMemberEndIndex, total, endTs);
    }
    if (trimMemberRangeEndDate) {
      const date = formatTrimMemberDate(endTs);
      trimMemberRangeEndDate.textContent = date || '—';
    }
    const activeSlice = Array.isArray(slice) ? slice : getTrimMemberSlice();
    const pointsCount = activeSlice.length;
    const meters = Number.isFinite(lengthMeters) ? lengthMeters : computeTrimMemberLengthMeters(activeSlice);
    if (trimMemberRangeLength) {
      const label = total ? formatTrimMemberLength(meters) : '';
      trimMemberRangeLength.textContent = label || '—';
    }
    if (trimMemberRangePoints) {
      trimMemberRangePoints.textContent = total ? `${pointsCount} of ${total} points` : 'No points';
    }
    if (trimMemberRangeStart && trimMemberRangeEnd) {
      const startOnTop = trimMemberStartIndex >= trimMemberEndIndex;
      trimMemberRangeStart.style.zIndex = startOnTop ? '4' : '2';
      trimMemberRangeEnd.style.zIndex = startOnTop ? '3' : '4';
    }
  };

  const getTrimMemberSlice = () => {
    if (!Array.isArray(trimMemberPositions) || trimMemberPositions.length === 0) return [];
    const total = trimMemberPositions.length;
    let start = Number.isFinite(trimMemberStartIndex) ? trimMemberStartIndex : 0;
    let end = Number.isFinite(trimMemberEndIndex) ? trimMemberEndIndex : total - 1;
    start = Math.max(0, Math.min(total - 1, start));
    end = Math.max(start, Math.min(total - 1, end));
    return trimMemberPositions.slice(start, end + 1);
  };

  const computeTrimMemberBounds = (coords) => {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    coords.forEach((coord) => {
      const lng = Array.isArray(coord) ? coord[0] : null;
      const lat = Array.isArray(coord) ? coord[1] : null;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
    return [[minLng, minLat], [maxLng, maxLat]];
  };

  const ensureTrimMemberMapLayers = () => {
    if (!trimMemberMap) return;
    if (!trimMemberMap.getSource(TRIM_MEMBER_PATH_SOURCE_ID)) {
      trimMemberMap.addSource(TRIM_MEMBER_PATH_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!trimMemberMap.getSource(TRIM_MEMBER_POINTS_SOURCE_ID)) {
      trimMemberMap.addSource(TRIM_MEMBER_POINTS_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!trimMemberMap.getLayer(TRIM_MEMBER_PATH_LAYER_ID)) {
      trimMemberMap.addLayer({
        id: TRIM_MEMBER_PATH_LAYER_ID,
        type: 'line',
        source: TRIM_MEMBER_PATH_SOURCE_ID,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'line-width': 3
        }
      });
    }
    if (!trimMemberMap.getLayer(TRIM_MEMBER_POINTS_LAYER_ID)) {
      trimMemberMap.addLayer({
        id: TRIM_MEMBER_POINTS_LAYER_ID,
        type: 'circle',
        source: TRIM_MEMBER_POINTS_SOURCE_ID,
        paint: {
          'circle-color': [
            'match',
            ['get', 'kind'],
            'start', '#22c55e',
            'end', '#ef4444',
            '#3b82f6'
          ],
          'circle-radius': 5,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  };

  const ensureTrimMemberMap = () => {
    if (!trimMemberMapEl) return false;
    if (trimMemberMap) return true;
    trimMemberMapUnavailable = false;
    if (!(window).mapboxgl) {
      trimMemberMapUnavailable = true;
      setTrimMemberMapEmpty('Map unavailable.');
      return false;
    }
    const accessToken = (localStorage.getItem('map.accessToken') || defaultAccessToken || '').trim();
    if (!accessToken) {
      trimMemberMapUnavailable = true;
      setTrimMemberMapEmpty('Map unavailable.');
      return false;
    }
    try {
      (window).mapboxgl.accessToken = accessToken;
      const styleUrl = (getTargetMapStyleUrl() || DEFAULT_STYLE_URL || '').trim();
      trimMemberMap = new (window).mapboxgl.Map({
        container: trimMemberMapEl,
        style: styleUrl || DEFAULT_STYLE_URL,
        center: [defaultStartLng, defaultStartLat],
        zoom: Number.isFinite(defaultStartZoom) ? defaultStartZoom : DEFAULT_START_ZOOM,
        attributionControl: false,
        preserveDrawingBuffer: true
      });
      trimMemberMapReady = false;
      trimMemberMap.on('load', () => {
        trimMemberMapReady = true;
        ensureTrimMemberMapLayers();
        updateTrimMemberMapData();
      });
      trimMemberMap.on('style.load', () => {
        ensureTrimMemberMapLayers();
        updateTrimMemberMapData();
      });
      return true;
    } catch (err) {
      console.error('Trim map init failed', err);
      trimMemberMapUnavailable = true;
      setTrimMemberMapEmpty('Map unavailable.');
      return false;
    }
  };

  const updateTrimMemberMapData = () => {
    const total = trimMemberPositions.length;
    if (trimMemberMapUnavailable) {
      setTrimMemberMapEmpty('Map unavailable.');
    } else if (!total) {
      setTrimMemberMapEmpty('No location data yet.');
    } else {
      setTrimMemberMapEmpty('');
    }
    const hasChanges = total > 0 && (trimMemberStartIndex > 0 || trimMemberEndIndex < total - 1);
    if (trimMemberExtract) {
      trimMemberExtract.hidden = false;
      trimMemberExtract.disabled = !hasChanges;
    }
    const slice = getTrimMemberSlice();
    const lengthMeters = computeTrimMemberLengthMeters(slice);
    const lengthLabel = formatTrimMemberLength(lengthMeters);
    if (trimMemberStatus) {
      if (!total) {
        trimMemberStatus.textContent = 'No location data yet.';
      } else if (!hasChanges) {
        trimMemberStatus.textContent = `Showing full track (${total} points${lengthLabel ? `, ${lengthLabel}` : ''})`;
      } else {
        trimMemberStatus.textContent = `Showing points ${trimMemberStartIndex + 1}-${trimMemberEndIndex + 1} of ${total}${lengthLabel ? ` (${lengthLabel})` : ''}`;
      }
    }
    updateTrimMemberRangeUI(slice, lengthMeters);
    if (!trimMemberMap || !trimMemberMapReady) return;
    const coords = slice.map((pos) => [pos.longitude, pos.latitude]).filter((pair) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
    const lineFeatures = [];
    if (coords.length >= 2) {
      lineFeatures.push({
        type: 'Feature',
        properties: { color: trimMemberColor || '#3b82f6' },
        geometry: { type: 'LineString', coordinates: coords }
      });
    }
    const pointFeatures = [];
    if (coords.length >= 1) {
      pointFeatures.push({ type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: coords[0] } });
      if (coords.length > 1) {
        pointFeatures.push({ type: 'Feature', properties: { kind: 'end' }, geometry: { type: 'Point', coordinates: coords[coords.length - 1] } });
      }
    }
    try {
      const pathSource = trimMemberMap.getSource(TRIM_MEMBER_PATH_SOURCE_ID);
      if (pathSource) pathSource.setData({ type: 'FeatureCollection', features: lineFeatures });
      const pointSource = trimMemberMap.getSource(TRIM_MEMBER_POINTS_SOURCE_ID);
      if (pointSource) pointSource.setData({ type: 'FeatureCollection', features: pointFeatures });
    } catch (err) {
      console.warn('Trim map update failed', err);
    }
    if (trimMemberFitNextUpdate && coords.length) {
      trimMemberFitNextUpdate = false;
      const bounds = computeTrimMemberBounds(coords);
      if (bounds) {
        try {
          trimMemberMap.fitBounds(bounds, { padding: 36, duration: 0 });
        } catch {}
      } else if (coords[0]) {
        try {
          trimMemberMap.jumpTo({ center: coords[0], zoom: Math.max(12, trimMemberMap.getZoom() || 12) });
        } catch {}
      }
    }
  };

  const syncTrimMemberRange = (source) => {
    const total = trimMemberPositions.length;
    if (!total) return;
    let startVal = Number(trimMemberRangeStart?.value);
    let endVal = Number(trimMemberRangeEnd?.value);
    if (!Number.isFinite(startVal)) startVal = 0;
    if (!Number.isFinite(endVal)) endVal = total - 1;
    if (startVal > endVal) {
      if (source === 'start') endVal = startVal;
      else startVal = endVal;
    }
    trimMemberStartIndex = Math.max(0, Math.min(total - 1, startVal));
    trimMemberEndIndex = Math.max(trimMemberStartIndex, Math.min(total - 1, endVal));
    if (trimMemberRangeStart) trimMemberRangeStart.value = String(trimMemberStartIndex);
    if (trimMemberRangeEnd) trimMemberRangeEnd.value = String(trimMemberEndIndex);
  };

  const handleTrimMemberRangeInput = (source) => {
    syncTrimMemberRange(source);
    updateTrimMemberMapData();
  };

  const openTrimMemberModalWithData = ({ positions, displayName, color, title, sourceType, sourceId } = {}) => {
    if (!trimMemberModal) return;
    trimMemberActiveId = sourceId || null;
    trimMemberDisplayName = displayName || '';
    trimMemberColor = color || null;
    trimMemberMapUnavailable = false;
    trimMemberSourceType = sourceType || null;
    trimMemberSourceFeatureId = sourceType === 'gpx' ? sourceId || null : null;
    if (trimMemberTitle) trimMemberTitle.textContent = title || 'Trim member session';
    const list = Array.isArray(positions) ? positions : [];
    trimMemberPositions = list
      .map((pos) => {
        const longitude = Number(pos?.longitude);
        const latitude = Number(pos?.latitude);
        const rawTs = pos?.timestamp;
        const timestamp = Number.isFinite(rawTs) ? Number(rawTs) : null;
        return { longitude, latitude, timestamp };
      })
      .filter((pos) => Number.isFinite(pos.longitude) && Number.isFinite(pos.latitude));
    const max = Math.max(0, trimMemberPositions.length - 1);
    trimMemberStartIndex = 0;
    trimMemberEndIndex = max;
    if (trimMemberRangeStart) {
      trimMemberRangeStart.min = '0';
      trimMemberRangeStart.max = String(max);
      trimMemberRangeStart.value = '0';
      trimMemberRangeStart.disabled = trimMemberPositions.length === 0;
    }
    if (trimMemberRangeEnd) {
      trimMemberRangeEnd.min = '0';
      trimMemberRangeEnd.max = String(max);
      trimMemberRangeEnd.value = String(max);
      trimMemberRangeEnd.disabled = trimMemberPositions.length === 0;
    }
    trimMemberFitNextUpdate = true;
    updateTrimMemberMapData();
    trimMemberModal.hidden = false;
    trimMemberModal.setAttribute('aria-hidden', 'false');
    try { trimMemberClose?.focus(); } catch {}
    if (ensureTrimMemberMap()) {
      setTimeout(() => {
        try { trimMemberMap?.resize(); } catch {}
        try { updateTrimMemberMapData(); } catch {}
      }, 60);
    }
  };

  const openTrimMemberModal = (trackerId) => {
    if (!trimMemberModal) return;
    const resolvedId = String(trackerId || '').trim();
    if (!resolvedId) return;
    const tracker = trackerStore.get(resolvedId);
    const entry = trackerPositionsStore.get(resolvedId);
    const positions = Array.isArray(entry?.positions) ? entry.positions : [];
    openTrimMemberModalWithData({
      positions,
      displayName: tracker ? getTrackerDisplayName(tracker) : resolvedId,
      color: tracker?.color || null,
      title: 'Trim member session',
      sourceType: 'tracker',
      sourceId: resolvedId
    });
  };

  const openTrimMemberModalForFeature = (feature) => {
    if (!trimMemberModal || !feature) return;
    const geom = feature.geometry;
    if (!geom) return;
    if (geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) {
      showToast('Only line features can be trimmed.', 'error');
      return;
    }
    const coords = geom.coordinates;
    if (coords.length < 2) {
      showToast('Line feature has no trim range.', 'error');
      return;
    }
    const positions = coords.map((coord) => ({
      longitude: Array.isArray(coord) ? Number(coord[0]) : NaN,
      latitude: Array.isArray(coord) ? Number(coord[1]) : NaN,
      timestamp: null
    }));
    const featureNameRaw = sanitizeFeatureNameDraft(feature.properties?.name || '');
    const displayName = featureNameRaw || 'Line feature';
    const isGpx = feature.properties?.importSource === 'gpx';
    openTrimMemberModalWithData({
      positions,
      displayName,
      color: feature.properties?.color || null,
      title: isGpx ? 'Trim GPX feature' : 'Trim line feature',
      sourceType: isGpx ? 'gpx' : 'feature',
      sourceId: feature.properties?.id || null
    });
  };

  const closeTrimMemberModal = () => {
    if (!trimMemberModal) return;
    trimMemberModal.hidden = true;
    trimMemberModal.setAttribute('aria-hidden', 'true');
    trimMemberActiveId = null;
    trimMemberPositions = [];
    trimMemberStartIndex = 0;
    trimMemberEndIndex = 0;
    trimMemberDisplayName = '';
    trimMemberColor = null;
    trimMemberFitNextUpdate = false;
    trimMemberMapUnavailable = false;
    trimMemberSourceType = null;
    trimMemberSourceFeatureId = null;
    if (trimMemberTitle) trimMemberTitle.textContent = 'Trim member session';
    setTrimMemberMapEmpty('');
  };

  const handleTrimMemberExtract = () => {
    const storeRef = (window)._drawStore;
    if (!storeRef || !Array.isArray(storeRef.features)) {
      showToast('Unable to add feature. Drawing store is not ready.', 'error');
      return;
    }
    const slice = getTrimMemberSlice();
    if (!slice.length) {
      showToast('No data to extract.', 'error');
      return;
    }
    const coords = slice.map((pos) => [pos.longitude, pos.latitude]);
    const geometry = coords.length > 1
      ? { type: 'LineString', coordinates: coords }
      : { type: 'Point', coordinates: coords[0] };
    const baseName = trimMemberDisplayName
      || (trimMemberSourceType === 'gpx'
        ? 'GPX track'
        : (trimMemberSourceType === 'feature' ? 'Line feature' : (trimMemberActiveId || 'Tracker')));
    const featureName = `Trimmed ${baseName}`;
    const kind = geometry.type === 'LineString' ? 'line' : 'poi';
    const generateId = () => (typeof newId === 'function')
      ? newId()
      : `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const feature = {
      type: 'Feature',
      geometry,
      properties: {
        id: generateId(),
        kind,
        name: featureName,
        color: trimMemberColor || '#1565C0'
      }
    };
    const hideOriginalLine = () => {
      if (!trimMemberSourceFeatureId) return false;
      const original = storeRef.features.find((f) => f?.properties?.id === trimMemberSourceFeatureId);
      if (!original || !original.properties) return false;
      original.properties._featureHidden = true;
      const relatedId = original.properties.id;
      storeRef.features.forEach((feat) => {
        if (feat?.properties?.relatedLineId === relatedId) {
          feat.properties._featureHidden = true;
        }
      });
      return true;
    };
    storeRef.features.push(feature);
    try {
      if (geometry.type === 'LineString' && typeof addLineEndpoints === 'function') {
        addLineEndpoints(feature, coords);
      }
    } catch {}
    const shouldHideOriginal = trimMemberSourceType === 'feature' || trimMemberSourceType === 'gpx';
    if (shouldHideOriginal) hideOriginalLine();
    try {
      if (typeof (window)._refreshDraw === 'function') (window)._refreshDraw();
      else if (typeof refreshDraw === 'function') refreshDraw();
    } catch {}
    try { if (typeof updateDrawingsPanel === 'function') updateDrawingsPanel(); } catch {}
    setDirty(true);
    requestFirestoreFeaturesSync(0);
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
    try { if (typeof computeFeatureBounds === 'function' && typeof focusMapOnBounds === 'function') focusMapOnBounds(computeFeatureBounds([feature])); } catch {}
    showToast('Feature extracted');
    closeTrimMemberModal();
  };

  function ensureRecordingEntry(tracker) {
    if (!tracker || !tracker.id) return null;
    let entry = trackersRecordingState.entries.get(tracker.id);
    if (!entry) {
      entry = {
        id: tracker.id,
        color: tracker.color || null,
        name: tracker.name || null,
        poiIcon: typeof tracker.poiIcon === 'string' ? tracker.poiIcon : null,
        samples: [],
        segments: []
      };
      trackersRecordingState.entries.set(tracker.id, entry);
    } else {
      if (!entry.color && tracker.color) entry.color = tracker.color;
      if (!entry.name && tracker.name) entry.name = tracker.name;
      if (!entry.poiIcon && tracker.poiIcon) entry.poiIcon = tracker.poiIcon;
    }
    return entry;
  }

  function captureRecordingSample(merged, prev, movementDistance, shouldAppendSegment, timestamp) {
    if (!trackersRecordingState.active) return;
    const entry = ensureRecordingEntry(merged);
    if (!entry) return;
    const sample = {
      timestamp,
      longitude: Number.isFinite(merged.longitude) ? merged.longitude : null,
      latitude: Number.isFinite(merged.latitude) ? merged.latitude : null,
      altitude: Number.isFinite(merged.altitude) ? merged.altitude : null,
      battery: Number.isFinite(merged.battery) ? merged.battery : null,
      hops: Number.isFinite(merged.hops) ? merged.hops : null,
      raw: merged.raw || null
    };
    entry.samples.push(sample);
    if (shouldAppendSegment && prev && Number.isFinite(prev.longitude) && Number.isFinite(prev.latitude) && Number.isFinite(merged.longitude) && Number.isFinite(merged.latitude)) {
      entry.segments.push({
        from: { longitude: prev.longitude, latitude: prev.latitude },
        to: { longitude: merged.longitude, latitude: merged.latitude },
        distance: movementDistance,
        timestamp,
        color: merged.color || entry.color || null
      });
    }
    trackersRecordingState.updatedAt = timestamp;
    if (!trackersRecordingHasData) {
      trackersRecordingHasData = true;
      refreshTrackersControlsState();
    }
  }

  function beginNewTrackersRecording() {
    if (trackersRecordingState.active) return;
    resetTrackersRecordingData();
    trackersRecordingState.active = true;
    trackersRecordingState.startedAt = Date.now();
    refreshTrackersControlsState();
    showToast('Recording started');
  }

  function pauseTrackersRecording() {
    if (!trackersRecordingState.active) return;
    trackersRecordingState.active = false;
    refreshTrackersControlsState();
    showToast('Recording paused');
  }

  function resumeTrackersRecording() {
    if (trackersRecordingState.active) return;
    trackersRecordingState.active = true;
    if (!Number.isFinite(trackersRecordingState.startedAt)) trackersRecordingState.startedAt = Date.now();
    refreshTrackersControlsState();
    showToast('Recording resumed');
  }

  function handleTrackersRecordClick() {
    if (trackersRecordingState.active) {
      pauseTrackersRecording();
      return;
    }
    const hasExistingData = trackersRecordingHasData && trackersRecordingState.entries.size > 0;
    if (hasExistingData) {
      const resumeChoice = confirm('Resume the previous recording? Click OK to resume, or Cancel to restart from zero (previous data will be discarded).');
      if (resumeChoice) {
        resumeTrackersRecording();
        return;
      }
      const restart = confirm('Start a new recording from zero? This will discard the previous recording.');
      if (!restart) {
        refreshTrackersControlsState();
        return;
      }
      beginNewTrackersRecording();
      return;
    }
    beginNewTrackersRecording();
  }

  function appendSuffixToFilename(base, suffix) {
    const text = String(base || '');
    const lastSlash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
    const dir = lastSlash >= 0 ? text.slice(0, lastSlash + 1) : '';
    const name = lastSlash >= 0 ? text.slice(lastSlash + 1) : text;
    const dot = name.lastIndexOf('.');
    if (dot > 0) {
      return `${dir}${name.slice(0, dot)}${suffix}${name.slice(dot)}`;
    }
    return `${dir}${name}${suffix}`;
  }

  function getTrackersSuggestedPath() {
    let base = currentFilePath || getSuggestedFilename();
    if (!base) base = `trackers_${Date.now()}.json`;
    let suggestion = appendSuffixToFilename(base, '_trackers');
    if (!suggestion.toLowerCase().endsWith('.json')) suggestion += '.json';
    return suggestion;
  }

  function cloneTrackerSample(sample) {
    if (!sample || typeof sample !== 'object') return null;
    const ts = Number(sample.timestamp);
    const longitude = Number(sample.longitude);
    const latitude = Number(sample.latitude);
    const altitude = Number(sample.altitude);
    const battery = Number(sample.battery);
    const hops = Number(sample.hops);
    return {
      timestamp: Number.isFinite(ts) ? ts : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      altitude: Number.isFinite(altitude) ? altitude : null,
      battery: Number.isFinite(battery) ? battery : null,
      hops: Number.isFinite(hops) ? hops : null,
      raw: typeof sample.raw === 'string' ? sample.raw : null
    };
  }

  function cloneTrackerSegment(segment, fallbackColor) {
    if (!segment || typeof segment !== 'object') return null;
    const fromLng = Number(segment?.from?.longitude);
    const fromLat = Number(segment?.from?.latitude);
    const toLng = Number(segment?.to?.longitude);
    const toLat = Number(segment?.to?.latitude);
    if (!Number.isFinite(fromLng) || !Number.isFinite(fromLat) || !Number.isFinite(toLng) || !Number.isFinite(toLat)) return null;
    const distance = Number(segment.distance);
    const timestamp = Number(segment.timestamp);
    const color = typeof segment.color === 'string' ? segment.color : (fallbackColor || null);
    return {
      from: { longitude: fromLng, latitude: fromLat },
      to: { longitude: toLng, latitude: toLat },
      distance: Number.isFinite(distance) ? distance : null,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
      color
    };
  }

  function getTrackersRecordingPayload() {
    const trackers = [];
    trackersRecordingState.entries.forEach((entry, key) => {
      if (!entry) return;
      const id = entry.id || key;
      if (!id) return;
      const color = typeof entry.color === 'string' ? entry.color : null;
      const poiIcon = typeof entry.poiIcon === 'string' ? entry.poiIcon : null;
      const samples = Array.isArray(entry.samples) ? entry.samples.map(cloneTrackerSample).filter(Boolean) : [];
      const segments = Array.isArray(entry.segments) ? entry.segments.map((seg) => cloneTrackerSegment(seg, color)).filter(Boolean) : [];
      if (!samples.length && !segments.length) return;
      trackers.push({
        id,
        name: typeof entry.name === 'string' ? entry.name : null,
        color,
        poiIcon,
        samples,
        segments
      });
    });
    const now = Date.now();
    const startedAt = Number.isFinite(trackersRecordingState.startedAt) ? trackersRecordingState.startedAt : null;
    const updatedAt = Number.isFinite(trackersRecordingState.updatedAt) ? trackersRecordingState.updatedAt : null;
    return {
      type: 'TrackerRecording',
      version: 1,
      startedAt,
      updatedAt,
      exportedAt: now,
      trackers
    };
  }

  function normalizeTrackersRecordingPayload(data) {
    if (!data || typeof data !== 'object') return null;
    const trackersInput = Array.isArray(data.trackers) ? data.trackers : [];
    const trackers = [];
    let minTs = Infinity;
    let maxTs = -Infinity;
    trackersInput.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) return;
      const name = typeof item.name === 'string' ? item.name : null;
      const color = typeof item.color === 'string' ? item.color : null;
      const poiIcon = typeof item.poiIcon === 'string'
        ? item.poiIcon
        : (typeof item.symbol === 'string' ? item.symbol : null);
      const samples = Array.isArray(item.samples) ? item.samples.map(cloneTrackerSample).filter(Boolean) : [];
      const segments = Array.isArray(item.segments) ? item.segments.map((seg) => cloneTrackerSegment(seg, color)).filter(Boolean) : [];
      samples.forEach((sample) => {
        if (Number.isFinite(sample.timestamp)) {
          if (sample.timestamp < minTs) minTs = sample.timestamp;
          if (sample.timestamp > maxTs) maxTs = sample.timestamp;
        }
      });
      segments.forEach((segment) => {
        if (Number.isFinite(segment.timestamp)) {
          if (segment.timestamp < minTs) minTs = segment.timestamp;
          if (segment.timestamp > maxTs) maxTs = segment.timestamp;
        }
      });
      if (!samples.length && !segments.length) return;
      trackers.push({ id, name, color, poiIcon, samples, segments });
    });
    if (!trackers.length) return null;
    const startedAt = Number.isFinite(Number(data.startedAt)) ? Number(data.startedAt) : (Number.isFinite(minTs) ? minTs : null);
    const updatedAt = Number.isFinite(Number(data.updatedAt)) ? Number(data.updatedAt) : (Number.isFinite(maxTs) ? maxTs : startedAt);
    return { trackers, startedAt, updatedAt };
  }

  function applyImportedTrackers(imported) {
    if (!imported || !Array.isArray(imported.trackers) || imported.trackers.length === 0) return false;
    resetTrackersRecordingData();
    trackersRecordingState.active = false;
    let overallMin = Infinity;
    let overallMax = -Infinity;
    imported.trackers.forEach((item) => {
      const entry = {
        id: item.id,
        name: item.name || null,
        color: item.color || null,
        poiIcon: item.poiIcon || null,
        samples: Array.isArray(item.samples) ? item.samples.slice().sort((a, b) => (Number(a.timestamp || 0) - Number(b.timestamp || 0))) : [],
        segments: Array.isArray(item.segments) ? item.segments.slice() : []
      };
      const existingTracker = trackerStore.get(item.id);
      let resolvedColor = entry.color || existingTracker?.color || null;
      if (!resolvedColor) resolvedColor = nextTrackerColor();
      entry.color = resolvedColor;
      if (!entry.poiIcon && existingTracker?.poiIcon) entry.poiIcon = existingTracker.poiIcon;
      trackersRecordingState.entries.set(item.id, {
        id: entry.id,
        name: entry.name,
        color: resolvedColor,
        poiIcon: entry.poiIcon || null,
        samples: entry.samples.map(cloneTrackerSample).filter(Boolean),
        segments: entry.segments.map((seg) => cloneTrackerSegment(seg, resolvedColor)).filter(Boolean)
      });
      const storedEntry = trackersRecordingState.entries.get(item.id);
      if (!storedEntry) return;
      const history = ensureTrackerHistoryEntry(item.id);
      history.positions.length = 0;
      history.segments.length = 0;
      const pushPosition = (lng, lat, timestamp) => {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        const last = history.positions[history.positions.length - 1];
        if (last && last.longitude === lng && last.latitude === lat) return;
        history.positions.push({
          longitude: lng,
          latitude: lat,
          timestamp: Number.isFinite(timestamp) ? timestamp : null
        });
        if (Number.isFinite(timestamp)) {
          if (timestamp < overallMin) overallMin = timestamp;
          if (timestamp > overallMax) overallMax = timestamp;
        }
      };
      storedEntry.samples.forEach((sample) => {
        pushPosition(sample.longitude, sample.latitude, sample.timestamp);
      });
      if (history.positions.length === 0) {
        storedEntry.segments.forEach((segment) => {
          pushPosition(segment.from.longitude, segment.from.latitude, segment.timestamp);
          pushPosition(segment.to.longitude, segment.to.latitude, segment.timestamp);
        });
      }
      storedEntry.segments.forEach((segment) => {
        history.segments.push({
          from: { longitude: segment.from.longitude, latitude: segment.from.latitude },
          to: { longitude: segment.to.longitude, latitude: segment.to.latitude },
          distance: Number.isFinite(segment.distance) ? segment.distance : null,
          timestamp: segment.timestamp,
          color: segment.color || resolvedColor
        });
        if (Number.isFinite(segment.timestamp)) {
          if (segment.timestamp < overallMin) overallMin = segment.timestamp;
          if (segment.timestamp > overallMax) overallMax = segment.timestamp;
        }
      });
      let lastSample = [...storedEntry.samples].reverse().find((sample) => Number.isFinite(sample.longitude) && Number.isFinite(sample.latitude));
      if (!lastSample && storedEntry.segments.length > 0) {
        const lastSegment = storedEntry.segments[storedEntry.segments.length - 1];
        if (lastSegment && Number.isFinite(lastSegment.to.longitude) && Number.isFinite(lastSegment.to.latitude)) {
          lastSample = {
            longitude: lastSegment.to.longitude,
            latitude: lastSegment.to.latitude,
            altitude: null,
            battery: null,
            hops: null,
            timestamp: Number.isFinite(lastSegment.timestamp) ? lastSegment.timestamp : null,
            raw: null
          };
        }
      }
      if (lastSample) {
        const merged = trackerStore.get(item.id) || { id: item.id };
        trackerStore.set(item.id, {
          id: item.id,
          longitude: lastSample.longitude,
          latitude: lastSample.latitude,
          altitude: Number.isFinite(lastSample.altitude) ? lastSample.altitude : merged.altitude ?? null,
          battery: Number.isFinite(lastSample.battery) ? lastSample.battery : merged.battery ?? null,
          hops: Number.isFinite(lastSample.hops) ? lastSample.hops : merged.hops ?? null,
          updatedAt: Number.isFinite(lastSample.timestamp) ? lastSample.timestamp : (merged.updatedAt || Date.now()),
          raw: lastSample.raw || merged.raw || null,
          name: entry.name || merged.name || null,
          color: resolvedColor,
          poiIcon: entry.poiIcon || merged.poiIcon || null,
          visible: merged.visible === false ? false : true
        });
        const currentTracker = trackerStore.get(item.id);
      }
    });
    trackersRecordingHasData = trackersRecordingState.entries.size > 0;
    trackersRecordingState.imported = true;
    trackersRecordingState.startedAt = Number.isFinite(imported.startedAt) ? imported.startedAt : (Number.isFinite(overallMin) ? overallMin : Date.now());
    trackersRecordingState.updatedAt = Number.isFinite(imported.updatedAt) ? imported.updatedAt : (Number.isFinite(overallMax) ? overallMax : trackersRecordingState.startedAt);
    if (trackersRecordingState.startedAt && trackersRecordingState.updatedAt && trackersRecordingState.updatedAt < trackersRecordingState.startedAt) {
      trackersRecordingState.updatedAt = trackersRecordingState.startedAt;
    }
    updateTrackerSource();
    updateTrackerPathSource();
    renderTrackersList();
    updateTrackersPanelState();
    refreshTrackersControlsState();
    return true;
  }

  async function handleTrackersSave() {
    closeTrackersMenu();
    if (!trackersRecordingHasData) return;
    if (!window.file || typeof window.file.saveTrackers !== 'function') {
      alert(t('alerts.trackerSaveUnavailable', 'Saving tracker recordings is not available in this build.'));
      return;
    }
    const payload = getTrackersRecordingPayload();
    if (!payload.trackers.length) {
      alert(t('alerts.noTrackerSave', 'No tracker data is available to save yet.'));
      return;
    }
    try {
      const defaultPath = getTrackersSuggestedPath();
      const result = await window.file.saveTrackers(payload, defaultPath);
      if (!result || !result.ok) {
        if (!result || !result.canceled) showToast(t('messages.saveFailed', 'Save failed'), 'error');
        return;
      }
      showToast(t('messages.trackersSaved', 'Trackers saved'));
    } catch (err) {
      console.error('Saving trackers failed', err);
      alert(t('alerts.couldNotSaveTrackers', 'Could not save trackers. Check the console for details.'));
      showToast(t('messages.saveFailed', 'Save failed'), 'error');
    }
  }

  async function handleTrackersOpen() {
    closeTrackersMenu();
    if (!window.file || typeof window.file.openTrackers !== 'function') {
      alert(t('alerts.trackerOpenUnavailable', 'Opening tracker recordings is not available in this build.'));
      return;
    }
    if (trackersRecordingHasData && trackersRecordingState.entries.size > 0) {
      const proceed = confirm(t('alerts.openRecordingReplace', 'Opening a recording will replace the current recorded data. Continue?'));
      if (!proceed) return;
    }
    try {
      const defaultPath = getTrackersSuggestedPath();
      const result = await window.file.openTrackers(defaultPath);
      if (!result || !result.ok) {
        if (!result || !result.canceled) showToast(t('messages.openFailed', 'Open failed'), 'error');
        return;
      }
      const normalized = normalizeTrackersRecordingPayload(result.data);
      if (!normalized) {
        alert(t('alerts.noTrackerTracksInFile', 'The selected file does not contain tracker tracks.'));
        return;
      }
      const applied = applyImportedTrackers(normalized);
      if (!applied) {
        alert(t('alerts.noTrackerTracks', 'No tracker tracks could be loaded from the selected file.'));
        return;
      }
      showToast(t('messages.trackerTracksLoaded', 'Tracker tracks loaded'));
    } catch (err) {
      console.error('Opening trackers failed', err);
      alert(t('alerts.couldNotOpenTrackers', 'Could not open tracker tracks. Check the console for details.'));
      showToast(t('messages.openFailed', 'Open failed'), 'error');
    }
  }

  function updateTrackersPanelState() {
    const listEl = trackersItems || q('#trackersItems');
    if (listEl) {
      if (trackerStore.size > 0) listEl.classList.add('is-visible');
      else listEl.classList.remove('is-visible');
    }
    refreshTrackersControlsState();
    updateTeamsEmptyState();
    updateTeamMemberActionsState();
  }

  const trackerColorPalette = ['#ff5722', '#03a9f4', '#8bc34a', '#ffc107', '#9c27b0', '#4caf50', '#00bcd4', '#ff9800'];
  let trackerColorIndex = 0;
  const nextTrackerColor = () => {
    const color = trackerColorPalette[trackerColorIndex % trackerColorPalette.length];
    trackerColorIndex += 1;
    return color;
  };
  const pickRandomTrackerColor = () => {
    if (!trackerColorPalette.length) return nextTrackerColor();
    const idx = Math.floor(Math.random() * trackerColorPalette.length);
    return trackerColorPalette[idx] || nextTrackerColor();
  };

  let editingTrackerId = null;
  let editingTrackerDraft = '';
  let isRenderingTrackers = false;
  const focusTrackerNameField = (el) => {
    try {
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  };

  const toRadians = (deg) => (deg * Math.PI) / 180;
  const haversineMeters = (a, b) => {
    if (!a || !b) return 0;
    const lat1 = toRadians(Number(a.latitude));
    const lat2 = toRadians(Number(b.latitude));
    const dLat = lat2 - lat1;
    const dLon = toRadians(Number(b.longitude) - Number(a.longitude));
    if (!Number.isFinite(lat1) || !Number.isFinite(lat2) || !Number.isFinite(dLat) || !Number.isFinite(dLon)) return 0;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const inner = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const clampedInner = Math.min(1, Math.max(0, inner));
    const earthRadiusMeters = 6371000;
    return 2 * earthRadiusMeters * Math.asin(Math.sqrt(clampedInner));
  };

  const GO_TO_AUTO_CLEAR_METERS = 5;
  const maybeAutoClearTrackerGoTo = (trackerId, coords, { skipUpdate = false, skipPersist = false } = {}) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed || !coords) return false;
    const target = trackerGoToLocations.get(trimmed);
    if (!target) return false;
    const lng = Number(coords.longitude);
    const lat = Number(coords.latitude);
    const toLng = Number(target.longitude);
    const toLat = Number(target.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(toLng) || !Number.isFinite(toLat)) return false;
    const distance = haversineMeters({ longitude: lng, latitude: lat }, { longitude: toLng, latitude: toLat });
    if (!Number.isFinite(distance) || distance > GO_TO_AUTO_CLEAR_METERS) return false;
    trackerGoToLocations.delete(trimmed);
    if (!skipUpdate) {
      try { updateTrackerGoToSource(); } catch {}
    }
    if (!skipPersist && teamsSessionId) {
      void removeTrackerGoToFromSessionDocument(trimmed).then((ok) => {
        if (!ok && teamsSessionId) {
          console.warn('Failed to persist go-to auto-clear', trimmed);
        }
      });
    }
    return true;
  };

  const ensureTrackerHistoryEntry = (trackerId) => {
    let record = trackerPositionsStore.get(trackerId);
    if (!record) {
      record = { positions: [], segments: [] };
      trackerPositionsStore.set(trackerId, record);
    }
    return record;
  };

  const appendTrackerSegment = (trackerId, from, to, distance, color, fromTimestamp, toTimestamp) => {
    const startTs = Number.isFinite(fromTimestamp) ? fromTimestamp : Date.now();
    const endTs = Number.isFinite(toTimestamp) ? toTimestamp : Date.now();
    const entry = ensureTrackerHistoryEntry(trackerId);
    if (entry.positions.length === 0 && Number.isFinite(from?.longitude) && Number.isFinite(from?.latitude)) {
      entry.positions.push({ longitude: from.longitude, latitude: from.latitude, timestamp: startTs });
    }
    const lastPos = entry.positions[entry.positions.length - 1];
    if (!lastPos || lastPos.longitude !== to.longitude || lastPos.latitude !== to.latitude) {
      entry.positions.push({ longitude: to.longitude, latitude: to.latitude, timestamp: endTs });
    }
    entry.segments.push({
      from: { longitude: from.longitude, latitude: from.latitude },
      to: { longitude: to.longitude, latitude: to.latitude },
      distance,
      color,
      timestamp: endTs
    });
  };

  const triggerTrackerRowBlink = (row) => {
    if (!row) return;
    row.classList.add('is-updated');
    setTimeout(() => {
      if (!row.isConnected) return;
      row.classList.remove('is-updated');
    }, 1100);
  };

  const getTrackerDisplayName = (tracker) => {
    if (!tracker) return '';
    const raw = typeof tracker.name === 'string' ? tracker.name.trim() : '';
    if (raw) return raw;
    return tracker.id ? String(tracker.id) : '';
  };

  const getTrackerDisplayTitle = (tracker) => {
    if (!tracker) return '';
    const raw = typeof tracker.title === 'string' ? tracker.title.trim() : '';
    return raw || '';
  };

  const getTrackerLabelText = (tracker) => {
    const name = getTrackerDisplayName(tracker);
    const title = getTrackerDisplayTitle(tracker);
    if (title) return `${name}\n${title}`;
    return name;
  };

  const clearActiveTrackerGoTo = ({ skipToolReset = false } = {}) => {
    if (activeTrackerGoToButton && activeTrackerGoToButton.isConnected) {
      activeTrackerGoToButton.classList.remove('is-active');
      activeTrackerGoToButton.setAttribute('aria-pressed', 'false');
    }
    activeTrackerGoToButton = null;
    activeTrackerGoToId = null;
    if (!skipToolReset && (window)._currentTool === 'team-goto') {
      try { window.setActiveTool?.(null); } catch {}
    }
  };

  const activateTrackerGoTo = (trackerId, buttonEl) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed || !buttonEl) return;
    if (activeTrackerGoToButton && activeTrackerGoToButton !== buttonEl && activeTrackerGoToButton.isConnected) {
      activeTrackerGoToButton.classList.remove('is-active');
      activeTrackerGoToButton.setAttribute('aria-pressed', 'false');
    }
    activeTrackerGoToId = trimmed;
    activeTrackerGoToButton = buttonEl;
    buttonEl.classList.add('is-active');
    buttonEl.setAttribute('aria-pressed', 'true');
    if (typeof window.setActiveTool === 'function') {
      window.setActiveTool('team-goto');
    } else {
      (window)._currentTool = 'team-goto';
    }
  };

  const toggleTrackerGoTo = (trackerId, buttonEl) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return;
    if (activeTrackerGoToId === trimmed) {
      clearActiveTrackerGoTo();
      return;
    }
    activateTrackerGoTo(trimmed, buttonEl);
  };

  const removeTeamMember = async (trackerId) => {
    const trimmed = String(trackerId || '').trim();
    if (!trimmed) return false;

    const hadGoTo = trackerGoToLocations.has(trimmed);

    if (activeTrackerGoToId === trimmed) {
      clearActiveTrackerGoTo();
    }
    if (editingTrackerId === trimmed) {
      editingTrackerId = null;
      editingTrackerDraft = '';
    }
    if (pendingTeamMemberTrackerId === trimmed) {
      try { closeTeamMemberModal(); } catch {}
      pendingTeamMemberTrackerId = null;
    }

    teamsSessionTrackerIds.delete(trimmed);
    trackerStore.delete(trimmed);
    trackerPositionsStore.delete(trimmed);
    trackerGoToLocations.delete(trimmed);
    trackerAutoReveal.delete(trimmed);
    trackerBlinkQueue.delete(trimmed);

    const subscription = trackerSubscriptions.get(trimmed);
    if (subscription) {
      safeUnsubscribe(subscription.unsubscribe);
      if (subscription.trackUnsubscribes instanceof Map) {
        subscription.trackUnsubscribes.forEach((unsub) => safeUnsubscribe(unsub));
        subscription.trackUnsubscribes.clear();
      }
    }
    trackerSubscriptions.delete(trimmed);
    clearTrackerSubscriptionRetry(trimmed);
    trackerSubscriptionRetries.delete(trimmed);

    if (trackersRecordingState.entries.delete(trimmed)) {
      trackersRecordingHasData = trackersRecordingState.entries.size > 0;
    }

    try { updateTrackerSource(); } catch {}
    try { updateTrackerPathSource(); } catch {}
    try { updateTrackerGoToSource(); } catch {}
    renderTrackersList();
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}

    if (teamsSessionId) {
      const [removeOk, deleteOk] = await Promise.all([
        removeTrackerFromSessionDocument(trimmed),
        deleteTeamTrackerDocument(trimmed)
      ]);
      const goToOk = hadGoTo ? await removeTrackerGoToFromSessionDocument(trimmed) : true;
      if (!removeOk || !deleteOk || !goToOk) {
        showToast(t('teams.memberRemoveFailed', 'Unable to remove team member. Check Firebase settings.'), 'error');
        return false;
      }
    }
    return true;
  };

  const renderTrackersList = () => {
    const listEl = trackersItems || q('#trackersItems');
    if (!listEl) { updateTrackersPanelState(); return; }
    const trackers = Array.from(trackerStore.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    isRenderingTrackers = true;
    try {
      listEl.innerHTML = '';
      if (!trackers.length) {
        listEl.classList.remove('is-visible');
      } else {
        listEl.classList.add('is-visible');
      }
      updateTeamsEmptyState();

      trackers.forEach((tracker) => {
        const row = document.createElement('div');
        row.className = 'tracker-row';
        row.dataset.trackerId = tracker.id;
        if (tracker.visible === false) row.classList.add('hidden');

        const displayName = getTrackerDisplayName(tracker);
        const displayTitle = getTrackerDisplayTitle(tracker);

        const header = document.createElement('div');
        header.className = 'tracker-header';

        const nameEl = document.createElement('div');
        nameEl.className = 'tracker-name';
        nameEl.contentEditable = 'true';
        nameEl.textContent = tracker.id === editingTrackerId && editingTrackerDraft ? editingTrackerDraft : displayName;
        nameEl.setAttribute('role', 'textbox');
        nameEl.setAttribute('aria-multiline', 'true');
        nameEl.setAttribute('aria-label', `Tracker ${tracker.id} name`);
        const commitName = () => {
          const value = (nameEl.textContent || '').trim();
          const name = value && value !== tracker.id ? value : null;
          if (name !== (tracker.name || null)) {
            updateTrackerEntry(tracker.id, { name });
          }
        };
        nameEl.addEventListener('focus', () => {
          editingTrackerId = tracker.id;
          editingTrackerDraft = nameEl.textContent || '';
        });
        nameEl.addEventListener('input', () => {
          if (tracker.id === editingTrackerId) {
            editingTrackerDraft = nameEl.textContent || '';
          }
        });
        nameEl.addEventListener('blur', () => {
          if (isRenderingTrackers) return;
          commitName();
          if (editingTrackerId === tracker.id) {
            editingTrackerId = null;
            editingTrackerDraft = '';
          }
        });
        nameEl.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            nameEl.blur();
          }
        });
        header.appendChild(nameEl);
        if (displayTitle) {
          const titleEl = document.createElement('div');
          titleEl.className = 'tracker-title';
          titleEl.textContent = displayTitle;
          header.appendChild(titleEl);
        }

        const meta = document.createElement('div');
        meta.className = 'tracker-meta';
        const idSpan = document.createElement('span');
        idSpan.textContent = `ID ${tracker.id}`;
        meta.appendChild(idSpan);
        if (Number.isFinite(tracker.battery)) {
          const bat = document.createElement('span');
          bat.textContent = `${Math.round(tracker.battery)}%`;
          meta.appendChild(bat);
        }
        if (Number.isFinite(tracker.hops)) {
          const hops = document.createElement('span');
          hops.textContent = `hops ${tracker.hops}`;
          meta.appendChild(hops);
        }
        if (meta.childElementCount <= 1) meta.style.opacity = '0.7';

        const actionsRow = document.createElement('div');
        actionsRow.className = 'tracker-actions-row';

        const actions = document.createElement('div');
        actions.className = 'tracker-actions';

        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'tracker-action tracker-color';
        colorBtn.title = 'Change tracker color';
        const chip = document.createElement('span');
        chip.className = 'tracker-color-chip';
        chip.style.backgroundColor = tracker.color || '#ff5722';
        colorBtn.appendChild(chip);
        colorBtn.addEventListener('click', () => {
          const picker = (window).openColorModal;
          const current = tracker.color || '#ff5722';
          if (typeof picker === 'function') {
            picker(current, (hex) => updateTrackerEntry(tracker.id, { color: hex }));
          } else {
            const hex = prompt('Tracker color (hex)', current);
            if (hex) updateTrackerEntry(tracker.id, { color: hex });
          }
        });
        const trackerHasSymbol = typeof tracker.poiIcon === 'string' && tracker.poiIcon.trim();
        if (trackerHasSymbol) {
          colorBtn.hidden = true;
          colorBtn.setAttribute('aria-hidden', 'true');
        }
        actionsRow.appendChild(colorBtn);

        const poiIconBtn = document.createElement('button');
        poiIconBtn.type = 'button';
        poiIconBtn.className = 'tracker-action tracker-poi-icon-btn';
        const selectLabel = t('teams.symbolButton', 'Team symbol');
        poiIconBtn.title = selectLabel;
        poiIconBtn.setAttribute('aria-label', selectLabel);
        poiIconBtn.appendChild(makeButtonIcon(DRAWING_ICON_PATHS.poiIcon));
        poiIconBtn.addEventListener('click', () => {
          const picker = (window).openTrackerPoiIconModal;
          if (typeof picker === 'function') picker(tracker);
        });

        const qrBtn = document.createElement('button');
        qrBtn.type = 'button';
        qrBtn.className = 'tracker-action tracker-qr';
        const qrTitle = 'Show QR code';
        const qrAria = `Show QR code for ${displayName}`;
        qrBtn.title = qrTitle;
        qrBtn.setAttribute('aria-label', qrAria);
        qrBtn.dataset.defaultTitle = qrTitle;
        qrBtn.dataset.defaultAriaLabel = qrAria;
        const qrDisabled = !firebaseAdminCredentialsReady || teamMemberQrInFlight;
        if (qrDisabled) {
          const reason = !firebaseAdminCredentialsReady
            ? t('teams.addMemberRequiresAdmin', 'Load Firebase Admin credentials to add team members.')
            : t('teams.memberModal.generating', 'Generating secure QR code...');
          qrBtn.disabled = true;
          qrBtn.classList.add('is-disabled');
          qrBtn.setAttribute('aria-disabled', 'true');
          qrBtn.title = reason;
          qrBtn.setAttribute('aria-label', reason);
        }
        const qrIcon = document.createElement('img');
        qrIcon.src = './assets/icons/regular/qr-code.svg';
        qrIcon.alt = '';
        qrIcon.setAttribute('aria-hidden', 'true');
        qrBtn.appendChild(qrIcon);
        qrBtn.addEventListener('click', () => openTeamMemberQrModal(tracker.id));
        actions.appendChild(poiIconBtn);
        actions.appendChild(qrBtn);

        const trimBtn = document.createElement('button');
        trimBtn.type = 'button';
        trimBtn.className = 'tracker-action tracker-trim';
        const trimLabel = 'Trim member session';
        trimBtn.title = trimLabel;
        trimBtn.setAttribute('aria-label', displayName ? `${trimLabel} (${displayName})` : trimLabel);
        const trimIcon = document.createElement('img');
        trimIcon.src = './assets/icons/regular/scissors.svg';
        trimIcon.alt = '';
        trimIcon.setAttribute('aria-hidden', 'true');
        trimBtn.appendChild(trimIcon);
        trimBtn.addEventListener('click', () => openTrimMemberModal(tracker.id));
        actions.appendChild(trimBtn);

        const gotoBtn = document.createElement('button');
        gotoBtn.type = 'button';
        gotoBtn.className = 'tracker-action tracker-goto';
        gotoBtn.title = 'Set go-to location';
        gotoBtn.setAttribute('aria-label', `Set go-to location for ${displayName}`);
        const gotoIcon = document.createElement('img');
        gotoIcon.src = './assets/icons/regular/sneaker-move.svg';
        gotoIcon.alt = '';
        gotoIcon.setAttribute('aria-hidden', 'true');
        gotoBtn.appendChild(gotoIcon);
        const isGoToActive = tracker.id === activeTrackerGoToId;
        gotoBtn.classList.toggle('is-active', isGoToActive);
        gotoBtn.setAttribute('aria-pressed', String(isGoToActive));
        if (isGoToActive) activeTrackerGoToButton = gotoBtn;
        gotoBtn.addEventListener('click', () => toggleTrackerGoTo(tracker.id, gotoBtn));
        actions.appendChild(gotoBtn);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'tracker-action tracker-toggle';
        toggleBtn.title = tracker.visible === false ? 'Show tracker' : 'Hide tracker';
        if (tracker.visible === false) toggleBtn.classList.add('is-off');
        toggleBtn.setAttribute('aria-pressed', String(tracker.visible !== false));
        const toggleIcon = document.createElement('img');
        toggleIcon.src = tracker.visible === false ? './assets/icons/regular/eye-slash.svg' : './assets/icons/regular/eye.svg';
        toggleIcon.alt = '';
        toggleIcon.setAttribute('aria-hidden', 'true');
        toggleBtn.appendChild(toggleIcon);
        toggleBtn.addEventListener('click', () => {
          const visible = tracker.visible === false;
          updateTrackerEntry(tracker.id, { visible });
        });

        const hasValidPosition = Number.isFinite(tracker.longitude) && Number.isFinite(tracker.latitude);
        if (hasValidPosition && !(tracker.longitude === 0 && tracker.latitude === 0)) {
          const focusBtn = document.createElement('button');
          focusBtn.type = 'button';
          focusBtn.className = 'tracker-action tracker-focus';
          focusBtn.title = 'Center map on tracker';
          focusBtn.setAttribute('aria-label', `Center map on tracker ${displayName}`);
          const focusIcon = document.createElement('img');
          focusIcon.src = './assets/icons/regular/crosshair.svg';
          focusIcon.alt = '';
          focusIcon.setAttribute('aria-hidden', 'true');
          focusBtn.appendChild(focusIcon);
          focusBtn.addEventListener('click', () => {
            try {
              const latest = trackerStore.get(tracker.id) || tracker;
              const lng = Number(latest.longitude);
              const lat = Number(latest.latitude);
              if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
              if (lng === 0 && lat === 0) return;
              const map = getMap();
              if (!map) return;
              const currentZoom = map.getZoom();
              map.flyTo({
                center: [lng, lat],
                zoom: Number.isFinite(currentZoom) ? Math.max(12, currentZoom) : 12,
                duration: 600
              });
            } catch (err) {
              console.error('tracker focus failed', err);
            }
          });
          actions.appendChild(focusBtn);
        }

        actions.appendChild(toggleBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'tracker-action tracker-remove';
        const removeLabel = t('teams.removeMember', 'Remove member');
        removeBtn.title = removeLabel;
        removeBtn.setAttribute('aria-label', displayName ? `${removeLabel} (${displayName})` : removeLabel);
        const removeIcon = document.createElement('img');
        removeIcon.src = './assets/icons/regular/trash.svg';
        removeIcon.alt = '';
        removeIcon.setAttribute('aria-hidden', 'true');
        removeBtn.appendChild(removeIcon);
        removeBtn.addEventListener('click', () => {
          const current = trackerStore.get(tracker.id) || tracker;
          const currentName = getTrackerDisplayName(current);
          const confirmBase = t(
            'teams.confirmRemoveMember',
            'Remove this team member? This will stop tracking their updates.'
          );
          const confirmText = currentName ? `${confirmBase}\n\n${currentName}` : confirmBase;
          if (!confirm(confirmText)) return;
          void removeTeamMember(tracker.id);
        });
        actions.appendChild(removeBtn);

        actionsRow.appendChild(actions);

        row.appendChild(header);
        row.appendChild(meta);
        row.appendChild(actionsRow);
        listEl.appendChild(row);

        if (trackerBlinkQueue.has(tracker.id)) {
          trackerBlinkQueue.delete(tracker.id);
          requestAnimationFrame(() => triggerTrackerRowBlink(row));
        }

        if (tracker.id === editingTrackerId) {
          requestAnimationFrame(() => focusTrackerNameField(nameEl));
        }
      });
    } finally {
      isRenderingTrackers = false;
      updateTrackersPanelState();
    }
  };

  const updateTrackerEntry = (id, updates) => {
    const current = trackerStore.get(id);
    if (!current) return;
    const next = { ...current, ...updates };
    trackerStore.set(id, next);
    if (Object.prototype.hasOwnProperty.call(updates || {}, 'color') && updates.color && trackerPositionsStore.has(id)) {
      const entry = trackerPositionsStore.get(id);
      if (entry && Array.isArray(entry.segments)) {
        entry.segments.forEach((segment) => { if (segment) segment.color = updates.color; });
      }
    }
    updateTrackerSource();
    updateTrackerPathSource();
    renderTrackersList();
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
  };

  const getTrackerFeatureCollection = () => {
    const features = [];
    trackerStore.forEach((tracker) => {
      if (!tracker || tracker.visible === false) return;
      if (!Number.isFinite(tracker.longitude) || !Number.isFinite(tracker.latitude)) return;
      const displayName = getTrackerDisplayName(tracker);
      const displayTitle = getTrackerDisplayTitle(tracker);
      const displayLabel = getTrackerLabelText(tracker);
      const poiIcon = typeof tracker.poiIcon === 'string' ? tracker.poiIcon.trim() : '';
      const props = {
        id: tracker.id,
        label: displayLabel,
        text: displayLabel,
        name: displayName,
        color: tracker.color || '#ff5722',
        battery: tracker.battery,
        altitude: tracker.altitude,
        hops: tracker.hops,
        updatedAt: tracker.updatedAt
      };
      if (displayTitle) props.title = displayTitle;
      if (poiIcon) props.poiIcon = poiIcon;
      features.push({
        type: 'Feature',
        properties: props,
        geometry: {
          type: 'Point',
          coordinates: [tracker.longitude, tracker.latitude]
        }
      });
    });
    return { type: 'FeatureCollection', features };
  };

  const getTrackerPathFeatureCollection = () => {
    const features = [];
    trackerPositionsStore.forEach((entry, trackerId) => {
      if (!entry || !Array.isArray(entry.segments)) return;
      entry.segments.forEach((segment, index) => {
        if (!segment || !segment.from || !segment.to) return;
        const { from, to } = segment;
        if (!Number.isFinite(from.longitude) || !Number.isFinite(from.latitude) || !Number.isFinite(to.longitude) || !Number.isFinite(to.latitude)) return;
        features.push({
          type: 'Feature',
          properties: {
            trackerId,
            segmentIndex: index,
            distance: segment.distance,
            timestamp: segment.timestamp,
            color: segment.color
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [from.longitude, from.latitude],
              [to.longitude, to.latitude]
            ]
          }
        });
      });
    });
    return { type: 'FeatureCollection', features };
  };

  const getTrackerGoToFeatureCollection = () => {
    const features = [];
    trackerGoToLocations.forEach((coords, trackerId) => {
      if (!coords) return;
      const tracker = trackerStore.get(trackerId);
      if (!tracker || tracker.visible === false) return;
      const lng = Number(tracker.longitude);
      const lat = Number(tracker.latitude);
      const toLng = Number(coords.longitude);
      const toLat = Number(coords.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(toLng) || !Number.isFinite(toLat)) return;
      const color = tracker.color || '#ff5722';
      features.push({
        type: 'Feature',
        properties: {
          trackerId,
          color,
          kind: 'goto-line'
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [lng, lat],
            [toLng, toLat]
          ]
        }
      });
      features.push({
        type: 'Feature',
        properties: {
          trackerId,
          color,
          kind: 'goto-end'
        },
        geometry: {
          type: 'Point',
          coordinates: [toLng, toLat]
        }
      });
    });
    return { type: 'FeatureCollection', features };
  };

  const ensureTrackerLayer = (map) => {
    if (!map) return;
    try {
      if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) return;
    } catch {}

    let pointsReady = true;
    try {
      if (!map.getSource('trackers')) {
        map.addSource('trackers', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      ensureFeatureLabelBackgroundImage(map);
      ensurePoiIconBackgroundImage(map);
      const trackerHasIconExpr = ['all',
        ['has', 'poiIcon'],
        ['!=', ['coalesce', ['get', 'poiIcon'], ''], '']
      ];
      const trackerLabelTextExpr = ['coalesce', ['get', 'label'], ['get', 'id'], ''];
      const trackerHasLabelExpr = ['!=', trackerLabelTextExpr, ''];
      const trackerLabelOffsetExpr = ['case',
        trackerHasIconExpr,
        ['literal', [1.8, 0]],
        ['literal', [1, 0]]
      ];
      if (!map.getLayer('tracker-dots')) {
        map.addLayer({
          id: 'tracker-dots',
          type: 'circle',
          source: 'trackers',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', trackerHasIconExpr]],
          paint: {
            'circle-radius': 5.75,
            'circle-color': ['coalesce', ['get', 'color'], '#ff5722'],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
          }
        });
      }
      if (!map.getLayer('tracker-icon-bg')) {
        map.addLayer({
          id: 'tracker-icon-bg',
          type: 'symbol',
          source: 'trackers',
          filter: ['all', ['==', ['geometry-type'], 'Point'], trackerHasIconExpr],
          layout: {
            'icon-image': POI_ICON_BG_IMAGE_ID,
            'icon-size': scaleLabelValue(POI_ICON_BG_SIZE),
            'icon-anchor': 'center',
            'icon-offset': [0, 0],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });
      }
      if (!map.getLayer('tracker-icon')) {
        map.addLayer({
          id: 'tracker-icon',
          type: 'symbol',
          source: 'trackers',
          filter: ['all', ['==', ['geometry-type'], 'Point'], trackerHasIconExpr],
          layout: {
            'icon-image': ['get', 'poiIcon'],
            'icon-size': scaleLabelValue(POI_ICON_SIZE),
            'icon-anchor': 'center',
            'icon-offset': [0, 0],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });
      }
      if (!map.getLayer('tracker-labels')) {
        map.addLayer({
          id: 'tracker-labels',
          type: 'symbol',
          source: 'trackers',
          layout: {
            'text-field': trackerLabelTextExpr,
            'icon-image': ['case', trackerHasLabelExpr, FEATURE_LABEL_BG_IMAGE_ID, ''],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [3, 6, 3, 6],
            'text-size': scaleLabelValue(BASE_TRACKER_LABEL_SIZE),
            'text-line-height': 1.1,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-anchor': 'left',
            'text-offset': trackerLabelOffsetExpr,
            'text-letter-spacing': 0.02,
            'icon-anchor': 'left',
            'icon-offset': trackerLabelOffsetExpr,
            'icon-allow-overlap': true
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': 'transparent',
            'text-halo-width': 0,
            'text-halo-blur': 0
          }
        });
      }
    } catch (err) {
      pointsReady = false;
      console.error('ensureTrackerLayer failed', err);
    }
    trackerSourceReady = pointsReady
      && !!map.getSource('trackers')
      && !!map.getLayer('tracker-dots')
      && !!map.getLayer('tracker-icon-bg')
      && !!map.getLayer('tracker-icon')
      && !!map.getLayer('tracker-labels');

    let pathsReady = true;
    try {
      if (!map.getSource('tracker-paths')) {
        map.addSource('tracker-paths', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!map.getLayer('tracker-paths')) {
        const beforeId = map.getLayer('tracker-dots') ? 'tracker-dots' : undefined;
        const layerConfig = {
          id: 'tracker-paths',
          type: 'line',
          source: 'tracker-paths',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#ff5722'],
            'line-width': 2.2,
            'line-opacity': 0.72
          }
        };
        if (beforeId) map.addLayer(layerConfig, beforeId);
        else map.addLayer(layerConfig);
      }
    } catch (err) {
      pathsReady = false;
      console.error('ensureTrackerPathLayer failed', err);
    }
    trackerPathSourceReady = pathsReady && !!map.getSource('tracker-paths') && !!map.getLayer('tracker-paths');

    let gotoReady = true;
    try {
      if (!map.getSource('tracker-goto')) {
        map.addSource('tracker-goto', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!map.getLayer('tracker-goto')) {
        const beforeId = map.getLayer('tracker-dots') ? 'tracker-dots' : undefined;
        const layerConfig = {
          id: 'tracker-goto',
          type: 'line',
          source: 'tracker-goto',
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#ff5722'],
            'line-width': 2.4,
            'line-opacity': 0.8,
            'line-dasharray': [1.2, 1.2]
          }
        };
        if (beforeId) map.addLayer(layerConfig, beforeId);
        else map.addLayer(layerConfig);
      }
      if (!map.getLayer('tracker-goto-end')) {
        const beforeId = map.getLayer('tracker-dots') ? 'tracker-dots' : undefined;
        const layerConfig = {
          id: 'tracker-goto-end',
          type: 'circle',
          source: 'tracker-goto',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 3,
            'circle-color': ['coalesce', ['get', 'color'], '#ff5722']
          }
        };
        if (beforeId) map.addLayer(layerConfig, beforeId);
        else map.addLayer(layerConfig);
      }
    } catch (err) {
      gotoReady = false;
      console.error('ensureTrackerGoToLayer failed', err);
    }
    trackerGoToSourceReady = gotoReady && !!map.getSource('tracker-goto') && !!map.getLayer('tracker-goto');
  };

  const updateTrackerSource = () => {
    const map = getMap();
    if (!map) return;
    if (!trackerSourceReady) {
      ensureTrackerLayer(map);
      if (!trackerSourceReady) return;
    }
    try {
      const src = map.getSource('trackers');
      const collection = getTrackerFeatureCollection();
      if (src && src.setData) src.setData(collection);
      try { ensurePoiIconsLoaded(map, collection.features); } catch {}
    } catch (e) {
      console.error('updateTrackerSource failed', e);
    }
    try { updateTrackerGoToSource(); } catch {}
  };

  const updateTrackerPathSource = () => {
    const map = getMap();
    if (!map) return;
    if (!trackerPathSourceReady) {
      ensureTrackerLayer(map);
      if (!trackerPathSourceReady) return;
    }
    try {
      const src = map.getSource('tracker-paths');
      if (src && src.setData) src.setData(getTrackerPathFeatureCollection());
    } catch (e) {
      console.error('updateTrackerPathSource failed', e);
    }
  };

  const updateTrackerGoToSource = () => {
    const map = getMap();
    if (!map) return;
    if (!trackerGoToSourceReady) {
      ensureTrackerLayer(map);
      if (!trackerGoToSourceReady) return;
    }
    try {
      const src = map.getSource('tracker-goto');
      if (src && src.setData) src.setData(getTrackerGoToFeatureCollection());
    } catch (e) {
      console.error('updateTrackerGoToSource failed', e);
    }
  };

  const syncGotoPoiControls = (shouldFocus=false) => {
    const enabled = !!gotoAddPoi?.checked;
    if (gotoAddPoi) gotoAddPoi.setAttribute('aria-checked', String(enabled));
    if (gotoPoiNameField) gotoPoiNameField.hidden = !enabled;
    if (enabled && shouldFocus && gotoPoiName) setTimeout(() => gotoPoiName.focus(), 0);
  };
  const updateGotoFieldsVisibility = () => {
    const system = (currentCoordinateSystem || '').toLowerCase();
    const showLatLng = system !== 'utm' && system !== 'gk';
    if (gotoFieldsLatLng) gotoFieldsLatLng.hidden = !showLatLng;
    if (gotoFieldsUTM) gotoFieldsUTM.hidden = system !== 'utm';
    if (gotoFieldsGK) gotoFieldsGK.hidden = system !== 'gk';
  };
  const resetGotoFields = () => {
    if (gotoLat) gotoLat.value = '';
    if (gotoLng) gotoLng.value = '';
    if (gotoUtmZone) gotoUtmZone.value = '';
    if (gotoUtmEasting) gotoUtmEasting.value = '';
    if (gotoUtmNorthing) gotoUtmNorthing.value = '';
    if (gotoGkZone) gotoGkZone.value = '';
    if (gotoGkEasting) gotoGkEasting.value = '';
    if (gotoGkNorthing) gotoGkNorthing.value = '';
  };
  const populateGotoFieldsFromCenter = () => {
    resetGotoFields();
    try {
      const map = (window)._map;
      const center = map?.getCenter();
      if (!center) return;
      const system = (currentCoordinateSystem || '').toLowerCase();
      if (system === 'utm') {
        const utm = utmFromLatLng(center.lat, center.lng);
        if (!utm) return;
        if (gotoUtmZone) gotoUtmZone.value = `${utm.zoneNumber}${utm.zoneLetter}`;
        if (gotoUtmEasting) gotoUtmEasting.value = Math.round(utm.easting);
        if (gotoUtmNorthing) gotoUtmNorthing.value = Math.round(utm.northing);
      } else if (system === 'gk') {
        const gk = gaussKruegerFromLatLng(center.lat, center.lng);
        if (!gk) return;
        if (gotoGkZone) gotoGkZone.value = String(gk.zoneNumber);
        if (gotoGkEasting) gotoGkEasting.value = Math.round(gk.easting);
        if (gotoGkNorthing) gotoGkNorthing.value = Math.round(gk.northing);
      } else {
        if (gotoLat) gotoLat.value = Number(center.lat).toFixed(6);
        if (gotoLng) gotoLng.value = Number(center.lng).toFixed(6);
      }
    } catch (err) {
      console.warn('populateGotoFieldsFromCenter failed', err);
    }
  };
  const refreshGotoFormForSystem = (forcePopulate = false) => {
    updateGotoFieldsVisibility();
    const shouldPopulate = forcePopulate || (gotoModal && gotoModal.hidden === false);
    if (shouldPopulate) populateGotoFieldsFromCenter();
    if (gotoModal && gotoModal.hidden === false) {
      let focusTarget = gotoLat;
      const system = (currentCoordinateSystem || '').toLowerCase();
      if (system === 'utm') focusTarget = gotoUtmZone;
      else if (system === 'gk') focusTarget = gotoGkZone;
      setTimeout(() => focusTarget?.focus(), 0);
    }
  };

  const setActiveSettingsGroup = (groupId, { focus = false } = {}) => {
    if (!settingsGroups.length) return;
    const hasGroup = settingsGroups.some((group) => group.dataset.settingsGroup === groupId);
    const fallback = settingsGroups.find((group) => !group.hidden)?.dataset.settingsGroup
      || settingsGroups[0]?.dataset.settingsGroup;
    const nextGroup = hasGroup ? groupId : fallback;
    if (!nextGroup) return;

    settingsGroups.forEach((group) => {
      const isActive = group.dataset.settingsGroup === nextGroup;
      group.hidden = !isActive;
      group.classList.toggle('is-active', isActive);
    });

    settingsGroupButtons.forEach((btn) => {
      const isActive = btn.dataset.settingsGroup === nextGroup;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
      if (isActive) {
        btn.setAttribute('aria-current', 'true');
        if (focus) {
          try { btn.focus(); } catch {}
        }
      } else {
        btn.removeAttribute('aria-current');
      }
    });
  };
  const revealSettingsGroupForElement = (el) => {
    const group = el?.closest?.('.settings-group')?.dataset?.settingsGroup;
    if (group) setActiveSettingsGroup(group);
  };
  
  const updateSettingsSaveState = () => {
    if (settingsSaveBtn) settingsSaveBtn.disabled = !settingsDirty;
  };
  
  const setSettingsStatus = (text='', dismissMs=0) => {
    if (!settingsStatus) return;
    if (settingsStatusTimer) { clearTimeout(settingsStatusTimer); settingsStatusTimer = null; }
    settingsStatus.textContent = text;
    if (text && dismissMs > 0) {
      settingsStatusTimer = setTimeout(() => {
        settingsStatus.textContent = '';
        settingsStatusTimer = null;
      }, dismissMs);
    }
  };
  const markSettingsDirty = () => {
    if (suppressSettingsEvents) return;
    settingsDirty = true;
    updateSettingsSaveState();
    setSettingsStatus(t('status.unsavedChanges', 'Unsaved changes'));
  };
  const withSuppressedSettingsEvents = (fn) => {
    const previous = suppressSettingsEvents;
    suppressSettingsEvents = true;
    try {
      fn();
    } finally {
      suppressSettingsEvents = previous;
    }
  };
  const parseStartInputs = () => {
    const lat = Number(settingStartLat?.value);
    const lng = Number(settingStartLng?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lng, lat];
  };
  const loadSettingsForm = () => {
    suppressSettingsEvents = true;
    try {
      const storedAccessToken = localStorage.getItem('map.accessToken');
      if (settingAccessToken) settingAccessToken.value = storedAccessToken !== null ? storedAccessToken : defaultAccessToken;

      const storedGoogleKey = localStorage.getItem('map.googleKey');
      if (settingGoogleKey) settingGoogleKey.value = storedGoogleKey !== null ? storedGoogleKey : defaultGoogleKey;

      const storedOpenAIKey = localStorage.getItem('openai.key');
      if (settingOpenAIKey) settingOpenAIKey.value = storedOpenAIKey !== null ? storedOpenAIKey : defaultOpenAIKey;

      loadFirebaseSettingsFromStorage({ syncInput: true, warnOnError: true });
      initFirestoreConnection();
      const storedFirestoreRules = readStoredRules(FIRESTORE_RULES_STORAGE_KEY);
      if (settingFirestoreRules) settingFirestoreRules.value = storedFirestoreRules !== null ? storedFirestoreRules : '';
      const storedStorageRules = readStoredRules(STORAGE_RULES_STORAGE_KEY);
      if (settingStorageRules) settingStorageRules.value = storedStorageRules !== null ? storedStorageRules : '';
      const storedFunctionsIndex = readStoredRules(FUNCTIONS_INDEX_STORAGE_KEY);
      if (settingFirebaseFunctionIndex) settingFirebaseFunctionIndex.value = storedFunctionsIndex !== null ? storedFunctionsIndex : '';

      const storedStyleUrl = localStorage.getItem('map.streetStyleUrl');
      const legacyStyleUrl = storedStyleUrl === null ? localStorage.getItem('map.styleUrl') : storedStyleUrl;
      const storedSatelliteStyleUrl = localStorage.getItem('map.satelliteStyleUrl');
      const storedTerrainStyleUrl = localStorage.getItem('map.terrainStyleUrl');
      if (settingStyleUrl) settingStyleUrl.value = legacyStyleUrl !== null ? legacyStyleUrl : defaultStyleUrl;
      if (settingSatelliteStyleUrl) settingSatelliteStyleUrl.value = storedSatelliteStyleUrl !== null ? storedSatelliteStyleUrl : defaultSatelliteStyleUrl;
      if (settingTerrainStyleUrl) settingTerrainStyleUrl.value = storedTerrainStyleUrl !== null ? storedTerrainStyleUrl : defaultTerrainStyleUrl;

      const storedHome = localStorage.getItem('map.homeAddress');
      if (settingHomeAddress) settingHomeAddress.value = storedHome !== null ? storedHome : defaultHomeAddress;

      const storedStartPosRaw = localStorage.getItem('map.startPos');
      const startPos = parseStartPos(storedStartPosRaw || `${defaultStartLng}, ${defaultStartLat}`);
      if (Array.isArray(startPos) && startPos.length === 2) {
        if (settingStartLng) settingStartLng.value = Number(startPos[0]).toFixed(6);
        if (settingStartLat) settingStartLat.value = Number(startPos[1]).toFixed(6);
      }

      const storedZoomRaw = localStorage.getItem('map.startZoom');
      const zoom = Number.isFinite(Number(storedZoomRaw)) ? Number(storedZoomRaw) : defaultStartZoom;
      if (settingStartZoom) settingStartZoom.value = String(zoom);

      const storedCoord = (localStorage.getItem('map.coordinateSystem') || 'latlng').toLowerCase();
      currentCoordinateSystem = storedCoord;
      if (settingCoordinateSystem) settingCoordinateSystem.value = storedCoord;
      applyFooterCoordLabel(getFooterLabelKeyForSystem(currentCoordinateSystem));
      if (lastKnownCenter) updateFooterCenterDisplay(lastKnownCenter.lat, lastKnownCenter.lng);
      refreshGotoFormForSystem(false);

      activeMapStyle = getStoredMapStyleKey();
      setActiveMapStyle(activeMapStyle, { persist: false });
      updateMapCursor();

      const storedLanguage = localStorage.getItem('app.language');
      const language = normalizeAppLanguage(storedLanguage);
      defaultAppLanguage = language;
      populateLanguageOptions(language);
      applyLanguagePreference(language);
    } catch (e) {
      console.error('Failed loading settings', e);
    } finally {
      suppressSettingsEvents = false;
      settingsDirty = false;
      updateSettingsSaveState();
      setSettingsStatus('');
      refreshFirebaseAdminStatus();
      loadDefaultFirebaseRules();
    }
  };
  const gatherSettingsFromForm = () => {
    const accessToken = (settingAccessToken?.value || '').trim();
    const googleKey = (settingGoogleKey?.value || '').trim();
    const openaiKey = (settingOpenAIKey?.value || '').trim();
    let styleUrl = (settingStyleUrl?.value || '').trim();
    let satelliteStyleUrl = (settingSatelliteStyleUrl?.value || '').trim();
    let terrainStyleUrl = (settingTerrainStyleUrl?.value || '').trim();
    const firebaseConfigRaw = normalizeLineBreaks(settingFirebaseConfig?.value || '');
    const firestoreRules = normalizeLineBreaks(settingFirestoreRules?.value || '');
    const storageRules = normalizeLineBreaks(settingStorageRules?.value || '');
    const functionsIndex = normalizeLineBreaks(settingFirebaseFunctionIndex?.value || '');
    const parsedFirebase = parseFirebaseSettingsText(firebaseConfigRaw);
    if (parsedFirebase.error) {
      alert(t('alerts.invalidFirebaseConfig', 'Firebase settings must be valid JSON.'));
      revealSettingsGroupForElement(settingFirebaseConfig);
      settingFirebaseConfig?.focus();
      return null;
    }
    if (!satelliteStyleUrl) satelliteStyleUrl = DEFAULT_SATELLITE_STYLE_URL;
    if (!terrainStyleUrl) terrainStyleUrl = DEFAULT_TERRAIN_STYLE_URL;
    if (!styleUrl) styleUrl = DEFAULT_STYLE_URL;
    const homeAddress = (settingHomeAddress?.value || '').trim();
    const coords = parseStartInputs();
    if (!coords) {
      const lat = Number(settingStartLat?.value);
      const lng = Number(settingStartLng?.value);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        alert(t('alerts.invalidLatitude', 'Please enter a valid start latitude.'));
        revealSettingsGroupForElement(settingStartLat);
        settingStartLat?.focus();
      } else {
        alert(t('alerts.invalidLongitude', 'Please enter a valid start longitude.'));
        revealSettingsGroupForElement(settingStartLng);
        settingStartLng?.focus();
      }
      return null;
    }
    let startZoom = Number(settingStartZoom?.value);
    if (!Number.isFinite(startZoom)) startZoom = DEFAULT_START_ZOOM;
    if (startZoom < 0 || startZoom > 22) {
      alert(t('alerts.invalidZoom', 'Start zoom must be between 0 and 22.'));
      revealSettingsGroupForElement(settingStartZoom);
      settingStartZoom?.focus();
      return null;
    }
    const language = normalizeAppLanguage(settingLanguage?.value);
    const coordinateSystem = (settingCoordinateSystem?.value || 'latlng').toLowerCase();

    return {
      accessToken,
      googleKey,
      openaiKey,
      styleUrl,
      homeAddress,
      startPos: coords,
      startZoom,
      language,
      coordinateSystem,
      satelliteStyleUrl,
      terrainStyleUrl,
      firebaseConfigRaw: parsedFirebase.raw,
      firebaseConfig: parsedFirebase.value,
      firestoreRules,
      storageRules,
      functionsIndex,
    };
  };
  const applySettings = async () => {
    const values = gatherSettingsFromForm();
    if (!values) return;

    const prevAccessToken = localStorage.getItem('map.accessToken') || '';
    const prevStyleUrl = (localStorage.getItem('map.streetStyleUrl')
      ?? localStorage.getItem('map.styleUrl')
      ?? '');
    const prevStartPos = parseStartPos(localStorage.getItem('map.startPos'));
    const prevStartZoom = Number(localStorage.getItem('map.startZoom') || DEFAULT_START_ZOOM);
    const prevSatelliteStyleUrl = localStorage.getItem('map.satelliteStyleUrl') || defaultSatelliteStyleUrl;
    const prevTerrainStyleUrl = localStorage.getItem('map.terrainStyleUrl') || defaultTerrainStyleUrl;
    const prevSatelliteEnabled = localStorage.getItem('map.satelliteEnabled') === '1';
    const prevActiveStyleKey = normalizeMapStyleKey(localStorage.getItem('map.activeStyle')) || (prevSatelliteEnabled ? 'satellite' : 'street');
    const styleChanged = values.styleUrl !== prevStyleUrl;
    const satelliteChanged = values.satelliteStyleUrl !== prevSatelliteStyleUrl;
    const terrainChanged = values.terrainStyleUrl !== prevTerrainStyleUrl;

    let saveErrored = false;
    if (styleChanged && MAPBOX_STYLE_URL_RE.test(values.styleUrl || '') && (values.accessToken || prevAccessToken)) {
      const tokenForCheck = (values.accessToken || prevAccessToken || '').trim();
      if (tokenForCheck) {
        const ok = await validateMapboxStyleUrl(values.styleUrl, tokenForCheck);
        if (!ok) {
          showToast(t('status.styleLoadFailed', 'Unable to load map style. Restoring previous style.'), 'error');
          values.styleUrl = prevStyleUrl || DEFAULT_STYLE_URL;
          if (settingStyleUrl) settingStyleUrl.value = values.styleUrl;
        }
      }
    }
    if (satelliteChanged && MAPBOX_STYLE_URL_RE.test(values.satelliteStyleUrl || '') && (values.accessToken || prevAccessToken)) {
      const tokenForCheck = (values.accessToken || prevAccessToken || '').trim();
      if (tokenForCheck) {
        const ok = await validateMapboxStyleUrl(values.satelliteStyleUrl, tokenForCheck);
        if (!ok) {
          showToast(t('status.styleLoadFailed', 'Unable to load satellite style. Restoring previous style.'), 'error');
          values.satelliteStyleUrl = prevSatelliteStyleUrl || DEFAULT_SATELLITE_STYLE_URL;
          if (settingSatelliteStyleUrl) settingSatelliteStyleUrl.value = values.satelliteStyleUrl;
        }
      }
    }
    if (terrainChanged && MAPBOX_STYLE_URL_RE.test(values.terrainStyleUrl || '') && (values.accessToken || prevAccessToken)) {
      const tokenForCheck = (values.accessToken || prevAccessToken || '').trim();
      if (tokenForCheck) {
        const ok = await validateMapboxStyleUrl(values.terrainStyleUrl, tokenForCheck);
        if (!ok) {
          showToast(t('status.styleLoadFailed', 'Unable to load terrain style. Restoring previous style.'), 'error');
          values.terrainStyleUrl = prevTerrainStyleUrl || DEFAULT_TERRAIN_STYLE_URL;
          if (settingTerrainStyleUrl) settingTerrainStyleUrl.value = values.terrainStyleUrl;
        }
      }
    }

    try {
      localStorage.setItem('map.accessToken', values.accessToken);
      localStorage.setItem('map.googleKey', values.googleKey);
      localStorage.setItem('openai.key', values.openaiKey);
      if (values.firebaseConfigRaw && values.firebaseConfigRaw.trim()) {
        localStorage.setItem(FIREBASE_SETTINGS_STORAGE_KEY, values.firebaseConfigRaw);
      } else {
        localStorage.removeItem(FIREBASE_SETTINGS_STORAGE_KEY);
      }
      if (values.firestoreRules && values.firestoreRules.trim()) {
        localStorage.setItem(FIRESTORE_RULES_STORAGE_KEY, values.firestoreRules);
      } else {
        localStorage.removeItem(FIRESTORE_RULES_STORAGE_KEY);
      }
      if (values.storageRules && values.storageRules.trim()) {
        localStorage.setItem(STORAGE_RULES_STORAGE_KEY, values.storageRules);
      } else {
        localStorage.removeItem(STORAGE_RULES_STORAGE_KEY);
      }
      if (values.functionsIndex && values.functionsIndex.trim()) {
        localStorage.setItem(FUNCTIONS_INDEX_STORAGE_KEY, values.functionsIndex);
      } else {
        localStorage.removeItem(FUNCTIONS_INDEX_STORAGE_KEY);
      }
      localStorage.setItem('map.streetStyleUrl', values.styleUrl);
      localStorage.setItem('map.styleUrl', values.styleUrl);
      localStorage.setItem('map.satelliteStyleUrl', values.satelliteStyleUrl);
      localStorage.setItem('map.terrainStyleUrl', values.terrainStyleUrl);
      localStorage.setItem('map.homeAddress', values.homeAddress);
      localStorage.setItem('map.startPos', `${values.startPos[0].toFixed(6)}, ${values.startPos[1].toFixed(6)}`);
      localStorage.setItem('map.startZoom', String(values.startZoom));
      localStorage.setItem('app.language', values.language);
      localStorage.setItem('map.coordinateSystem', values.coordinateSystem);
    } catch (e) {
      saveErrored = true;
      console.error('Failed saving settings', e);
    }

    if (saveErrored) {
      setSettingsStatus(t('status.settingsSaveFailed', 'Failed to save settings'), 4000);
      return;
    }

    applyLanguagePreference(values.language);

    firebaseSettings = values.firebaseConfig;
    initFirestoreConnection();

    if (settingCoordinateSystem) settingCoordinateSystem.value = values.coordinateSystem;
    if (settingSatelliteStyleUrl) settingSatelliteStyleUrl.value = values.satelliteStyleUrl || DEFAULT_SATELLITE_STYLE_URL;
    if (settingTerrainStyleUrl) settingTerrainStyleUrl.value = values.terrainStyleUrl || DEFAULT_TERRAIN_STYLE_URL;
    currentCoordinateSystem = values.coordinateSystem || 'latlng';
    applyFooterCoordLabel(getFooterLabelKeyForSystem(currentCoordinateSystem));
    if (lastKnownCenter) updateFooterCenterDisplay(lastKnownCenter.lat, lastKnownCenter.lng);
    refreshGotoFormForSystem(false);

    try {
      if (values.accessToken && (window).mapboxgl) {
        (window).mapboxgl.accessToken = values.accessToken;
      }
    } catch (e) { console.error('Failed applying access token', e); }

    applyServiceAvailability();

    const map = (window)._map;
    if (!map) {
      if (values.accessToken) {
        try { initMap(); } catch (e) { console.error('Map init after save failed', e); }
      }
    } else {
      try {
        const prevActiveStyleUrl = getMapStyleUrlForKey(prevActiveStyleKey, {
          street: prevStyleUrl || DEFAULT_STYLE_URL,
          satellite: prevSatelliteStyleUrl || DEFAULT_SATELLITE_STYLE_URL,
          terrain: prevTerrainStyleUrl || DEFAULT_TERRAIN_STYLE_URL,
        });
        const nextActiveStyleUrl = getTargetMapStyleUrl();
        if (nextActiveStyleUrl && prevActiveStyleUrl !== nextActiveStyleUrl) {
          applyMapStyle(nextActiveStyleUrl);
        }
      } catch (e) { console.error('Failed applying style', e); }
      try {
        const changedCenter = Math.abs(values.startPos[0] - prevStartPos[0]) > 1e-9 || Math.abs(values.startPos[1] - prevStartPos[1]) > 1e-9;
        if (changedCenter) {
          map.jumpTo({ center: values.startPos, zoom: values.startZoom });
        } else if (values.startZoom !== prevStartZoom) {
          map.setZoom(values.startZoom);
        }
      } catch (e) { console.error('Failed applying start position', e); }
    }

    loadSettingsForm();
    applyServiceAvailability();
    setSettingsStatus(t('status.settingsSaved', 'Settings saved'), 2500);
  };

  loadSettingsForm();
  applyServiceAvailability();
  setupDeployLogListener();
  setRulesEditorExpanded(firestoreRulesEditor, firebaseCollapseFirestoreRulesBtn, false);
  setRulesEditorExpanded(storageRulesEditor, firebaseCollapseStorageRulesBtn, false);
  setRulesEditorExpanded(functionsRulesEditor, firebaseCollapseFunctionsBtn, false);
  setRulesEditorExpanded(firebaseConfigEditor, firebaseCollapseConfigBtn, false);
  if (settingsGroupButtons.length && settingsGroups.length) {
    settingsGroupButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setActiveSettingsGroup(btn.dataset.settingsGroup, { focus: true });
      });
    });
    const initialGroup = settingsGroupButtons.find((btn) => btn.classList.contains('is-active'))?.dataset.settingsGroup
      || settingsGroups.find((group) => !group.hidden)?.dataset.settingsGroup
      || settingsGroupButtons[0]?.dataset.settingsGroup
      || settingsGroups[0]?.dataset.settingsGroup;
    setActiveSettingsGroup(initialGroup);
  }
  if (settingLanguage) {
    settingLanguage.addEventListener('change', () => {
      populateLanguageOptions(settingLanguage.value);
      applyLanguagePreference(settingLanguage.value);
      markSettingsDirty();
    });
  }
  if (settingCoordinateSystem) {
    settingCoordinateSystem.addEventListener('change', () => {
      currentCoordinateSystem = (settingCoordinateSystem.value || 'latlng').toLowerCase();
      applyFooterCoordLabel(getFooterLabelKeyForSystem(currentCoordinateSystem));
      if (lastKnownCenter) updateFooterCenterDisplay(lastKnownCenter.lat, lastKnownCenter.lng);
      refreshGotoFormForSystem(false);
    });
  }
  if (languageMenu) {
    languageMenu.querySelectorAll('.lang-menu-item').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.lang === translationState.language);
    });
  }
  if (settingsForm) {
    settingsForm.addEventListener('input', (e) => {
      if (e && e.target === settingsSaveBtn) return;
      markSettingsDirty();
      if (e?.target === settingFirestoreRules
        || e?.target === settingStorageRules
        || e?.target === settingFirebaseFunctionIndex) {
        if (e.target === settingFirestoreRules) clearRulesStatusError(firebaseFirestoreRulesStatus);
        if (e.target === settingStorageRules) clearRulesStatusError(firebaseStorageRulesStatus);
        if (e.target === settingFirebaseFunctionIndex) clearRulesStatusError(firebaseFunctionsStatus);
        updateFirebaseAdminActionsState();
      }
    });
    settingsForm.addEventListener('change', (e) => {
      if (e && e.target === settingsSaveBtn) return;
      markSettingsDirty();
      if (e?.target === settingFirestoreRules
        || e?.target === settingStorageRules
        || e?.target === settingFirebaseFunctionIndex) {
        if (e.target === settingFirestoreRules) clearRulesStatusError(firebaseFirestoreRulesStatus);
        if (e.target === settingStorageRules) clearRulesStatusError(firebaseStorageRulesStatus);
        if (e.target === settingFirebaseFunctionIndex) clearRulesStatusError(firebaseFunctionsStatus);
        updateFirebaseAdminActionsState();
      }
    });
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await applySettings();
    });
  }
  if (firebaseAdminSelectBtn) {
    firebaseAdminSelectBtn.addEventListener('click', async () => {
      if (firebaseAdminFileInput) {
        firebaseAdminFileInput.value = '';
        firebaseAdminFileInput.click();
        return;
      }
      if (!window.firebaseAdmin?.selectCredentials) {
        showToast(t('alerts.firebaseAdminUnavailable', 'Firebase Admin integration is not available.'), 'error');
        return;
      }
      setFirebaseAdminStatus(t('status.firebaseAdminSelecting', 'Select a credentials file to continue.'), { i18nKey: 'status.firebaseAdminSelecting' });
      try {
        const result = await window.firebaseAdmin.selectCredentials();
        if (!result || result.cancelled) {
          setFirebaseAdminStatus(t('status.firebaseAdminSelectionCancelled', 'Selection canceled.'), { i18nKey: 'status.firebaseAdminSelectionCancelled' });
          return;
        }
        if (!result.ok) {
          const fallback = t('alerts.firebaseAdminInvalid', 'Firebase Admin credentials are invalid.');
          const message = formatFirebaseAdminError(result, fallback);
          setFirebaseAdminStatus(message, { isError: true });
          showToast(message, 'error');
          return;
        }
        setFirebaseAdminStatus(t('status.firebaseAdminSaved', 'Firebase Admin credentials verified and saved.'), { i18nKey: 'status.firebaseAdminSaved' });
        setFirebaseAdminProject(result.projectId || '');
        setFirebaseAdminClearButton(true);
        firebaseAdminCredentialsReady = true;
        await applyFirebaseConfigFromAdmin();
        updateFirebaseAdminActionsState();
      } catch (err) {
        const fallback = t('alerts.firebaseAdminVerifyFailed', 'Unable to verify Firebase Admin credentials.');
        setFirebaseAdminStatus(fallback, { isError: true });
        showToast(fallback, 'error');
      }
    });
  }
  if (firebaseAdminFileInput) {
    firebaseAdminFileInput.addEventListener('change', async () => {
      const file = firebaseAdminFileInput.files?.[0];
      if (!file) {
        setFirebaseAdminStatus(t('status.firebaseAdminSelectionCancelled', 'Selection canceled.'), { i18nKey: 'status.firebaseAdminSelectionCancelled' });
        return;
      }
      if (!window.firebaseAdmin?.ingestCredentials) {
        showToast(t('alerts.firebaseAdminUnavailable', 'Firebase Admin integration is not available.'), 'error');
        return;
      }
      setFirebaseAdminStatus(t('status.firebaseAdminSelecting', 'Select a credentials file to continue.'), { i18nKey: 'status.firebaseAdminSelecting' });
      try {
        const raw = await file.text();
        const result = await window.firebaseAdmin.ingestCredentials({ raw, filename: file.name });
        if (!result || result.cancelled) {
          setFirebaseAdminStatus(t('status.firebaseAdminSelectionCancelled', 'Selection canceled.'), { i18nKey: 'status.firebaseAdminSelectionCancelled' });
          return;
        }
        if (!result.ok) {
          const fallback = t('alerts.firebaseAdminInvalid', 'Firebase Admin credentials are invalid.');
          const message = formatFirebaseAdminError(result, fallback);
          setFirebaseAdminStatus(message, { isError: true });
          showToast(message, 'error');
          return;
        }
        setFirebaseAdminStatus(t('status.firebaseAdminSaved', 'Firebase Admin credentials verified and saved.'), { i18nKey: 'status.firebaseAdminSaved' });
        setFirebaseAdminProject(result.projectId || '');
        setFirebaseAdminClearButton(true);
        firebaseAdminCredentialsReady = true;
        await applyFirebaseConfigFromAdmin();
        updateFirebaseAdminActionsState();
      } catch (err) {
        const fallback = t('alerts.firebaseAdminVerifyFailed', 'Unable to verify Firebase Admin credentials.');
        setFirebaseAdminStatus(fallback, { isError: true });
        showToast(fallback, 'error');
      }
    });
  }
  if (firebaseAdminClearBtn) {
    firebaseAdminClearBtn.addEventListener('click', async () => {
      if (!window.firebaseAdmin?.clearCredentials) return;
      try {
        await window.firebaseAdmin.clearCredentials();
        setFirebaseAdminStatus(t('status.firebaseAdminCleared', 'Firebase Admin credentials removed.'), { i18nKey: 'status.firebaseAdminCleared' });
        setFirebaseAdminProject('');
        setFirebaseAdminClearButton(false);
        firebaseAdminCredentialsReady = false;
        updateFirebaseAdminActionsState();
      } catch (err) {
        const fallback = t('alerts.firebaseAdminClearFailed', 'Unable to remove Firebase Admin credentials.');
        setFirebaseAdminStatus(fallback, { isError: true });
        showToast(fallback, 'error');
      }
    });
  }
  // Per-drawing edit state
  (window)._editTarget = (window)._editTarget || null;
  let currentFilePath = null;
  let startupHomeApplied = false;
  window.file?.onCurrentFile?.((p) => {
    currentFilePath = p;
    if (!p) maybeFlyHomeOnStartup();
  });

  function dateYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${da}`;
  }
  function sanitizeToken(s){ return String(s||'').trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_\-]/g,'').slice(0,40) || 'map'; }
  function getSuggestedFilename(){
    const cc = sanitizeToken((window)._placeCountryCode || '');
    const city = sanitizeToken((window)._placeCity || '');
    const date = dateYYYYMMDD();
    const parts = [];
    if (cc) parts.push(cc);
    if (city) parts.push(city);
    parts.push(date);
    return (parts.join('_') || `map_${date}`) + '.json';
  }

  // ---------- Mapbox GL init ----------
  function parseStartPos(input) {
    try {
      if (!input && input !== 0) return DEFAULT_MAP_START.slice();
      if (Array.isArray(input) && input.length === 2) {
        const lng = Number(input[0]);
        const lat = Number(input[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          return [lng, lat];
        }
        return DEFAULT_MAP_START.slice();
      }
      const parts = String(input).split(',').map(s => Number(s.trim()));
      if (parts.length === 2 && parts.every(n => Number.isFinite(n))) {
        const [lng, lat] = parts;
        if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) return [lng, lat];
      }
      return DEFAULT_MAP_START.slice();
    } catch { return DEFAULT_MAP_START.slice(); }
  }

  async function geocodeAddress(address, key) {
    if (!address || !key) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Geocode request failed: ${resp.status}`);
    const data = await resp.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const loc = data.results[0]?.geometry?.location;
    if (!loc) return null;
    const lng = Number(loc.lng);
    const lat = Number(loc.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
  }

  async function maybeFlyHomeOnStartup() {
    if (startupHomeApplied || currentFilePath) return;
    const map = (window)._map;
    if (!map) return;

    const ensureZoom = () => {
      const z = Number(map.getZoom());
      return Number.isFinite(z) ? Math.max(12, z) : 12;
    };
    const jumpToDefault = () => {
      try { map.jumpTo({ center: DEFAULT_HOME_CENTER, zoom: ensureZoom() }); }
      catch (e) { console.error('Failed to move to default home location', e); }
    };
    const markDone = () => { startupHomeApplied = true; };

    const home = (localStorage.getItem('map.homeAddress') || defaultHomeAddress || '').trim();
    if (!home) {
      jumpToDefault();
      markDone();
      return;
    }

    const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
    if (!key) {
      console.warn('Google Maps API key missing; using default home location.');
      jumpToDefault();
      markDone();
      return;
    }

    let coords = null;
    try {
      coords = await geocodeAddress(home, key);
    } catch (e) {
      console.error('Home address lookup failed', e);
    }

    if (currentFilePath) { markDone(); return; }

    if (coords) {
      map.jumpTo({ center: coords, zoom: ensureZoom() });
    } else {
      console.warn('Could not resolve home address; using default home location.');
      jumpToDefault();
    }
    markDone();
  }

  function initMap() {
    const mapEl = q('#map');
    if (!mapEl) return;
    if (!(window).mapboxgl) {
      console.warn('Mapbox GL not loaded');
      return;
    }
    try {
      // Use CSP-friendly worker build
      (window).mapboxgl.workerUrl = './dist/vendor/mapbox-gl/mapbox-gl-csp-worker.js';
    } catch {}

    // Gather settings with fallbacks
    const accessToken = (localStorage.getItem('map.accessToken') || defaultAccessToken || '').trim();
    const initialStyleUrl = getTargetMapStyleUrl();
    const styleUrl = (initialStyleUrl || DEFAULT_STYLE_URL).trim();
    const startPos = parseStartPos(localStorage.getItem('map.startPos') || `${defaultStartLng}, ${defaultStartLat}`);
    const startZoomRaw = localStorage.getItem('map.startZoom');
    const startZoom = Number.isFinite(Number(startZoomRaw)) ? Number(startZoomRaw) : (Number.isFinite(defaultStartZoom) ? defaultStartZoom : DEFAULT_START_ZOOM);

    if (!accessToken) {
      console.warn('No Mapbox access token set. Skipping map init.');
      updateWelcomeState();
      return;
    }

    updateWelcomeState();

    (window).mapboxgl.accessToken = accessToken;
    const map = new (window).mapboxgl.Map({
      container: mapEl,
      style: styleUrl,
      preserveDrawingBuffer: true,
      center: startPos,
      zoom: Number.isFinite(startZoom) ? startZoom : 12,
      attributionControl: true,
    });
    (window)._map = map; // for debugging
    (window)._lastStyleUrl = styleUrl;
    updateMapStyleButtons();
    try { (window)._bindEditInteractions && (window)._bindEditInteractions(); } catch {}
    try { ensureTrackerLayer(map); } catch (e) { console.error('tracker layer init failed', e); }

    const fmt = (n, d=2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
    const computeScaleDenominator = (mapInstance) => {
      if (!mapInstance) return null;
      try {
        const zoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : null;
        const center = typeof mapInstance.getCenter === 'function' ? mapInstance.getCenter() : null;
        if (!Number.isFinite(zoom) || !center || !Number.isFinite(center.lat)) return null;
        const metersPerPixel = getMetersPerPixelAtLatitude(mapInstance, center.lat, zoom);
        if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null;
        const scale = (metersPerPixel * 96) / 0.0254;
        if (!Number.isFinite(scale) || scale <= 0) return null;
        return Math.round(scale);
      } catch (err) {
        console.warn('computeScaleDenominator failed', err);
        return null;
      }
    };

    function updateStats() {
      try {
        const c = map.getCenter();
        lastKnownCenter = { lat: c.lat, lng: c.lng };
        updateFooterCenterDisplay(c.lat, c.lng);
        statZoom && (statZoom.textContent = fmt(map.getZoom(), 2));
        if (statScale) {
          const scaleVal = computeScaleDenominator(map);
          statScale.textContent = scaleVal ? `1 : ${scaleVal.toLocaleString()}` : '—';
        }
        statBearing && (statBearing.textContent = fmt(map.getBearing(), 1));
        statPitch && (statPitch.textContent = fmt(map.getPitch(), 1));
      } catch {}
    }
    map.on('load', updateStats);
    map.on('move', updateStats);
    map.on('zoom', () => applyLabelVisibility(map));

    // Pin toggle state
    let mapPinned = false;
  let _lastScaleTrigger = null;
    map.on('load', () => {
      updatePlaceFromCenter();
      maybeFlyHomeOnStartup();
      trackerSourceReady = false;
      trackerPathSourceReady = false;
      ensureTrackerLayer(map);
      updateTrackerSource();
      updateTrackerPathSource();
      applyFeaturesVisibility(map);
      applyTrackersVisibility(map);
      refreshGridOverlay();
      updateMapCursor();
    });
    map.on('style.load', () => {
      trackerSourceReady = false;
      trackerPathSourceReady = false;
      ensureTrackerLayer(map);
      updateTrackerSource();
      updateTrackerPathSource();
      applyTrackersVisibility(map);
      applyFeaturesVisibility(map);
      updateFeatureLabels();
      if (weatherOverlayActive) scheduleWeatherRefresh();
      if (lastKnownCenter) updateFooterCenterDisplay(lastKnownCenter.lat, lastKnownCenter.lng);
      refreshGridOverlay();
      updateMapCursor();
    });
    map.on('moveend', () => { if (!mapPinned) updatePlaceFromCenter(); });

    // If the map style loaded before listeners were attached, ensure overlays render.
    if (activeGridOverlay !== 'none' && typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      refreshGridOverlay();
    }

    const setPinned = (v) => {
      mapPinned = !!v;
      try {
        if (mapPinned) {
          map.dragPan.disable(); map.scrollZoom.disable(); map.boxZoom.disable();
          map.doubleClickZoom.disable(); map.touchZoomRotate.disable(); map.keyboard.disable();
        } else {
          map.dragPan.enable(); map.scrollZoom.enable(); map.boxZoom.enable();
          map.doubleClickZoom.enable(); map.touchZoomRotate.enable(); map.keyboard.enable();
        }
      } catch {}
      toolPin?.setAttribute('aria-pressed', String(mapPinned));
      toolPin?.classList.toggle('active', mapPinned);
    };
    toolPin?.addEventListener('click', () => setPinned(!mapPinned));

    async function updatePlaceFromCenter(){
      try{
        const c = map.getCenter();
        lastKnownCenter = { lat: c.lat, lng: c.lng };
        if (!googleServicesEnabled) {
          lastKnownAddress = '';
          if (footerAddress) footerAddress.textContent = '—';
          return;
        }
        const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
        if (!key) {
          lastKnownAddress = '';
          if (footerAddress) footerAddress.textContent = '—';
          return;
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(c.lat + ',' + c.lng)}&key=${encodeURIComponent(key)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
          lastKnownAddress = '';
          if (footerAddress) footerAddress.textContent = '—';
          return;
        }
        const res = data.results[0];
        const addr = res.formatted_address || res.formattedAddress || '—';
        lastKnownAddress = addr;
        if (footerAddress) footerAddress.textContent = addr || '—';
        try{
          const comps = res.address_components || [];
          const country = comps.find(c => (c.types||[]).includes('country'));
          const city = comps.find(c => (c.types||[]).includes('locality')) || comps.find(c => (c.types||[]).includes('postal_town'));
          (window)._placeCountryCode = country?.short_name || country?.long_name || '';
          (window)._placeCity = city?.short_name || city?.long_name || '';
        }catch{}
      } catch (e) {
        console.error(e);
        if (footerAddress) footerAddress.textContent = '—';
      }
    }

    // ---- Drawing sources/layers ----
    const drawStore = { type: 'FeatureCollection', features: [] };
    // Expose for edit interactions outside initMap scope
    (window)._drawStore = drawStore;
    const ensureDrawLayers = () => {
      if (!map.getSource('draw')) {
        map.addSource('draw', { type: 'geojson', data: drawStore });
      }
      if (!map.getSource('draw-draft')) {
        map.addSource('draw-draft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getSource('edit-verts')) {
        map.addSource('edit-verts', { type: 'geojson', data: { type:'FeatureCollection', features: [] } });
      }
      if (!map.getSource('edit-mid')) {
        map.addSource('edit-mid', { type: 'geojson', data: { type:'FeatureCollection', features: [] } });
      }
      if (!map.getSource('draw-labels')) {
        map.addSource('draw-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      ensureTriangleMarkerImage(map);
      ensureFeatureLabelBackgroundImage(map);
      ensurePoiIconBackgroundImage(map);
      const hasValidNameExpr = ['all',
        ['!=', ['coalesce', ['get','name'], ''], ''],
        ['!=', ['downcase', ['coalesce', ['get','name'], '']], 'untitled']
      ];
      const poiHasIconExpr = ['all',
        ['has', 'poiIcon'],
        ['!=', ['coalesce', ['get','poiIcon'], ''], '']
      ];
      const hasAreaLabelExpr = ['all',
        ['==', ['get', 'showSize'], true],
        ['!=', ['coalesce', ['get', 'area'], ''], '']
      ];
      const polygonHasLabelExpr = ['any', hasValidNameExpr, hasAreaLabelExpr];
      const lineLengthLabelExpr = ['!=', ['coalesce', ['get','length'], ''], ''];
      const poiLabelOffsetExpr = ['case',
        poiHasIconExpr,
        ['literal', [1.8, 0]],
        ['literal', [1, 0]]
      ];
      if (!map.getLayer('draw-fill')) {
        map.addLayer({
          id: 'draw-fill',
          type: 'fill',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          paint: { 'fill-color': ['coalesce', ['get','color'], '#1565C0'], 'fill-opacity': 0.25 }
        });
      }
      if (!map.getLayer('draw-fill-outline')) {
        map.addLayer({
          id: 'draw-fill-outline',
          type: 'line',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': ['coalesce', ['get','color'], '#1565C0'],
            'line-width': 2.2,
            'line-opacity': 1
          }
        });
      }
      if (!map.getLayer('draw-line')) {
        map.addLayer({
          id: 'draw-line',
          type: 'line',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          paint: { 'line-color': ['coalesce', ['get','color'], '#1565C0'], 'line-width': 2 }
        });
      }
      if (!map.getLayer('draw-line-arrows')) {
        map.addLayer({
          id: 'draw-line-arrows',
          type: 'symbol',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 40,
            'icon-image': 'triangle-15',
            'icon-size': 0.9,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true
          },
          paint: {
            'icon-color': ['coalesce', ['get','color'], '#1565C0'],
            'icon-opacity': 1
          }
        });
      }
      // Base point as colored circle for robust visibility
      if (!map.getLayer('draw-point-circle')) {
        map.addLayer({
          id: 'draw-point-circle', type: 'circle', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true], ['!', poiHasIconExpr]],
          paint: {
            'circle-color': ['coalesce', ['get','color'], '#1565C0'],
            'circle-radius': 9,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-opacity': ['coalesce', ['get','pointOpacity'], 1]
          }
        });
      }
      if (!map.getLayer('draw-line-start-inner')) {
        map.addLayer({
          id: 'draw-line-start-inner', type: 'circle', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true], ['==', ['get','hasInnerDot'], true]],
          paint: {
            'circle-color': '#ffffff',
            'circle-radius': ['*', 0.6, 9],
            'circle-opacity': 1
          }
        });
      }
      if (!map.getLayer('draw-point-icon-bg')) {
        map.addLayer({
          id: 'draw-point-icon-bg',
          type: 'symbol',
          source: 'draw',
          filter: ['all',
            ['==', ['geometry-type'], 'Point'],
            ['!=', ['get','_trackerHidden'], true],
            ['!=', ['get','_featureHidden'], true],
            ['!=', ['get','_featureLabelHidden'], true],
            ['!=', ['get','isLineEndpoint'], true],
            poiHasIconExpr
          ],
          layout: {
            'icon-image': POI_ICON_BG_IMAGE_ID,
            'icon-size': scaleLabelValue(POI_ICON_BG_SIZE),
            'icon-anchor': 'center',
            'icon-offset': [0, 0],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });
      }
      if (!map.getLayer('draw-point-icon')) {
        map.addLayer({
          id: 'draw-point-icon',
          type: 'symbol',
          source: 'draw',
          filter: ['all',
            ['==', ['geometry-type'], 'Point'],
            ['!=', ['get','_trackerHidden'], true],
            ['!=', ['get','_featureHidden'], true],
            ['!=', ['get','_featureLabelHidden'], true],
            ['!=', ['get','isLineEndpoint'], true],
            poiHasIconExpr
          ],
          layout: {
            'icon-image': ['get','poiIcon'],
            'icon-size': scaleLabelValue(POI_ICON_SIZE),
            'icon-anchor': 'center',
            'icon-offset': [0, 0],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });
      }
      // Optional label next to POI: show feature name when not empty/Untitled
      if (!map.getLayer('draw-point')) {
        map.addLayer({
          id: 'draw-point', type: 'symbol', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true], ['!=', ['get','_featureLabelHidden'], true], ['!=', ['get','isLineEndpoint'], true]],
          layout: {
            'text-field': [
              'case',
              [
                'all',
                ['has', 'name'],
                ['!=', ['downcase', ['coalesce', ['get','name'], '']], 'untitled'],
                ['!=', ['coalesce', ['get','name'], ''], '']
              ],
              ['get','name'],
              ''
            ],
            'icon-image': ['case', hasValidNameExpr, FEATURE_LABEL_BG_IMAGE_ID, ''],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [3, 6, 3, 6],
            'text-size': scaleLabelValue(BASE_FEATURE_LABEL_SIZE),
            'text-line-height': 1.1,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-anchor': 'left',
            'text-offset': poiLabelOffsetExpr,
            'text-letter-spacing': 0.02,
            'icon-anchor': 'left',
            'icon-offset': poiLabelOffsetExpr,
            'icon-allow-overlap': true
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': 'transparent',
            'text-halo-width': 0,
            'text-halo-blur': 0
          }
        });
      }
      if (!map.getLayer('draw-labels-polygon')) {
        map.addLayer({
          id: 'draw-labels-polygon',
          type: 'symbol',
          source: 'draw-labels',
          filter: ['==', ['get', 'labelType'], 'polygon'],
          layout: {
            'visibility': 'none',
            'text-field': ['format',
              ['case',
                ['all',
                  ['!=', ['coalesce', ['get', 'name'], ''], ''],
                  ['!=', ['downcase', ['coalesce', ['get', 'name'], '']], 'untitled']
                ],
                ['coalesce', ['get', 'name'], ''],
                ''
              ],
              {},
              ['case',
                ['all',
                  ['!=', ['coalesce', ['get', 'name'], ''], ''],
                  ['!=', ['downcase', ['coalesce', ['get', 'name'], '']], 'untitled'],
                  ['==', ['get', 'showSize'], true],
                  ['!=', ['coalesce', ['get', 'area'], ''], '']
                ],
                '\n',
                ''
              ],
              {},
              ['case',
                ['all',
                  ['==', ['get', 'showSize'], true],
                  ['!=', ['coalesce', ['get', 'area'], ''], '']
                ],
                ['coalesce', ['get', 'area'], ''],
                ''
              ],
              { 'font-scale': 0.85 }
            ],
            'icon-image': ['case', polygonHasLabelExpr, FEATURE_LABEL_BG_IMAGE_ID, ''],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [4, 6, 4, 6],
            'text-size': scaleLabelValue(BASE_FEATURE_LABEL_SIZE),
            'text-line-height': 1.1,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-justify': 'center',
            'text-max-width': 8,
            'text-allow-overlap': false,
            'text-padding': 2,
            'text-optional': false,
            'icon-anchor': 'center'
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': 'transparent',
            'text-halo-width': 0,
            'text-halo-blur': 0
          }
        });
      }
      if (!map.getLayer('draw-labels-line-name')) {
        map.addLayer({
          id: 'draw-labels-line-name',
          type: 'symbol',
          source: 'draw-labels',
          filter: ['==', ['get', 'labelType'], 'line-name'],
          layout: {
            'visibility': 'none',
            'text-field': ['case',
              ['all',
                ['!=', ['coalesce', ['get', 'name'], ''], ''],
                ['!=', ['downcase', ['coalesce', ['get', 'name'], '']], 'untitled']
              ],
              ['coalesce', ['get', 'name'], ''],
              ''
            ],
            'icon-image': ['case', hasValidNameExpr, FEATURE_LABEL_BG_IMAGE_ID, ''],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [3, 6, 3, 6],
            'text-size': scaleLabelValue(BASE_FEATURE_LABEL_SIZE),
            'text-line-height': 1.1,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'bottom',
            'text-offset': [0, -0.7],
            'text-allow-overlap': false,
            'text-max-width': 6,
            'text-padding': 2,
            'text-optional': false,
            'icon-anchor': 'bottom',
            'icon-offset': [0, -0.7]
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': 'transparent',
            'text-halo-width': 0,
            'text-halo-blur': 0
          }
        });
      }
      if (!map.getLayer('draw-labels-line-length')) {
        map.addLayer({
          id: 'draw-labels-line-length',
          type: 'symbol',
          source: 'draw-labels',
          filter: ['==', ['get', 'labelType'], 'line-length'],
          layout: {
            'visibility': 'none',
            'text-field': ['coalesce', ['get', 'length'], ''],
            'icon-image': ['case', lineLengthLabelExpr, FEATURE_LABEL_BG_IMAGE_ID, ''],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [3, 6, 3, 6],
            'text-size': scaleLabelValue(BASE_FEATURE_LABEL_SIZE),
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'top',
            'text-offset': [0, 0.7],
            'text-allow-overlap': false,
            'text-max-width': 6,
            'text-padding': 2,
            'text-optional': false,
            'icon-anchor': 'top',
            'icon-offset': [0, 0.7]
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': 'transparent',
            'text-halo-width': 0,
            'text-halo-blur': 0,
          }
        });
      }
      if (!map.getLayer('draw-labels-polygon-side-length')) {
        map.addLayer({
          id: 'draw-labels-polygon-side-length',
          type: 'symbol',
          source: 'draw-labels',
          filter: ['==', ['get', 'labelType'], 'polygon-side-length'],
          layout: {
            'visibility': 'none',
            'symbol-placement': 'line-center',
            'text-field': ['coalesce', ['get', 'length'], ''],
            'icon-image': ['case', lineLengthLabelExpr, FEATURE_LABEL_BG_IMAGE_ID, ''],
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [3, 6, 3, 6],
            'text-size': scaleLabelValue(BASE_FEATURE_LABEL_SIZE),
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-keep-upright': true,
            'text-rotation-alignment': 'map',
            'text-max-width': 6,
            'text-padding': 2,
            'text-optional': false
          },
          paint: {
            'text-color': '#000000',
            'text-halo-color': 'transparent',
            'text-halo-width': 0,
            'text-halo-blur': 0
          }
        });
      }
      if (!map.getLayer('draw-draft-fill')) {
        map.addLayer({ id: 'draw-draft-fill', type: 'fill', source: 'draw-draft', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#1565C0', 'fill-opacity': 0.18 } });
      }
      if (!map.getLayer('draw-draft-line')) {
        map.addLayer({ id: 'draw-draft-line', type: 'line', source: 'draw-draft', paint: { 'line-color': '#1565C0', 'line-width': 2, 'line-dasharray': [2,2] } });
      }
      if (!map.getLayer('draw-hl-fill')) {
        map.addLayer({ id: 'draw-hl-fill', type: 'fill', source: 'draw', filter: ['all', ['==', ['get','id'], '__none__'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]], paint: { 'fill-color': '#FFC107', 'fill-opacity': 0.30 } });
      }
      if (!map.getLayer('draw-hl-line')) {
        map.addLayer({ id: 'draw-hl-line', type: 'line', source: 'draw', filter: ['all', ['==', ['get','id'], '__none__'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]], paint: { 'line-color': '#FFC107', 'line-width': 4 } });
      }
      if (!map.getLayer('draw-hl-point')) {
        map.addLayer({ id: 'draw-hl-point', type: 'circle', source: 'draw', filter: ['all', ['==', ['get','id'], '__none__'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]], paint: { 'circle-color': '#FFC107', 'circle-radius': 9.2, 'circle-opacity': 0.5 } });
      }
      if (!map.getLayer('edit-verts')) {
        map.addLayer({ id: 'edit-verts', type: 'circle', source: 'edit-verts', paint: { 'circle-color': '#FFEB3B', 'circle-stroke-color': '#333', 'circle-stroke-width': 1, 'circle-radius': 7 }, layout: { visibility: 'none' } });
      }
      if (!map.getLayer('edit-mid')) {
        map.addLayer({ id: 'edit-mid', type: 'circle', source: 'edit-mid', paint: { 'circle-color': '#00E5FF', 'circle-stroke-color': '#004d5a', 'circle-stroke-width': 1, 'circle-radius': 5 }, layout: { visibility: 'none' } });
      }
      applyLabelVisibility(map);
      updateFeatureLabels();
      try { ensurePoiIconsLoaded(map, drawStore.features); } catch {}
    };
    map.on('load', ensureDrawLayers);
    // When switching styles (map.setStyle), the style graph resets; re-add our drawing layers
    map.on('style.load', () => {
      try {
        ensureDrawLayers();
        refreshDraw();
        (window)._bindEditInteractions && (window)._bindEditInteractions();
        if ((window)._editTarget) {
          refreshEditVerts();
          map.setLayoutProperty('edit-verts','visibility','visible');
          map.setLayoutProperty('edit-mid','visibility','visible');
        }
        applyFeaturesVisibility(map);
        updateTrackerSource();
        updateTrackerPathSource();
        applyTrackersVisibility(map);
        if (weatherOverlayActive) scheduleWeatherRefresh();
      } catch {}
    });

    const setDraft = (featureOrNull) => {
      const src = map.getSource('draw-draft');
      if (!src) return;
      const fc = { type: 'FeatureCollection', features: featureOrNull ? [featureOrNull] : [] };
      src.setData(fc);
    };
    const refreshDraw = () => {
      try { ensureLineEndpointsForAll(); } catch {}
      const src = map.getSource('draw');
      if (src) src.setData({ type: 'FeatureCollection', features: drawStore.features });
      updateFeatureLabels();
      updateDrawingsPanel();
      try { ensurePoiIconsLoaded(map, drawStore.features); } catch {}
      try { if ((window)._editTarget) refreshEditVerts(); } catch {}
    };
    // Expose refreshers so edit interaction code can call them
    (window)._refreshDraw = refreshDraw;

    const applyTrackerVisibilityToDrawings = () => {
      try {
        if (!drawStore || !Array.isArray(drawStore.features)) return;
        const hiddenIds = new Set();
        trackerStore.forEach((tracker) => {
          if (tracker && tracker.visible === false) hiddenIds.add(String(tracker.id));
        });
        let changed = false;
        drawStore.features.forEach((feature) => {
          if (!feature || !feature.properties) return;
          const trackerId = feature.properties.trackerId || feature.properties.trackerID || feature.properties.tracker_id;
          if (!trackerId) return;
          const shouldHide = hiddenIds.has(String(trackerId));
          if (!!feature.properties._trackerHidden !== shouldHide) {
            feature.properties._trackerHidden = shouldHide;
            changed = true;
          }
        });
        if (changed) {
          refreshDraw();
          requestFirestoreFeaturesSync();
        }
      } catch (err) {
        console.error('applyTrackerVisibilityToDrawings failed', err);
      }
    };
    (window).applyTrackerVisibilityToDrawings = applyTrackerVisibilityToDrawings;
    try { applyTrackerVisibilityToDrawings(); } catch {}

    const refreshEditVerts = () => {
      try {
        const verts = [];
        const mids = [];
        const eid = (window)._editTarget;
        if (eid) {
          const f = drawStore.features.find(x => x.properties?.id === eid);
          if (f && f.geometry) {
            const geomType = f.geometry.type;
            if (geomType === 'Polygon') {
              const ring = (f.geometry.coordinates?.[0] || []).slice();
              if (ring.length >= 4) {
                for (let i = 0; i < ring.length - 1; i++) {
                  const c = ring[i];
                  if (!Array.isArray(c)) continue;
                  const n = ring[i + 1];
                  if (!Array.isArray(n)) continue;
                  verts.push({
                    type: 'Feature',
                    properties: { fid: f.properties?.id, idx: i, geomType: 'Polygon' },
                    geometry: { type: 'Point', coordinates: [c[0], c[1]] }
                  });
                  const mx = (c[0] + n[0]) / 2;
                  const my = (c[1] + n[1]) / 2;
                  mids.push({
                    type: 'Feature',
                    properties: { fid: f.properties?.id, insAfter: i, geomType: 'Polygon' },
                    geometry: { type: 'Point', coordinates: [mx, my] }
                  });
                }
              }
            } else if (geomType === 'LineString') {
              const coords = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : [];
              if (coords.length >= 2) {
                for (let i = 0; i < coords.length; i++) {
                  const c = coords[i];
                  if (!Array.isArray(c)) continue;
                  verts.push({
                    type: 'Feature',
                    properties: { fid: f.properties?.id, idx: i, geomType: 'LineString' },
                    geometry: { type: 'Point', coordinates: [c[0], c[1]] }
                  });
                  if (i < coords.length - 1) {
                    const n = coords[i + 1];
                    if (!Array.isArray(n)) continue;
                    const mx = (c[0] + n[0]) / 2;
                    const my = (c[1] + n[1]) / 2;
                    mids.push({
                      type: 'Feature',
                      properties: { fid: f.properties?.id, insAfter: i, geomType: 'LineString' },
                      geometry: { type: 'Point', coordinates: [mx, my] }
                    });
                  }
                }
              }
            }
          }
        }
        const src = map.getSource('edit-verts');
        if (src) src.setData({ type: 'FeatureCollection', features: verts });
        const msrc = map.getSource('edit-mid');
        if (msrc) msrc.setData({ type: 'FeatureCollection', features: mids });
      } catch (err) {
        console.error('refreshEditVerts failed', err);
      }
    };
    (window)._refreshEditVerts = refreshEditVerts;

    // Helper: point in polygon ring (ray casting)
    function pointInRing(pt, ring){
      try{
        let x = pt[0], y = pt[1], inside = false;
        for (let i=0, j=ring.length-1; i<ring.length; j=i++){
          const xi = ring[i][0], yi = ring[i][1];
          const xj = ring[j][0], yj = ring[j][1];
          const intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }catch{ return false; }
    }

    // Finish edit when clicking outside the edited polygon
    map.on('mousedown', (e) => {
      try{
        const eid = (window)._editTarget; if (!eid) return;
        // If clicking on edit handles, ignore (drag/insert will handle it)
        const feats = map.queryRenderedFeatures(e.point, { layers: ['edit-verts','edit-mid'] });
        if (feats && feats.length) return;
        const ds = (window)._drawStore || drawStore;
        const f = ds.features.find(x => x.properties?.id === eid);
        if (!f) { (window)._editTarget = null; map.setLayoutProperty('edit-verts','visibility','none'); map.setLayoutProperty('edit-mid','visibility','none'); (window)._refreshEditVerts && (window)._refreshEditVerts(); (window)._refreshDraw && (window)._refreshDraw(); return; }
        if (f.geometry?.type === 'Polygon') {
          const ring = f.geometry.coordinates && f.geometry.coordinates[0];
          if (!Array.isArray(ring) || ring.length < 4) { (window)._editTarget = null; map.setLayoutProperty('edit-verts','visibility','none'); map.setLayoutProperty('edit-mid','visibility','none'); (window)._refreshEditVerts && (window)._refreshEditVerts(); (window)._refreshDraw && (window)._refreshDraw(); return; }
          const inside = pointInRing([e.lngLat.lng, e.lngLat.lat], ring);
          if (!inside) {
            (window)._editTarget = null;
            try { map.setLayoutProperty('edit-verts','visibility','none'); map.setLayoutProperty('edit-mid','visibility','none'); } catch {}
            try { (window)._refreshEditVerts && (window)._refreshEditVerts(); } catch {}
            try { (window)._refreshDraw && (window)._refreshDraw(); } catch {}
          }
        }
      }catch{}
    });
    const refreshDrawMapOnly = () => {
      try {
        const src = map.getSource('draw');
        if (src) src.setData(drawStore);
        updateFeatureLabels();
      } catch {}
    };

    // Expose a loader to replace drawings from external data (file open)
    (window).loadDrawings = (fc) => {
      try{
        if (!fc || fc.type !== 'FeatureCollection') return;
        drawStore.features = Array.isArray(fc.features) ? fc.features.map(f => {
          if (!f.properties) f.properties = {};
          if (!f.properties.id) f.properties.id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
          if (typeof f.properties.name === 'string' && f.properties.name) {
            f.properties.name = formatImportedFeatureName(f.properties.name);
          }
          return f;
        }) : [];
        refreshDraw();
        try { ensurePoiIconsLoaded(getMap(), drawStore.features); } catch {}
        requestFirestoreFeaturesSync(0);
        try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
      } catch(e){ console.error('loadDrawings failed', e); }
    };

    // Helpers to create shapes
    const rectFrom = (a, b) => {
      const minLng = Math.min(a.lng, b.lng), maxLng = Math.max(a.lng, b.lng);
      const minLat = Math.min(a.lat, b.lat), maxLat = Math.max(a.lat, b.lat);
      const ring = [[minLng,minLat],[maxLng,minLat],[maxLng,maxLat],[minLng,maxLat],[minLng,minLat]];
      return { type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[ring] } };
    };
    const metersPerDegLat = 111320;
    const metersPerDegLngAt = (lat) => Math.cos(lat * Math.PI/180) * metersPerDegLat;
    const distMeters = (a, b) => {
      const mpdLng = metersPerDegLngAt((a[1]+b[1])/2);
      const dx = (b[0] - a[0]) * mpdLng;
      const dy = (b[1] - a[1]) * metersPerDegLat;
      return Math.hypot(dx, dy);
    };
    const lengthMeters = (coords) => {
      let m = 0; for (let i=1;i<coords.length;i++) m += distMeters(coords[i-1], coords[i]); return m;
    };
    const areaSqm = (coords) => {
      const avgLat = coords.reduce((s, c)=>s+c[1],0)/coords.length;
      const kx = metersPerDegLngAt(avgLat), ky = metersPerDegLat;
      let sum = 0;
      for (let i=0;i<coords.length-1;i++){
        const x1 = coords[i][0]*kx, y1 = coords[i][1]*ky;
        const x2 = coords[i+1][0]*kx, y2 = coords[i+1][1]*ky;
        sum += (x1*y2 - x2*y1);
      }
      return Math.abs(sum)/2;
    };
    const POLYGON_SIDE_MIN_METERS = 10;
    const fmtLen = (m) => m >= 1000 ? `${(m/1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
    const fmtArea = (a) => a >= 1_000_000 ? `${(a/1_000_000).toFixed(2)} km²` : `${Math.round(a).toLocaleString()} m²`;
    const polygonCentroid = (ring) => {
      if (!Array.isArray(ring) || ring.length < 3) return null;
      let twiceArea = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        if (![x0, y0, x1, y1].every(Number.isFinite)) continue;
        const cross = (x0 * y1) - (x1 * y0);
        twiceArea += cross;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
      }
      if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-12) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        ring.forEach((pt) => {
          const [lng, lat] = Array.isArray(pt) ? pt : [];
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
          return null;
        }
        return [ (minLng + maxLng) / 2, (minLat + maxLat) / 2 ];
      }
      const areaFactor = twiceArea * 3;
      if (!Number.isFinite(areaFactor) || Math.abs(areaFactor) < 1e-12) return null;
      return [ cx / areaFactor, cy / areaFactor ];
    };
    buildFeatureLabelFeatures = () => {
      const labels = [];
      if (!drawStore || !Array.isArray(drawStore.features)) return labels;
      drawStore.features.forEach((feature) => {
        try {
          if (!feature || feature.properties?.isLineEndpoint) return;
          if (feature.properties?._trackerHidden) return;
          if (feature.properties?._featureHidden) return;
          if (feature.properties?._featureLabelHidden) return;
          const showSize = !feature.properties?._featureSizeHidden;
          const geom = feature.geometry;
          const kind = (feature.properties?.kind || '').toLowerCase();
          const color = typeof feature.properties?.color === 'string' ? feature.properties.color : '#1f2933';
          if (geom?.type === 'Polygon' && kind !== 'arrow') {
            const rings = Array.isArray(geom.coordinates) ? geom.coordinates : [];
            const ring = Array.isArray(rings[0]) ? rings[0] : null;
            if (!ring || ring.length < 4) return;
            const centroid = polygonCentroid(ring);
            if (!centroid) return;
            let areaLabel = '';
            if (showSize) {
              const area = areaSqm(ring);
              if (Number.isFinite(area)) areaLabel = fmtArea(area);
            }
            const rawName = normalizeLineBreaks(feature.properties?.name || '');
            const hasText = /\S/.test(rawName);
            const name = hasText ? rawName : 'Untitled';
            const hasName = hasText && String(name).toLowerCase() !== 'untitled';
            if (!hasName && !areaLabel) return;
            labels.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: centroid },
              properties: {
                labelType: 'polygon',
                name,
                area: areaLabel,
                color,
                showSize
              }
            });
            if (showSize) {
              for (let i = 0; i < ring.length - 1; i++) {
                const a = ring[i];
                const b = ring[i + 1];
                if (!Array.isArray(a) || !Array.isArray(b)) continue;
                const lenMeters = distMeters(a, b);
                if (!Number.isFinite(lenMeters) || lenMeters < POLYGON_SIDE_MIN_METERS) continue;
                labels.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: [[a[0], a[1]], [b[0], b[1]]] },
                  properties: {
                    labelType: 'polygon-side-length',
                    length: fmtLen(lenMeters),
                    color
                  }
                });
              }
            }
            return;
          }
          if (geom?.type === 'LineString' && (kind === 'line' || kind === 'polyline' || kind === 'path' || kind === '')) {
            const coords = Array.isArray(geom.coordinates) ? geom.coordinates : [];
            if (coords.length < 2) return;
            const start = coords[0];
            const end = coords[coords.length - 1];
            if (!Array.isArray(start) || !Array.isArray(end)) return;
            const rawName = normalizeLineBreaks(feature.properties?.name || '');
            const hasText = /\S/.test(rawName);
            const name = hasText ? rawName : 'Untitled';
            labels.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [start[0], start[1]] },
              properties: {
                labelType: 'line-name',
                name,
                color
              }
            });
            if (showSize) {
              const lengthMetersValue = lengthMeters(coords);
              if (Number.isFinite(lengthMetersValue)) {
                const length = fmtLen(lengthMetersValue);
                labels.push({
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [end[0], end[1]] },
                  properties: {
                    labelType: 'line-length',
                    length,
                    color
                  }
                });
              }
            }
          }
        } catch (err) {
          console.error('buildFeatureLabelFeatures failed', err);
        }
      });
      return labels;
    };
    updateFeatureLabels = () => {
      try {
        const mapInst = getMap();
        if (!mapInst) return;
        const src = mapInst.getSource('draw-labels');
        if (!src) return;
        src.setData({ type: 'FeatureCollection', features: buildFeatureLabelFeatures() });
      } catch (err) {
        console.error('updateFeatureLabels failed', err);
      }
    };
    const newId = () => `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
    // Auto-assign palette (cycling)
    const colorPalette = ['#1565C0','#C62828','#2E7D32','#EF6C00','#6A1B9A','#00838F','#AD1457','#4E342E','#283593','#546E7A'];
    // Picker palette (30+ choices)
    const colorChoices = [
      '#b71c1c','#c62828','#ad1457','#880e4f','#6a1b9a','#4a148c','#311b92','#283593','#1a237e',
      '#0d47a1','#1565c0','#0277bd','#006064','#00838f','#004d40','#00796b','#1b5e20','#2e7d32',
      '#33691e','#827717','#f57f17','#ff8f00','#ef6c00','#e65100','#d84315','#bf360c','#5d4037',
      '#4e342e','#37474f','#263238','#000000'
    ];
    let lastColorIndex = -1;
    const nextColor = () => { lastColorIndex = (lastColorIndex + 1) % colorPalette.length; return colorPalette[lastColorIndex]; };
    const annotateFeature = (f, kind) => {
      f.properties = { ...(f.properties||{}), id: newId(), kind };
      if (!f.properties.color) f.properties.color = nextColor();
      notifyFeatureAdded(kind || 'feature');
      ensureFeaturesVisible();
      return f;
    };
    const addLineEndpoints = (lineFeature, coords) => {
      try {
        if (!lineFeature || !Array.isArray(coords) || coords.length < 2) return;
        const start = coords[0];
        const end = coords[coords.length - 1];
        if (!Array.isArray(start) || !Array.isArray(end)) return;
        const color = lineFeature.properties?.color || '#1565C0';
        const lineId = lineFeature.properties?.id;
        const hidden = !!lineFeature.properties?._featureHidden;
        const makePoint = (coord, kind, { opacity = 1, hasInnerDot = false } = {}) => ({
          type: 'Feature',
          properties: {
            id: newId(),
            kind,
            color,
            pointOpacity: opacity,
            hasInnerDot,
            relatedLineId: lineId,
            isLineEndpoint: true,
            _featureHidden: hidden
          },
          geometry: { type: 'Point', coordinates: [coord[0], coord[1]] }
        });
        drawStore.features.push(makePoint(start, 'line-start', { opacity: 1, hasInnerDot: true }));
        drawStore.features.push(makePoint(end, 'line-end', { opacity: 1 }));
      } catch (err) {
        console.error('addLineEndpoints failed', err);
      }
    };

    const syncLineEndpointVisibility = (lineFeature) => {
      try {
        const lineId = lineFeature?.properties?.id;
        if (!lineId) return false;
        const hidden = !!lineFeature.properties?._featureHidden;
        let changed = false;
        drawStore.features.forEach((feat) => {
          if (feat?.properties?.isLineEndpoint && feat.properties?.relatedLineId === lineId) {
            if (!!feat.properties._featureHidden !== hidden) {
              feat.properties._featureHidden = hidden;
              changed = true;
            }
          }
        });
        return changed;
      } catch (err) {
        console.error('syncLineEndpointVisibility failed', err);
        return false;
      }
    };
    function syncLineEndpoints(lineFeature) {
      try {
        if (!lineFeature || lineFeature.geometry?.type !== 'LineString') return;
        const coords = Array.isArray(lineFeature.geometry?.coordinates) ? lineFeature.geometry.coordinates : null;
        const lineId = lineFeature.properties?.id;
        if (!coords || coords.length < 2 || !lineId) return;
        const start = coords[0];
        const end = coords[coords.length - 1];
        if (!Array.isArray(start) || !Array.isArray(end)) return;
        let hasStart = false;
        let hasEnd = false;
        drawStore.features.forEach((feat) => {
          if (!feat || feat.properties?.relatedLineId !== lineId) return;
          if (!feat.geometry || feat.geometry.type !== 'Point') return;
          if (feat.properties?.kind === 'line-start') {
            feat.geometry.coordinates = [start[0], start[1]];
            hasStart = true;
          } else if (feat.properties?.kind === 'line-end') {
            feat.geometry.coordinates = [end[0], end[1]];
            hasEnd = true;
          }
        });
        if (!hasStart || !hasEnd) {
          const color = lineFeature.properties?.color || '#1565C0';
          const hidden = !!lineFeature.properties?._featureHidden;
          const makePoint = (coord, kind, { opacity = 1, hasInnerDot = false } = {}) => ({
            type: 'Feature',
            properties: {
              id: newId(),
              kind,
              color,
              pointOpacity: opacity,
              hasInnerDot,
              relatedLineId: lineId,
              isLineEndpoint: true,
              _featureHidden: hidden
            },
            geometry: { type: 'Point', coordinates: [coord[0], coord[1]] }
          });
          if (!hasStart) drawStore.features.push(makePoint(start, 'line-start', { opacity: 1, hasInnerDot: true }));
          if (!hasEnd) drawStore.features.push(makePoint(end, 'line-end', { opacity: 1 }));
        }
      } catch (err) {
        console.error('syncLineEndpoints failed', err);
      }
    }
    function ensureLineEndpointsForAll() {
      try {
        if (!Array.isArray(drawStore.features)) return;
        drawStore.features.forEach((feat) => {
          if (!feat || feat.properties?.isLineEndpoint) return;
          if (feat.geometry?.type !== 'LineString') return;
          syncLineEndpoints(feat);
        });
      } catch (err) {
        console.error('ensureLineEndpointsForAll failed', err);
      }
    }
    const circleFrom = (center, edge, steps=64) => {
      const latRad = center.lat * Math.PI/180;
      const mPerDegLng = Math.max(1e-6, Math.cos(latRad) * metersPerDegLat);
      const dx = (edge.lng - center.lng) * mPerDegLng;
      const dy = (edge.lat - center.lat) * metersPerDegLat;
      const r = Math.sqrt(dx*dx + dy*dy);
      const ring = [];
      for (let i=0;i<=steps;i++){
        const ang = (i/steps) * Math.PI*2;
        const dLng = (Math.cos(ang) * r) / mPerDegLng;
        const dLat = (Math.sin(ang) * r) / metersPerDegLat;
        ring.push([center.lng + dLng, center.lat + dLat]);
      }
      return { type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[ring] } };
    };

    // Drag-to-draw for Rect/Circle
    let dragStart = null;
    let arrowStart = null;
    let arrowMoveHandler = null;

    const arrowFeatureFrom = (startLngLat, endLngLat) => {
      try {
        if (!startLngLat || !endLngLat) return null;
        const startLng = Number(startLngLat.lng);
        const startLat = Number(startLngLat.lat);
        const endLng = Number(endLngLat.lng);
        const endLat = Number(endLngLat.lat);
        if (![startLng, startLat, endLng, endLat].every(Number.isFinite)) return null;
        const avgLat = (startLat + endLat) / 2;
        const mPerDegLng = Math.max(1e-6, Math.cos(avgLat * Math.PI / 180) * metersPerDegLat);
        const dx = (endLng - startLng) * mPerDegLng;
        const dy = (endLat - startLat) * metersPerDegLat;
        const len = Math.hypot(dx, dy);
        if (!Number.isFinite(len) || len < 1) return null;
        const shaftWidth = Math.min(Math.max(len * 0.12, 4), 30);
        const minHead = Math.min(len * 0.5, 25);
        const headLen = Math.min(Math.max(len * 0.3, minHead), len * 0.9);
        const shaftEnd = Math.max(len - headLen, len * 0.25);
        const headHalfWidth = Math.max(shaftWidth * 1.6, headLen * 0.6);
        const ux = dx / len;
        const uy = dy / len;
        const vx = -uy;
        const vy = ux;
        const point = (dist, offset) => ({
          x: ux * dist + vx * offset,
          y: uy * dist + vy * offset
        });
        const tip = { x: dx, y: dy };
        const ringMeters = [
          point(0, shaftWidth / 2),
          point(shaftEnd, shaftWidth / 2),
          point(shaftEnd, headHalfWidth),
          tip,
          point(shaftEnd, -headHalfWidth),
          point(shaftEnd, -shaftWidth / 2),
          point(0, -shaftWidth / 2)
        ];
        const toLngLat = (pt) => [
          startLng + pt.x / mPerDegLng,
          startLat + pt.y / metersPerDegLat
        ];
        const ring = ringMeters.map(toLngLat);
        ring.push(ring[0]);
        return { type: 'Feature', properties: { lengthMeters: len }, geometry: { type: 'Polygon', coordinates: [ring] } };
      } catch (err) {
        console.error('arrowFeatureFrom failed', err);
        return null;
      }
    };

    const cleanupArrowInteraction = () => {
      const hadActive = !!arrowStart || !!arrowMoveHandler;
      if (arrowMoveHandler) {
        try { map.off('mousemove', arrowMoveHandler); } catch {}
        arrowMoveHandler = null;
      }
      arrowStart = null;
      try { map.dragPan.enable(); } catch {}
      try { map.getCanvas().style.cursor = ''; } catch {}
      if (hadActive) setDraft(null);
    };
    (window)._cleanupArrowInteraction = cleanupArrowInteraction;
    const onMouseDown = (e) => {
      const tool = (window)._currentTool;
      if (tool !== 'rect' && tool !== 'circle') return;
      dragStart = e.lngLat;
      map.getCanvas().style.cursor = 'crosshair';
      map.dragPan.disable();
      const move = (ev) => {
        if (!dragStart) return;
        const f = tool === 'rect' ? rectFrom(dragStart, ev.lngLat) : circleFrom(dragStart, ev.lngLat);
        setDraft(f);
      };
      const up = (ev) => {
        map.off('mousemove', move);
        map.off('mouseup', up);
        map.getCanvas().style.cursor = '';
        map.dragPan.enable();
        if (!dragStart) return;
        const finalF = tool === 'rect' ? rectFrom(dragStart, ev.lngLat) : circleFrom(dragStart, ev.lngLat);
        drawStore.features.push(annotateFeature(finalF, tool === 'rect' ? 'rectangle' : 'circle'));
        setDirty(true);
        refreshDraw(); setDraft(null); dragStart = null;
      };
      map.on('mousemove', move);
      map.on('mouseup', up);
    };
    map.on('mousedown', onMouseDown);

    // Click-to-vertex for Line/Polygon and POI
    let vertCoords = null; // array of [lng,lat]
    (window)._lineInProgress = false;
    const coordsEqual = (a, b, eps=1e-6) => !!a && !!b && Math.abs(a[0]-b[0]) <= eps && Math.abs(a[1]-b[1]) <= eps;
    const onClick = (e) => {
      const tool = (window)._currentTool;
      if (!tool) return;
      if (tool === 'crosshair') {
        if (e?.preventDefault) e.preventDefault();
        const lngLat = e?.lngLat;
        if (lngLat && Number.isFinite(lngLat.lng) && Number.isFinite(lngLat.lat)) {
          showCoordinatesDialog(lngLat.lng, lngLat.lat);
        }
        return;
      }
      if (tool === 'team-goto') {
        if (e?.preventDefault) e.preventDefault();
        const lngLat = e?.lngLat;
        const trackerId = activeTrackerGoToId;
        if (trackerId && lngLat && Number.isFinite(lngLat.lng) && Number.isFinite(lngLat.lat)) {
          if (trackerGoToLocations.has(trackerId)) {
            void clearTrackerGoToLocation(trackerId);
            return;
          }
          void setTrackerGoToLocation(trackerId, { longitude: lngLat.lng, latitude: lngLat.lat });
          try { window.setActiveTool?.(null); } catch { (window)._currentTool = null; }
          return;
        }
        try { window.setActiveTool?.(null); } catch { (window)._currentTool = null; }
        return;
      }
      if (tool === 'arrow') {
        if (!arrowStart) {
          arrowStart = e.lngLat;
          try { map.dragPan.disable(); } catch {}
          try { map.getCanvas().style.cursor = 'crosshair'; } catch {}
          if (arrowMoveHandler) {
            try { map.off('mousemove', arrowMoveHandler); } catch {}
            arrowMoveHandler = null;
          }
          arrowMoveHandler = (moveEvt) => {
            const draft = arrowFeatureFrom(arrowStart, moveEvt.lngLat);
            setDraft(draft);
          };
          map.on('mousemove', arrowMoveHandler);
        } else {
          const feature = arrowFeatureFrom(arrowStart, e.lngLat);
          if (feature) {
            drawStore.features.push(annotateFeature(feature, 'arrow'));
            setDirty(true);
            refreshDraw();
          }
          cleanupArrowInteraction();
          window.setActiveTool?.(null);
        }
        return;
      }
      if (tool === 'poi') {
        // Single POI type: store as a Point feature
        const poi = { type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:[e.lngLat.lng, e.lngLat.lat] } };
        drawStore.features.push(annotateFeature(poi, 'poi'));
        setDirty(true);
        refreshDraw();
        return;
      }
      if (tool !== 'poly' && tool !== 'line') return;
      if (!vertCoords) vertCoords = [];
      const newPt = [e.lngLat.lng, e.lngLat.lat];
      // Avoid pushing a duplicate point when double-clicking
      if (vertCoords.length === 0 || !coordsEqual(vertCoords[vertCoords.length-1], newPt)) {
        vertCoords.push(newPt);
      }
      (window)._lineInProgress = (Array.isArray(vertCoords) && vertCoords.length > 0 && tool === 'line');
      if (tool === 'poly') {
        const ring = vertCoords.length > 1 ? [...vertCoords, vertCoords[0]] : [...vertCoords];
        setDraft({ type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[ring] } });
      } else {
        setDraft({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: vertCoords.slice() } });
      }
    };
    const finishVertices = () => {
      const tool = (window)._currentTool;
      if (!vertCoords || !tool) { setDraft(null); vertCoords = null; return; }
      if (tool === 'poly' && vertCoords.length >= 3) {
        // If the last two vertices are the same (double-click), drop the last
        if (vertCoords.length >= 2 && coordsEqual(vertCoords[vertCoords.length-1], vertCoords[vertCoords.length-2])) {
          vertCoords.pop();
        }
        // Ensure we still have a valid polygon
        if (vertCoords.length < 3) { setDraft(null); vertCoords = null; return; }
        const ring = [...vertCoords, vertCoords[0]];
        drawStore.features.push(annotateFeature({ type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[ring] } }, 'polygon'));
      } else if (tool === 'line' && vertCoords.length >= 2) {
        const coords = vertCoords.slice();
        const lineFeature = annotateFeature({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: coords } }, 'line');
        drawStore.features.push(lineFeature);
        addLineEndpoints(lineFeature, coords);
      }
      setDirty(true);
      refreshDraw(); setDraft(null); vertCoords = null; (window)._lineInProgress = false;
    };
    const onDblClick = (e) => {
      const tool = (window)._currentTool;
      if (tool === 'poly' || tool === 'line') { e.preventDefault(); finishVertices(); }
    };
    map.on('click', onClick);
    map.on('dblclick', onDblClick);

    // Expose an abort helper so global handlers (e.g., ESC) can cancel drawing
    (window).abortActiveTool = () => {
      try { window._cleanupArrowInteraction?.(); } catch {}
      try { setDraft(null); } catch {}
      try { (window)._lineInProgress = false; } catch {}
      try { vertCoords = null; dragStart = null; } catch {}
      try { const m = (window)._map; if (m) { m.dragPan.enable(); m.getCanvas().style.cursor = ''; } } catch {}
      try { if ((window)._currentTool === 'crosshair') setCrosshairMode(false); } catch {}
      try { window.setActiveTool?.(null); } catch {}
    };

    // ---------- Drawings floating list ----------
    let hoveredId = null;
    const setHighlight = (id) => {
      hoveredId = id || null;
      const matchId = ['==', ['get', 'id'], id || '__none__'];
      const polygonFilter = ['all', ['==', ['geometry-type'], 'Polygon'], matchId, ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]];
      const lineFilter = ['all', ['==', ['geometry-type'], 'LineString'], matchId, ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]];
      const pointFilter = ['all', ['==', ['geometry-type'], 'Point'], matchId, ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]];
      try { map.setFilter('draw-hl-fill', polygonFilter); } catch {}
      try { map.setFilter('draw-hl-line', lineFilter); } catch {}
      try { map.setFilter('draw-hl-point', pointFilter); } catch {}
    };
    // ---- Direct edit tool (hover + drag) ----
    let editToolHoverId = null;
    let editToolOwnedId = null;
    let editToolDrag = null;
    let editToolRafPending = false;
    let editToolLastEvt = null;
    const EDIT_TOOL_LAYERS = ['draw-fill', 'draw-fill-outline', 'draw-line', 'draw-point-circle', 'draw-point-icon', 'draw-point'];
    const isEditToolActive = () => (window)._currentTool === 'edit';
    const setEditHandleVisibility = (visible) => {
      try { map.setLayoutProperty('edit-verts', 'visibility', visible ? 'visible' : 'none'); } catch {}
      try { map.setLayoutProperty('edit-mid', 'visibility', visible ? 'visible' : 'none'); } catch {}
    };
    const setDrawSourceData = () => {
      try {
        const src = map.getSource('draw');
        if (src) src.setData({ type: 'FeatureCollection', features: drawStore.features });
      } catch {}
    };
    const clearEditHover = () => {
      const hadHover = !!editToolHoverId;
      editToolHoverId = null;
      if (hadHover) setHighlight(null);
      if (editToolOwnedId && (window)._editTarget === editToolOwnedId) {
        (window)._editTarget = null;
        editToolOwnedId = null;
        try { refreshEditVerts(); } catch {}
        setEditHandleVisibility(false);
      }
      try { map.getCanvas().style.cursor = ''; } catch {}
    };
    const getEditableHit = (point) => {
      if (!point) return null;
      let hits = [];
      try { hits = map.queryRenderedFeatures(point, { layers: EDIT_TOOL_LAYERS }) || []; } catch { hits = []; }
      if (!hits.length) return null;
      let endpointHit = null;
      let featureHit = null;
      for (let i = 0; i < hits.length; i += 1) {
        const hit = hits[i];
        const props = hit?.properties || {};
        if (props._featureHidden || props._trackerHidden) continue;
        if (props.isReadOnly) continue;
        if (props.isLineEndpoint) {
          const relatedId = props.relatedLineId || props.relatedLineID || props.related_line_id || null;
          if (!relatedId) continue;
          const lineFeat = drawStore.features.find(f => f?.properties?.id === relatedId);
          if (!lineFeat || lineFeat.geometry?.type !== 'LineString') continue;
          if (lineFeat.properties?._featureHidden || lineFeat.properties?._trackerHidden) continue;
          if (lineFeat.properties?.isReadOnly) continue;
          endpointHit = { rendered: hit, store: lineFeat, endpointKind: props.kind || null, endpointId: props.id || null };
          break;
        }
        const fid = props.id || null;
        if (!fid) continue;
        const storeFeat = drawStore.features.find(f => f?.properties?.id === fid);
        if (!storeFeat || storeFeat?.properties?.isLineEndpoint) continue;
        featureHit = { rendered: hit, store: storeFeat };
        break;
      }
      return endpointHit || featureHit || null;
    };
    const applyEditHover = (hit) => {
      const nextId = hit?.store?.properties?.id || null;
      if (editToolHoverId !== nextId) {
        editToolHoverId = nextId;
        setHighlight(nextId);
      }
      const canEditVerts = !!(hit && (hit.store.geometry?.type === 'LineString' || hit.store.geometry?.type === 'Polygon'));
      if (canEditVerts) {
        if ((window)._editTarget !== nextId) {
          (window)._editTarget = nextId;
          editToolOwnedId = nextId;
          try { refreshEditVerts(); } catch {}
        }
        setEditHandleVisibility(true);
        try { map.moveLayer('edit-mid'); map.moveLayer('edit-verts'); } catch {}
      } else if (editToolOwnedId && (window)._editTarget === editToolOwnedId) {
        (window)._editTarget = null;
        editToolOwnedId = null;
        try { refreshEditVerts(); } catch {}
        setEditHandleVisibility(false);
      }
      try { map.getCanvas().style.cursor = hit ? 'grab' : ''; } catch {}
    };
    const toLngLatFromEvent = (ev) => {
      if (!ev) return null;
      if (ev.lngLat) return ev.lngLat;
      if (ev.point && Number.isFinite(ev.point.x) && Number.isFinite(ev.point.y)) {
        try { return map.unproject([ev.point.x, ev.point.y]); } catch { return null; }
      }
      const oe = ev.originalEvent || ev;
      const canvas = map.getCanvas();
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      let x = null;
      let y = null;
      if (oe?.touches && oe.touches[0]) {
        x = oe.touches[0].clientX - rect.left;
        y = oe.touches[0].clientY - rect.top;
      } else if (oe && (oe.clientX != null) && (oe.clientY != null)) {
        x = oe.clientX - rect.left;
        y = oe.clientY - rect.top;
      }
      if (x == null || y == null) return null;
      try { return map.unproject([x, y]); } catch { return null; }
    };
    const translateCoords = (coords, dx, dy) => {
      if (!Array.isArray(coords)) return coords;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[0] + dx, coords[1] + dy];
      }
      return coords.map((item) => translateCoords(item, dx, dy));
    };
    const applyEditDrag = (evt) => {
      if (!editToolDrag) return;
      const lngLat = toLngLatFromEvent(evt);
      if (!lngLat) return;
      const f = editToolDrag.feature;
      if (!f || !f.geometry) return;
      if (editToolDrag.mode === 'endpoint') {
        if (f.geometry.type !== 'LineString') return;
        const coords = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
        if (!coords || coords.length < 2) return;
        const idx = editToolDrag.endpointKind === 'line-start' ? 0 : coords.length - 1;
        const nextCoord = [lngLat.lng, lngLat.lat];
        coords[idx] = nextCoord;
        if (editToolDrag.endpointFeature?.geometry?.type === 'Point') {
          editToolDrag.endpointFeature.geometry.coordinates = [nextCoord[0], nextCoord[1]];
        }
        try { syncLineEndpoints(f); } catch {}
        editToolDrag.moved = editToolDrag.moved || Math.abs(lngLat.lng - editToolDrag.start[0]) > 1e-10 || Math.abs(lngLat.lat - editToolDrag.start[1]) > 1e-10;
      } else {
        const dx = lngLat.lng - editToolDrag.start[0];
        const dy = lngLat.lat - editToolDrag.start[1];
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        const nextCoords = translateCoords(editToolDrag.origCoords, dx, dy);
        f.geometry.coordinates = nextCoords;
        if (f.geometry.type === 'LineString') {
          try { syncLineEndpoints(f); } catch {}
        }
        editToolDrag.moved = editToolDrag.moved || Math.abs(dx) > 1e-10 || Math.abs(dy) > 1e-10;
      }
      setDrawSourceData();
      try { map.triggerRepaint(); } catch {}
      try { updateFeatureLabels(); } catch {}
      try { if ((window)._editTarget) refreshEditVerts(); } catch {}
    };
    const onEditDragMove = (e) => {
      if (!editToolDrag) return;
      editToolLastEvt = e;
      if (editToolRafPending) return;
      editToolRafPending = true;
      requestAnimationFrame(() => {
        editToolRafPending = false;
        applyEditDrag(editToolLastEvt);
      });
    };
    const stopEditDrag = () => {
      if (!editToolDrag) return;
      const moved = !!editToolDrag.moved;
      editToolDrag = null;
      try {
        map.dragPan.enable();
        map.getCanvas().style.cursor = editToolHoverId ? 'grab' : '';
      } catch {}
      try {
        document.removeEventListener('mousemove', onEditDragMove, true);
        document.removeEventListener('mouseup', stopEditDrag, true);
        document.removeEventListener('touchmove', onEditDragMove, { capture:true });
        document.removeEventListener('touchend', stopEditDrag, { capture:true });
      } catch {}
      if (moved) {
        setDirty(true);
        refreshDraw();
        notifyFeatureModified('Feature moved');
      }
    };
    const beginEditDrag = (hit, evt) => {
      if (!hit || !hit.store || !hit.store.geometry) return;
      const lngLat = toLngLatFromEvent(evt);
      if (!lngLat) return;
      if (hit.endpointKind === 'line-start' || hit.endpointKind === 'line-end') {
        let endpointFeature = null;
        if (hit.endpointId) {
          endpointFeature = drawStore.features.find(f => f?.properties?.id === hit.endpointId) || null;
        }
        editToolDrag = {
          id: hit.store.properties?.id || null,
          feature: hit.store,
          start: [lngLat.lng, lngLat.lat],
          endpointKind: hit.endpointKind,
          endpointFeature,
          mode: 'endpoint',
          moved: false
        };
      } else {
        const coords = hit.store.geometry.coordinates;
        let orig;
        try { orig = JSON.parse(JSON.stringify(coords)); } catch { orig = coords; }
        editToolDrag = {
          id: hit.store.properties?.id || null,
          feature: hit.store,
          start: [lngLat.lng, lngLat.lat],
          origCoords: orig,
          mode: 'translate',
          moved: false
        };
      }
      try {
        map.getCanvas().style.cursor = 'grabbing';
        map.dragPan.disable();
      } catch {}
      try {
        document.addEventListener('mousemove', onEditDragMove, true);
        document.addEventListener('mouseup', stopEditDrag, true);
        document.addEventListener('touchmove', onEditDragMove, { capture:true, passive:false });
        document.addEventListener('touchend', stopEditDrag, { capture:true });
      } catch {}
      evt?.preventDefault?.();
    };
    const onEditToolMouseDown = (e) => {
      if (!isEditToolActive()) return;
      if (editToolDrag) return;
      if (e?.originalEvent && ('button' in e.originalEvent) && e.originalEvent.button !== 0) return;
      try {
        const handleHits = map.queryRenderedFeatures(e.point, { layers: ['edit-verts', 'edit-mid'] });
        if (handleHits && handleHits.length) return;
      } catch {}
      const hit = getEditableHit(e.point);
      if (!hit) return;
      applyEditHover(hit);
      beginEditDrag(hit, e);
    };
    map.on('mousemove', (e) => {
      if (!isEditToolActive()) return;
      if (editToolDrag || (window)._editVertexDragging) return;
      const hit = getEditableHit(e.point);
      if (!hit) { clearEditHover(); return; }
      applyEditHover(hit);
    });
    map.on('mousedown', onEditToolMouseDown);
    map.on('touchstart', onEditToolMouseDown, { passive:false });
    try {
      map.getCanvas().addEventListener('mouseleave', () => {
        if (!isEditToolActive() || editToolDrag) return;
        clearEditHover();
      });
    } catch {}
    (window)._setEditToolActive = (active) => {
      if (!active) {
        if (editToolDrag) stopEditDrag();
        clearEditHover();
      }
    };
    // Color modal helpers
    function buildColorGridOnce(){
      if (!colorGrid || colorGrid.dataset.built === '1') return;
      colorChoices.forEach((hex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-opt';
        btn.style.backgroundColor = hex;
        btn.setAttribute('data-color', hex);
        btn.setAttribute('aria-selected', 'false');
        btn.title = hex;
        colorGrid.appendChild(btn);
      });
      colorGrid.dataset.built = '1';
      colorGrid.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const hex = t.getAttribute('data-color');
        if (!hex) return;
        if (typeof colorState.onPick === 'function') colorState.onPick(hex);
        closeColorModal();
      });
    }
    function openColorModal(currentHex, onPick){
      if (!colorModal) return;
      colorState.onPick = onPick;
      colorState.current = currentHex;
      buildColorGridOnce();
      // Mark selected
      try {
        colorGrid.querySelectorAll('.color-opt').forEach(el => {
          const hex = el.getAttribute('data-color') || '';
          el.setAttribute('aria-selected', String(hex.toLowerCase() === String(currentHex||'').toLowerCase()));
        });
      } catch {}
      colorModal.hidden = false;
    }
    (window).openColorModal = openColorModal;
    function closeColorModal(){ if (colorModal) colorModal.hidden = true; colorState.onPick = null; colorState.current = null; }
    colorClose?.addEventListener('click', () => closeColorModal());
    colorModal?.addEventListener('click', (e) => {
      const t = e.target; if (t && t instanceof HTMLElement && t.classList.contains('modal-backdrop')) closeColorModal();
    });

    // POI icon modal helpers
    function buildPoiIconGrid(currentId){
      if (!poiIconGrid) return;
      poiIconGrid.textContent = '';
      const list = symbolCatalogState.list;
      if (!list.length) {
        if (poiIconStatus) {
          poiIconStatus.textContent = symbolCatalogState.promise ? POI_ICON_LOADING_LABEL : POI_ICON_EMPTY_LABEL;
          poiIconStatus.hidden = false;
        }
        return;
      }
      if (poiIconStatus) {
        poiIconStatus.textContent = '';
        poiIconStatus.hidden = true;
      }
      const makeBtn = ({ id, label, src, fallbackSrc, isNone = false }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `poi-icon-opt${isNone ? ' poi-icon-opt--none' : ''}`;
        btn.setAttribute('data-icon-id', id || '');
        const selected = isNone ? !currentId : (id === currentId);
        btn.setAttribute('aria-selected', String(selected));
        const ariaLabel = label || POI_ICON_NONE_LABEL;
        btn.setAttribute('aria-label', ariaLabel);
        btn.title = ariaLabel;
        if (isNone) {
          const labelEl = document.createElement('span');
          labelEl.className = 'poi-icon-none-label';
          labelEl.textContent = POI_ICON_NONE_LABEL;
          btn.appendChild(labelEl);
          return btn;
        }
        const img = document.createElement('img');
        img.className = 'poi-icon-img';
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = src || '';
        if (fallbackSrc) {
          img.addEventListener('error', () => {
            if (img.src !== fallbackSrc) img.src = fallbackSrc;
          }, { once: true });
        }
        btn.appendChild(img);
        return btn;
      };
      const noneWrap = document.createElement('div');
      noneWrap.className = 'poi-icon-group';
      const noneTitle = document.createElement('div');
      noneTitle.className = 'poi-icon-group-title';
      noneTitle.textContent = POI_ICON_NONE_LABEL;
      const noneGrid = document.createElement('div');
      noneGrid.className = 'poi-icon-group-grid';
      noneGrid.appendChild(makeBtn({ id: '', label: POI_ICON_NONE_LABEL, isNone: true }));
      noneWrap.appendChild(noneTitle);
      noneWrap.appendChild(noneGrid);
      poiIconGrid.appendChild(noneWrap);

      symbolCatalogState.groups.forEach((group) => {
        if (!group || !Array.isArray(group.entries) || group.entries.length === 0) return;
        const groupWrap = document.createElement('div');
        groupWrap.className = 'poi-icon-group';
        const title = document.createElement('div');
        title.className = 'poi-icon-group-title';
        title.textContent = String(group.label || '').trim() || 'Symbols';
        const grid = document.createElement('div');
        grid.className = 'poi-icon-group-grid';
        group.entries.forEach((entry) => {
          grid.appendChild(makeBtn(entry));
        });
        groupWrap.appendChild(title);
        groupWrap.appendChild(grid);
        poiIconGrid.appendChild(groupWrap);
      });
    }
    function applyPoiIconSelection(nextId){
      if (poiIconPickerState.mode === 'tracker') {
        const trackerId = poiIconPickerState.trackerId;
        if (!trackerId) return;
        if (nextId) {
          const mapInst = getMap();
          if (mapInst) {
            const entry = symbolCatalogState.byId.get(nextId);
            if (entry) ensurePoiIconImageOnMap(mapInst, entry);
          }
        }
        updateTrackerEntry(trackerId, { poiIcon: nextId || null });
        return;
      }
      const targetId = poiIconPickerState.targetId;
      if (!targetId) return;
      const ds = (window)._drawStore;
      const feature = ds?.features?.find((item) => item?.properties?.id === targetId) || null;
      if (!feature) return;
      feature.properties = feature.properties || {};
      if (nextId) feature.properties.poiIcon = nextId;
      else delete feature.properties.poiIcon;
      if (nextId) {
        const mapInst = getMap();
        if (mapInst) {
          const entry = symbolCatalogState.byId.get(nextId);
          if (entry) ensurePoiIconImageOnMap(mapInst, entry);
        }
      }
      setDirty(true);
      refreshDrawMapOnly();
      notifyFeatureModified('POI icon updated');
      try { updateDrawingsPanel(); } catch {}
    }
    function openPoiIconModal(feature){
      if (!poiIconModal || !feature) return;
      const currentId = typeof feature.properties?.poiIcon === 'string' ? feature.properties.poiIcon.trim() : '';
      poiIconPickerState.mode = 'draw';
      poiIconPickerState.targetId = feature.properties?.id || null;
      poiIconPickerState.currentId = currentId;
      poiIconPickerState.trackerId = null;
      poiIconModal.hidden = false;
      if (!symbolCatalogState.list.length) {
        const loading = ensureSymbolsLoaded();
        buildPoiIconGrid(currentId);
        loading.then(() => buildPoiIconGrid(poiIconPickerState.currentId)).catch(() => {});
      } else {
        buildPoiIconGrid(currentId);
      }
    }
    function openTrackerPoiIconModal(tracker){
      if (!poiIconModal || !tracker) return;
      const currentId = typeof tracker.poiIcon === 'string' ? tracker.poiIcon.trim() : '';
      poiIconPickerState.mode = 'tracker';
      poiIconPickerState.trackerId = tracker.id || null;
      poiIconPickerState.targetId = null;
      poiIconPickerState.currentId = currentId;
      poiIconModal.hidden = false;
      if (!symbolCatalogState.list.length) {
        const loading = ensureSymbolsLoaded();
        buildPoiIconGrid(currentId);
        loading.then(() => buildPoiIconGrid(poiIconPickerState.currentId)).catch(() => {});
      } else {
        buildPoiIconGrid(currentId);
      }
    }
    (window).openTrackerPoiIconModal = openTrackerPoiIconModal;
    function closePoiIconModal(){
      if (poiIconModal) poiIconModal.hidden = true;
      poiIconPickerState.targetId = null;
      poiIconPickerState.currentId = null;
      poiIconPickerState.mode = null;
      poiIconPickerState.trackerId = null;
    }
    if (poiIconGrid && poiIconGrid.dataset.bound !== '1') {
      poiIconGrid.dataset.bound = '1';
      poiIconGrid.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const btn = t.closest('button[data-icon-id]');
        if (!btn) return;
        const nextId = btn.getAttribute('data-icon-id') || '';
        applyPoiIconSelection(nextId);
        closePoiIconModal();
      });
    }
    poiIconClose?.addEventListener('click', () => closePoiIconModal());
    poiIconModal?.addEventListener('click', (e) => {
      const t = e.target; if (t && t instanceof HTMLElement && t.classList.contains('modal-backdrop')) closePoiIconModal();
    });

    const renderRow = (f) => {
      if (f?.properties?.isLineEndpoint) return null;
      f.properties = f.properties || {};
      const row = document.createElement('div');
      row.className = 'drawing-row';
      row.dataset.id = f.properties.id;
      const header = document.createElement('div');
      header.className = 'drawing-header';
      const nameWrap = document.createElement('div');
      nameWrap.className = 'drawing-name';
      const nameEl = document.createElement('div');
      nameEl.className = 'drawing-title';
      const isReadOnlyFeature = !!f.properties?.isReadOnly;
      const canEditName = !isReadOnlyFeature || !!f.properties?.allowNameEdit;
      nameEl.contentEditable = 'false';
      nameEl.setAttribute('role', 'textbox');
      nameEl.setAttribute('aria-multiline', 'true');
      nameEl.setAttribute('aria-readonly', 'true');
      nameEl.setAttribute('data-placeholder', 'Untitled');
      const initialName = sanitizeFeatureNameDraft(f.properties?.name || '');
      if (initialName !== (f.properties?.name || '')) f.properties.name = initialName;
      nameEl.textContent = initialName;
      nameWrap.appendChild(nameEl);
      const importBadgeText = (f.properties?.importBadge || (f.properties?.importSource === 'gpx' ? 'GPX' : '') || '').toString().trim();
      if (importBadgeText) {
        const badge = document.createElement('span');
        badge.className = 'drawing-badge';
        if (f.properties?.importSource === 'gpx') badge.classList.add('drawing-badge--gpx');
        badge.textContent = importBadgeText;
        badge.title = importBadgeText;
        nameWrap.appendChild(badge);
      }
      header.appendChild(nameWrap);
      const meta = document.createElement('div');
      meta.className = 'drawing-meta';
      const size = document.createElement('div');
      size.className = 'drawing-size';
      const actionsRow = document.createElement('div');
      actionsRow.className = 'drawing-actions-row';
      const actions = document.createElement('div');
      actions.className = 'drawing-actions';
      const colorWrap = document.createElement('button');
      colorWrap.type = 'button';
      colorWrap.className = 'drawing-color';
      const getColor = () => (f.properties && f.properties.color) ? String(f.properties.color) : '#1565C0';
      const applyColorToWrap = () => { try { colorWrap.style.backgroundColor = getColor(); } catch {} };
      applyColorToWrap();
      const changeColorLabel = t('messages.changeColor', 'Change color');
      colorWrap.title = changeColorLabel;
      colorWrap.setAttribute('aria-label', changeColorLabel);
      colorWrap.addEventListener('click', () => {
        openColorModal(getColor(), (hex) => {
          f.properties = f.properties || {};
          f.properties.color = hex;
          applyColorToWrap();
          setDirty(true);
          refreshDraw();
          notifyFeatureModified('Feature color updated');
        });
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'drawing-del';
      del.title = 'Delete';
      const delIcon = makeButtonIcon(DRAWING_ICON_PATHS.delete);
      del.appendChild(delIcon);
      const g = f.geometry || {};
      const isPoiFeature = g.type === 'Point';
      row.classList.toggle('drawing-row--poi', isPoiFeature);
      const poiHasSymbol = isPoiFeature && typeof f.properties?.poiIcon === 'string' && f.properties.poiIcon.trim();
      const isGpxFeature = f.properties?.importSource === 'gpx';
      const canTrimLine = g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length > 1;
      const isArrowFeature = (f.properties?.kind || '').toLowerCase() === 'arrow';
      const disableEditAi = isArrowFeature;
      let editBtn = null;
      let updateEditBtnState = () => {};
      let startEdit = () => {};
      let stopEdit = () => {};
      if (!disableEditAi && !isReadOnlyFeature) {
        editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'drawing-edit';
        const editIdleLabel = g.type === 'LineString' ? 'Edit line' : 'Edit polygon';
        const editActiveLabel = 'Save edits';
        editBtn.title = editIdleLabel;
        editBtn.setAttribute('aria-label', editIdleLabel);
        const editIcon = makeButtonIcon(DRAWING_ICON_PATHS.edit);
        editBtn.appendChild(editIcon);
        updateEditBtnState = () => {
          const active = (window)._editTarget && f.properties?.id === (window)._editTarget;
          editBtn.classList.toggle('active', !!active);
          const label = active ? editActiveLabel : editIdleLabel;
          editBtn.title = label;
          editBtn.setAttribute('aria-label', label);
        };
        updateEditBtnState();
        startEdit = () => {
          try { (window).abortActiveTool && (window).abortActiveTool(); } catch {}
          try { (window).setActiveTool && (window).setActiveTool(null); } catch {}
          (window)._editTarget = f.properties?.id || null;
          updateEditBtnState();
          try{ const m=(window)._map; if (m){ m.setLayoutProperty('edit-verts','visibility','visible'); m.setLayoutProperty('edit-mid','visibility','visible'); refreshEditVerts(); try{ m.moveLayer('edit-mid'); m.moveLayer('edit-verts'); }catch{} } }catch{}
          if (g.type==='Polygon') flyToFeaturePolygon(f);
        };
        stopEdit = () => {
          (window)._editTarget = null;
          updateEditBtnState();
          try{ const m=(window)._map; if (m){ m.setLayoutProperty('edit-verts','visibility','none'); m.setLayoutProperty('edit-mid','visibility','none'); refreshEditVerts(); } }catch{}
          setDirty(true); refreshDraw();
          notifyFeatureModified();
        };
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); const active = (window)._editTarget && f.properties?.id === (window)._editTarget; if (active) stopEdit(); else startEdit(); });
      }
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'drawing-toggle';
      const toggleIcon = makeButtonIcon(DRAWING_ICON_PATHS.show);
      toggleBtn.appendChild(toggleIcon);
      const labelToggleBtn = document.createElement('button');
      labelToggleBtn.type = 'button';
      labelToggleBtn.className = 'drawing-toggle drawing-label-toggle';
      const labelToggleIcon = makeButtonIcon(DRAWING_ICON_PATHS.labelShow);
      labelToggleBtn.appendChild(labelToggleIcon);
      const sizeToggleBtn = document.createElement('button');
      sizeToggleBtn.type = 'button';
      sizeToggleBtn.className = 'drawing-toggle drawing-size-toggle';
      const sizeToggleIcon = makeButtonIcon(DRAWING_ICON_PATHS.size);
      sizeToggleBtn.appendChild(sizeToggleIcon);
      const focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.className = 'drawing-toggle drawing-focus';
      const focusIcon = makeButtonIcon(DRAWING_ICON_PATHS.focus);
      focusBtn.appendChild(focusIcon);
      let aiBtn = null;
      if (!disableEditAi && !isReadOnlyFeature) {
        aiBtn = document.createElement('button');
        aiBtn.type = 'button';
        aiBtn.className = 'drawing-ai'; aiBtn.title = 'AI…'; aiBtn.setAttribute('aria-label','AI suggestions');
        const aiIcon = makeButtonIcon(DRAWING_ICON_PATHS.ai);
        aiBtn.appendChild(aiIcon);
        if (!aiEnabled) {
          aiBtn.disabled = true;
          aiBtn.hidden = true;
          aiBtn.style.display = 'none';
        }
      }
      let poiIconBtn = null;
      if (isPoiFeature) {
        poiIconBtn = document.createElement('button');
        poiIconBtn.type = 'button';
        poiIconBtn.className = 'drawing-poi-icon-btn';
        const poiIconLabel = t('messages.poiIconButton', 'POI symbol');
        poiIconBtn.title = poiIconLabel;
        poiIconBtn.setAttribute('aria-label', poiIconLabel);
        const icon = makeButtonIcon(DRAWING_ICON_PATHS.poiIcon);
        poiIconBtn.appendChild(icon);
        if (isReadOnlyFeature) {
          poiIconBtn.disabled = true;
        } else {
          poiIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPoiIconModal(f);
          });
        }
      }
      let sizeText = '';
      let sizeLabel = '';
      const suppressSizeMeta = isPoiFeature;
      if (g.type === 'LineString') {
        sizeText = fmtLen(lengthMeters(g.coordinates));
        sizeLabel = 'Length';
      } else if (g.type === 'Polygon') {
        const ring = g.coordinates[0];
        sizeText = fmtArea(areaSqm(ring));
        sizeLabel = 'Area';
      } else if (g.type === 'Point') {
        // Intentionally blank; POIs shouldn't show a type line in the sidebar.
      }
      if (!sizeLabel && !sizeText && !suppressSizeMeta) {
        sizeLabel = String(f.properties.kind || g.type || 'Feature');
      }
      size.textContent = sizeText ? `${sizeLabel}: ${sizeText}` : sizeLabel;
      if (!sizeLabel && !sizeText) {
        meta.hidden = true;
      }
      const isArrow = f.properties?.kind === 'arrow';
      if (isArrow && editBtn) {
        editBtn.hidden = true;
        editBtn.disabled = true;
        const lenMeters = Number(f.properties?.lengthMeters);
        if (Number.isFinite(lenMeters)) size.textContent = `Length: ${fmtLen(lenMeters)}`;
      }
      meta.appendChild(size);
      row.appendChild(header);
      if (editBtn) actions.appendChild(editBtn);
      if (poiIconBtn) actions.appendChild(poiIconBtn);
      if (canTrimLine) {
        const trimBtn = document.createElement('button');
        trimBtn.type = 'button';
        trimBtn.className = 'drawing-trim';
        const trimLabel = isGpxFeature ? 'Trim GPX feature' : 'Trim line feature';
        trimBtn.title = trimLabel;
        trimBtn.setAttribute('aria-label', trimLabel);
        const trimIcon = makeButtonIcon(DRAWING_ICON_PATHS.trim);
        trimBtn.appendChild(trimIcon);
        trimBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openTrimMemberModalForFeature(f);
        });
        actions.appendChild(trimBtn);
      }
      actions.appendChild(toggleBtn);
      actions.appendChild(labelToggleBtn);
      actions.appendChild(sizeToggleBtn);
      actions.appendChild(focusBtn);
      if (aiBtn) actions.appendChild(aiBtn);
      actions.appendChild(del);
      if (poiHasSymbol) {
        colorWrap.hidden = true;
        colorWrap.setAttribute('aria-hidden', 'true');
      }
      actionsRow.appendChild(colorWrap);
      actionsRow.appendChild(actions);
      if (!isPoiFeature) {
        row.appendChild(meta);
      }
      row.appendChild(actionsRow);
      row.addEventListener('mouseenter', () => setHighlight(f.properties.id));
      row.addEventListener('mouseleave', () => setHighlight(null));
      const focusNameEditor = () => {
        try { nameEl.focus(); } catch {}
        try {
          const selection = window.getSelection?.();
          const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
          if (!range || !nameEl.contains(range.startContainer)) {
            placeCaretAtEnd(nameEl);
          }
        } catch {
          try { placeCaretAtEnd(nameEl); } catch {}
        }
      };
      const setNameEditing = (editing) => {
        if (!canEditName) return;
        const next = !!editing;
        if (nameEl.isContentEditable === next) return;
        nameEl.contentEditable = next ? 'true' : 'false';
        nameEl.setAttribute('aria-readonly', String(!next));
        if (next) focusNameEditor();
      };
      const clampNameInNode = ({ draft = false } = {}) => {
        const current = normalizeLineBreaks(nameEl.textContent || '');
        const sanitized = draft
          ? sanitizeFeatureNameDraft(current)
          : sanitizeFeatureName(current, { allowImportEllipsis: true });
        if (sanitized !== current) {
          nameEl.textContent = sanitized;
          placeCaretAtEnd(nameEl);
        }
        return sanitized;
      };
      const commitName = ({ draft = false } = {}) => {
        const value = clampNameInNode({ draft });
        f.properties = f.properties || {};
        f.properties.name = value;
        return value;
      };
      nameEl.addEventListener('click', (e) => {
        if (!canEditName) return;
        e.stopPropagation();
        setNameEditing(true);
      });
      nameEl.addEventListener('blur', () => {
        if (!nameEl.isContentEditable) return;
        commitName();
        setNameEditing(false);
        setDirty(true);
        refreshDraw();
        notifyFeatureModified('Feature renamed');
      });
      nameEl.addEventListener('input', () => {
        if (!nameEl.isContentEditable) return;
        commitName({ draft: true });
        setDirty(true);
        refreshDrawMapOnly();
      });
      nameEl.addEventListener('keydown', (e) => {
        if (!nameEl.isContentEditable) return;
        if (e.key !== 'Enter') return;
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          nameEl.blur();
          return;
        }
        e.preventDefault();
        insertEditableText(nameEl, '\n');
        nameEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
      nameEl.addEventListener('paste', (e) => {
        if (!nameEl.isContentEditable) return;
        const text = e.clipboardData?.getData('text/plain');
        if (text == null) return;
        e.preventDefault();
        insertEditableText(nameEl, normalizeLineBreaks(text));
        nameEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = confirm('Delete this drawing?');
        if (!ok) return;
        const idx = drawStore.features.findIndex(x => x.properties?.id === f.properties.id);
        if (idx >= 0) {
          const [removed] = drawStore.features.splice(idx, 1);
          if (removed?.geometry?.type === 'LineString' && removed?.properties?.id) {
            const relatedId = removed.properties.id;
            drawStore.features = drawStore.features.filter((feat) => feat?.properties?.relatedLineId !== relatedId);
          }
          setDirty(true);
          refreshDraw();
          setHighlight(null);
          updateDrawingsPanel();
          notifyFeatureModified('Feature deleted');
        }
      });
      // Toggle per-feature edit
      const flyToFeaturePolygon = (feat) => {
        try{
          const ring = feat?.geometry?.coordinates?.[0] || [];
          if (!ring.length) return;
          let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;
          ring.forEach(p=>{ const [lng,lat]=p; if(lng<minLng)minLng=lng; if(lng>maxLng)maxLng=lng; if(lat<minLat)minLat=lat; if(lat>maxLat)maxLat=lat; });
          if (Number.isFinite(minLng)&&Number.isFinite(minLat)&&Number.isFinite(maxLng)&&Number.isFinite(maxLat)){
            const m = (window)._map; if (!m) return;
            try {
              if (typeof m.cameraForBounds === 'function') {
                const cam = m.cameraForBounds([[minLng,minLat],[maxLng,maxLat]], { padding: 80, maxZoom: 17 });
                const baseZoom = (cam && Number.isFinite(cam.zoom)) ? cam.zoom : (m.getZoom() || 12);
                const reducedZoom = Math.max(0, baseZoom * 0.90); // reduce by ~10%
                const center = cam && cam.center ? cam.center : { lng:(minLng+maxLng)/2, lat:(minLat+maxLat)/2 };
                m.easeTo({ center, zoom: reducedZoom, duration: 500 });
              } else {
                // Fallback: fit then zoom out by 25%
                m.fitBounds([[minLng,minLat],[maxLng,maxLat]], { padding: 80, duration: 400, maxZoom: 17 });
                m.once('moveend', () => {
                  try { m.easeTo({ zoom: Math.max(0, (m.getZoom() || 12) * 0.90), duration: 150 }); } catch {}
                });
              }
            } catch {}
          }
        }catch{}
      };
      const applyToggleState = () => {
        const hidden = !!(f.properties && f.properties._featureHidden);
        const key = hidden ? 'features.showFeature' : 'features.hideFeature';
        const labelText = t(key, hidden ? 'Show feature' : 'Hide feature');
        toggleIcon.src = hidden ? DRAWING_ICON_PATHS.hide : DRAWING_ICON_PATHS.show;
        toggleBtn.dataset.i18nTitle = key;
        toggleBtn.dataset.i18nAriaLabel = key;
        toggleBtn.title = labelText;
        toggleBtn.setAttribute('aria-label', labelText);
        toggleBtn.setAttribute('aria-pressed', String(hidden));
        toggleBtn.classList.toggle('is-hidden', hidden);
        row.classList.toggle('drawing-row--hidden', hidden);
        if (hidden && hoveredId === f.properties?.id) setHighlight(null);
      };
      const applyLabelToggleState = () => {
        const labelHidden = !!(f.properties && f.properties._featureLabelHidden);
        const key = labelHidden ? 'features.showLabels' : 'features.hideLabels';
        const labelText = t(key, labelHidden ? 'Show labels' : 'Hide labels');
        labelToggleIcon.src = labelHidden ? DRAWING_ICON_PATHS.labelHide : DRAWING_ICON_PATHS.labelShow;
        labelToggleBtn.dataset.i18nTitle = key;
        labelToggleBtn.dataset.i18nAriaLabel = key;
        labelToggleBtn.title = labelText;
        labelToggleBtn.setAttribute('aria-label', labelText);
        labelToggleBtn.setAttribute('aria-pressed', String(labelHidden));
        labelToggleBtn.classList.toggle('is-hidden', labelHidden);
      };
      const applySizeToggleState = () => {
        const sizeHidden = !!(f.properties && f.properties._featureSizeHidden);
        const key = sizeHidden ? 'features.showSize' : 'features.hideSize';
        const labelText = t(key, sizeHidden ? 'Show size' : 'Hide size');
        sizeToggleBtn.dataset.i18nTitle = key;
        sizeToggleBtn.dataset.i18nAriaLabel = key;
        sizeToggleBtn.title = labelText;
        sizeToggleBtn.setAttribute('aria-label', labelText);
        sizeToggleBtn.setAttribute('aria-pressed', String(sizeHidden));
        sizeToggleBtn.classList.toggle('is-hidden', sizeHidden);
      };
      applyToggleState();
      applyLabelToggleState();
      applySizeToggleState();
      if (g.type === 'LineString') syncLineEndpointVisibility(f);
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        f.properties = f.properties || {};
        const currentlyHidden = !!f.properties._featureHidden;
        const nextHidden = !currentlyHidden;
        f.properties._featureHidden = nextHidden;
        let stoppedEditing = false;
        if (nextHidden && (window)._editTarget && f.properties?.id === (window)._editTarget) {
          const prevSuppress = suppressFeatureToasts;
          suppressFeatureToasts = true;
          try { stopEdit(); stoppedEditing = true; }
          finally { suppressFeatureToasts = prevSuppress; }
        }
        applyToggleState();
        const endpointsChanged = g.type === 'LineString' ? syncLineEndpointVisibility(f) : false;
        if (!stoppedEditing || endpointsChanged) {
          setDirty(true);
          refreshDraw();
        }
        notifyFeatureModified(nextHidden ? 'messages.featureHidden' : 'messages.featureShown', nextHidden ? 'Feature hidden' : 'Feature shown');
      });
      labelToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        f.properties = f.properties || {};
        const currentlyHidden = !!f.properties._featureLabelHidden;
        const nextHidden = !currentlyHidden;
        f.properties._featureLabelHidden = nextHidden;
        applyLabelToggleState();
        setDirty(true);
        refreshDrawMapOnly();
        notifyFeatureModified(t(nextHidden ? 'messages.featureLabelsHidden' : 'messages.featureLabelsShown', nextHidden ? 'Feature labels hidden' : 'Feature labels shown'));
      });
      sizeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        f.properties = f.properties || {};
        const currentlyHidden = !!f.properties._featureSizeHidden;
        const nextHidden = !currentlyHidden;
        f.properties._featureSizeHidden = nextHidden;
        applySizeToggleState();
        setDirty(true);
        refreshDrawMapOnly();
        notifyFeatureModified(t(nextHidden ? 'messages.featureSizeHidden' : 'messages.featureSizeShown', nextHidden ? 'Feature size hidden' : 'Feature size shown'));
      });
      const getFeatureCenter = () => {
        try {
          const geom = f?.geometry;
          if (!geom) return null;
          if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
            const [lng, lat] = geom.coordinates;
            if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
          }
          const centroid = centroidOfGeom(geom);
          if (centroid && Number.isFinite(centroid.lng) && Number.isFinite(centroid.lat)) return centroid;
          const bounds = computeFeatureBounds([f]);
          if (!bounds) return null;
          const lng = (bounds.minLng + bounds.maxLng) / 2;
          const lat = (bounds.minLat + bounds.maxLat) / 2;
          if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
        } catch {}
        return null;
      };
      const applyFocusState = () => {
        const labelText = 'Center map on feature';
        focusBtn.title = labelText;
        focusBtn.setAttribute('aria-label', labelText);
        const center = getFeatureCenter();
        const ok = !!center;
        focusBtn.disabled = !ok;
        focusBtn.classList.toggle('is-disabled', !ok);
        if (!ok) focusBtn.setAttribute('aria-disabled', 'true');
        else focusBtn.removeAttribute('aria-disabled');
      };
      applyFocusState();
      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const center = getFeatureCenter();
        if (!center) return;
        const map = getMap();
        if (!map) return;
        const currentZoom = map.getZoom();
        map.flyTo({
          center: [center.lng, center.lat],
          zoom: Number.isFinite(currentZoom) ? Math.max(12, currentZoom) : 12,
          duration: 600
        });
      });
      aiBtn?.addEventListener('click', (e) => {
        if (!aiEnabled) return;
        e.stopPropagation();
        openAiModal(f);
      });
      return row;
    };
    const updateFeaturesActionsState = (hasFeaturesParam) => {
      const visibleFeatures = Array.isArray(drawStore.features) ? drawStore.features.filter(f => !f?.properties?.isLineEndpoint) : [];
      const hasFeatures = (typeof hasFeaturesParam === 'boolean') ? hasFeaturesParam : visibleFeatures.length > 0;
      if (featuresSaveBtn) {
        const disabled = !hasFeatures;
        featuresSaveBtn.disabled = disabled;
        featuresSaveBtn.classList.toggle('is-disabled', disabled);
        if (disabled) featuresSaveBtn.setAttribute('aria-disabled', 'true');
        else featuresSaveBtn.removeAttribute('aria-disabled');
      }
      if (featuresClearBtn) {
        const disabled = !hasFeatures;
        featuresClearBtn.disabled = disabled;
        featuresClearBtn.classList.toggle('is-disabled', disabled);
        if (disabled) featuresClearBtn.setAttribute('aria-disabled', 'true');
        else featuresClearBtn.removeAttribute('aria-disabled');
      }
      if (featuresActions) {
        featuresActions.classList.toggle('features-actions--empty', !hasFeatures);
      }
    };
    const computeFeatureBounds = (input) => {
      const list = Array.isArray(input) ? input : (input && Array.isArray(input.features) ? input.features : []);
      if (!list.length) return null;
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      const extend = (lng, lat) => {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      };
      const walk = (geom) => {
        if (!geom) return;
        const type = geom.type;
        const coords = geom.coordinates;
        if (type === 'Point') {
          extend(coords[0], coords[1]);
        } else if (type === 'MultiPoint' || type === 'LineString') {
          coords.forEach((pt) => extend(pt[0], pt[1]));
        } else if (type === 'Polygon' || type === 'MultiLineString') {
          coords.forEach((ring) => ring.forEach((pt) => extend(pt[0], pt[1])));
        } else if (type === 'MultiPolygon') {
          coords.forEach((poly) => poly.forEach((ring) => ring.forEach((pt) => extend(pt[0], pt[1]))));
        } else if (type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
          geom.geometries.forEach(walk);
        }
      };
      list.forEach((feature) => {
        try { walk(feature?.geometry); } catch {}
      });
      if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null;
      return { minLng, minLat, maxLng, maxLat };
    };

    const focusMapOnBounds = (bounds) => {
      try {
        if (!bounds) return;
        const map = getMap();
        if (!map) return;
        const { minLng, minLat, maxLng, maxLat } = bounds;
        if (![minLng, minLat, maxLng, maxLat].every((v) => Number.isFinite(v))) return;
        const sw = [minLng, minLat];
        const ne = [maxLng, maxLat];
        const spanLng = maxLng - minLng;
        const spanLat = maxLat - minLat;
        if (Math.abs(spanLng) < 0.0005 && Math.abs(spanLat) < 0.0005) {
          const centerLng = (minLng + maxLng) / 2;
          const centerLat = (minLat + maxLat) / 2;
          const currentZoom = map.getZoom();
          map.flyTo({
            center: [centerLng, centerLat],
            zoom: Number.isFinite(currentZoom) ? Math.max(12, currentZoom) : 12,
            duration: 600
          });
        } else {
          map.fitBounds([sw, ne], { padding: 60, duration: 800, maxZoom: 16 });
        }
      } catch (err) {
        console.error('focusMapOnBounds failed', err);
      }
    };

    const handleFeaturesSave = async () => {
      closeFeaturesActionsMenu();
      if (!featuresSaveBtn || featuresSaveBtn.disabled) return;
      if (!window.file || typeof window.file.saveAs !== 'function') {
        console.warn('File save bridge is not available.');
        return;
      }
      if (!Array.isArray(drawStore.features) || drawStore.features.length === 0) return;
      try {
        const data = (window).draw?.toJSON?.() || { type: 'FeatureCollection', features: [] };
        const defaultPath = currentFilePath || getSuggestedFilename();
        const result = await window.file.saveAs(data, defaultPath);
        if (result && result.ok) {
          setDirty(false);
          showToast(t('messages.featuresSaved', 'Features saved'));
        }
      } catch (err) {
        console.error('Saving features failed', err);
        showToast(t('messages.saveFailed', 'Save failed'), 'error');
      }
    };

    const normalizeImportedFeature = (feature, existingIds, options = {}) => {
      if (!feature || feature.type !== 'Feature' || !feature.geometry) return null;
      let clone;
      try {
        clone = JSON.parse(JSON.stringify(feature));
      } catch (err) {
        console.error('Failed cloning feature', err);
        return null;
      }
      clone.properties = { ...(clone.properties || {}) };
      const opts = options && typeof options === 'object' ? options : {};
      const idRegistry = existingIds instanceof Set ? existingIds : new Set();
      const geomType = clone.geometry?.type;
      if (!clone.properties.kind) {
        if (geomType === 'Polygon') clone.properties.kind = 'polygon';
        else if (geomType === 'LineString') clone.properties.kind = 'line';
        else if (geomType === 'Point') clone.properties.kind = 'poi';
      }
      if (!clone.properties.color) clone.properties.color = nextColor();
      if (typeof opts.setName === 'string') {
        clone.properties.name = formatImportedFeatureName(opts.setName);
      } else if (typeof clone.properties.name === 'string' && clone.properties.name.trim()) {
        clone.properties.name = formatImportedFeatureName(clone.properties.name);
      } else if (typeof opts.forceName === 'string') {
        clone.properties.name = formatImportedFeatureName(opts.forceName);
      } else {
        clone.properties.name = '';
      }
      if (opts.readOnly) clone.properties.isReadOnly = true;
      if (opts.allowNameEdit) clone.properties.allowNameEdit = true;
      if (opts.importSource) clone.properties.importSource = opts.importSource;
      if (opts.badgeLabel) clone.properties.importBadge = opts.badgeLabel;
      if (opts.extraProps && typeof opts.extraProps === 'object') {
        clone.properties = { ...clone.properties, ...opts.extraProps };
      }
      if (!clone.properties.id || idRegistry.has(clone.properties.id)) {
        let candidate;
        do {
          candidate = newId();
        } while (idRegistry.has(candidate));
        clone.properties.id = candidate;
      }
      idRegistry.add(clone.properties.id);
      return clone;
    };

    const deriveNameFromFilePath = (pathString) => {
      if (typeof pathString !== 'string' || !pathString.trim()) return 'Untitled';
      const parts = pathString.split(/[\\/]+/).filter(Boolean);
      if (!parts.length) return 'Untitled';
      const base = parts[parts.length - 1];
      const dot = base.lastIndexOf('.');
      const trimmed = (dot > 0 ? base.slice(0, dot) : base).trim();
      return trimmed || 'Untitled';
    };

    const elementsByTag = (root, tagName) => {
      if (!root || typeof tagName !== 'string' || !tagName) return [];
      const results = [];
      const pushList = (list) => {
        if (!list || typeof list.length !== 'number') return;
        for (let i = 0; i < list.length; i += 1) {
          const node = list[i];
          if (node && !results.includes(node)) results.push(node);
        }
      };
      try { pushList(root.getElementsByTagName(tagName)); } catch {}
      if (typeof root.getElementsByTagNameNS === 'function') {
        try { pushList(root.getElementsByTagNameNS('*', tagName)); } catch {}
      }
      return results;
    };

    const sanitizeSequentialCoords = (coords) => {
      const filtered = [];
      if (!Array.isArray(coords)) return filtered;
      coords.forEach((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return;
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        const clampedLat = Math.max(Math.min(lat, 90), -90);
        let normalizedLng = lng;
        while (normalizedLng < -180) normalizedLng += 360;
        while (normalizedLng > 180) normalizedLng -= 360;
        const next = [normalizedLng, clampedLat];
        if (!filtered.length) {
          filtered.push(next);
          return;
        }
        const prev = filtered[filtered.length - 1];
        if (Math.abs(prev[0] - next[0]) < 1e-9 && Math.abs(prev[1] - next[1]) < 1e-9) return;
        filtered.push(next);
      });
      return filtered;
    };

    const coordsFromElements = (elements, attrLat = 'lat', attrLon = 'lon') => {
      const coords = [];
      if (!Array.isArray(elements)) return coords;
      elements.forEach((el) => {
        if (!el || typeof el.getAttribute !== 'function') return;
        const latRaw = el.getAttribute(attrLat) ?? el.getAttribute(attrLat.toUpperCase());
        const lonRaw = el.getAttribute(attrLon) ?? el.getAttribute(attrLon.toUpperCase());
        const lat = parseFloat(latRaw);
        const lon = parseFloat(lonRaw);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        coords.push([lon, lat]);
      });
      return coords;
    };

    const coordsFromTrack = (doc) => {
      const tracks = elementsByTag(doc, 'trk');
      for (let i = 0; i < tracks.length; i += 1) {
        const track = tracks[i];
        const segments = elementsByTag(track, 'trkseg');
        let coords = [];
        if (segments.length) {
          segments.forEach((seg) => {
            coords = coords.concat(coordsFromElements(elementsByTag(seg, 'trkpt')));
          });
        } else {
          coords = coordsFromElements(elementsByTag(track, 'trkpt'));
        }
        const sanitized = sanitizeSequentialCoords(coords);
        if (sanitized.length) return sanitized;
      }
      return [];
    };

    const coordsFromRoute = (doc) => {
      const routes = elementsByTag(doc, 'rte');
      for (let i = 0; i < routes.length; i += 1) {
        const route = routes[i];
        const coords = sanitizeSequentialCoords(coordsFromElements(elementsByTag(route, 'rtept')));
        if (coords.length) return coords;
      }
      return [];
    };

    const coordsFromWaypoints = (doc) => sanitizeSequentialCoords(coordsFromElements(elementsByTag(doc, 'wpt')));

    const coordsToGeometry = (coords) => {
      if (!Array.isArray(coords) || !coords.length) return null;
      if (coords.length >= 2) return { type: 'LineString', coordinates: coords };
      return { type: 'Point', coordinates: coords[0] };
    };

    const parseGpxToFeature = (gpxText) => {
      if (typeof gpxText !== 'string' || !gpxText.trim()) return null;
      if (typeof DOMParser !== 'function') {
        console.warn('DOMParser unavailable; cannot parse GPX.');
        return null;
      }
      let doc;
      try {
        const parser = new DOMParser();
        doc = parser.parseFromString(gpxText, 'application/xml');
      } catch (err) {
        console.error('parseGpxToFeature failed', err);
        return null;
      }
      if (!doc) return null;
      try {
        const parseErrors = doc.getElementsByTagName('parsererror');
        if (parseErrors && parseErrors.length) {
          console.error('GPX parse error', parseErrors[0]?.textContent || '');
          return null;
        }
      } catch {}
      let geometry = coordsToGeometry(coordsFromTrack(doc));
      if (!geometry) geometry = coordsToGeometry(coordsFromRoute(doc));
      if (!geometry) {
        const waypointGeom = coordsToGeometry(coordsFromWaypoints(doc));
        if (waypointGeom) geometry = waypointGeom;
      }
      if (!geometry) return null;
      const properties = {};
      if (geometry.type === 'LineString') properties.kind = 'line';
      else if (geometry.type === 'Point') properties.kind = 'poi';
      return { type: 'Feature', properties, geometry };
    };

    const handleFeaturesLoad = async () => {
      closeFeaturesActionsMenu();
      if (!window.file || typeof window.file.openFeatureCollection !== 'function') {
        console.warn('File open bridge is not available.');
        return;
      }
      try {
        const result = await window.file.openFeatureCollection(currentFilePath || undefined);
        if (!result || result.canceled) return;
        if (!result.ok) {
          if (result.error) alert(`Unable to open file: ${result.error}`);
          return;
        }
        const payload = result.data;
        if (!payload || payload.type !== 'FeatureCollection') {
          alert('The selected file does not contain a valid FeatureCollection.');
          return;
        }
        const incoming = Array.isArray(payload.features) ? payload.features.filter(f => f && f.type === 'Feature' && f.geometry) : [];
        if (incoming.length === 0) {
          alert('The selected file does not contain any features to load.');
          return;
        }
        const hasExisting = Array.isArray(drawStore.features) && drawStore.features.length > 0;
        let mode = 'replace';
        if (hasExisting) {
          let choice = null;
          if (window.file && typeof window.file.askMergeReplace === 'function') {
            choice = await window.file.askMergeReplace('Load features', 'MERGE keeps current features and adds items from the file. REPLACE ALL discards current features.');
          }
          if (!choice) {
            const merge = confirm('Features already exist. Click OK to MERGE, or Cancel to REPLACE ALL.');
            choice = { choice: merge ? 'merge' : 'replace' };
          }
          if (!choice || choice.choice === 'cancel') return;
          mode = choice.choice;
        }
        if (mode === 'replace') {
          drawStore.features = [];
        }
        const existingIds = new Set((drawStore.features || []).map(f => f?.properties?.id).filter(Boolean));
        const normalized = incoming.map((feature) => normalizeImportedFeature(feature, existingIds)).filter(Boolean);
        if (!normalized.length) {
          alert('No valid features could be imported from the selected file.');
          return;
        }
        suppressFeatureToasts = true;
        try {
          normalized.forEach((f) => drawStore.features.push(f));
        } finally {
          suppressFeatureToasts = false;
        }
        refreshDraw();
        setDirty(true);
        requestFirestoreFeaturesSync(0);
        if (result.filePath) currentFilePath = result.filePath;
        try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
        const bounds = computeFeatureBounds(normalized);
        focusMapOnBounds(bounds);
        showToast(mode === 'replace' ? 'Features replaced from file' : 'Features merged from file');
      } catch (err) {
        console.error('Loading features failed', err);
        alert('Could not load features. Check the console for details.');
        showToast('Load failed', 'error');
      }
    };

    const handleFeaturesLoadGpx = async () => {
      closeFeaturesActionsMenu();
      if (!window.file || typeof window.file.openGpx !== 'function') {
        console.warn('GPX open bridge is not available.');
        return;
      }
      try {
        const result = await window.file.openGpx(currentFilePath || undefined);
        if (!result || result.canceled) return;
        if (!result.ok) {
          if (result.error) alert(result.error);
          showToast(t('messages.loadFailed', 'Load failed'), 'error');
          return;
        }
        const feature = parseGpxToFeature(result.data);
        if (!feature) {
          alert(t('messages.invalidGpx', 'The GPX file did not contain a usable track or waypoint.'));
          showToast(t('messages.loadFailed', 'Load failed'), 'error');
          return;
        }
        const rawFriendlyName = deriveNameFromFilePath(result.filePath || '');
        const friendlyName = formatImportedFeatureName(rawFriendlyName) || 'Untitled';
        const existingIds = new Set((drawStore.features || []).map((f) => f?.properties?.id).filter(Boolean));
        const normalized = normalizeImportedFeature(feature, existingIds, {
          setName: friendlyName,
          readOnly: true,
          allowNameEdit: true,
          importSource: 'gpx',
          badgeLabel: 'GPX'
        });
        suppressFeatureToasts = true;
        try {
          drawStore.features.push(normalized);
          if (normalized?.geometry?.type === 'LineString' && Array.isArray(normalized.geometry.coordinates)) {
            addLineEndpoints(normalized, normalized.geometry.coordinates);
          }
        } finally {
          suppressFeatureToasts = false;
        }
        refreshDraw();
        setDirty(true);
        requestFirestoreFeaturesSync(0);
        try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
        focusMapOnBounds(computeFeatureBounds([normalized]));
        showToast(t('messages.gpxImported', 'GPX feature added'));
      } catch (err) {
        console.error('Loading GPX failed', err);
        alert(t('messages.gpxLoadError', 'Unable to load the GPX file.'));
        showToast(t('messages.loadFailed', 'Load failed'), 'error');
      }
    };

    const handleFeaturesClear = () => {
      closeFeaturesActionsMenu();
      if (!Array.isArray(drawStore.features) || drawStore.features.length === 0) return;
      const ok = confirm('Clear all features? This cannot be undone.');
      if (!ok) return;
      drawStore.features = [];
      refreshDraw();
      setDirty(true);
      showToast('Features cleared');
      requestFirestoreFeaturesSync(0);
    };

    const updateDrawingsPanel = () => {
      if (!drawingsList) return;
      drawingsList.innerHTML = '';
      const visibleFeatures = Array.isArray(drawStore.features) ? drawStore.features.filter(f => !f?.properties?.isLineEndpoint) : [];
      if (!visibleFeatures.length) {
        const empty = document.createElement('div');
        empty.className = 'features-empty';
        empty.textContent = t('messages.noFeaturesYet', 'No features yet. Start drawing on the map.');
        drawingsList.appendChild(empty);
        updateFeaturesActionsState(false);
        return;
      }
      visibleFeatures.forEach(f => {
        const row = renderRow(f);
        if (row) drawingsList.appendChild(row);
      });
      updateFeaturesActionsState(visibleFeatures.length > 0);
    };
    featuresSaveBtn?.addEventListener('click', handleFeaturesSave);
    featuresLoadBtn?.addEventListener('click', handleFeaturesLoad);
    featuresLoadGpxBtn?.addEventListener('click', handleFeaturesLoadGpx);
    featuresClearBtn?.addEventListener('click', handleFeaturesClear);
    updateFeaturesActionsState();
    updateDrawingsPanel();
    setDirty(false);

    // ---- AI modal helpers ----
    function centroidOf(f){
      try{
        const g = f?.geometry; if (!g) return null;
        if (g.type === 'Point') return { lng: g.coordinates[0], lat: g.coordinates[1] };
        const acc = { x:0, y:0, n:0 };
        const push = (lng,lat)=>{ if(Number.isFinite(lng)&&Number.isFinite(lat)){ acc.x+=lng; acc.y+=lat; acc.n++; } };
        if (g.type === 'LineString') g.coordinates.forEach(c=>push(c[0],c[1]));
        if (g.type === 'Polygon') g.coordinates[0].forEach(c=>push(c[0],c[1]));
        if (acc.n>0) return { lng: acc.x/acc.n, lat: acc.y/acc.n };
      }catch{}
      return null;
    }
    async function describeLocation(p){
      try{
        const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
        if (!key || !p) return '';
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(p.lat+','+p.lng)}&key=${encodeURIComponent(key)}`;
        const resp = await fetch(url); const data = await resp.json();
        if (data.status !== 'OK' || !data.results?.length) return '';
        const res = data.results[0];
        const comps = res.address_components || [];
        const country = comps.find(c => (c.types||[]).includes('country'))?.long_name || '';
        const city = comps.find(c => (c.types||[]).includes('locality'))?.long_name || '';
        return [city, country].filter(Boolean).join(', ');
      }catch{ return ''; }
    }
    function summarizeSize(f){
      const g = f?.geometry; if (!g) return '';
      if (g.type === 'Polygon') {
        const ring = g.coordinates?.[0]||[]; return `Area: ${fmtArea(areaSqm(ring))}`;
      }
      if (g.type === 'LineString') return `Length: ${fmtLen(lengthMeters(g.coordinates||[]))}`;
      return '';
    }
    // ---- Constraint helpers ----
    function bboxOfGeom(g){
      let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;
      const upd=(lng,lat)=>{ if(!Number.isFinite(lng)||!Number.isFinite(lat))return; if(lng<minLng)minLng=lng; if(lng>maxLng)maxLng=lng; if(lat<minLat)minLat=lat; if(lat>maxLat)maxLat=lat; };
      if(!g) return null;
      const t=g.type, c=g.coordinates;
      if(t==='Point'){ upd(c[0],c[1]); }
      else if(t==='LineString'||t==='MultiPoint'){ c.forEach(p=>upd(p[0],p[1])); }
      else if(t==='Polygon'||t==='MultiLineString'){ c.forEach(r=>r.forEach(p=>upd(p[0],p[1]))); }
      else if(t==='MultiPolygon'){ c.forEach(poly=>poly.forEach(r=>r.forEach(p=>upd(p[0],p[1])))); }
      if(!Number.isFinite(minLng)) return null;
      return {minLng,minLat,maxLng,maxLat};
    }
    function pointInPoly(pt, ring){
      // ray casting; ring is array of [lng,lat]
      let [x,y]=pt, inside=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const xi=ring[i][0], yi=ring[i][1], xj=ring[j][0], yj=ring[j][1];
        const intersect=((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-12)+xi);
        if(intersect) inside=!inside;
      }
      return inside;
    }
    function centroidOfGeom(g){
      try{
        if (!g) return null;
        if (g.type === 'Point') return { lng: g.coordinates[0], lat: g.coordinates[1] };
        const acc = { x:0, y:0, n:0 };
        const push = (lng,lat)=>{ if(Number.isFinite(lng)&&Number.isFinite(lat)){ acc.x+=lng; acc.y+=lat; acc.n++; } };
        if (g.type === 'LineString') g.coordinates.forEach(c=>push(c[0],c[1]));
        if (g.type === 'Polygon') (g.coordinates?.[0]||[]).forEach(c=>push(c[0],c[1]));
        if (acc.n>0) return { lng: acc.x/acc.n, lat: acc.y/acc.n };
      }catch{}
      return null;
    }
    function constrainToOriginal(orig, fc){
      const out = { type:'FeatureCollection', features: [] };
      const g0 = orig?.geometry; if(!g0) return fc || out;
      const type0 = g0.type;
      let polyRing = null; let bbox=null; let buf=0;
      if(type0==='Polygon'){
        polyRing = Array.isArray(g0.coordinates)&&g0.coordinates[0] ? g0.coordinates[0] : null;
      } else {
        // For lines/points, use bbox with relaxed buffer (~10% of span)
        bbox = bboxOfGeom(g0);
        if(bbox){ const spanLng=bbox.maxLng-bbox.minLng, spanLat=bbox.maxLat-bbox.minLat; buf = 0.10*Math.max(spanLng,spanLat); }
      }
      const withinBbox = (lng,lat)=> lng>= (bbox.minLng-buf) && lng<= (bbox.maxLng+buf) && lat>= (bbox.minLat-buf) && lat<= (bbox.maxLat+buf);
      const keepPoint = (lng,lat)=> polyRing ? pointInPoly([lng,lat], polyRing) : withinBbox(lng,lat);
      (fc?.features||[]).forEach(f=>{
        const g=f?.geometry; if(!g){ return; }
        const t=g.type, c=g.coordinates;
        let ok=false;
        if(t==='Point'){
          ok = keepPoint(c[0],c[1]);
        } else if(t==='LineString'){
          if (polyRing) {
            // Relaxed: centroid inside OR at least half the vertices inside
            const center = centroidOfGeom(g);
            const insideCount = Array.isArray(c)? c.filter(p=>keepPoint(p[0],p[1])).length : 0;
            ok = (center && keepPoint(center.lng, center.lat)) || (insideCount >= Math.ceil((c?.length||0)*0.5));
          } else {
            // bbox mode: centroid in expanded bbox OR any vertex inside
            const center = centroidOfGeom(g);
            const anyInside = Array.isArray(c) && c.some(p=>keepPoint(p[0],p[1]));
            ok = (center && keepPoint(center.lng, center.lat)) || anyInside;
          }
        } else if(t==='Polygon'){
          const ring = Array.isArray(c)&&c[0] ? c[0] : [];
          if (polyRing) {
            // Relaxed: centroid inside polygon
            const center = centroidOfGeom(g);
            ok = !!(center && keepPoint(center.lng, center.lat)) && ring.length>2;
          } else {
            // bbox mode: centroid inside bbox
            const center = centroidOfGeom(g);
            ok = !!(center && keepPoint(center.lng, center.lat)) && ring.length>2;
          }
        } else if (t === 'Point') {
          // Allow POIs to move freely; accept any point
          ok = Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
        } else {
          ok = false;
        }
        if(ok) out.features.push(f);
      });
      return out;
    }
    async function openAiModal(feature){
      if (!aiEnabled) return;
      aiTarget = feature;
      aiError.textContent = '';
      if (aiInput) aiInput.value = '';
      if (aiModifiersInput) aiModifiersInput.value = '';
      if (aiReplaceCheckbox) aiReplaceCheckbox.checked = false;
      const geomType = feature?.geometry?.type;
      populateAiPresetOptions(geomType);
      if (aiModal) aiModal.hidden = false;
      if (aiMeta) {
        aiMeta.innerHTML = `<div>${t('status.loading', 'Loading…')}</div>`;
        const center = centroidOf(feature);
        const loc = await describeLocation(center);
        const parts = [];
        const sizeText = summarizeSize(feature); if (sizeText) parts.push(`<div>${sizeText}</div>`);
        if (center) parts.push(`<div>Center: ${center.lng.toFixed(5)}, ${center.lat.toFixed(5)}</div>`);
        if (loc) parts.push(`<div>Location: ${loc}</div>`);
        aiMeta.innerHTML = parts.join('');
      }
    }
    function closeAiModal(){ if (aiModal) aiModal.hidden = true; }
    aiClose?.addEventListener('click', closeAiModal);
    aiModal?.addEventListener('click', (e) => { const t = e.target; if (t && t.dataset && t.dataset.action === 'close') closeAiModal(); });
    aiSubmit?.addEventListener('click', async () => {
      try{
        if (!aiEnabled) {
          aiError.textContent = t('messages.addOpenAIKey', 'Add an OpenAI API key in Settings to use AI features.');
          return;
        }
        if (!aiTarget) return;
        const manualInstruction = (aiInput?.value || '').trim();
        let presetInstruction = '';
        if (aiPresetSelect && !aiPresetSelect.disabled) {
          presetInstruction = (aiPresetSelect.value || '').trim();
          if (presetInstruction) {
            if (presetInstruction.includes('{VALUE}')) {
              const rawValue = aiValueInput?.value;
              if (!rawValue) {
                aiError.textContent = 'Enter a value for the selected preset.';
                return;
              }
              presetInstruction = presetInstruction.replace('{VALUE}', rawValue);
            }
            if (presetInstruction.includes('{DIRECTION}')) {
              const dir = aiDirectionSelect?.value || 'north';
              presetInstruction = presetInstruction.replace('{DIRECTION}', dir);
            }
          }
        }
        const modifierInstruction = (aiModifiersInput?.value || '').trim();
        const promptParts = [presetInstruction, manualInstruction, modifierInstruction].filter((part) => part && part.length > 0);
        if (!promptParts.length) {
          aiError.textContent = 'Please enter an instruction, choose a preset, or add modifiers for the AI request.';
          return;
        }
        const prompt = promptParts.join('\n');
        aiError.textContent = '';
        aiSubmit.disabled = true; aiSubmit.textContent = t('aiModal.submitting', 'Submitting…'); if (aiSpinner) aiSpinner.style.display='inline-block'; if (aiInput) aiInput.disabled = true;
        // API key from settings/localStorage
        const openaiKey = (localStorage.getItem('openai.key') || defaultOpenAIKey || '').trim();
        const result = await window.ai.transformDrawing({ type:'Feature', properties:{}, geometry: aiTarget.geometry }, prompt, openaiKey);
        if (!result || !result.ok) { aiError.textContent = translateString(result?.error || 'AI request failed', 'messages.aiRequestFailed'); return; }
        const candidates = (result.featureCollection && Array.isArray(result.featureCollection.features))
          ? result.featureCollection.features.filter((f) => f && f.type === 'Feature' && f.geometry && ['Polygon','LineString','Point'].includes(f.geometry.type))
          : [];
        if (!candidates.length) {
          aiError.textContent = t('messages.aiResponseInvalid', 'The AI response did not contain valid features within the original area. The drawing was not changed.');
          return;
        }
        // Replace the target with new features only after validating we have some
        const replaceOriginal = !aiReplaceCheckbox || aiReplaceCheckbox.checked;
        const idx = drawStore.features.findIndex(x => x.properties?.id === aiTarget.properties?.id);
        if (replaceOriginal && idx >= 0) drawStore.features.splice(idx, 1);
        suppressFeatureToasts = true;
        try {
          candidates.forEach(feat => {
            drawStore.features.push(annotateFeature(feat, (feat.geometry?.type === 'Polygon') ? 'polygon' : (feat.geometry?.type === 'LineString') ? 'line' : 'poi'));
          });
        } finally {
          suppressFeatureToasts = false;
        }
        setDirty(true);
        refreshDraw();
        closeAiModal();
        notifyFeatureModified('Feature updated by AI');
      } catch(e){
        aiError.textContent = String(e);
      } finally {
        aiSubmit.disabled = false; aiSubmit.textContent = t('aiModal.submit', 'SUBMIT'); if (aiSpinner) aiSpinner.style.display='none'; if (aiInput) aiInput.disabled = false;
      }
    });

    // Expose draw store for saving later
    (window).draw = {
      toJSON: () => ({ type: 'FeatureCollection', features: drawStore.features.slice() }),
      clear: () => { drawStore.features = []; refreshDraw(); }
    };

  }

  // Wire buttons
  featuresActionsToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFeaturesActionsMenu();
  });
  featuresActionsMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  trackersMenuToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTrackersMenu();
  });
  trackersMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (featuresActionsMenuOpen) {
      const inMenu = featuresActionsMenu && target instanceof Node && featuresActionsMenu.contains(target);
      const onToggle = featuresActionsToggleBtn && target instanceof Node && featuresActionsToggleBtn.contains(target);
      if (!inMenu && !onToggle) closeFeaturesActionsMenu();
    }
    if (trackersMenuOpen) {
      const inMenu = trackersMenu && target instanceof Node && trackersMenu.contains(target);
      const onToggle = trackersMenuToggle && target instanceof Node && trackersMenuToggle.contains(target);
      if (!inMenu && !onToggle) closeTrackersMenu();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFeaturesActionsMenu();
      closeTrackersMenu();
    }
  });
  trackersRecordBtn?.addEventListener('click', handleTrackersRecordClick);
  trackersSaveBtn?.addEventListener('click', handleTrackersSave);
  trackersOpenBtn?.addEventListener('click', handleTrackersOpen);
  teamsStartSessionBtn?.addEventListener('click', openTeamsStartSessionModal);
  teamsResumeSessionBtn?.addEventListener('click', openTeamsResumeSessionModal);
  mapSessionStartBtn?.addEventListener('click', openTeamsStartSessionModal);
  mapSessionResumeBtn?.addEventListener('click', openTeamsResumeSessionModal);
  mapSessionTitleEl?.addEventListener('click', openTeamsSessionActionsModal);
  teamsAddBtn?.addEventListener('click', openTeamMemberModal);
  teamsStartSessionClose?.addEventListener('click', closeTeamsStartSessionModal);
  teamsStartSessionCancel?.addEventListener('click', closeTeamsStartSessionModal);
  teamsStartSessionForm?.addEventListener('submit', handleTeamsStartSessionSubmit);
  teamsStartSessionModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeTeamsStartSessionModal();
  });
  teamsResumeSessionClose?.addEventListener('click', closeTeamsResumeSessionModal);
  teamsResumeSessionStart?.addEventListener('click', () => {
    closeTeamsResumeSessionModal();
    openTeamsStartSessionModal();
  });
  teamsResumeSessionCancel?.addEventListener('click', closeTeamsResumeSessionModal);
  teamsResumeSessionModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeTeamsResumeSessionModal();
  });
  teamsSessionActionsClose?.addEventListener('click', closeTeamsSessionActionsModal);
  teamsSessionRenameForm?.addEventListener('submit', handleTeamsSessionRenameSubmit);
  teamsSessionStopAction?.addEventListener('click', () => { void stopTeamsSession(); });
  teamsSessionCloseAction?.addEventListener('click', () => { void closeTeamsSession(); });
  teamsSessionActionsModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeTeamsSessionActionsModal();
  });
  teamsDeleteSessionClose?.addEventListener('click', closeTeamsDeleteSessionModal);
  teamsDeleteSessionCancel?.addEventListener('click', closeTeamsDeleteSessionModal);
  teamsDeleteSessionConfirm?.addEventListener('click', handleTeamsDeleteSessionConfirm);
  teamsDeleteSessionModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeTeamsDeleteSessionModal();
  });
  const setRulesButtonDisabled = (btn, disabled) => {
    if (!btn) return;
    btn.disabled = disabled;
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('is-disabled', !!disabled);
  };
  const startFirebaseDeploy = (titleText) => {
    firebaseDeploySessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    openDeployModal(titleText);
    return firebaseDeploySessionId;
  };
  const handleDeployAllFirebase = async () => {
    if (!window.firebaseAdmin?.deployFirestoreRules
      || !window.firebaseAdmin?.deployStorageRules
      || !window.firebaseAdmin?.deployTrackerUpdatesFunction) {
      const message = t('alerts.firebaseAdminUnavailable', 'Firebase Admin integration is not available.');
      showToast(message, 'error');
      return;
    }
    const firestore = getRulesText(settingFirestoreRules);
    const storage = getRulesText(settingStorageRules);
    const functions = getRulesText(settingFirebaseFunctionIndex);
    if (!firestore.trimmed) {
      const message = t('alerts.firebaseRulesEmpty', 'Rules content is empty.');
      setFirebaseRulesStatus(firebaseFirestoreRulesStatus, message, { isError: true, i18nKey: 'alerts.firebaseRulesEmpty' });
      showToast(message, 'error');
      return;
    }
    if (!storage.trimmed) {
      const message = t('alerts.firebaseRulesEmpty', 'Rules content is empty.');
      setFirebaseRulesStatus(firebaseStorageRulesStatus, message, { isError: true, i18nKey: 'alerts.firebaseRulesEmpty' });
      showToast(message, 'error');
      return;
    }
    if (!functions.trimmed) {
      const message = t('alerts.firebaseFunctionEmpty', 'Function code is empty.');
      setFirebaseRulesStatus(firebaseFunctionsStatus, message, { isError: true, i18nKey: 'alerts.firebaseFunctionEmpty' });
      showToast(message, 'error');
      return;
    }
    const deployId = startFirebaseDeploy(t('settings.firebaseDeployingTitle', 'Deploying Firebase…'));
    appendDeployLog('Starting full Firebase deploy.');
    setRulesButtonDisabled(firebaseDeployFirestoreRulesBtn, true);
    setRulesButtonDisabled(firebaseDeployStorageRulesBtn, true);
    setRulesButtonDisabled(firebaseDeployFunctionsBtn, true);
    if (firebaseDeployAllBtn) setRulesButtonDisabled(firebaseDeployAllBtn, true);
    try {
      setFirebaseRulesStatus(
        firebaseFirestoreRulesStatus,
        t('status.firebaseRulesDeployingFirestore', 'Deploying Firestore rules...'),
        { i18nKey: 'status.firebaseRulesDeployingFirestore' }
      );
      appendDeployLog('Deploying Firestore rules...');
      const firestoreResult = await window.firebaseAdmin.deployFirestoreRules({ content: firestore.raw, deployId });
      if (!firestoreResult?.ok) {
        const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
        const message = formatFirebaseAdminError(firestoreResult, fallback);
        setFirebaseRulesStatus(firebaseFirestoreRulesStatus, message, { isError: true });
        showToast(message, 'error');
        appendDeployLog(`Error: ${message}`);
        finishDeployModal(message);
        return;
      }
      storeRulesDeployState(FIRESTORE_RULES_DEPLOY_KEY, firestore.raw);
      setFirebaseRulesStatus(firebaseFirestoreRulesStatus, '', { i18nKey: null });
      firebaseFirestoreRulesStatus?.classList?.add('is-success-icon');
      appendDeployLog('Firestore rules deployed.');

      setFirebaseRulesStatus(
        firebaseStorageRulesStatus,
        t('status.firebaseRulesDeployingStorage', 'Deploying Storage rules...'),
        { i18nKey: 'status.firebaseRulesDeployingStorage' }
      );
      appendDeployLog('Deploying Storage rules...');
      const bucket = getStorageBucketFromInput();
      const storageResult = await window.firebaseAdmin.deployStorageRules({ content: storage.raw, bucket, deployId });
      if (!storageResult?.ok) {
        const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
        const message = formatFirebaseAdminError(storageResult, fallback);
        setFirebaseRulesStatus(firebaseStorageRulesStatus, message, { isError: true });
        showToast(message, 'error');
        appendDeployLog(`Error: ${message}`);
        finishDeployModal(message);
        return;
      }
      storeRulesDeployState(STORAGE_RULES_DEPLOY_KEY, storage.raw);
      setFirebaseRulesStatus(firebaseStorageRulesStatus, '', { i18nKey: null });
      firebaseStorageRulesStatus?.classList?.add('is-success-icon');
      appendDeployLog('Storage rules deployed.');

      setFirebaseRulesStatus(
        firebaseFunctionsStatus,
        t('status.firebaseFunctionsDeploying', 'Deploying Cloud Function...'),
        { i18nKey: 'status.firebaseFunctionsDeploying' }
      );
      appendDeployLog('Deploying Cloud Function...');
      const functionsResult = await window.firebaseAdmin.deployTrackerUpdatesFunction({ content: functions.raw, deployId });
      if (!functionsResult?.ok) {
        const fallback = t('alerts.firebaseFunctionDeployFailed', 'Unable to deploy function.');
        const message = formatFirebaseAdminError(functionsResult, fallback);
        setFirebaseRulesStatus(firebaseFunctionsStatus, message, { isError: true });
        showToast(message, 'error');
        appendDeployLog(`Error: ${message}`);
        finishDeployModal(message);
        return;
      }
      storeRulesDeployState(FUNCTIONS_INDEX_DEPLOY_KEY, functions.raw);
      setFirebaseRulesStatus(firebaseFunctionsStatus, '', { i18nKey: null });
      firebaseFunctionsStatus?.classList?.add('is-success-icon');
      appendDeployLog('Cloud Function deployed.');

      const doneMessage = t('settings.firebaseDeployingDone', 'Firebase deploy complete.');
      showToast(doneMessage);
      finishDeployModal(doneMessage);
    } catch (err) {
      const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
      showToast(fallback, 'error');
      appendDeployLog(`Error: ${fallback}`);
      finishDeployModal(fallback);
    } finally {
      updateFirebaseAdminActionsState();
    }
  };
  const handleDeployFirestoreRules = async () => {
    if (!window.firebaseAdmin?.deployFirestoreRules) {
      const message = t('alerts.firebaseAdminUnavailable', 'Firebase Admin integration is not available.');
      setFirebaseRulesStatus(firebaseFirestoreRulesStatus, message, { isError: true });
      showToast(message, 'error');
      return;
    }
    const { raw, trimmed } = getRulesText(settingFirestoreRules);
    if (!trimmed) {
      const message = t('alerts.firebaseRulesEmpty', 'Rules content is empty.');
      setFirebaseRulesStatus(firebaseFirestoreRulesStatus, message, { isError: true, i18nKey: 'alerts.firebaseRulesEmpty' });
      showToast(message, 'error');
      return;
    }
    setRulesButtonDisabled(firebaseDeployFirestoreRulesBtn, true);
    setFirebaseRulesStatus(
      firebaseFirestoreRulesStatus,
      t('status.firebaseRulesDeployingFirestore', 'Deploying Firestore rules...'),
      { i18nKey: 'status.firebaseRulesDeployingFirestore' }
    );
    const deployId = startFirebaseDeploy(t('settings.firebaseDeployingTitleFirestore', 'Deploying Firestore rules…'));
    appendDeployLog('Starting Firestore rules deployment.');
    try {
      const result = await window.firebaseAdmin.deployFirestoreRules({ content: raw, deployId });
      if (!result?.ok) {
        const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
        const message = formatFirebaseAdminError(result, fallback);
        setFirebaseRulesStatus(firebaseFirestoreRulesStatus, message, { isError: true });
        showToast(message, 'error');
        appendDeployLog(`Error: ${message}`);
        finishDeployModal(message);
        return;
      }
      storeRulesDeployState(FIRESTORE_RULES_DEPLOY_KEY, raw);
      const message = t('status.firebaseRulesDeployedFirestore', 'Firestore rules deployed.');
      setFirebaseRulesStatus(firebaseFirestoreRulesStatus, '', { i18nKey: null });
      firebaseFirestoreRulesStatus?.classList?.add('is-success-icon');
      showToast(message);
      appendDeployLog('Firestore rules deployment complete.');
      finishDeployModal(message);
    } catch (err) {
      const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
      setFirebaseRulesStatus(firebaseFirestoreRulesStatus, fallback, { isError: true });
      showToast(fallback, 'error');
      appendDeployLog(`Error: ${fallback}`);
      finishDeployModal(fallback);
    } finally {
      updateFirebaseAdminActionsState();
    }
  };
  const handleDeployStorageRules = async () => {
    if (!window.firebaseAdmin?.deployStorageRules) {
      const message = t('alerts.firebaseAdminUnavailable', 'Firebase Admin integration is not available.');
      setFirebaseRulesStatus(firebaseStorageRulesStatus, message, { isError: true });
      showToast(message, 'error');
      return;
    }
    const { raw, trimmed } = getRulesText(settingStorageRules);
    if (!trimmed) {
      const message = t('alerts.firebaseRulesEmpty', 'Rules content is empty.');
      setFirebaseRulesStatus(firebaseStorageRulesStatus, message, { isError: true, i18nKey: 'alerts.firebaseRulesEmpty' });
      showToast(message, 'error');
      return;
    }
    setRulesButtonDisabled(firebaseDeployStorageRulesBtn, true);
    setFirebaseRulesStatus(
      firebaseStorageRulesStatus,
      t('status.firebaseRulesDeployingStorage', 'Deploying Storage rules...'),
      { i18nKey: 'status.firebaseRulesDeployingStorage' }
    );
    const deployId = startFirebaseDeploy(t('settings.firebaseDeployingTitleStorage', 'Deploying Storage rules…'));
    appendDeployLog('Starting Storage rules deployment.');
    try {
      const bucket = getStorageBucketFromInput();
      const result = await window.firebaseAdmin.deployStorageRules({ content: raw, bucket, deployId });
      if (!result?.ok) {
        const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
        const message = formatFirebaseAdminError(result, fallback);
        setFirebaseRulesStatus(firebaseStorageRulesStatus, message, { isError: true });
        showToast(message, 'error');
        appendDeployLog(`Error: ${message}`);
        finishDeployModal(message);
        return;
      }
      storeRulesDeployState(STORAGE_RULES_DEPLOY_KEY, raw);
      const message = t('status.firebaseRulesDeployedStorage', 'Storage rules deployed.');
      setFirebaseRulesStatus(firebaseStorageRulesStatus, '', { i18nKey: null });
      firebaseStorageRulesStatus?.classList?.add('is-success-icon');
      showToast(message);
      appendDeployLog('Storage rules deployment complete.');
      finishDeployModal(message);
    } catch (err) {
      const fallback = t('alerts.firebaseRulesDeployFailed', 'Unable to deploy rules.');
      setFirebaseRulesStatus(firebaseStorageRulesStatus, fallback, { isError: true });
      showToast(fallback, 'error');
      appendDeployLog(`Error: ${fallback}`);
      finishDeployModal(fallback);
    } finally {
      updateFirebaseAdminActionsState();
    }
  };
  const handleDeployTrackerUpdatesFunction = async () => {
    if (!window.firebaseAdmin?.deployTrackerUpdatesFunction) {
      const message = t('alerts.firebaseAdminUnavailable', 'Firebase Admin integration is not available.');
      setFirebaseRulesStatus(firebaseFunctionsStatus, message, { isError: true });
      showToast(message, 'error');
      return;
    }
    const { raw, trimmed } = getRulesText(settingFirebaseFunctionIndex);
    if (!trimmed) {
      const message = t('alerts.firebaseFunctionEmpty', 'Function code is empty.');
      setFirebaseRulesStatus(firebaseFunctionsStatus, message, { isError: true, i18nKey: 'alerts.firebaseFunctionEmpty' });
      showToast(message, 'error');
      return;
    }
    setRulesButtonDisabled(firebaseDeployFunctionsBtn, true);
    setFirebaseRulesStatus(
      firebaseFunctionsStatus,
      t('status.firebaseFunctionsDeploying', 'Deploying Cloud Function...'),
      { i18nKey: 'status.firebaseFunctionsDeploying' }
    );
    const deployId = startFirebaseDeploy(t('settings.firebaseDeployingTitleFunctions', 'Deploying Cloud Function…'));
    appendDeployLog('Starting Cloud Function deployment.');
    try {
      const result = await window.firebaseAdmin.deployTrackerUpdatesFunction({ content: raw, deployId });
      if (!result?.ok) {
        const fallback = t('alerts.firebaseFunctionDeployFailed', 'Unable to deploy function.');
        const message = formatFirebaseAdminError(result, fallback);
        setFirebaseRulesStatus(firebaseFunctionsStatus, message, { isError: true });
        showToast(message, 'error');
        appendDeployLog(`Error: ${message}`);
        finishDeployModal(message);
        return;
      }
      storeRulesDeployState(FUNCTIONS_INDEX_DEPLOY_KEY, raw);
      const message = t('status.firebaseFunctionsDeployed', 'Cloud Function deployed.');
      setFirebaseRulesStatus(firebaseFunctionsStatus, '', { i18nKey: null });
      firebaseFunctionsStatus?.classList?.add('is-success-icon');
      showToast(message);
      appendDeployLog('Cloud Function deployment complete.');
      finishDeployModal(message);
    } catch (err) {
      const fallback = t('alerts.firebaseFunctionDeployFailed', 'Unable to deploy function.');
      setFirebaseRulesStatus(firebaseFunctionsStatus, fallback, { isError: true });
      showToast(fallback, 'error');
      appendDeployLog(`Error: ${fallback}`);
      finishDeployModal(fallback);
    } finally {
      updateFirebaseAdminActionsState();
    }
  };
  firebaseAdminClearSessionsBtn?.addEventListener('click', () => {
    if (firebaseAdminClearSessionsBtn.disabled) return;
    openFirebaseAdminClearSessionsModal();
  });
  firebaseAdminClearAnonymousUsersBtn?.addEventListener('click', () => {
    if (firebaseAdminClearAnonymousUsersBtn.disabled) return;
    openFirebaseAdminClearAnonymousUsersModal();
  });
  firebaseDeployFirestoreRulesBtn?.addEventListener('click', () => {
    if (firebaseDeployFirestoreRulesBtn.disabled) return;
    void handleDeployFirestoreRules();
  });
  firebaseDeployStorageRulesBtn?.addEventListener('click', () => {
    if (firebaseDeployStorageRulesBtn.disabled) return;
    void handleDeployStorageRules();
  });
  firebaseDeployFunctionsBtn?.addEventListener('click', () => {
    if (firebaseDeployFunctionsBtn.disabled) return;
    void handleDeployTrackerUpdatesFunction();
  });
  firebaseDeployAllBtn?.addEventListener('click', () => {
    if (firebaseDeployAllBtn.disabled) return;
    void handleDeployAllFirebase();
  });
  firebaseCollapseFirestoreRulesBtn?.addEventListener('click', () => {
    toggleRulesEditor(firestoreRulesEditor, firebaseCollapseFirestoreRulesBtn);
  });
  firebaseCollapseStorageRulesBtn?.addEventListener('click', () => {
    toggleRulesEditor(storageRulesEditor, firebaseCollapseStorageRulesBtn);
  });
  firebaseCollapseFunctionsBtn?.addEventListener('click', () => {
    toggleRulesEditor(functionsRulesEditor, firebaseCollapseFunctionsBtn);
  });
  firebaseCollapseConfigBtn?.addEventListener('click', () => {
    toggleRulesEditor(firebaseConfigEditor, firebaseCollapseConfigBtn);
  });
  firebaseAdminClearSessionsClose?.addEventListener('click', closeFirebaseAdminClearSessionsModal);
  firebaseAdminClearSessionsCancel?.addEventListener('click', closeFirebaseAdminClearSessionsModal);
  firebaseAdminClearSessionsConfirm?.addEventListener('click', handleFirebaseAdminClearSessionsConfirm);
  firebaseAdminClearSessionsModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeFirebaseAdminClearSessionsModal();
  });
  firebaseAdminClearAnonymousUsersClose?.addEventListener('click', closeFirebaseAdminClearAnonymousUsersModal);
  firebaseAdminClearAnonymousUsersCancel?.addEventListener('click', closeFirebaseAdminClearAnonymousUsersModal);
  firebaseAdminClearAnonymousUsersConfirm?.addEventListener('click', handleFirebaseAdminClearAnonymousUsersConfirm);
  firebaseAdminClearAnonymousUsersModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeFirebaseAdminClearAnonymousUsersModal();
  });
  firebaseDeployModalClose?.addEventListener('click', closeDeployModal);
  firebaseDeployModalDone?.addEventListener('click', closeDeployModal);
  firebaseDeployModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeDeployModal();
  });
  teamMemberClose?.addEventListener('click', closeTeamMemberModal);
  teamMemberModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeTeamMemberModal();
  });
  trimMemberClose?.addEventListener('click', closeTrimMemberModal);
  trimMemberModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeTrimMemberModal();
  });
  trimMemberModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTrimMemberModal();
      e.stopPropagation();
    }
  });
  trimMemberRangeStart?.addEventListener('input', () => handleTrimMemberRangeInput('start'));
  trimMemberRangeEnd?.addEventListener('input', () => handleTrimMemberRangeInput('end'));
  trimMemberExtract?.addEventListener('click', handleTrimMemberExtract);

  refreshTrackersControlsState();
  updateTeamsSessionUI();

  // deprecated: old floating monitor toggle (removed)

  fullscreenBtn?.addEventListener('click', async () => {
    try {
      const isFull = await window.app.toggleFullScreen();
      showToast(t(isFull ? 'messages.fullscreenEntered' : 'messages.fullscreenExited', isFull ? 'Entered fullscreen' : 'Exited fullscreen'));
    } catch (err) {
      console.error('Toggle fullscreen failed', err);
      showToast(t('messages.fullscreenToggleFailed', 'Fullscreen toggle failed'), 'error');
    }
  });

  // ---- Tabs UI state + toolbar height ----
  function updateTabUI(){
    const isMap = !!tabMapInput?.checked;
    if (tabMapLabel) { tabMapLabel.classList.toggle('active', isMap); tabMapLabel.setAttribute('aria-selected', String(isMap)); }
    if (tabSettingsLabel) { tabSettingsLabel.classList.toggle('active', !isMap); tabSettingsLabel.setAttribute('aria-selected', String(!isMap)); }
    document.body.classList.toggle('map-active', isMap);
    document.body.style.setProperty('--toolbar-h', isMap ? '44px' : '0px');
    if (isMap) {
      scheduleMapResize();
      try { window.dispatchEvent(new Event('resize')); } catch {}
    }
  }
  const openSettingsTab = () => {
    if (tabSettingsInput) tabSettingsInput.checked = true;
    if (tabMapInput) tabMapInput.checked = false;
    updateTabUI();
    try {
      if (tabSettingsLabel && typeof tabSettingsLabel.focus === 'function') tabSettingsLabel.focus();
    } catch {}
  };
  mapWelcomeSettings?.addEventListener('click', openSettingsTab);
  settingsQuickBtn?.addEventListener('click', openSettingsTab);
  settingsCloseBtn?.addEventListener('click', () => {
    if (!tabMapInput) return;
    tabMapInput.checked = true;
    tabMapInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  tabMapInput?.addEventListener('change', () => {
    if (tabMapInput?.checked && settingsDirty) {
      alert(t('alerts.unsavedSettings', 'You have unsaved settings. Please save before returning to the map.'));
      if (tabMapInput) tabMapInput.checked = false;
      if (tabSettingsInput) tabSettingsInput.checked = true;
    }
    updateTabUI();
  });
  tabSettingsInput?.addEventListener('change', updateTabUI);
  updateTabUI();

  // ---- Floating panels: positioning + drag with persistence ----
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
  function makeDraggable(el, { handle, storageKey, container, defaultPos, positionMode } = {}){
    if (!el || !container) return;
    handle = handle || el;
    const useBottom = positionMode === 'bottom';
    const loadPos = () => {
      try{ const raw = localStorage.getItem(storageKey); if (!raw) return null; return JSON.parse(raw); }catch{ return null; }
    };
    const savePos = (pos) => { try{ localStorage.setItem(storageKey, JSON.stringify(pos)); }catch{} };
    const applyPos = (pos) => {
      const crect = container.getBoundingClientRect();
      const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
      const x = clamp(pos.left ?? 0, 0, Math.max(0, crect.width - w));
      let yTop;
      if (useBottom) {
        // if bottom provided, convert to top space for clamping
        const bottom = pos.bottom ?? Math.max(0, crect.height - (pos.top ?? 0) - h);
        yTop = clamp(Math.max(0, crect.height - bottom - h), 0, Math.max(0, crect.height - h));
      } else {
        yTop = clamp(pos.top ?? 0, 0, Math.max(0, crect.height - h));
      }
      el.style.left = `${x}px`;
      if (useBottom) {
        const bottom = Math.max(0, crect.height - yTop - h);
        el.style.bottom = `${bottom}px`;
        el.style.top = '';
      } else {
        el.style.top = `${yTop}px`;
        el.style.bottom = '';
      }
    };
    const initPos = () => {
      const saved = storageKey && loadPos();
      if (saved && Number.isFinite(saved.left) && (Number.isFinite(saved.top) || Number.isFinite(saved.bottom))) { applyPos(saved); return; }
      if (defaultPos) { applyPos(defaultPos()); }
    };
    let dragging = false; let startX=0, startY=0; let startLeft=0, startTop=0; let startBottom=0;
    const onDown = (e) => {
      // don't start drag from interactive elements
      const target = e.target;
      if (target && (
        target.closest('input,textarea,select,button') ||
        (target instanceof HTMLElement && target.isContentEditable)
      )) return;
      const ev = e.touches ? e.touches[0] : e;
      dragging = true;
      const rect = el.getBoundingClientRect();
      const crect = container.getBoundingClientRect();
      startLeft = rect.left - crect.left; startTop = rect.top - crect.top;
      startBottom = crect.bottom - rect.bottom;
      startX = ev.clientX; startY = ev.clientY;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive:false });
      document.addEventListener('touchend', onUp);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const ev = e.touches ? e.touches[0] : e;
      const dx = ev.clientX - startX; const dy = ev.clientY - startY;
      if (useBottom) {
        const crect = container.getBoundingClientRect();
        const h = el.offsetHeight || 0;
        const newTop = startTop + dy;
        const newBottom = Math.max(0, crect.height - newTop - h);
        applyPos({ left: startLeft + dx, bottom: newBottom });
      } else {
        applyPos({ left: startLeft + dx, top: startTop + dy });
      }
      e.preventDefault?.();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      // Save
      const crect = container.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      if (useBottom) {
        const bottom = crect.bottom - rect.bottom;
        const pos = { left: rect.left - crect.left, bottom };
        storageKey && savePos(pos);
      } else {
        const pos = { left: rect.left - crect.left, top: rect.top - crect.top };
        storageKey && savePos(pos);
      }
    };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive:false });
    // Kick initial positioning
    initPos();
  }

  // --- Features sidebar: sizing, collapse ---
  function initSidebar(){
    const root = document.documentElement;
    let sidebarOpen = false;

    let resizeTimer = null;
    const scheduleResize = (delay=260) => {
      try { if (resizeTimer) clearTimeout(resizeTimer); } catch {}
      resizeTimer = setTimeout(() => { try { getMap()?.resize(); } catch {} }, delay);
    };
    const applyOpen = (open) => {
      const show = !!open;
      sidebarOpen = show;
      closeFeaturesActionsMenu();
      if (show) {
        root.style.setProperty('--sidebar-w', `${FEATURES_PANEL_WIDTH}px`);
        if (featuresSidebar) {
          featuresSidebar.hidden = false;
          featuresSidebar.classList.remove('anim-exit','anim-exit-active');
          featuresSidebar.classList.add('anim-enter');
          requestAnimationFrame(() => featuresSidebar.classList.add('anim-enter-active'));
          setTimeout(() => featuresSidebar && featuresSidebar.classList.remove('anim-enter','anim-enter-active'), 220);
        }
        try { localStorage.setItem('ui.sidebar.open', '1'); } catch {}
      } else {
        root.style.setProperty('--sidebar-w', '0px');
        if (featuresSidebar) {
          featuresSidebar.classList.remove('anim-enter','anim-enter-active');
          featuresSidebar.classList.add('anim-exit');
          requestAnimationFrame(() => featuresSidebar.classList.add('anim-exit-active'));
          const onEnd = () => {
            if (featuresSidebar) featuresSidebar.hidden = true;
            featuresSidebar && featuresSidebar.classList.remove('anim-exit','anim-exit-active');
            featuresSidebar && featuresSidebar.removeEventListener('transitionend', onEnd);
          };
          featuresSidebar.addEventListener('transitionend', onEnd);
        }
        try { localStorage.setItem('ui.sidebar.open', '0'); } catch {}
      }
      if (featuresToggleBtn) {
        featuresToggleBtn.hidden = show;
        featuresToggleBtn.classList.toggle('is-open', show);
        featuresToggleBtn.setAttribute('aria-expanded', String(show));
        featuresToggleBtn.setAttribute('aria-label', show ? 'Hide features panel' : 'Show features panel');
        featuresToggleBtn.title = show ? 'Hide features panel' : 'Show features panel';
      }
      scheduleResize();
    };
    const initialOpen = localStorage.getItem('ui.sidebar.open') !== '0';
    applyOpen(initialOpen);

    setFeatureLabelsToggleState(true);
    featuresLabelsToggle?.addEventListener('click', () => {
      setFeatureLabelsToggleState(!featureLabelsVisible);
    });

    featuresCollapse?.addEventListener('click', () => {
      applyOpen(false);
      setTimeout(() => { try { featuresToggleBtn?.focus?.(); } catch {} }, 240);
    });
    featuresToggleBtn?.addEventListener('click', () => applyOpen(true));

    try { document.body.classList.add('sidebar-ready'); } catch {}
  }

  function initTrackersSidebar(){
    const sidebarEl = trackersSidebar || q('#trackersSidebar');
    const toggleBtn = trackersToggleBtn || q('#trackersToggleBtn');
    const collapseEl = trackersCollapse || q('#trackersCollapse');
    if (!sidebarEl && !toggleBtn) return;
    const root = document.documentElement;

    const setOpen = (open) => {
      const show = !!open;
      try { localStorage.setItem('ui.trackers.open', show ? '1' : '0'); } catch {}
      if (!show) closeTrackersMenu();
      root.style.setProperty('--trackers-sidebar-w', show ? `${TRACKERS_PANEL_WIDTH}px` : '0px');
      if (sidebarEl) {
        if (show) {
          sidebarEl.hidden = false;
          sidebarEl.classList.remove('anim-exit', 'anim-exit-active');
          sidebarEl.classList.add('anim-enter');
          requestAnimationFrame(() => sidebarEl.classList.add('anim-enter-active'));
          setTimeout(() => {
            sidebarEl.classList.remove('anim-enter', 'anim-enter-active');
          }, 220);
        } else {
          sidebarEl.classList.remove('anim-enter', 'anim-enter-active');
          sidebarEl.classList.add('anim-exit');
          requestAnimationFrame(() => sidebarEl.classList.add('anim-exit-active'));
          const cleanup = () => {
            sidebarEl.removeEventListener('transitionend', cleanup);
            if (root.style.getPropertyValue('--trackers-sidebar-w') !== '0px') return;
            sidebarEl.hidden = true;
            sidebarEl.classList.remove('anim-exit', 'anim-exit-active');
          };
          sidebarEl.addEventListener('transitionend', cleanup);
          setTimeout(cleanup, 240);
        }
      }
      if (toggleBtn) {
        toggleBtn.hidden = show;
        toggleBtn.classList.toggle('is-open', show);
        toggleBtn.setAttribute('aria-expanded', String(show));
        toggleBtn.setAttribute('aria-label', show ? 'Hide teams panel' : 'Show teams panel');
        toggleBtn.title = show ? 'Hide teams panel' : 'Show teams panel';
      }
      if (collapseEl) {
        collapseEl.setAttribute('aria-expanded', String(show));
        collapseEl.title = show ? 'Hide teams panel' : 'Show teams panel';
        collapseEl.setAttribute('aria-label', show ? 'Hide teams panel' : 'Show teams panel');
      }
    };

    (window).openTrackersPanel = () => setOpen(true);
    (window).closeTrackersPanel = () => setOpen(false);

    const stored = localStorage.getItem('ui.trackers.open');
    const shouldOpen = stored === '1';
    setOpen(shouldOpen);

    collapseEl?.addEventListener('click', () => {
      setOpen(false);
      setTimeout(() => { try { toggleBtn?.focus?.(); } catch {} }, 240);
    });

    toggleBtn?.addEventListener('click', () => setOpen(true));


    renderTrackersList();
    updateTrackersPanelState();
    refreshTrackersControlsState();

    try { document.body.classList.add('sidebar-ready'); } catch {}
  }

  // Initialize panels + sidebar + map after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { initSidebar(); } catch {}
      try { initTrackersSidebar(); } catch {}
      try { ensureSymbolsLoaded(); } catch {}
      initMap();
    }, { once: true });
  } else {
    try { initSidebar(); } catch {}
    try { initTrackersSidebar(); } catch {}
    try { ensureSymbolsLoaded(); } catch {}
    initMap();
  }

  // ---- File menu interactions ----
  // Save request from main -> send data back
  if (window.file && window.file.onRequestSave && window.file.provideSave) {
    window.file.onRequestSave(() => {
      try {
        const data = (window).draw?.toJSON?.() || { type:'FeatureCollection', features: [] };
        if (currentFilePath) {
          window.file.provideSave(data);
        } else {
          const defaultName = getSuggestedFilename();
          window.file.provideSave({ data, defaultPath: defaultName });
        }
      } catch (e) { console.error('Prepare save failed', e); }
    });
  }
  // Save completed (from main)
  window.file && window.file.onSaved && window.file.onSaved(() => {
    setDirty(false);
    showToast(t('messages.featuresSaved', 'Features saved'));
  });
  // Open data from main -> prompt overwrite and load
  if (window.file && window.file.onOpenData) {
    window.file.onOpenData(async (payload) => {
      try {
        if (!payload || payload.type !== 'FeatureCollection') return;
        const m = (window)._map;
        if (!m) return;
        const src = m.getSource('draw');
        if (!src) return;
        if (isDirty) {
          const promptRes = await window.file.askSaveDiscardCancel(
            t('alerts.unsavedDrawings', 'You have unsaved drawings.'),
            t('alerts.saveBeforeOpening', 'Do you want to save before opening a file?')
          );
          if (!promptRes || promptRes.choice === 'cancel') return;
          if (promptRes.choice === 'save') {
            try {
              const data = (window).draw?.toJSON?.() || { type:'FeatureCollection', features: [] };
              const saved = await window.file.saveAs(data, currentFilePath || getSuggestedFilename());
              if (!saved || !saved.ok) return;
              setDirty(false);
            } catch { return; }
          }
        }
        // Replace via helper to keep in sync with panel
        if ((window).loadDrawings) (window).loadDrawings(payload);
        setDirty(false);
        // After loading, compute bounds and fit view
        try {
          const bounds = computeFeatureBounds(payload);
          focusMapOnBounds(bounds);
        } catch (e) { console.error('fit to bounds failed', e); }
      } catch (e) { console.error('Open failed', e); }
    });
  }

  // Close confirmation from main (save/discard/cancel)
  if (window.app && window.app.onConfirmClose && window.app.confirmCloseResult && window.file && window.file.saveAs) {
    window.app.onConfirmClose(async () => {
      try {
        if (!isDirty) { window.app.confirmCloseResult(true); return; }
        const promptRes = await window.file.askSaveDiscardCancel(
          t('alerts.unsavedDrawings', 'You have unsaved drawings.'),
          t('alerts.saveBeforeClosing', 'Do you want to save before closing?')
        );
        if (!promptRes || promptRes.choice === 'cancel') { window.app.confirmCloseResult(false); return; }
          if (promptRes.choice === 'save') {
            try {
              const data = (window).draw?.toJSON?.() || { type:'FeatureCollection', features: [] };
              const saved = await window.file.saveAs(data, currentFilePath || getSuggestedFilename());
              if (!saved || !saved.ok) { window.app.confirmCloseResult(false); return; }
              setDirty(false);
              window.app.confirmCloseResult(true);
          } catch { window.app.confirmCloseResult(false); }
        } else if (promptRes.choice === 'discard') {
          window.app.confirmCloseResult(true);
        } else {
          window.app.confirmCloseResult(false);
        }
      } catch { window.app.confirmCloseResult(false); }
    });
  }

  // New file: clear drawings and fly to home address
  if (window.file && window.file.onNew) {
    window.file.onNew(async () => {
      try {
        const m = (window)._map; if (!m) return;
        // Check if drawings exist
        let hasExisting = false;
        try {
          const src = m.getSource('draw');
          const curr = src && src._data && Array.isArray(src._data.features) ? src._data.features : [];
          hasExisting = curr.length > 0;
        } catch {}
        if (hasExisting || isDirty) {
          const res = await window.file.askSaveDiscardCancel(
            t('alerts.unsavedDrawings', 'You have unsaved drawings.'),
            t('alerts.saveBeforeNew', 'Do you want to save before creating a new file?')
          );
          if (!res || res.choice === 'cancel') return;
          if (res.choice === 'save') {
            try {
              const data = (window).draw?.toJSON?.() || { type:'FeatureCollection', features: [] };
              const saved = await window.file.saveAs(data, currentFilePath || getSuggestedFilename());
              if (!saved || !saved.ok) return;
              setDirty(false);
            } catch { return; }
          }
          // discard continues
        }
        // Clear drawings
        (window).draw?.clear?.();
        const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
        const home = (localStorage.getItem('map.homeAddress') || defaultHomeAddress || '').trim();
        if (!home) { alert('Please set a Home Address in Settings.'); return; }
        if (!key) { alert('Please set Google Maps API key in Settings.'); return; }
        let coords = null;
        try {
          coords = await geocodeAddress(home, key);
        } catch (e) {
          console.error('Home address lookup failed', e);
        }
        if (!coords) { alert('Could not find the home address.'); return; }
        m.flyTo({ center: coords, zoom: Math.max(12, m.getZoom() || 12), duration: 700 });
      } catch (e) { console.error('New file action failed', e); }
    });
  }

  // ---- Toolbar wiring ----
  (function initToolbar(){
    const visibleCenter = () => {
      try{
        const m = getMap(); if (!m) return null;
        const canvas = m.getCanvas();
        const px = [ canvas.clientWidth / 2, canvas.clientHeight / 2 ];
        return m.unproject(px);
      }catch{ return null; }
    };
    const setActiveTool = (tool) => {
      const previousTool = (window)._currentTool;
      (window)._currentTool = tool;
      if (previousTool === 'team-goto' && tool !== 'team-goto') {
        clearActiveTrackerGoTo({ skipToolReset: true });
      }
      if (previousTool === 'arrow' && tool !== 'arrow') {
        window._cleanupArrowInteraction?.();
      }
      const all = [toolEdit, toolRect, toolPoly, toolCircle, toolLine, toolArrow, toolPOI, toolCrosshair];
      all.forEach(btn => btn?.classList.remove('active'));
      // aria-pressed state for buttons
      all.forEach(btn => btn && btn.setAttribute('aria-pressed', String(false)));
      // no POI palette in the toolbar
      switch (tool) {
        case 'edit': toolEdit?.classList.add('active'); toolEdit?.setAttribute('aria-pressed', String(true)); break;
        case 'rect': toolRect?.classList.add('active'); toolRect?.setAttribute('aria-pressed', String(true)); break;
        case 'poly': toolPoly?.classList.add('active'); toolPoly?.setAttribute('aria-pressed', String(true)); break;
        case 'circle': toolCircle?.classList.add('active'); toolCircle?.setAttribute('aria-pressed', String(true)); break;
        case 'line': toolLine?.classList.add('active'); toolLine?.setAttribute('aria-pressed', String(true)); break;
        case 'arrow': toolArrow?.classList.add('active'); toolArrow?.setAttribute('aria-pressed', String(true)); break;
        case 'poi':
          toolPOI?.classList.add('active');
          toolPOI?.setAttribute('aria-pressed', String(true));
          break;
        case 'crosshair':
          toolCrosshair?.classList.add('active');
          toolCrosshair?.setAttribute('aria-pressed', String(true));
          break;
        default: break;
      }
      if (tool === 'crosshair') {
        setCrosshairMode(true);
      } else if (previousTool === 'crosshair') {
        setCrosshairMode(false);
      }
      if (tool && tool !== 'poi' && tool !== 'crosshair' && tool !== 'team-goto') {
        ensureFeaturesVisible();
      }
      try { (window)._setEditToolActive && (window)._setEditToolActive(tool === 'edit'); } catch {}
    };
    // Expose for global key handlers
    (window).setActiveTool = setActiveTool;
    toolRect?.addEventListener('click', () => setActiveTool((window)._currentTool === 'rect' ? null : 'rect'));
    toolEdit?.addEventListener('click', () => setActiveTool((window)._currentTool === 'edit' ? null : 'edit'));
    toolPoly?.addEventListener('click', () => setActiveTool((window)._currentTool === 'poly' ? null : 'poly'));
    toolCircle?.addEventListener('click', () => setActiveTool((window)._currentTool === 'circle' ? null : 'circle'));
    toolLine?.addEventListener('click', () => {
      const isActive = (window)._currentTool === 'line';
      if (isActive) {
        // If a line is currently in progress, keep the tool active to continue it
        if ((window)._lineInProgress) return;
        // Otherwise, toggle off
        setActiveTool(null);
      } else {
        setActiveTool('line');
      }
    });
    toolArrow?.addEventListener('click', () => {
      const isActive = (window)._currentTool === 'arrow';
      if (isActive) {
        window._cleanupArrowInteraction?.();
        setActiveTool(null);
      } else {
        window._cleanupArrowInteraction?.();
        setActiveTool('arrow');
      }
    });
    toolPOI?.addEventListener('click', () => setActiveTool((window)._currentTool === 'poi' ? null : 'poi'));
    toolCrosshair?.addEventListener('click', () => setActiveTool((window)._currentTool === 'crosshair' ? null : 'crosshair'));

    const applyScaleFromDenominator = (scaleValue) => {
      const map = getMap();
      if (!map || !Number.isFinite(scaleValue) || scaleValue <= 0) return false;
      const center = map.getCenter?.();
      if (!center || !Number.isFinite(center.lat)) return false;
      const targetMetersPerPixel = (scaleValue * 0.0254) / 96;
      if (!Number.isFinite(targetMetersPerPixel) || targetMetersPerPixel <= 0) return false;
      const metersPerPixelAtLat = getMetersPerPixelAtLatitude(map, center.lat, 0);
      if (!Number.isFinite(metersPerPixelAtLat) || metersPerPixelAtLat <= 0) return false;
      const zoom = Math.log2(metersPerPixelAtLat / targetMetersPerPixel);
      if (!Number.isFinite(zoom)) return false;
      const clampedZoom = Math.max(0, Math.min(24, zoom));
      try {
        map.easeTo({ zoom: clampedZoom, duration: 600, easing: (t) => t });
        return true;
      } catch (err) {
        console.warn('applyScaleFromDenominator failed', err);
        return false;
      }
    };

    const closeScaleDialog = () => {
      if (!scaleDialog) return;
      try {
        if (typeof scaleDialog.close === 'function') {
          if (scaleDialog.open) scaleDialog.close();
        } else {
          scaleDialog.hidden = true;
          const trigger = _lastScaleTrigger;
          _lastScaleTrigger = null;
          if (trigger && typeof trigger.focus === 'function') {
            try { trigger.focus(); } catch {}
          }
        }
      } catch (err) {
        console.warn('scaleDialog.close failed', err);
      }
    };

    const openScaleDialog = () => {
      if (!scaleDialog) return;
      _lastScaleTrigger = document.activeElement || null;
      try {
        if (typeof scaleDialog.showModal === 'function') {
          scaleDialog.showModal();
        } else {
          scaleDialog.hidden = false;
        }
        setTimeout(() => {
          try { scaleDialog?.querySelector?.('.scale-option')?.focus(); }
          catch {}
        }, 0);
      } catch (err) {
        console.warn('scaleDialog.showModal failed', err);
      }
    };

    scaleDialogClose?.addEventListener('click', (event) => {
      event?.preventDefault?.();
      closeScaleDialog();
    });
    if (scaleDialog) {
      scaleDialog.addEventListener('cancel', (event) => {
        event?.preventDefault?.();
        closeScaleDialog();
      });
      scaleDialog.addEventListener('click', (event) => {
        if (event.target === scaleDialog) closeScaleDialog();
      });
      scaleDialog.addEventListener('close', () => {
        const trigger = _lastScaleTrigger;
        _lastScaleTrigger = null;
        if (trigger && typeof trigger.focus === 'function') {
          try { trigger.focus(); } catch {}
        }
      });
    }

    scaleOptionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const scaleValue = Number(btn.dataset.scale);
        const ok = applyScaleFromDenominator(scaleValue);
        if (ok) {
          closeScaleDialog();
          showToast(t('alerts.scaleApplied', 'Scale applied.'), 'success', 1800);
        } else {
          showToast(t('alerts.scaleFailed', 'Could not set scale.'), 'error', 2400);
        }
      });
    });

    toolSetScale?.addEventListener('click', (event) => {
      event?.preventDefault?.();
      openScaleDialog();
    });
    const adjustLabelScale = (delta) => {
      setLabelScale(labelScale + delta);
    };
    toolLabelIncrease?.addEventListener('click', () => adjustLabelScale(LABEL_SCALE_STEP));
    toolLabelDecrease?.addEventListener('click', () => adjustLabelScale(-LABEL_SCALE_STEP));

    const waitForMapIdle = (map, timeout = 4000) => {
      if (!map) return Promise.resolve(false);
      return new Promise((resolve) => {
        try {
          const isIdle = () => {
            try {
              const loaded = typeof map.loaded === 'function' ? map.loaded() : true;
              const moving = typeof map.isMoving === 'function' ? map.isMoving() : false;
              const zooming = typeof map.isZooming === 'function' ? map.isZooming() : false;
              const rotating = typeof map.isRotating === 'function' ? map.isRotating() : false;
              return loaded && !moving && !zooming && !rotating;
            } catch {
              return false;
            }
          };
          if (isIdle()) {
            resolve(true);
            return;
          }
          let finished = false;
          let timer = null;
          const handleIdle = () => {
            if (finished) return;
            finished = true;
            try { map.off?.('idle', handleIdle); } catch {}
            if (timer) clearTimeout(timer);
            resolve(true);
          };
          map.on?.('idle', handleIdle);
          map.triggerRepaint?.();
          timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            try { map.off?.('idle', handleIdle); } catch {}
            resolve(false);
          }, timeout);
        } catch (err) {
          console.warn('waitForMapIdle failed', err);
          resolve(false);
        }
      });
    };

    const captureMapSnapshot = async () => {
      const map = getMap();
      if (!map) throw new Error('Map is not ready');
      await waitForMapIdle(map);
      const canvas = map.getCanvas?.();
      if (!canvas) throw new Error('Map canvas unavailable');
      const rect = typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : null;
      const dpr = window.devicePixelRatio || 1;

      const mapWidth = canvas.width;
      const mapHeight = canvas.height;
      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = mapWidth;
      mapCanvas.height = mapHeight;
      const mapCtx = mapCanvas.getContext('2d');
      if (!mapCtx) throw new Error('Unable to prepare snapshot canvas');
      mapCtx.drawImage(canvas, 0, 0);
      try {
        await drawWeatherMarkersForSnapshot({ ctx: mapCtx, canvas: mapCanvas, rect, map });
      } catch (err) {
        console.warn('drawWeatherMarkersForSnapshot failed', err);
      }

      const cssWidth = rect?.width;
      const pxScaleRaw = (cssWidth && cssWidth > 0)
        ? mapWidth / cssWidth
        : (Number.isFinite(dpr) && dpr > 0 ? dpr : 1);
      const pxScale = Math.max(1, pxScaleRaw || 1);
      const sidebarWidthPx = Math.max(1, Math.round(300 * pxScale));
      const targetAspect = 297 / 210;
      let mapCropWidth = mapWidth;
      let mapCropHeight = mapHeight;
      let mapCropX = 0;
      let mapCropY = 0;

      // Crop the map so the final export (map + sidebar) matches A4 landscape.
      if (mapHeight > 0 && mapWidth > 0) {
        let desiredMapWidth = Math.round(targetAspect * mapHeight - sidebarWidthPx);
        if (desiredMapWidth > 0 && desiredMapWidth <= mapWidth) {
          mapCropWidth = desiredMapWidth;
          mapCropX = Math.round((mapWidth - mapCropWidth) / 2);
        } else {
          let desiredMapHeight = Math.round((mapWidth + sidebarWidthPx) / targetAspect);
          desiredMapHeight = Math.max(1, Math.min(desiredMapHeight, mapHeight));
          mapCropHeight = desiredMapHeight;
          mapCropY = Math.round((mapHeight - mapCropHeight) / 2);
          const fallbackWidth = Math.round(targetAspect * mapCropHeight - sidebarWidthPx);
          if (fallbackWidth > 0 && fallbackWidth < mapCropWidth) {
            mapCropWidth = fallbackWidth;
            mapCropX = Math.round((mapWidth - mapCropWidth) / 2);
          }
        }
      }
      const mapRenderWidth = mapCropWidth;
      const mapRenderHeight = mapCropHeight;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = mapRenderWidth + sidebarWidthPx;
      exportCanvas.height = mapRenderHeight;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Unable to prepare export canvas');
      ctx.drawImage(
        mapCanvas,
        mapCropX,
        mapCropY,
        mapRenderWidth,
        mapRenderHeight,
        0,
        0,
        mapRenderWidth,
        mapRenderHeight
      );

      const center = map.getCenter?.() || null;
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : null;
      const bearingRaw = typeof map.getBearing === 'function' ? map.getBearing() : null;
      const pitch = typeof map.getPitch === 'function' ? map.getPitch() : null;
      const styleUrl = ((window)._lastStyleUrl && typeof (window)._lastStyleUrl === 'string')
        ? (window)._lastStyleUrl
        : getTargetMapStyleUrl();
      const normalizedBearing = Number.isFinite(bearingRaw)
        ? ((bearingRaw % 360) + 360) % 360
        : null;
      const latForScale = Number.isFinite(center?.lat) ? center.lat : 0;
      const metersPerPixel = Number.isFinite(zoom)
        ? getMetersPerPixelAtLatitude(map, latForScale, zoom)
        : null;
      const metersPerPixelForScaleBar = (Number.isFinite(metersPerPixel) && Number.isFinite(pxScale) && pxScale > 0)
        ? metersPerPixel / pxScale
        : metersPerPixel;
      const scaleDenominator = Number.isFinite(metersPerPixel)
        ? (metersPerPixel * 96) / 0.0254
        : null;
      const utm = Number.isFinite(center?.lat) && Number.isFinite(center?.lng)
        ? utmFromLatLng(center.lat, center.lng)
        : null;

      const formatDegrees = (value) => {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(6)}°`;
      };
      const formatZoom = (value) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(2);
      };
      const formatBearing = (value) => {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(1)}°`;
      };
      const formatPitch = (value) => {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(1)}°`;
      };
      const formatScale = (value) => {
        if (!Number.isFinite(value) || value <= 0) return '—';
        return `1 : ${Math.round(value).toLocaleString()}`;
      };
      const formatUTMLines = (value) => {
        if (!value) return ['—'];
        const { zoneNumber, zoneLetter, easting, northing } = value;
        if (!Number.isFinite(zoneNumber) || !zoneLetter) return ['—'];
        const east = Math.round(easting).toLocaleString();
        const north = Math.round(northing).toLocaleString();
        return [`Zone ${zoneNumber}${zoneLetter}`, `${east} mE`, `${north} mN`];
      };

      const drawCompass = (ctx, cx, cy, radius, bearingDeg) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#f1f5f9';
        ctx.font = `600 ${Math.round(radius * 0.75)}px "Inter", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -radius * 0.7);

        if (Number.isFinite(bearingDeg)) {
          ctx.rotate((-bearingDeg) * DEG_TO_RAD);
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(0, -radius * 0.78);
          ctx.lineTo(radius * 0.18, radius * 0.28);
          ctx.lineTo(0, radius * 0.08);
          ctx.lineTo(-radius * 0.18, radius * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(0, radius * 0.12);
          ctx.lineTo(radius * 0.1, radius * 0.44);
          ctx.lineTo(-radius * 0.1, radius * 0.44);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      };

      const drawPrintSidebar = () => {
        const sidebarWidth = sidebarWidthPx;
        const panelX = mapRenderWidth;
        const panelHeight = exportCanvas.height;
        const padding = Math.round(24 * pxScale);
        const textX = panelX + padding;
        const contentWidth = Math.max(60, sidebarWidth - padding * 2);
        const baseFont = '"Inter", "Segoe UI", "Helvetica Neue", sans-serif';
        const labelFontSize = Math.max(11, Math.round(12 * pxScale));
        const valueFontSize = Math.max(14, Math.round(16 * pxScale));
        const secondaryFontSize = Math.max(12, Math.round(14 * pxScale));
        const notesTitleFontSize = Math.max(13, Math.round(15 * pxScale));
        const labelFont = `600 ${labelFontSize}px ${baseFont}`;
        const valueFont = `500 ${valueFontSize}px ${baseFont}`;
        const smallValueFont = `500 ${secondaryFontSize}px ${baseFont}`;
        const notesFont = `600 ${notesTitleFontSize}px ${baseFont}`;
        const lineGap = Math.round(6 * pxScale);
        const blockGap = Math.round(14 * pxScale);
        const separatorHeight = Math.max(1, Math.round(pxScale));
        const separatorGap = Math.round(18 * pxScale);
        const notesLineGap = Math.round(32 * pxScale);
        const notesLineThickness = Math.max(1, Math.round(pxScale));
        const notesTitle = t('print.notesTitle', 'Notes');

        let cursorY = padding;

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(panelX, 0, sidebarWidth, panelHeight);
        if (panelX > 0) {
          const dividerWidth = Math.max(1, Math.round(pxScale));
          ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
          ctx.fillRect(panelX - dividerWidth, 0, dividerWidth, panelHeight);
        }
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = Math.max(1, Math.round(pxScale));
        ctx.strokeRect(panelX + ctx.lineWidth / 2, ctx.lineWidth / 2, sidebarWidth - ctx.lineWidth, panelHeight - ctx.lineWidth);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const wrapLines = (value, font) => {
          const rows = Array.isArray(value) ? value : [value ?? ''];
          const output = [];
          ctx.save();
          ctx.font = font;
          const measure = (text) => ctx.measureText(text).width;
          rows.forEach((row) => {
            const text = String(row ?? '');
            if (!text.trim()) {
              output.push('');
              return;
            }
            const words = text.split(/\s+/);
            let current = '';
            const pushCurrent = () => {
              if (current) {
                output.push(current);
                current = '';
              }
            };
            words.forEach((word) => {
              const candidate = current ? `${current} ${word}` : word;
              if (measure(candidate) <= contentWidth) {
                current = candidate;
              } else {
                pushCurrent();
                if (measure(word) <= contentWidth) {
                  current = word;
                } else {
                  let fragment = '';
                  for (const char of word) {
                    const next = fragment ? `${fragment}${char}` : char;
                    if (measure(next) > contentWidth && fragment) {
                      output.push(fragment);
                      fragment = char;
                    } else {
                      fragment = next;
                    }
                  }
                  if (fragment) {
                    output.push(fragment);
                    fragment = '';
                  }
                  current = '';
                }
              }
            });
            pushCurrent();
          });
          ctx.restore();
          return output.length ? output : [''];
        };

        const drawSeparator = () => {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
          ctx.fillRect(textX, cursorY, contentWidth, separatorHeight);
          cursorY += separatorHeight + separatorGap;
        };

        const drawLabelValueBlock = (label, value, { font = valueFont, fontSize = valueFontSize } = {}) => {
          ctx.font = labelFont;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(label.toUpperCase(), textX, cursorY);
          cursorY += labelFontSize + Math.round(4 * pxScale);
          const lines = wrapLines(value, font);
          ctx.font = font;
          ctx.fillStyle = '#0f172a';
          lines.forEach((line, idx) => {
            ctx.fillText(line, textX, cursorY);
            cursorY += fontSize + (idx === lines.length - 1 ? 0 : lineGap);
          });
          cursorY += blockGap;
        };

        const drawCompassSection = () => {
          const compassRadius = Math.min(contentWidth * 0.35, Math.max(40 * pxScale, Math.round(sidebarWidth * 0.16)));
          const compassCx = panelX + sidebarWidth / 2;
          const compassCy = cursorY + compassRadius;
          drawCompass(ctx, compassCx, compassCy, compassRadius, normalizedBearing);
          cursorY = compassCy + compassRadius + blockGap;
        };

        const drawInlineScaleBar = () => {
          if (!Number.isFinite(metersPerPixelForScaleBar) || metersPerPixelForScaleBar <= 0) return;
          ctx.font = labelFont;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('SCALE', textX, cursorY);
          cursorY += labelFontSize + Math.round(4 * pxScale);

          const maxBarWidthPx = contentWidth;
          const niceSteps = [1, 2, 5];
          let bestMeters = null;
          let bestWidthPx = 0;
          const targetMeters = metersPerPixelForScaleBar * maxBarWidthPx;
          for (let exp = -3; exp <= 6; exp++) {
            const base = Math.pow(10, exp);
            niceSteps.forEach((step) => {
              const lengthMeters = step * base;
              const widthPx = lengthMeters / metersPerPixelForScaleBar;
              if (widthPx <= maxBarWidthPx && widthPx > bestWidthPx) {
                bestWidthPx = widthPx;
                bestMeters = lengthMeters;
              }
            });
          }
          if (!bestMeters) {
            let minOverflow = Infinity;
            let minLength = null;
            for (let exp = -3; exp <= 6; exp++) {
              const base = Math.pow(10, exp);
              niceSteps.forEach((step) => {
                const lengthMeters = step * base;
                const widthPx = lengthMeters / metersPerPixelForScaleBar;
                if (widthPx > maxBarWidthPx && widthPx < minOverflow) {
                  minOverflow = widthPx;
                  minLength = lengthMeters;
                }
              });
            }
            bestMeters = minLength || targetMeters || 1000;
            bestWidthPx = bestMeters / metersPerPixelForScaleBar;
          }
          if (!Number.isFinite(bestMeters) || !Number.isFinite(bestWidthPx) || bestWidthPx <= 0) {
            cursorY += blockGap;
            return;
          }

          const barHeight = Math.max(10, Math.round(12 * pxScale));
          const segments = 4;
          const segmentWidth = bestWidthPx / segments;
          ctx.save();
          ctx.translate(textX, cursorY);
          for (let i = 0; i < segments; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#0f172a' : '#ffffff';
            ctx.fillRect(segmentWidth * i, 0, segmentWidth, barHeight);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = Math.max(1, Math.round(pxScale * 0.9));
            ctx.strokeRect(segmentWidth * i, 0, segmentWidth, barHeight);
          }
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(1, Math.round(pxScale));
          ctx.strokeRect(0, 0, bestWidthPx, barHeight);

          const useKilometers = bestMeters >= 1000;
          const unitLabel = useKilometers ? 'km' : 'm';
          const formatter = (meters) => {
            if (useKilometers) {
              const km = meters / 1000;
              return Math.abs(km - Math.round(km)) < 1e-6 ? `${Math.round(km)}` : km.toFixed(1);
            }
            return Math.round(meters).toLocaleString();
          };

          const labelOffset = Math.round(6 * pxScale);
          const labelY = barHeight + labelOffset;
          ctx.font = smallValueFont;
          ctx.fillStyle = '#0f172a';
          ctx.textBaseline = 'top';
          [
            { align: 'left', x: 0, value: 0 },
            { align: 'center', x: bestWidthPx / 2, value: bestMeters / 2 },
            { align: 'right', x: bestWidthPx, value: bestMeters }
          ].forEach(({ align, x, value }) => {
            ctx.textAlign = align;
            ctx.fillText(formatter(value), x, labelY);
          });

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(unitLabel.toUpperCase(), bestWidthPx + Math.round(10 * pxScale), barHeight / 2);
          ctx.restore();
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const totalHeight = barHeight + labelOffset + secondaryFontSize;
          cursorY += totalHeight + blockGap;
        };

        const drawNotesSection = () => {
          ctx.font = notesFont;
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(notesTitle, textX, cursorY);
          cursorY += notesTitleFontSize + Math.round(8 * pxScale);
          const lineCount = 4;
          for (let i = 0; i < lineCount; i++) {
            const lineY = cursorY + notesLineGap * i;
            ctx.fillStyle = '#cbd5f5';
            ctx.fillRect(textX, lineY, contentWidth, notesLineThickness);
          }
          cursorY += notesLineGap * lineCount;
        };

        drawCompassSection();
        drawLabelValueBlock('Heading', formatBearing(normalizedBearing));
        drawLabelValueBlock('Pitch', formatPitch(pitch));
        drawLabelValueBlock('Zoom', formatZoom(zoom));
        drawLabelValueBlock('Scale', formatScale(scaleDenominator));
        drawSeparator();
        const latLonLines = [`Lat ${formatDegrees(center?.lat)}`, `Lon ${formatDegrees(center?.lng)}`];
        drawLabelValueBlock('Lat / Lon', latLonLines, { font: smallValueFont, fontSize: secondaryFontSize });
        drawLabelValueBlock('UTM', formatUTMLines(utm), { font: smallValueFont, fontSize: secondaryFontSize });
        drawSeparator();
        drawInlineScaleBar();
        drawSeparator();
        drawNotesSection();

        ctx.restore();
      };

      drawPrintSidebar();

      let dataUrl = '';
      try {
        dataUrl = exportCanvas.toDataURL('image/png');
      } catch (err) {
        console.warn('exportCanvas.toDataURL failed', err);
        dataUrl = '';
      }
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Unable to capture map imagery');
      }

      const timestamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..+/, '');
      const defaultFileName = `map-snapshot-${timestamp}.png`;
      return {
        dataUrl,
        width: exportCanvas.width,
        height: exportCanvas.height,
        clientWidth: rect?.width || canvas.clientWidth || canvas.width,
        clientHeight: rect?.height || canvas.clientHeight || canvas.height,
        devicePixelRatio: dpr,
        defaultFileName,
        meta: {
          zoom,
          bearing: normalizedBearing,
          pitch,
          center: center ? { lat: center.lat, lng: center.lng } : null,
          styleUrl,
          utm,
          metersPerPixel,
          scaleDenominator,
          capturedAt: new Date().toISOString()
        }
      };
    };

    const showExportLoading = (labelKey, fallback) => {
      if (!exportLoadingModal) return;
      if (exportLoadingText) {
        exportLoadingText.textContent = t(labelKey, fallback);
      }
      exportLoadingModal.hidden = false;
    };

    const hideExportLoading = () => {
      if (exportLoadingModal) exportLoadingModal.hidden = true;
    };

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const handleSaveMapSnapshot = async () => {
      if (!toolPrint || toolPrint.disabled) return;
      toolPrint.disabled = true;
      try {
        const map = getMap();
        if (!map) {
          showToast(t('alerts.mapNotReady', 'Map is not ready yet.'), 'error', 2200);
          return;
        }
        showExportLoading('export.loadingSnapshot', 'Preparing snapshot export...');
        const [snapshot] = await Promise.all([
          captureMapSnapshot(),
          wait(1200)
        ]);
        if (!snapshot?.dataUrl) {
          showToast(t('alerts.snapshotUnavailable', 'Snapshot export is not available.'), 'error', 2600);
          return;
        }
        if (!window.mapTools || typeof window.mapTools.saveMapSnapshot !== 'function') {
          showToast(t('alerts.snapshotUnavailable', 'Snapshot export is not available.'), 'error', 2400);
          return;
        }
        const result = await window.mapTools.saveMapSnapshot(snapshot);
        if (!result) {
          showToast(t('alerts.snapshotFailed', 'Failed to save map snapshot.'), 'error', 2600);
          return;
        }
        if (result.ok) {
          showToast(t('alerts.snapshotSuccess', 'Map snapshot saved.'), 'success', 2000);
        } else if (result.canceled) {
          showToast(t('alerts.snapshotCancelled', 'Save cancelled.'), 'error', 2000);
        } else {
          const message = typeof result.error === 'string' && result.error.trim()
            ? result.error
            : t('alerts.snapshotFailed', 'Failed to save map snapshot.');
          showToast(message, 'error', 2600);
        }
      } catch (err) {
        console.error('handleSaveMapSnapshot failed', err);
        showToast(t('alerts.snapshotFailed', 'Failed to save map snapshot.'), 'error', 2600);
      } finally {
        hideExportLoading();
        toolPrint.disabled = false;
      }
    };

    toolPrint?.addEventListener('click', handleSaveMapSnapshot);

    const handleExportMapPdf = async () => {
      if (!toolExportPdf || toolExportPdf.disabled) return;
      toolExportPdf.disabled = true;
      try {
        const map = getMap();
        if (!map) {
          showToast(t('alerts.mapNotReady', 'Map is not ready yet.'), 'error', 2200);
          return;
        }
        showExportLoading('export.loadingPdf', 'Preparing PDF export...');
        const [snapshot] = await Promise.all([
          captureMapSnapshot(),
          wait(1200)
        ]);
        if (!snapshot?.dataUrl) {
          showToast(t('alerts.pdfUnavailable', 'PDF export is not available.'), 'error', 2600);
          return;
        }
        if (!window.mapTools || typeof window.mapTools.saveMapPdf !== 'function') {
          showToast(t('alerts.pdfUnavailable', 'PDF export is not available.'), 'error', 2400);
          return;
        }
        const defaultPdfName = typeof snapshot.defaultFileName === 'string'
          ? snapshot.defaultFileName.replace(/\.png$/i, '.pdf')
          : `map-snapshot-${new Date().toISOString().replace(/[:]/g, '').replace(/\..+/, '')}.pdf`;
        const result = await window.mapTools.saveMapPdf({
          ...snapshot,
          defaultFileName: defaultPdfName
        });
        if (!result) {
          showToast(t('alerts.pdfFailed', 'Failed to export map PDF.'), 'error', 2600);
          return;
        }
        if (result.ok) {
          showToast(t('alerts.pdfSuccess', 'Map PDF exported.'), 'success', 2000);
        } else if (result.canceled) {
          showToast(t('alerts.pdfCancelled', 'Export cancelled.'), 'error', 2000);
        } else {
          const message = typeof result.error === 'string' && result.error.trim()
            ? result.error
            : t('alerts.pdfFailed', 'Failed to export map PDF.');
          showToast(message, 'error', 2600);
        }
      } catch (err) {
        console.error('handleExportMapPdf failed', err);
        showToast(t('alerts.pdfFailed', 'Failed to export map PDF.'), 'error', 2600);
      } finally {
        hideExportLoading();
        toolExportPdf.disabled = false;
      }
    };

    toolExportPdf?.addEventListener('click', handleExportMapPdf);

    // Legacy prompt search removed; using modal + Places API (New) instead
    // Search modal open
    function openSearchModal(){
      if (!searchModal || !googleServicesEnabled) return;
      searchModal.hidden = false;
      if (searchResults) searchResults.innerHTML = '';
      if (searchQuery) { searchQuery.value = ''; setTimeout(() => searchQuery.focus(), 0); }
    }
    function closeSearchModal(){ if (searchModal) searchModal.hidden = true; }
    toolSearch?.addEventListener('click', openSearchModal);
    searchClose?.addEventListener('click', closeSearchModal);
    searchModal?.addEventListener('click', (e) => {
      const t = e.target; if (t && t.dataset && t.dataset.action === 'close') closeSearchModal();
    });
    searchModal?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSearchModal();
        e.stopPropagation();
      }
    });

    // Go To coordinates modal
    function openGotoModal(){
      if (!gotoModal) return;
      gotoModal.hidden = false;
      refreshGotoFormForSystem(true);
      syncGotoPoiControls();
    }
    function closeGotoModal(){ if (gotoModal) gotoModal.hidden = true; }
    toolGoTo?.addEventListener('click', openGotoModal);
    gotoClose?.addEventListener('click', closeGotoModal);
    gotoModal?.addEventListener('click', (e) => { const t=e.target; if (t && t.dataset && t.dataset.action==='close') closeGotoModal(); });
    gotoModal?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeGotoModal();
        e.stopPropagation();
      }
    });
    gotoAddPoi?.addEventListener('change', () => {
      const shouldFocus = !!gotoAddPoi.checked;
      syncGotoPoiControls(shouldFocus);
    });
    syncGotoPoiControls();

    const openShortcutsModal = () => {
      if (!shortcutsModal) return;
      renderShortcutsList();
      shortcutsModal.hidden = false;
      shortcutsModal.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        try { shortcutsClose?.focus(); }
        catch (err) { console.warn('focus shortcutsClose failed', err); }
      }, 0);
    };
    const closeShortcutsModal = () => {
      if (!shortcutsModal || shortcutsModal.hidden) return;
      shortcutsModal.hidden = true;
      shortcutsModal.setAttribute('aria-hidden', 'true');
    };

    const performGoto = async () => {
      try{
        const map = (window)._map; if (!map) return;
        let targetLat = null;
        let targetLng = null;
        const system = (currentCoordinateSystem || '').toLowerCase();
        if (system === 'utm') {
          const zoneParsed = parseUtmZoneInput(gotoUtmZone?.value);
          const easting = Number(gotoUtmEasting?.value);
          const northing = Number(gotoUtmNorthing?.value);
          if (!zoneParsed || !Number.isFinite(easting) || !Number.isFinite(northing)) {
            alert(t('alerts.invalidCoords', 'Please enter valid coordinates.'));
            if (!zoneParsed) gotoUtmZone?.focus();
            else if (!Number.isFinite(easting)) gotoUtmEasting?.focus();
            else gotoUtmNorthing?.focus();
            return;
          }
          const latLng = latLngFromUtm({ ...zoneParsed, easting, northing });
          if (!latLng || !Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)) {
            alert(t('alerts.invalidCoords', 'Please enter valid coordinates.'));
            gotoUtmZone?.focus();
            return;
          }
          targetLat = latLng.lat;
          targetLng = latLng.lng;
        } else if (system === 'gk') {
          const zoneNumber = Number(gotoGkZone?.value);
          const easting = Number(gotoGkEasting?.value);
          const northing = Number(gotoGkNorthing?.value);
          const zoneValid = Number.isInteger(zoneNumber) && zoneNumber >= 1 && zoneNumber <= 60;
          if (!zoneValid || !Number.isFinite(easting) || !Number.isFinite(northing)) {
            alert(t('alerts.invalidCoords', 'Please enter valid coordinates.'));
            if (!zoneValid) gotoGkZone?.focus();
            else if (!Number.isFinite(easting)) gotoGkEasting?.focus();
            else gotoGkNorthing?.focus();
            return;
          }
          const latLng = latLngFromGaussKrueger({ zoneNumber, easting, northing });
          if (!latLng || !Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)) {
            alert(t('alerts.invalidCoords', 'Please enter valid coordinates.'));
            gotoGkZone?.focus();
            return;
          }
          targetLat = latLng.lat;
          targetLng = latLng.lng;
        } else {
          const lng = Number(gotoLng?.value);
          const lat = Number(gotoLat?.value);
          if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            alert(t('alerts.invalidCoords', 'Please enter valid coordinates.'));
            return;
          }
          targetLat = lat;
          targetLng = lng;
        }
        map.flyTo({ center: [targetLng, targetLat], zoom: Math.max(14, map.getZoom() || 14), duration: 600 });
        if (gotoAddPoi && gotoAddPoi.checked) {
          try {
            const ds = (window)._drawStore || drawStore;
            const poi = { type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:[targetLng, targetLat] } };
            const name = (gotoPoiName?.value || '').trim();
            if (name) poi.properties.name = name;
            const af = (typeof annotateFeature === 'function') ? annotateFeature : (f)=>f;
            ds.features.push(af(poi, 'poi'));
            setDirty(true);
            if (typeof (window)._refreshDraw === 'function') (window)._refreshDraw(); else refreshDraw();
          } catch (err) { console.error('Add POI failed', err); }
        }
        closeGotoModal();
      } catch (err) {
        console.error('performGoto failed', err);
      }
    };
    gotoSubmit?.addEventListener('click', performGoto);
    // Allow Enter key to submit from either field
    gotoLat?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performGoto(); } });
    gotoLng?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performGoto(); } });
    [gotoUtmZone, gotoUtmEasting, gotoUtmNorthing, gotoGkZone, gotoGkEasting, gotoGkNorthing].forEach((input) => {
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); performGoto(); }
      });
    });

    toolShortcuts?.addEventListener('click', openShortcutsModal);
    shortcutsClose?.addEventListener('click', closeShortcutsModal);
    shortcutsModal?.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.action === 'close') {
        closeShortcutsModal();
      }
    });
    shortcutsModal?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeShortcutsModal();
        e.stopPropagation();
      }
    });

    const TYPING_INPUT_TYPES = new Set(['text','search','email','url','tel','number','password','date','time','datetime-local','month','week','color']);
    const MAP_PAN_STEP = 160;
    const isTypingTarget = (target) => {
      if (!target) return false;
      if (target.isContentEditable) return true;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'select') return true;
      if (tag === 'input') {
        const type = (target.type || '').toLowerCase();
        return TYPING_INPUT_TYPES.has(type);
      }
      return false;
    };

    const toggleToolShortcut = (tool) => {
      if (typeof (window).setActiveTool !== 'function') return;
      const current = (window)._currentTool;
      if (current === tool) {
        if (tool === 'line' && (window)._lineInProgress) return;
        (window).setActiveTool(null);
      } else {
        if (tool === 'arrow') window._cleanupArrowInteraction?.();
        (window).setActiveTool(tool);
      }
    };

    const panMapBy = (dx, dy) => {
      try {
        const map = getMap();
        if (!map) return;
        map.panBy([dx, dy], { duration: 180, easing: (t) => 1 - Math.pow(1 - t, 2) });
      } catch (err) {
        console.warn('panMapBy failed', err);
      }
    };

    const toggleFeaturesSidebarViaShortcut = () => {
      const isOpen = !featuresSidebar?.hidden;
      if (isOpen) {
        featuresCollapse?.click();
      } else {
        featuresToggleBtn?.click();
      }
    };

    const toggleTrackersSidebarViaShortcut = () => {
      const isOpen = !trackersSidebar?.hidden;
      if (isOpen) {
        trackersCollapse?.click();
      } else {
        trackersToggleBtn?.click();
      }
    };

    const handleKeyboardShortcuts = (event) => {
      if (!tabMapInput?.checked) return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key;
      if (shortcutsModal && shortcutsModal.hidden === false) {
        closeShortcutsModal();
      }
      switch (key) {
        case '1': toggleToolShortcut('rect'); event.preventDefault(); return;
        case '2': toggleToolShortcut('poly'); event.preventDefault(); return;
        case '3': toggleToolShortcut('circle'); event.preventDefault(); return;
        case '4': toggleToolShortcut('line'); event.preventDefault(); return;
        case '5': toggleToolShortcut('arrow'); event.preventDefault(); return;
        case '6': toggleToolShortcut('poi'); event.preventDefault(); return;
        case '8': toggleToolShortcut('crosshair'); event.preventDefault(); return;
        case '9':
          openScaleDialog();
          event.preventDefault();
          return;
        case 'ArrowUp':
          panMapBy(0, -MAP_PAN_STEP);
          event.preventDefault();
          return;
        case 'ArrowDown':
          panMapBy(0, MAP_PAN_STEP);
          event.preventDefault();
          return;
        case 'ArrowLeft':
          panMapBy(-MAP_PAN_STEP, 0);
          event.preventDefault();
          return;
        case 'ArrowRight':
          panMapBy(MAP_PAN_STEP, 0);
          event.preventDefault();
          return;
        case '+':
          toolZoomIn?.click();
          event.preventDefault();
          return;
        case '=':
          if (event.shiftKey) {
            toolZoomIn?.click();
            event.preventDefault();
            return;
          }
          break;
        case '-':
        case '_':
          toolZoomOut?.click();
          event.preventDefault();
          return;
        case 'F':
        case 'f':
          toggleFeaturesSidebarViaShortcut();
          event.preventDefault();
          return;
        case 'E':
        case 'e':
          toggleToolShortcut('edit');
          event.preventDefault();
          return;
        case 'T':
        case 't':
          toggleTrackersSidebarViaShortcut();
          event.preventDefault();
          return;
        case 'G':
        case 'g':
          cycleGridOverlay();
          event.preventDefault();
          return;
        case 'C':
        case 'c':
          openGotoModal();
          event.preventDefault();
          return;
        case 'S':
        case 's':
          toolSearch?.click();
          event.preventDefault();
          return;
        case 'P':
        case 'p':
          handleSaveMapSnapshot();
          event.preventDefault();
          return;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Clicking the LAT/LONG in footer opens the same Go To dialog
    try {
      if (statCenter) {
        statCenter.style.cursor = 'pointer';
        statCenter.dataset.i18nTitle = 'messages.clickToEnterCoordinates';
        statCenter.title = t('messages.clickToEnterCoordinates', 'Click to enter coordinates');
        statCenter.addEventListener('click', openGotoModal);
      }
    } catch {}

    try {
      if (statScale) {
        statScale.style.cursor = 'pointer';
        statScale.dataset.i18nTitle = 'messages.clickToSetScale';
        statScale.title = t('messages.clickToSetScale', 'Click to set scale');
        statScale.addEventListener('click', openScaleDialog);
      }
    } catch {}

    if (footerAddress) {
      footerAddress.style.cursor = 'pointer';
      footerAddress.dataset.i18nTitle = 'messages.clickToCopyAddress';
      footerAddress.title = t('messages.clickToCopyAddress', 'Click to copy address');
      footerAddress.addEventListener('click', async () => {
        try {
          const addr = (footerAddress.textContent || '').trim() || lastKnownAddress || '';
          const lat = Number(lastKnownCenter?.lat);
          const lng = Number(lastKnownCenter?.lng);
          const latStr = Number.isFinite(lat) ? lat.toFixed(6) : '—';
          const lngStr = Number.isFinite(lng) ? lng.toFixed(6) : '—';
          const text = addr ? `${addr}, LAT ${latStr}, LONG ${lngStr}` : `LAT ${latStr}, LONG ${lngStr}`;
          const ok = await writeToClipboard(text);
          if (!ok) throw new Error('clipboard unavailable');
          footerAddress.classList.add('copied');
          setTimeout(() => footerAddress.classList.remove('copied'), 1200);
          showToast(t('messages.addressCopied', 'Address copied to clipboard'));
        } catch (err) {
          console.error('Copy address failed', err);
          showToast(t('messages.copyFailed', 'Copy failed'), 'error');
        }
      });
    }

    const renderSearchMessage = (key, fallback) => {
      if (!searchResults) return;
      searchResults.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'muted';
      bindText(msg, key, fallback);
      searchResults.appendChild(msg);
    };

    // Live search with debounce
    let searchTimer = null;
    async function performSearch(qstr){
      if (!googleServicesEnabled || !searchResults) return;
      const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
      if (!key) { renderSearchMessage('searchModal.setGoogleKey', 'Set Google API key in Settings.'); return; }
      if (!qstr || qstr.trim().length < 3) { renderSearchMessage('searchModal.typeHint', 'Type at least 3 characters…'); return; }
      renderSearchMessage('searchModal.searching', 'Searching…');
      try{
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
          },
          body: JSON.stringify({ textQuery: qstr })
        });
        const data = await resp.json();
        const items = Array.isArray(data.places) ? data.places : [];
        if (!items.length) { renderSearchMessage('searchModal.noResults', 'No results'); return; }
        searchResults.innerHTML = '';
        items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'search-item'; row.setAttribute('role','option');
          const title = document.createElement('div'); title.className = 'search-title'; title.textContent = it.displayName?.text || it.formattedAddress || qstr;
          const sub = document.createElement('div'); sub.className = 'search-sub'; sub.textContent = it.formattedAddress || '';
          row.appendChild(title); row.appendChild(sub);
          row.addEventListener('click', () => {
            try{
              const loc = it.location;
              if (loc && (window)._map) { (window)._map.flyTo({ center: [loc.longitude, loc.latitude], zoom: Math.max(12, (window)._map.getZoom() || 12) }); }
              closeSearchModal();
            }catch{}
          });
          searchResults.appendChild(row);
        });
      }catch(e){
        console.error(e);
        renderSearchMessage('searchModal.searchFailed', 'Search failed');
      }
    }
    searchQuery?.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer);
      const val = searchQuery.value;
      searchTimer = setTimeout(() => performSearch(val), 250);
    });

    // View controls
    
    toolZoomIn?.addEventListener('click', () => { try { const m=getMap(); if (!m) return; const around = visibleCenter() || m.getCenter(); m.zoomIn({ duration: 300, around }); } catch {} });
    toolZoomOut?.addEventListener('click', () => { try { const m=getMap(); if (!m) return; const around = visibleCenter() || m.getCenter(); m.zoomOut({ duration: 300, around }); } catch {} });
    toolResetView?.addEventListener('click', () => {
      const m = getMap(); if (!m) return;
      try { m.easeTo({ bearing: 0, pitch: 0, duration: 400 }); } catch {}
    });
  })();

  const closeAnyOpenModal = () => {
    if (aiModal && aiModal.hidden === false) {
      closeAiModal();
      return true;
    }
    if (colorModal && colorModal.hidden === false) {
      closeColorModal();
      return true;
    }
    if (poiIconModal && poiIconModal.hidden === false) {
      closePoiIconModal();
      return true;
    }
    if (teamMemberModal && teamMemberModal.hidden === false) {
      closeTeamMemberModal();
      return true;
    }
    if (teamsStartSessionModal && teamsStartSessionModal.hidden === false) {
      closeTeamsStartSessionModal();
      return true;
    }
    if (teamsResumeSessionModal && teamsResumeSessionModal.hidden === false) {
      closeTeamsResumeSessionModal();
      return true;
    }
    if (teamsSessionActionsModal && teamsSessionActionsModal.hidden === false) {
      closeTeamsSessionActionsModal();
      return true;
    }
    if (firebaseAdminClearSessionsModal && firebaseAdminClearSessionsModal.hidden === false) {
      closeFirebaseAdminClearSessionsModal();
      return true;
    }
    if (firebaseAdminClearAnonymousUsersModal && firebaseAdminClearAnonymousUsersModal.hidden === false) {
      closeFirebaseAdminClearAnonymousUsersModal();
      return true;
    }
    if (searchModal && searchModal.hidden === false) {
      closeSearchModal();
      return true;
    }
    if (gotoModal && gotoModal.hidden === false) {
      closeGotoModal();
      return true;
    }
    return false;
  };

  // Global ESC handler: close modals first; else exit active tool and cancel any drafts
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeAnyOpenModal()) {
      e.preventDefault();
      return;
    }
    const target = e.target;
    // Ignore when typing in inputs or contenteditable
    if (target && (target.closest && target.closest('input, textarea, select')))
      return;
    if (target && (target.isContentEditable || (target.closest && target.closest('[contenteditable="true"]'))))
      return;
    try { (window).setActiveTool && (window).setActiveTool(null); } catch {}
    try { (window).abortActiveTool && (window).abortActiveTool(); } catch {}
    try {
      const m = getMap();
      if (m) m.easeTo({ bearing: 0, pitch: 0, duration: 350 });
    } catch {}
  });

  // --- Edit vertices interactions ---
  (function initEditInteractions(){
    let dragging = null; // { fid, idx }
    const getM = () => (window)._map;
    const toLngLatFromEvent = (ev) => {
      const m = getM(); if (!m) return null;
      // Mapbox event: has lngLat or point
      if (ev && ev.lngLat) return ev.lngLat;
      if (ev && ev.point && Number.isFinite(ev.point.x) && Number.isFinite(ev.point.y)) {
        return m.unproject([ev.point.x, ev.point.y]);
      }
      // DOM event: convert viewport coords to container-relative coords
      const oe = ev && (ev.originalEvent || ev);
      const canvas = m.getCanvas();
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      let x = null, y = null;
      if (oe && oe.touches && oe.touches[0]) {
        x = oe.touches[0].clientX - rect.left;
        y = oe.touches[0].clientY - rect.top;
      } else if (oe && (oe.clientX != null) && (oe.clientY != null)) {
        x = oe.clientX - rect.left;
        y = oe.clientY - rect.top;
      }
      if (x == null || y == null) return null;
      return m.unproject([x, y]);
    };
    let rafPending = false; let lastEvt = null;
    const applyFrom = (evt) => {
      if (!dragging || !(window)._editTarget) return;
      const m = getM(); if (!m) return;
      const lngLat = toLngLatFromEvent(evt);
      if (!lngLat) return;
      const { lng, lat } = lngLat;
      const ds = (window)._drawStore; if (!ds) return;
      const f = ds.features.find(x => x.properties?.id === dragging.fid);
      if (!f || !f.geometry) return;
      if (f.geometry.type === 'Polygon') {
        const ring = f.geometry.coordinates && f.geometry.coordinates[0];
        if (!Array.isArray(ring)) return;
        const i = dragging.idx;
        if (!Number.isInteger(i) || i < 0 || i >= ring.length - 1) return;
        ring[i] = [lng, lat];
        ring[ring.length - 1] = ring[0]; // keep closed
      } else if (f.geometry.type === 'LineString') {
        const coords = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
        if (!coords) return;
        const i = dragging.idx;
        if (!Number.isInteger(i) || i < 0 || i >= coords.length) return;
        coords[i] = [lng, lat];
        syncLineEndpoints(f);
      } else {
        return;
      }
      try { const src = m.getSource('draw'); if (src) src.setData(ds); } catch {}
      try { (window)._refreshEditVerts && (window)._refreshEditVerts(); } catch {}
    };
    const onMove = (e) => {
      if (!dragging || !(window)._editTarget) return;
      lastEvt = e;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => { rafPending = false; applyFrom(lastEvt); });
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = null;
      try {
        const m = getM(); if (!m) return;
        m.getCanvas().style.cursor = '';
        m.dragPan.enable();
        (window)._editVertexDragging = false;
        m.off('mousemove', onMove);
        m.off('mouseup', onUp);
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onUp, true);
        document.removeEventListener('touchmove', onMove, { capture:true });
        document.removeEventListener('touchend', onUp, { capture:true });
      } catch {}
      try { (window)._refreshDraw && (window)._refreshDraw(); } catch {}
      try { if ((window)._currentTool === 'edit') { setDirty(true); notifyFeatureModified('Feature updated'); } } catch {}
    };
    // Begin drag helpers
    const beginDrag = () => {
      try {
        const m = getM(); if (!m) return;
        m.getCanvas().style.cursor = 'grabbing';
        m.dragPan.disable();
        (window)._editVertexDragging = true;
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
        document.addEventListener('touchmove', onMove, { capture:true, passive:false });
        document.addEventListener('touchend', onUp, { capture:true });
      } catch {}
    };
    const onDown = (e) => {
      if (!(window)._editTarget) return;
      const feat = e.features && e.features[0];
      if (!feat) return;
      if (e.originalEvent && 'button' in e.originalEvent && e.originalEvent.button !== 0) return; // left click only
      dragging = { fid: feat.properties?.fid, idx: Number(feat.properties?.idx), geomType: feat.properties?.geomType || null };
      beginDrag();
      e.preventDefault();
    };
    // Provide a binder we can call once the map exists
    (window)._bindEditInteractions = (function(){
      let bound = false;
      return function bind(){
        if (bound) return;
        const m = getM(); if (!m) return;
        try{
          // Global mousedown fallback using hit-test to find a vertex under pointer
          m.on('mousedown', (e) => {
            if (!(window)._editTarget) return;
            try{
              const feats = m.queryRenderedFeatures(e.point, { layers: ['edit-verts'] });
              if (feats && feats[0]) { onDown({ ...e, features:[feats[0]], originalEvent: e.originalEvent }); }
            }catch{}
          });
          // Layer-specific events (attach now; Mapbox allows binding before layer exists)
          m.on('mousedown', 'edit-verts', onDown);
          m.on('touchstart', 'edit-verts', onDown, { passive:false });
          const handleMidEvent = (feat, originalEvent) => {
            if (!feat) return;
            const fid = feat.properties?.fid;
            const after = Number(feat.properties?.insAfter);
            const geomType = feat.properties?.geomType || null;
            const ds = (window)._drawStore; if (!ds) return;
            const f = ds.features.find(x => x.properties?.id === fid);
            if (!f || !f.geometry) return;
            const coord = feat.geometry && feat.geometry.coordinates; if (!coord) return;
            if (geomType === 'Polygon' && f.geometry.type === 'Polygon') {
              const ring = f.geometry.coordinates && f.geometry.coordinates[0];
              if (!Array.isArray(ring) || after < 0 || after >= ring.length - 1) return;
              ring.splice(after + 1, 0, [coord[0], coord[1]]);
              ring[ring.length - 1] = ring[0];
              try { const src = m.getSource('draw'); if (src) src.setData(ds); } catch {}
              try { (window)._refreshEditVerts && (window)._refreshEditVerts(); } catch {}
              dragging = { fid, idx: after + 1, geomType: 'Polygon' };
              beginDrag();
              originalEvent?.preventDefault?.();
            } else if (geomType === 'LineString' && f.geometry.type === 'LineString') {
              const coords = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
              if (!coords || after < 0 || after >= coords.length - 1) return;
              coords.splice(after + 1, 0, [coord[0], coord[1]]);
              syncLineEndpoints(f);
              try { const src = m.getSource('draw'); if (src) src.setData(ds); } catch {}
              try { (window)._refreshEditVerts && (window)._refreshEditVerts(); } catch {}
              dragging = { fid, idx: after + 1, geomType: 'LineString' };
              beginDrag();
              originalEvent?.preventDefault?.();
            }
          };
          m.on('mousedown', 'edit-mid', (e) => {
            if (!(window)._editTarget) return;
            const feat = e.features && e.features[0];
            handleMidEvent(feat, e);
          });
          m.on('touchstart', 'edit-mid', (e) => {
            if (!(window)._editTarget) return;
            const feat = e.features && e.features[0];
            handleMidEvent(feat, e);
          }, { passive:false });
          m.on('mouseenter', 'edit-verts', () => { if ((window)._editTarget) m.getCanvas().style.cursor = 'grab'; });
          m.on('mouseleave', 'edit-verts', () => { if ((window)._editTarget && !dragging) m.getCanvas().style.cursor = ''; });
          bound = true;
        } catch {}
      };
    })();
    try { (window)._bindEditInteractions(); } catch {}
  })();

})();
