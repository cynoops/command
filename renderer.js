(() => {
  const q = (sel) => document.querySelector(sel);
  const ce = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };
  const DEFAULT_HOME_CENTER = [6.3729914, 49.5658574];
  const DEFAULT_MAP_START = [6.13, 49.61];
  const DEFAULT_STYLE_URL = 'mapbox://styles/mapbox/outdoors-v12';
  const DEFAULT_START_ZOOM = 12;
  const DEFAULT_SERIAL_BAUD = '115200';
  const DEFAULT_AUTO_RECONNECT = 'on';
  const DEFAULT_APP_LANGUAGE = 'en';
  const LANGUAGE_CODES = ['en','de','fr','es','it'];
  const LANGUAGE_LABELS = {
    en: { en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian' },
    de: { en: 'Englisch', de: 'Deutsch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch' },
    fr: { en: 'Anglais', de: 'Allemand', fr: 'Français', es: 'Espagnol', it: 'Italien' },
    es: { en: 'Inglés', de: 'Alemán', fr: 'Francés', es: 'Español', it: 'Italiano' },
    it: { en: 'Inglese', de: 'Tedesco', fr: 'Francese', es: 'Spagnolo', it: 'Italiano' },
  };
  const DRAWING_ICON_PATHS = {
    edit: './assets/icons/regular/pencil-simple.svg',
    hide: './assets/icons/regular/eye.svg',
    show: './assets/icons/regular/eye-slash.svg',
    ai: './assets/icons/regular/sparkle.svg',
    delete: './assets/icons/regular/x.svg'
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

  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;
  const clampLatForMercator = (lat) => Math.max(Math.min(lat, 89.999999), -89.999999);
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
      if (shortcutsList) {
        try { renderShortcutsList(); }
        catch (err) { console.error('renderShortcutsList failed', err); }
      }
      // Update elements that rely on translateString fallback (e.g., dynamic text) by re-triggering manual updates if needed.
    } catch (err) {
      console.error('applyTranslations error', err);
    }
  };
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
  const serialConnectBtn = q('#serialConnectBtn');
  const serialStatusDot = q('#serialStatusDot');
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

  const connectModal = q('#connectModal');
  const portsContainer = q('#portsContainer');
  const connectClose = q('#connectClose');
  const refreshPorts = q('#refreshPorts');
  const connectBtnAction = q('#connectBtnAction');
  const connectBaud = q('#connectBaud');

  // New serial monitor modal
  const serialMonitorBtn = q('#serialMonitorBtn');
  const languageDropdown = q('#languageDropdown');
  const languageToggle = q('#languageToggle');
  const languageMenu = q('#languageMenu');
  const serialMonitorModal = q('#serialMonitorModal');
  const serialMonitorClose = q('#serialMonitorClose');
  const serialMonitorBody = q('#serialMonitorBody');
  const serialConnPath = q('#serialConnPath');
  const serialDisconnectBtn = q('#serialDisconnectBtn');
  const serialMonitorClearBtn = q('#serialMonitorClear');
  const toolRect = q('#toolRect');
  const toolPoly = q('#toolPoly');
  const toolCircle = q('#toolCircle');
  const toolLine = q('#toolLine');
  const toolArrow = q('#toolArrow');
  const toolPOI = q('#toolPOI');
  const toolWeather = q('#toolWeather');
  const toolCrosshair = q('#toolCrosshair');
  const toolSetScale = q('#toolSetScale');
  const toolPrint = q('#toolPrint');
  const toolPushLive = q('#toolPushLive');
  const toolPushLiveDivider = q('#toolPushLiveDivider');
  const toolShortcuts = q('#toolShortcuts');
  const mapUtilityToolbar = q('#mapUtilityToolbar');
  const mapUtilityButtons = mapUtilityToolbar ? Array.from(mapUtilityToolbar.querySelectorAll('.map-utility-btn')) : [];
  const weatherUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'cloud-sun');
  const satelliteUtilityBtn = mapUtilityButtons.find((btn) => btn?.dataset?.tool === 'satellite');
  const mapCrosshair = q('#mapCrosshair');
  const toolSearch = q('#toolSearch');
  const toolGoTo = q('#toolGoTo');
  const drawingsList = q('#drawingsList');
  const featuresActions = q('#featuresActions');
  const featuresLabelsToggle = q('#featuresLabelsToggle');
  const featuresActionsToggleBtn = q('#featuresActionsToggle');
  const featuresActionsMenu = q('#featuresActionsMenu');
  const featuresSaveBtn = q('#featuresSaveBtn');
  const featuresLoadBtn = q('#featuresLoadBtn');
  const featuresClearBtn = q('#featuresClearBtn');
  const toolPin = q('#toolPin');
  const settingLanguage = q('#settingLanguage');
  const settingHomeAddress = q('#settingHomeAddress');
  const settingAccessToken = q('#settingAccessToken');
  const settingGoogleKey = q('#settingGoogleKey');
  const settingOpenAIKey = q('#settingOpenAIKey');
  const settingCynoopsLiveKey = q('#settingCynoopsLiveKey');
  const settingStyleUrl = q('#settingStyleUrl');
  const settingSatelliteStyleUrl = q('#settingSatelliteStyleUrl');
  const settingStartLng = q('#settingStartLng');
  const settingStartLat = q('#settingStartLat');
  const settingStartZoom = q('#settingStartZoom');
  const settingBaud = q('#settingBaud');
  const settingAutoReconnect = q('#settingAutoReconnect');
  const settingsForm = q('#settingsForm');
  const settingsSaveBtn = q('#settingsSaveBtn');
  const settingsStatus = q('.settings-status');
  const defaultAccessToken = settingAccessToken?.defaultValue || '';
  const defaultGoogleKey = settingGoogleKey?.defaultValue || '';
  const defaultOpenAIKey = settingOpenAIKey?.defaultValue || '';
  const defaultCynoopsLiveKey = settingCynoopsLiveKey?.defaultValue || '';
  const DEFAULT_SATELLITE_STYLE_URL = 'mapbox://styles/mapbox/standard-satellite';
  let satelliteStyleActive = localStorage.getItem('map.satelliteEnabled') === '1';
  const defaultStyleUrl = settingStyleUrl?.defaultValue || DEFAULT_STYLE_URL;
  const defaultSatelliteStyleUrl = settingSatelliteStyleUrl?.defaultValue || DEFAULT_SATELLITE_STYLE_URL;
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
  const TOOL_CURSOR_SET = new Set(['rect', 'poly', 'circle', 'line', 'arrow', 'poi', 'weather', 'crosshair']);
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
    const shouldCrosshair = TOOL_CURSOR_SET.has(tool) || weatherOverlayActive;
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
    const stored = localStorage.getItem('map.styleUrl');
    const fallback = defaultStyleUrl || DEFAULT_STYLE_URL;
    const value = (typeof stored === 'string' && stored.trim()) ? stored.trim() : (fallback || DEFAULT_STYLE_URL);
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
  const getTargetMapStyleUrl = () => (satelliteStyleActive ? getSatelliteMapStyleUrl() : getBaseMapStyleUrl());
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
  const setSatelliteButtonState = (active) => {
    if (!satelliteUtilityBtn) return;
    satelliteUtilityBtn.classList.toggle('is-active', !!active);
    satelliteUtilityBtn.setAttribute('aria-pressed', String(!!active));
  };
  setSatelliteButtonState(satelliteStyleActive);
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
      [toolRect, 'toolbar.drawRectangle'],
      [toolPoly, 'toolbar.drawPolygon'],
      [toolCircle, 'toolbar.drawCircle'],
      [toolLine, 'toolbar.drawLine'],
      [toolArrow, 'toolbar.drawArrow'],
      [toolPOI, 'toolbar.addPoi'],
      [toolWeather, 'map.utilities.weather'],
      [toolCrosshair, 'toolbar.showCoordinates'],
      [toolSetScale, 'toolbar.setScale'],
      [toolPrint, 'toolbar.saveSnapshot'],
      [toolPushLive, 'toolbar.pushLiveUpdates'],
      [toolShortcuts, 'toolbar.shortcuts']
    ];
    toolbarBindings.forEach(([btn, key]) => {
      bindAttrAuto(btn, 'title', key);
      bindAttrAuto(btn, 'aria-label', key);
      bindAttrAuto(btn, 'data-tooltip', key);
    });

    bindAttrAuto(serialConnectBtn, 'title', 'serial.connectAria');
    bindAttrAuto(serialConnectBtn, 'aria-label', 'serial.connectAria');
    bindAttrAuto(serialMonitorBtn, 'title', 'serial.openMonitorAria');
    bindAttrAuto(serialMonitorBtn, 'aria-label', 'serial.openMonitorAria');
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
    bindTextAuto(trackersEmpty?.querySelector('div'), 'trackers.empty');
    bindTextAuto(trackersConnectBtn?.querySelector('span'), 'trackers.connect');
    bindTextAuto(trackersWaiting?.querySelector('span:last-child'), 'trackers.waiting');
    bindTextAuto(document.getElementById('trackersRecordText'), 'trackers.record');
    bindTextAuto(trackersMenuToggle?.querySelector('.visually-hidden'), 'trackers.openMenu');
    bindTextAuto(trackersSaveBtn?.querySelector('span'), 'trackers.save');
    bindTextAuto(trackersOpenBtn?.querySelector('span'), 'trackers.open');

    bindTextAuto(document.querySelector('.settings-panel h2'), 'settings.title');
    const settingsGroupHeadings = document.querySelectorAll('.settings-group h3');
    if (settingsGroupHeadings?.[0]) bindTextAuto(settingsGroupHeadings[0], 'settings.section.general');
    if (settingsGroupHeadings?.[1]) bindTextAuto(settingsGroupHeadings[1], 'settings.section.apiKeys');
    if (settingsGroupHeadings?.[2]) bindTextAuto(settingsGroupHeadings[2], 'settings.section.map');
    if (settingsGroupHeadings?.[3]) bindTextAuto(settingsGroupHeadings[3], 'settings.section.serial');

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
    bindText(labelOf(settingCynoopsLiveKey), 'settings.cynoopsLiveKey', labelOf(settingCynoopsLiveKey)?.textContent || 'CYNOOPS Live API Key');
    const cynoopsHelp = helpOf(settingCynoopsLiveKey);
    bindAttr(cynoopsHelp, 'aria-label', 'settings.cynoopsLiveKey.help', cynoopsHelp?.getAttribute('aria-label') || '');
    bindAttr(cynoopsHelp, 'data-tooltip', 'settings.cynoopsLiveKey.help', cynoopsHelp?.getAttribute('data-tooltip') || '');
    bindText(labelOf(settingStyleUrl), 'settings.mapStyleUrl', labelOf(settingStyleUrl)?.textContent || 'Map Style URL');
    bindText(labelOf(settingSatelliteStyleUrl), 'settings.satelliteStyleUrl', labelOf(settingSatelliteStyleUrl)?.textContent || 'Satellite Map Style URL');
    bindText(labelOf(settingHomeAddress), 'settings.homeAddress', labelOf(settingHomeAddress)?.textContent || 'Home Address');
    bindText(labelOf(settingStartLat), 'settings.startLatitude', labelOf(settingStartLat)?.textContent || 'Start Latitude');
    bindText(labelOf(settingStartLng), 'settings.startLongitude', labelOf(settingStartLng)?.textContent || 'Start Longitude');
    bindText(labelOf(settingStartZoom), 'settings.startZoom', labelOf(settingStartZoom)?.textContent || 'Start Zoom');
    bindText(labelOf(settingBaud), 'settings.serialBaud', labelOf(settingBaud)?.textContent || 'Serial Baud Rate');
    bindText(labelOf(settingAutoReconnect), 'settings.autoReconnect', labelOf(settingAutoReconnect)?.textContent || 'Auto-reconnect Serial');
    const autoReconnectOff = settingAutoReconnect?.querySelector('option[value="off"]');
    const autoReconnectOn = settingAutoReconnect?.querySelector('option[value="on"]');
    bindTextAuto(autoReconnectOff, 'settings.autoReconnect.off');
    bindTextAuto(autoReconnectOn, 'settings.autoReconnect.on');
    bindTextAuto(settingsSaveBtn, 'settings.save');

    bindTextAuto(document.getElementById('connectTitle'), 'connectModal.title');
    bindAttrAuto(connectClose, 'title', 'common.close');
    bindAttrAuto(portsContainer, 'aria-label', 'connectModal.availablePorts');
    bindText(connectBaud?.closest('label')?.querySelector('.label'), 'connectModal.baud', connectBaud?.closest('label')?.querySelector('.label')?.textContent || 'Baud');
    bindTextAuto(refreshPorts, 'connectModal.refresh');
    bindTextAuto(connectBtnAction, 'connectModal.connect');

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

    bindTextAuto(document.getElementById('pushLiveTitle'), 'pushLiveModal.title');
    bindAttrAuto(pushLiveClose, 'title', 'common.close');
    bindTextAuto(pushLiveStatus, 'pushLiveModal.idle');
    bindAttrAuto(pushLiveQr, 'alt', 'pushLiveModal.imageAlt');
    bindTextAuto(pushLiveStart, 'pushLiveModal.startButton');
    bindTextAuto(pushLiveEnd, 'pushLiveModal.endButton');
    bindTextAuto(pushLiveCancel, 'pushLiveModal.cancelButton');
    bindAttrAuto(pushLiveCancel, 'title', 'pushLiveModal.cancelButton');

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

    bindTextAuto(document.getElementById('serialMonTitle'), 'serialMonitor.title');
    bindAttrAuto(serialMonitorClose, 'title', 'common.close');
    bindTextAuto(serialMonitorModal?.querySelector('.modal-row .muted'), 'serialMonitor.connected');
    bindTextAuto(serialMonitorClearBtn, 'serialMonitor.clear');
    bindTextAuto(serialDisconnectBtn, 'serialMonitor.disconnect');

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
  const pushLiveModal = q('#pushLiveModal');
  const pushLiveClose = q('#pushLiveClose');
  const pushLiveLoading = q('#pushLiveLoading');
  const pushLiveStatus = q('#pushLiveStatus');
  const pushLivePreview = q('#pushLivePreview');
  const pushLiveQr = q('#pushLiveQr');
  const pushLiveStart = q('#pushLiveStart');
  const pushLiveEnd = q('#pushLiveEnd');
  const pushLiveCancel = q('#pushLiveCancel');
  const shortcutsModal = q('#shortcutsModal');
  const shortcutsClose = q('#shortcutsClose');
  const shortcutsList = q('#shortcutsList');
  if (pushLiveModal) pushLiveModal.setAttribute('aria-hidden', 'true');
  if (shortcutsModal) shortcutsModal.setAttribute('aria-hidden', 'true');
  // Sidebar elements
  const featuresSidebar = q('#featuresSidebar');
  const featuresResizer = q('#featuresResizer');
  const featuresCollapse = q('#featuresCollapse');
  const featuresToggleBtn = q('#featuresToggleBtn');
  const trackersSidebar = q('#trackersSidebar');
  const trackersToggleBtn = q('#trackersToggleBtn');
  const trackersCollapse = q('#trackersCollapse');
  const trackersConnectBtn = q('#trackersConnectBtn');
  const trackersList = q('#trackersList');
  const trackersItems = q('#trackersItems');
  const trackersEmpty = q('#trackersEmpty');
  const trackersWaiting = q('#trackersWaiting');
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
    { key: '7', labelKey: 'shortcuts.weather', fallback: 'Weather' },
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
    { key: 'T', labelKey: 'shortcuts.trackersPanel', fallback: 'Toggle trackers panel' },
    { key: 'Shift + S', labelKey: 'shortcuts.serialConnect', fallback: 'Open serial connection' },
    { key: 'M', labelKey: 'shortcuts.serialMonitor', fallback: 'Open serial monitor' },
    { key: 'L', labelKey: 'shortcuts.pushLiveUpdates', fallback: 'Push LIVE updates' },
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
  let weatherAbortController = null;
  let weatherRefreshTimer = null;
  const WEATHER_REFRESH_DELAY_MS = 1000;
  let featuresLayersVisible = true;
  let featureLabelsVisible = true;
  let trackersLayersVisible = true;
  const FEATURE_LAYER_IDS = ['draw-fill', 'draw-fill-outline', 'draw-line', 'draw-line-arrows', 'draw-point-circle', 'draw-line-start-inner', 'draw-point', 'draw-hl-fill', 'draw-hl-line', 'draw-hl-point'];
  const LABEL_LAYER_IDS = ['draw-labels-polygon', 'draw-labels-line-name', 'draw-labels-line-length'];
  const TRACKER_LAYER_IDS = ['tracker-dots', 'tracker-labels', 'tracker-paths'];

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

  mapUtilityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = !btn.classList.contains('is-active');
      btn.classList.toggle('is-active', next);
      btn.setAttribute('aria-pressed', String(next));
      const tool = btn.dataset.tool;
      const map = getMap();
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
        case 'satellite':
          satelliteStyleActive = next;
          localStorage.setItem('map.satelliteEnabled', satelliteStyleActive ? '1' : '0');
          setSatelliteButtonState(satelliteStyleActive);
          applyCurrentMapStyle();
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

  let buildFeatureLabelFeatures = () => [];
  let updateFeatureLabels = () => {};

  function applyLabelVisibility(mapParam) {
    const map = mapParam || getMap();
    if (!map) return;
    const visibility = (featuresLayersVisible && featureLabelsVisible) ? 'visible' : 'none';
    LABEL_LAYER_IDS.forEach((layerId) => {
      try {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
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
    return { ...point, temperature: Number(temperature), code, description, iconUri };
  }

  function computeWeatherSamplePoints(map) {
    if (!map) return [];
    const bounds = map.getBounds();
    if (!bounds) return [];
    const center = bounds.getCenter();
    const centerPoint = map.project(center);
    const canvas = map.getCanvas?.();
    const width = Number(canvas?.clientWidth || canvas?.width || 1024);
    const height = Number(canvas?.clientHeight || canvas?.height || 768);
    if (!centerPoint || !Number.isFinite(centerPoint.x) || !Number.isFinite(centerPoint.y)) {
      return [center];
    }

    const base = Math.max(60, Math.min(width, height) * 0.12);
    const pitch = typeof map.getPitch === 'function' ? Number(map.getPitch()) : 0;
    const clampedPitch = Math.max(0, Math.min(85, Number.isFinite(pitch) ? pitch : 0));
    const pitchScale = 1 + (clampedPitch / 60) * 1.4;

    const forwardBias = base * pitchScale;
    const lateral = base * 0.85;
    const backward = base * 0.6;

    const offsets = [
      { dx: 0, dy: -forwardBias },
      { dx: lateral, dy: -base * 0.4 },
      { dx: -lateral, dy: -base * 0.4 },
      { dx: lateral * 0.9, dy: backward },
      { dx: -lateral * 0.9, dy: backward }
    ];

    const points = offsets.map(({ dx, dy }) => {
      const screenPoint = { x: centerPoint.x + dx, y: centerPoint.y + dy };
      try {
        const lngLat = map.unproject(screenPoint);
        if (!lngLat || !Number.isFinite(lngLat.lng) || !Number.isFinite(lngLat.lat)) return null;
        const lat = Math.max(-85, Math.min(85, lngLat.lat));
        let { lng } = lngLat;
        if (lng > 180) lng -= 360;
        if (lng < -180) lng += 360;
        return { lng, lat };
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (points.length) return points;

    const north = bounds.getNorth();
    const south = bounds.getSouth();
    let east = bounds.getEast();
    let west = bounds.getWest();
    if (east < west) east += 360;
    const latSpan = Math.abs(north - south);
    const lngSpan = Math.abs(east - west);
    const fallbackRadiusLat = Math.max(0.01, latSpan * 0.15);
    const fallbackRadiusLng = Math.max(0.01, lngSpan * 0.12);
    const clampLat = (lat) => Math.max(-85, Math.min(85, lat));
    const wrapLng = (lng) => {
      if (lng > 180) return lng - 360;
      if (lng < -180) return lng + 360;
      return lng;
    };
    return [
      { lng: wrapLng(center.lng), lat: clampLat(center.lat + fallbackRadiusLat) },
      { lng: wrapLng(center.lng), lat: clampLat(center.lat - fallbackRadiusLat) },
      { lng: wrapLng(center.lng + fallbackRadiusLng), lat: clampLat(center.lat) },
      { lng: wrapLng(center.lng - fallbackRadiusLng), lat: clampLat(center.lat) }
    ];
  }

  async function refreshWeatherOverlay() {
    if (!weatherOverlayActive) return;
    if (weatherAbortController) {
      try { weatherAbortController.abort(); } catch {}
      weatherAbortController = null;
    }
    clearWeatherOverlayMarkers();
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
    setWeatherButtonState(true);
    refreshWeatherOverlay();
    if (!weatherMoveHandler) {
      weatherMoveHandler = () => scheduleWeatherRefresh();
      map.on('move', weatherMoveHandler);
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
    if (weatherMoveHandler && map) {
      try { map.off('move', weatherMoveHandler); } catch {}
      weatherMoveHandler = null;
    }
    removeAllWeatherMarkers();
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
    requestLiveFeaturesSync(0);
    if (suppressFeatureToasts) return;
    const label = labelForKind(kind);
    showToast(`${label} added`);
  };

  const notifyFeatureModified = (label = 'Feature updated') => {
    requestLiveFeaturesSync(0);
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
  const readGoogleKey = () => (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
  const readOpenAIKey = () => (localStorage.getItem('openai.key') || defaultOpenAIKey || '').trim();
  const readCynoopsLiveKey = () => (localStorage.getItem('cynoops.liveApiKey') || defaultCynoopsLiveKey || '').trim();

  let googleServicesEnabled = false;
  let aiEnabled = false;
  let liveUpdatesEnabled = false;
  let serialConnected = false;
  let serialConnecting = false;
  let trackerDataSeen = false;
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
    const hasMapbox = !!readMapboxToken();
    googleServicesEnabled = !!readGoogleKey();
    aiEnabled = !!readOpenAIKey();
    liveUpdatesEnabled = !!readCynoopsLiveKey();

    if (mapWelcome) mapWelcome.hidden = hasMapbox;

    if (toolPushLive) {
      const shouldShowLive = !!liveUpdatesEnabled;
      toolPushLive.hidden = !shouldShowLive;
      toolPushLive.disabled = !shouldShowLive;
      toolPushLive.setAttribute('aria-disabled', String(!shouldShowLive));
      if (toolPushLiveDivider) toolPushLiveDivider.hidden = !shouldShowLive;
      if (shouldShowLive) {
        toolPushLive.removeAttribute('aria-hidden');
        const skipStatus = pushLiveModal?.hidden !== false;
        applyLiveSessionState({ skipStatus });
      } else {
        toolPushLive.setAttribute('aria-hidden', 'true');
        abortLiveRequest();
        if (pushLiveModal) {
          pushLiveModal.hidden = true;
          pushLiveModal.setAttribute('aria-hidden', 'true');
        }
        applyLiveSessionState();
      }
    }

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

  const LIVE_SESSION_STORAGE_KEY = 'cynoops.liveSession';
  let pushLiveAbortController = null;
  let pushLiveRequestToken = 0;
  let currentLiveSession = null;

  const loadStoredLiveSession = () => {
    try {
      const raw = localStorage.getItem(LIVE_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        if (!parsed.qrPayload) {
          const recovered = extractLiveQrPayload(parsed.payload ?? parsed.data ?? parsed);
          if (recovered) parsed.qrPayload = recovered;
        }
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to load stored LIVE session', err);
      try { localStorage.removeItem(LIVE_SESSION_STORAGE_KEY); } catch {}
    }
    return null;
  };

  const storeLiveSession = (session) => {
    try { localStorage.setItem(LIVE_SESSION_STORAGE_KEY, JSON.stringify(session)); }
    catch (err) { console.warn('Failed to store LIVE session metadata', err); }
  };

  const clearStoredLiveSession = () => {
    try { localStorage.removeItem(LIVE_SESSION_STORAGE_KEY); }
    catch (err) { console.warn('Failed clearing LIVE session metadata', err); }
  };

  const abortLiveRequest = () => {
    if (pushLiveAbortController) {
      try { pushLiveAbortController.abort(); } catch {}
      pushLiveAbortController = null;
    }
    pushLiveRequestToken++;
    if (pushLiveLoading) pushLiveLoading.hidden = true;
  };

  const setPushLiveStatus = (key, fallback, state = 'info') => {
    if (!pushLiveStatus) return;
    if (key) {
      pushLiveStatus.dataset.i18n = key;
      pushLiveStatus.textContent = t(key, fallback);
    } else {
      delete pushLiveStatus.dataset.i18n;
      pushLiveStatus.textContent = fallback ?? '';
    }
    pushLiveStatus.dataset.state = state;
    if (state === 'info') pushLiveStatus.classList.add('muted');
    else pushLiveStatus.classList.remove('muted');
  };

  const resolveSessionId = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const candidates = [
      payload.sessionId,
      payload.sessionID,
      payload.session_id,
      payload.id,
      payload.session,
      payload.liveSessionId,
      payload.live_session_id,
      payload.liveApiDocId,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    if (payload.data && typeof payload.data === 'object') {
      const nested = resolveSessionId(payload.data);
      if (nested) return nested;
    }
    return null;
  };

  const findValueByKey = (input, key, visited = new Set(), depth = 0) => {
    if (!input || typeof input !== 'object') return undefined;
    if (visited.has(input) || depth > 12) return undefined;
    visited.add(input);
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const value = input[key];
      if (typeof value === 'string' && value.trim()) return value;
      if (value && typeof value === 'object') {
        const nested = findValueByKey(value, key, visited, depth + 1);
        if (nested !== undefined && nested !== null) return nested;
      }
    }
    for (const value of Object.values(input)) {
      if (!value || typeof value !== 'object') continue;
      const result = findValueByKey(value, key, visited, depth + 1);
      if (result !== undefined && result !== null) return result;
    }
    return undefined;
  };

  const buildLiveQrPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const pick = (...keys) => {
      for (const key of keys) {
        const value = findValueByKey(payload, key);
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    };

    const liveApiDocId = pick('liveApiDocId', 'docId', 'liveDocId', 'documentId');
    const authToken = pick('authToken', 'authorizationToken', 'auth_token');
    const firebaseAuthToken = pick('firebaseAuthToken', 'firebaseToken', 'firebase_auth_token');
    const updatesCollectionPath = pick('updatesCollectionPath', 'collectionPath', 'updatesPath');

    if (!liveApiDocId || !authToken || !firebaseAuthToken || !updatesCollectionPath) return null;

    try {
      return JSON.stringify({
        liveApiDocId,
        authToken,
        firebaseAuthToken,
        updatesCollectionPath
      });
    } catch (err) {
      console.error('Failed to build LIVE QR payload', err);
      return null;
    }
  };

  const extractLiveQrPayload = (input, visited = new Set(), depth = 0) => {
    if (input && typeof input === 'object') {
      const built = buildLiveQrPayload(input);
      if (built) return built;
    }
    if (input == null) return null;
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return null;
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        if (depth > 8) return null;
        try {
          const parsed = JSON.parse(trimmed);
          return extractLiveQrPayload(parsed, visited, depth + 1) ?? trimmed;
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    if (typeof input !== 'object') return null;
    if (visited.has(input)) return null;
    if (depth > 8) return null;
    visited.add(input);

    const probe = (value) => extractLiveQrPayload(value, visited, depth + 1);
    const candidateKeys = [
      'qrPayload',
      'qrString',
      'qr',
      'qr_code',
      'qrCode',
      'qrcode',
      'qrUrl',
      'qrURL',
      'url',
      'link',
      'data',
      'payload',
      'value'
    ];

    if (!Array.isArray(input)) {
      for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
          const candidate = probe(input[key]);
          if (candidate) return candidate;
        }
      }
      for (const value of Object.values(input)) {
        const candidate = probe(value);
        if (candidate) return candidate;
      }
    } else {
      for (const value of input) {
        const candidate = probe(value);
        if (candidate) return candidate;
      }
    }
    return null;
  };

  const LIVE_FEATURES_UPLOAD_DELAY = 800;
  const LIVE_TRACKERS_UPLOAD_DELAY = 1500;
  let liveSyncActive = false;
  let liveSyncSessionId = null;
  let liveSyncApiKey = null;
  let liveFeaturesUploadTimer = null;
  let liveFeaturesUploadInFlight = false;
  let liveFeaturesUploadPending = false;
  let liveTrackersUploadTimer = null;
  let liveTrackersUploadInFlight = false;
  let liveTrackersUploadPending = false;
  const liveTrackerLocations = new Map();
  const liveTrackerMetadata = new Map();

  const cloneForLiveSync = (value) => {
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch (err) {
      console.warn('structuredClone failed for live sync, using JSON clone', err);
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      console.error('Failed to clone value for live sync', err);
      return null;
    }
  };

  const resetLiveSyncBuffers = () => {
    if (liveFeaturesUploadTimer) {
      clearTimeout(liveFeaturesUploadTimer);
      liveFeaturesUploadTimer = null;
    }
    if (liveTrackersUploadTimer) {
      clearTimeout(liveTrackersUploadTimer);
      liveTrackersUploadTimer = null;
    }
    liveFeaturesUploadInFlight = false;
    liveFeaturesUploadPending = false;
    liveTrackersUploadInFlight = false;
    liveTrackersUploadPending = false;
    liveTrackerLocations.clear();
    liveTrackerMetadata.clear();
  };

  const teardownLiveSync = () => {
    resetLiveSyncBuffers();
    liveSyncActive = false;
    liveSyncSessionId = null;
    liveSyncApiKey = null;
  };

  const buildFeaturesPayload = () => {
    let storeRef = null;
    try { storeRef = (window)._drawStore || drawStore; }
    catch { storeRef = null; }
    if (!storeRef) return null;
    return cloneForLiveSync(storeRef);
  };

  const trackerMetadataEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  };

  const sanitizeTrackerMetadata = (tracker) => {
    if (!tracker || typeof tracker !== 'object') return null;
    const metadata = {
      name: typeof tracker.name === 'string' ? tracker.name.trim() || null : null,
      color: typeof tracker.color === 'string' ? tracker.color.trim() || null : null,
      visible: tracker.visible === false ? false : true,
      battery: Number.isFinite(tracker.battery) ? Number(tracker.battery) : null,
      altitude: Number.isFinite(tracker.altitude) ? Number(tracker.altitude) : null,
      hops: Number.isFinite(tracker.hops) ? Number(tracker.hops) : null,
      updatedAt: Number.isFinite(tracker.updatedAt) ? Number(tracker.updatedAt) : null,
      longitude: Number.isFinite(tracker.longitude) ? Number(tracker.longitude) : null,
      latitude: Number.isFinite(tracker.latitude) ? Number(tracker.latitude) : null
    };
    return metadata;
  };

  const buildTrackerSyncPayload = () => {
    const aggregated = new Map();
    liveTrackerLocations.forEach((locations, trackerId) => {
      if (!trackerId || !Array.isArray(locations) || locations.length === 0) return;
      const trimmedId = String(trackerId).trim();
      if (!trimmedId) return;
      const sanitized = locations.map((entry) => {
        const lng = Number(entry.longitude);
        const lat = Number(entry.latitude);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        const record = {
          longitude: lng,
          latitude: lat,
          timestamp: Number.isFinite(entry.timestamp) ? Number(entry.timestamp) : Date.now()
        };
        if (Number.isFinite(entry.altitude)) record.altitude = Number(entry.altitude);
        if (Number.isFinite(entry.battery)) record.battery = Number(entry.battery);
        if (Number.isFinite(entry.hops)) record.hops = Number(entry.hops);
        return record;
      }).filter(Boolean);
      if (!sanitized.length) return;
      const payload = aggregated.get(trimmedId) || {};
      payload.locations = sanitized;
      aggregated.set(trimmedId, payload);
    });
    liveTrackerMetadata.forEach((metadata, trackerId) => {
      if (!trackerId || !metadata || typeof metadata !== 'object') return;
      const trimmedId = String(trackerId).trim();
      if (!trimmedId) return;
      const payload = aggregated.get(trimmedId) || {};
      payload.metadata = metadata;
      aggregated.set(trimmedId, payload);
    });
    if (aggregated.size === 0) return null;
    const result = {};
    aggregated.forEach((payload, trackerId) => {
      if (!payload || Object.keys(payload).length === 0) return;
      result[trackerId] = payload;
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  const ensureLiveSyncReady = () => {
    if (!liveSyncActive || !liveSyncSessionId || !liveSyncApiKey) return false;
    return true;
  };

  const pushLiveFeatures = async () => {
    if (!ensureLiveSyncReady()) return;
    const payload = buildFeaturesPayload();
    if (!payload) return;
    liveFeaturesUploadInFlight = true;
    try {
      const response = await fetch('https://cynoops.com/api/live', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: liveSyncApiKey,
          'live-type': 'features'
        },
        body: JSON.stringify({
          sessionId: liveSyncSessionId,
          data: {
            data: payload
          }
        })
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${text}`);
      }
    } catch (err) {
      console.error('Failed to push LIVE features update', err);
    } finally {
      liveFeaturesUploadInFlight = false;
      if (liveFeaturesUploadPending) {
        liveFeaturesUploadPending = false;
        scheduleLiveFeaturesUpload();
      }
    }
  };

  const pushLiveTrackerUpdates = async () => {
    if (!ensureLiveSyncReady()) return;
    const payload = buildTrackerSyncPayload();
    if (!payload) return;
    liveTrackersUploadInFlight = true;
    try {
      const response = await fetch('https://cynoops.com/api/live', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: liveSyncApiKey,
          'live-type': 'trackers'
        },
        body: JSON.stringify({
          sessionId: liveSyncSessionId,
          data: payload
        })
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${text}`);
      }
    } catch (err) {
      console.error('Failed to push LIVE tracker update', err);
    } finally {
      liveTrackersUploadInFlight = false;
      if (liveTrackersUploadPending) {
        liveTrackersUploadPending = false;
        scheduleLiveTrackersUpload();
      }
    }
  };

  const scheduleLiveFeaturesUpload = (delay = LIVE_FEATURES_UPLOAD_DELAY) => {
    if (!ensureLiveSyncReady()) return;
    if (liveFeaturesUploadInFlight) {
      liveFeaturesUploadPending = true;
      return;
    }
    if (liveFeaturesUploadTimer) clearTimeout(liveFeaturesUploadTimer);
    liveFeaturesUploadTimer = setTimeout(() => {
      liveFeaturesUploadTimer = null;
      pushLiveFeatures();
    }, Math.max(0, Number.isFinite(delay) ? delay : LIVE_FEATURES_UPLOAD_DELAY));
  };

  const scheduleLiveTrackersUpload = (delay = LIVE_TRACKERS_UPLOAD_DELAY) => {
    if (!ensureLiveSyncReady()) return;
    if (liveTrackersUploadInFlight) {
      liveTrackersUploadPending = true;
      return;
    }
    if (liveTrackersUploadTimer) clearTimeout(liveTrackersUploadTimer);
    liveTrackersUploadTimer = setTimeout(() => {
      liveTrackersUploadTimer = null;
      pushLiveTrackerUpdates();
    }, Math.max(0, Number.isFinite(delay) ? delay : LIVE_TRACKERS_UPLOAD_DELAY));
  };

  const requestLiveFeaturesSync = (delay) => {
    if (!ensureLiveSyncReady()) return;
    scheduleLiveFeaturesUpload(typeof delay === 'number' ? delay : LIVE_FEATURES_UPLOAD_DELAY);
  };

  const requestLiveTrackersSync = (delay) => {
    if (!ensureLiveSyncReady()) return;
    scheduleLiveTrackersUpload(typeof delay === 'number' ? delay : LIVE_TRACKERS_UPLOAD_DELAY);
  };

  const recordLiveTrackerMetadata = (tracker, { skipSchedule = false, delay } = {}) => {
    if (!ensureLiveSyncReady()) return;
    if (!tracker || !tracker.id) return;
    const id = String(tracker.id).trim();
    if (!id) return;
    const metadata = sanitizeTrackerMetadata(tracker);
    if (!metadata) return;
    const previous = liveTrackerMetadata.get(id);
    if (trackerMetadataEqual(previous, metadata)) return;
    liveTrackerMetadata.set(id, metadata);
    if (!skipSchedule) {
      requestLiveTrackersSync(typeof delay === 'number' ? delay : LIVE_TRACKERS_UPLOAD_DELAY);
    }
  };

  const recordLiveTrackerLocation = (tracker, { skipSchedule = false, delay } = {}) => {
    if (!ensureLiveSyncReady()) return;
    if (!tracker || !tracker.id) return;
    const id = String(tracker.id).trim();
    if (!id) return;
    const lng = Number(tracker.longitude);
    const lat = Number(tracker.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const location = {
      longitude: lng,
      latitude: lat,
      timestamp: Number.isFinite(tracker.updatedAt) ? Number(tracker.updatedAt) : Date.now()
    };
    if (Number.isFinite(tracker.altitude)) location.altitude = Number(tracker.altitude);
    if (Number.isFinite(tracker.battery)) location.battery = Number(tracker.battery);
    if (Number.isFinite(tracker.hops)) location.hops = Number(tracker.hops);
    const entry = liveTrackerLocations.get(id) || [];
    const last = entry[entry.length - 1];
    if (last && last.longitude === location.longitude && last.latitude === location.latitude && last.timestamp === location.timestamp) {
      return;
    }
    entry.push(location);
    liveTrackerLocations.set(id, entry);
    recordLiveTrackerMetadata(tracker, { skipSchedule: true });
    if (!skipSchedule) {
      requestLiveTrackersSync(typeof delay === 'number' ? delay : LIVE_TRACKERS_UPLOAD_DELAY);
    }
  };

  const seedLiveTrackerLocations = () => {
    liveTrackerLocations.clear();
    liveTrackerMetadata.clear();
    let storeRef = null;
    try { storeRef = trackerStore; }
    catch { storeRef = null; }
    if (!storeRef || typeof storeRef.forEach !== 'function') return;
    storeRef.forEach((tracker) => {
      recordLiveTrackerMetadata(tracker, { skipSchedule: true });
      recordLiveTrackerLocation(tracker, { skipSchedule: true });
    });
  };

  const activateLiveSync = (session, apiKey) => {
    if (!session || !session.id || !apiKey) {
      teardownLiveSync();
      return;
    }
    liveSyncSessionId = session.id;
    liveSyncApiKey = apiKey;
    liveSyncActive = true;
    resetLiveSyncBuffers();
    seedLiveTrackerLocations();
    requestLiveFeaturesSync(0);
    requestLiveTrackersSync(200);
  };

  const applyLiveSessionState = ({ skipStatus = false } = {}) => {
    const hasApiKey = !!liveUpdatesEnabled;
    const hasSession = !!currentLiveSession;
    if (pushLiveLoading) pushLiveLoading.hidden = true;

    if (pushLiveStart) {
      pushLiveStart.disabled = !hasApiKey || hasSession;
      pushLiveStart.hidden = false;
    }
    if (pushLiveEnd) {
      pushLiveEnd.hidden = !hasSession;
      pushLiveEnd.disabled = !hasSession || !hasApiKey;
    }
    if (pushLivePreview) pushLivePreview.hidden = !hasSession;
    if (!hasSession && pushLiveQr) pushLiveQr.src = '';

    if (hasSession) {
      let qrPayload = currentLiveSession.qrPayload ?? currentLiveSession.payload ?? currentLiveSession.data ?? currentLiveSession;
      let qrText = '';
      const resolved = extractLiveQrPayload(qrPayload);
      if (resolved) {
        qrText = resolved;
        if (!currentLiveSession.qrPayload || currentLiveSession.qrPayload !== resolved) {
          currentLiveSession.qrPayload = resolved;
          storeLiveSession(currentLiveSession);
        }
      } else if (typeof qrPayload === 'string') {
        qrText = qrPayload;
      } else {
        try { qrText = JSON.stringify(qrPayload); }
        catch (err) { console.error('Failed to stringify LIVE session payload', err); }
      }
      if (qrText) {
        const dataUrl = generateQrDataUrl(qrText, 600, 6);
        if (dataUrl && pushLiveQr) {
          pushLiveQr.src = dataUrl;
          if (pushLivePreview) pushLivePreview.hidden = false;
          if (!skipStatus) {
            if (hasApiKey) {
              setPushLiveStatus('pushLiveModal.ready', 'Scan the QR code to start the LIVE connection.', 'success');
            } else {
              setPushLiveStatus('pushLiveModal.noKey', 'Add your CYNOOPS Live API key to start a LIVE session.', 'error');
            }
          }
          return;
        }
      }
      if (pushLivePreview) pushLivePreview.hidden = true;
      if (pushLiveQr) pushLiveQr.src = '';
      if (!skipStatus) setPushLiveStatus('pushLiveModal.qrError', 'Unable to render LIVE QR code.', 'error');
      return;
    }

    if (!skipStatus) {
      if (!hasApiKey) {
        setPushLiveStatus('pushLiveModal.noKey', 'Add your CYNOOPS Live API key to start a LIVE session.', 'error');
      } else {
        setPushLiveStatus('pushLiveModal.idle', 'Start a LIVE session to generate a QR code.', 'info');
      }
    }
  };

  const startLiveSession = async () => {
    if (currentLiveSession) {
      const existingKey = readCynoopsLiveKey();
      if (existingKey) {
        activateLiveSync(currentLiveSession, existingKey);
        requestLiveFeaturesSync(0);
        requestLiveTrackersSync(200);
      } else {
        teardownLiveSync();
      }
      applyLiveSessionState();
      setPushLiveStatus('pushLiveModal.ready', 'Scan the QR code to start the LIVE connection.', 'success');
      return;
    }
    if (!liveUpdatesEnabled) {
      teardownLiveSync();
      applyLiveSessionState();
      return;
    }
    const apiKey = readCynoopsLiveKey();
    if (!apiKey) {
      teardownLiveSync();
      applyLiveSessionState({ skipStatus: true });
      setPushLiveStatus('pushLiveModal.noKey', 'Add your CYNOOPS Live API key to start a LIVE session.', 'error');
      return;
    }

    abortLiveRequest();
    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
    pushLiveAbortController = controller;
    const requestToken = ++pushLiveRequestToken;

    if (pushLiveLoading) pushLiveLoading.hidden = false;
    if (pushLiveStart) pushLiveStart.disabled = true;
    if (pushLiveEnd) pushLiveEnd.disabled = true;
    setPushLiveStatus('pushLiveModal.starting', 'Starting LIVE updates…', 'info');

    try {
      const response = await fetch('https://cynoops.com/api/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey
        },
        body: JSON.stringify({ command: 'start' }),
        signal: controller?.signal
      });

      if (requestToken !== pushLiveRequestToken) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      if (requestToken !== pushLiveRequestToken) return;

      if (!payload || typeof payload !== 'object') throw new Error('Invalid LIVE response');
      const payloadData = (payload && payload.data && typeof payload.data === 'object') ? payload.data : null;
      const sessionId = resolveSessionId(payload) || (payloadData ? resolveSessionId(payloadData) : null);
      if (!sessionId) throw new Error('Missing LIVE session ID');

      const qrPayload = extractLiveQrPayload(payload) ?? (payloadData ? extractLiveQrPayload(payloadData) : null);
      if (!qrPayload) throw new Error('Missing LIVE QR payload');

      currentLiveSession = { id: sessionId, payload, storedAt: Date.now(), qrPayload };
      storeLiveSession(currentLiveSession);
      activateLiveSync(currentLiveSession, apiKey);
      applyLiveSessionState({ skipStatus: true });
      setPushLiveStatus('pushLiveModal.ready', 'Scan the QR code to start the LIVE connection.', 'success');
    } catch (err) {
      if (controller?.signal?.aborted) return;
      console.error('Failed to start CynoOps LIVE updates', err);
      applyLiveSessionState({ skipStatus: true });
      setPushLiveStatus('pushLiveModal.error', 'Failed to start LIVE updates. Please try again.', 'error');
    } finally {
      if (requestToken === pushLiveRequestToken) {
        if (!currentLiveSession && pushLiveStart) pushLiveStart.disabled = !liveUpdatesEnabled;
        if (pushLiveEnd) pushLiveEnd.disabled = !currentLiveSession;
        if (pushLiveAbortController === controller) pushLiveAbortController = null;
        if (pushLiveLoading) pushLiveLoading.hidden = true;
      }
    }
  };

  const endLiveSession = async ({ silent = false } = {}) => {
    if (!currentLiveSession) {
      applyLiveSessionState({ skipStatus: silent });
      teardownLiveSync();
      return;
    }
    const apiKey = readCynoopsLiveKey();
    if (!apiKey) {
      if (silent) {
        clearStoredLiveSession();
        currentLiveSession = null;
        applyLiveSessionState({ skipStatus: true });
        teardownLiveSync();
        return;
      }
      setPushLiveStatus('pushLiveModal.noKey', 'Add your CYNOOPS Live API key to start a LIVE session.', 'error');
      return;
    }

    abortLiveRequest();
    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
    pushLiveAbortController = controller;
    const requestToken = ++pushLiveRequestToken;

    if (!silent) {
      if (pushLiveLoading) pushLiveLoading.hidden = false;
      if (pushLiveStart) pushLiveStart.disabled = true;
      if (pushLiveEnd) pushLiveEnd.disabled = true;
      setPushLiveStatus('pushLiveModal.ending', 'Ending LIVE session…', 'info');
    }

    const sessionId = currentLiveSession?.id ?? null;

    try {
      const response = await fetch('https://cynoops.com/api/live', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey
        },
        body: JSON.stringify({ sessionId }),
        signal: controller?.signal
      });

      if (requestToken !== pushLiveRequestToken) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      clearStoredLiveSession();
      currentLiveSession = null;
      applyLiveSessionState({ skipStatus: true });
      teardownLiveSync();
      if (!silent) {
        setPushLiveStatus('pushLiveModal.ended', 'LIVE session ended.', 'success');
      }
    } catch (err) {
      if (controller?.signal?.aborted) return;
      console.error('Failed to end CynoOps LIVE session', err);
      clearStoredLiveSession();
      currentLiveSession = null;
      applyLiveSessionState({ skipStatus: true });
      teardownLiveSync();
      if (!silent) {
        setPushLiveStatus('pushLiveModal.endError', 'Failed to end LIVE session. Please try again.', 'error');
      }
    } finally {
      if (requestToken === pushLiveRequestToken) {
        if (pushLiveStart) pushLiveStart.disabled = !liveUpdatesEnabled || !!currentLiveSession;
        if (pushLiveEnd) pushLiveEnd.disabled = !currentLiveSession;
        if (pushLiveAbortController === controller) pushLiveAbortController = null;
        if (pushLiveLoading) pushLiveLoading.hidden = true;
      }
    }
  };

  currentLiveSession = loadStoredLiveSession();
  applyLiveSessionState({ skipStatus: true });
  if (currentLiveSession) {
    endLiveSession({ silent: true }).catch((err) => {
      console.warn('Automatic LIVE session shutdown failed', err);
    });
  }

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

  let selectedPath = null;
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
  const setSerialMonitorVisible = (visible) => {
    if (!serialMonitorBtn) return;
    const show = !!visible;
    serialMonitorBtn.hidden = !show;
    serialMonitorBtn.classList.toggle('is-hidden', !show);
  };

  const trackerStore = new Map();
  const trackerBlinkQueue = new Set();
  const trackerPositionsStore = new Map();
  (window)._trackerPositions = trackerPositionsStore;
  (window)._trackerStore = trackerStore;
  (window).getTrackerData = () => Array.from(trackerStore.values());
  let trackerSourceReady = false;
  let trackerPathSourceReady = false;
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
    const showControls = serialConnected || trackersRecordingHasData || trackersRecordingState.imported;
    if (trackersControls) trackersControls.hidden = !showControls;
    if (!showControls) closeTrackersMenu();
    if (trackersRecordBtn) {
      const canRecord = serialConnected && !serialConnecting;
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

  function ensureRecordingEntry(tracker) {
    if (!tracker || !tracker.id) return null;
    let entry = trackersRecordingState.entries.get(tracker.id);
    if (!entry) {
      entry = { id: tracker.id, color: tracker.color || null, name: tracker.name || null, samples: [], segments: [] };
      trackersRecordingState.entries.set(tracker.id, entry);
    } else {
      if (!entry.color && tracker.color) entry.color = tracker.color;
      if (!entry.name && tracker.name) entry.name = tracker.name;
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
    if (!serialConnected || serialConnecting) {
      showToast('Open a serial connection before recording', 'error');
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
      const samples = Array.isArray(entry.samples) ? entry.samples.map(cloneTrackerSample).filter(Boolean) : [];
      const segments = Array.isArray(entry.segments) ? entry.segments.map((seg) => cloneTrackerSegment(seg, color)).filter(Boolean) : [];
      if (!samples.length && !segments.length) return;
      trackers.push({
        id,
        name: typeof entry.name === 'string' ? entry.name : null,
        color,
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
      trackers.push({ id, name, color, samples, segments });
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
        samples: Array.isArray(item.samples) ? item.samples.slice().sort((a, b) => (Number(a.timestamp || 0) - Number(b.timestamp || 0))) : [],
        segments: Array.isArray(item.segments) ? item.segments.slice() : []
      };
      const existingTracker = trackerStore.get(item.id);
      let resolvedColor = entry.color || existingTracker?.color || null;
      if (!resolvedColor) resolvedColor = nextTrackerColor();
      entry.color = resolvedColor;
      trackersRecordingState.entries.set(item.id, {
        id: entry.id,
        name: entry.name,
        color: resolvedColor,
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
          visible: merged.visible === false ? false : true
        });
        const currentTracker = trackerStore.get(item.id);
        recordLiveTrackerMetadata(currentTracker, { skipSchedule: true });
        recordLiveTrackerLocation(currentTracker, { skipSchedule: true });
      }
    });
    trackersRecordingHasData = trackersRecordingState.entries.size > 0;
    trackersRecordingState.imported = true;
    trackersRecordingState.startedAt = Number.isFinite(imported.startedAt) ? imported.startedAt : (Number.isFinite(overallMin) ? overallMin : Date.now());
    trackersRecordingState.updatedAt = Number.isFinite(imported.updatedAt) ? imported.updatedAt : (Number.isFinite(overallMax) ? overallMax : trackersRecordingState.startedAt);
    if (trackersRecordingState.startedAt && trackersRecordingState.updatedAt && trackersRecordingState.updatedAt < trackersRecordingState.startedAt) {
      trackersRecordingState.updatedAt = trackersRecordingState.startedAt;
    }
    trackerDataSeen = true;
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
    if (trackersConnectBtn) {
      const disabled = serialConnected || serialConnecting;
      trackersConnectBtn.disabled = disabled;
      trackersConnectBtn.setAttribute('aria-disabled', String(disabled));
    }
    const waitingEl = trackersWaiting || q('#trackersWaiting');
    const shouldWait = serialConnected && !trackerDataSeen && trackerStore.size === 0;
    if (waitingEl) waitingEl.hidden = !shouldWait;
    const emptyEl = trackersEmpty || q('#trackersEmpty');
    if (emptyEl) emptyEl.style.display = shouldWait ? 'none' : (trackerStore.size === 0 ? 'flex' : 'none');
    const listEl = trackersItems || q('#trackersItems');
    if (listEl) {
      if (trackerStore.size > 0) listEl.classList.add('is-visible');
      else listEl.classList.remove('is-visible');
    }
    refreshTrackersControlsState();
  }

  const trackerColorPalette = ['#ff5722', '#03a9f4', '#8bc34a', '#ffc107', '#9c27b0', '#4caf50', '#00bcd4', '#ff9800'];
  let trackerColorIndex = 0;
  const nextTrackerColor = () => {
    const color = trackerColorPalette[trackerColorIndex % trackerColorPalette.length];
    trackerColorIndex += 1;
    return color;
  };

  const normalizeTrackerIdFromAutoProbe = (type, deviceId) => {
    const cleanedType = String(type || '').trim().toLowerCase();
    if (cleanedType === 'base') return 'CO-ROOT';
    if (cleanedType !== 'tracker') return null;
    let id = String(deviceId || '').trim();
    if (!id) return null;
    if (!id.toUpperCase().startsWith('CO-')) id = `CO-${id}`;
    id = id.toUpperCase();
    return id;
  };

  const ensureTrackerStub = (id, { name } = {}) => {
    const trackerId = String(id || '').trim();
    if (!trackerId) return null;
    let tracker = trackerStore.get(trackerId);
    if (!tracker) {
      const color = nextTrackerColor();
      tracker = {
        id: trackerId,
        longitude: null,
        latitude: null,
        altitude: null,
        battery: null,
        hops: null,
        updatedAt: Date.now(),
        raw: null,
        name: name || null,
        color,
        visible: true,
      };
      trackerStore.set(trackerId, tracker);
      trackerDataSeen = true;
      ensureTrackerHistoryEntry(trackerId);
      recordLiveTrackerMetadata(tracker, { delay: 0 });
      updateTrackerSource();
      updateTrackerPathSource();
      renderTrackersList();
      updateTrackersPanelState();
      refreshTrackersControlsState();
      return tracker;
    }
    if (name && !tracker.name) {
      updateTrackerEntry(trackerId, { name });
      return trackerStore.get(trackerId);
    }
    return tracker;
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

      trackers.forEach((tracker) => {
        const row = document.createElement('div');
        row.className = 'tracker-row';
        row.dataset.trackerId = tracker.id;
        if (tracker.visible === false) row.classList.add('hidden');

        const displayName = (tracker.name && tracker.name.trim()) || tracker.id;

        const nameEl = document.createElement('div');
        nameEl.className = 'tracker-name';
        nameEl.contentEditable = 'true';
        nameEl.textContent = tracker.id === editingTrackerId && editingTrackerDraft ? editingTrackerDraft : displayName;
        nameEl.setAttribute('role', 'textbox');
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
          if (e.key === 'Enter') {
            e.preventDefault();
            nameEl.blur();
          }
        });

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

      actions.appendChild(colorBtn);

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

        row.appendChild(nameEl);
        row.appendChild(actions);
        row.appendChild(meta);
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
    recordLiveTrackerMetadata(next, { delay: 0 });
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

  const TRACKER_ID_PATTERN = /^CO-(?:\d{12}|ROOT)$/; // allow regular trackers (12 digits) and special CO-ROOT beacon

  const parseTrackerLine = (raw) => {
    if (!raw && raw !== 0) return null;
    const text = String(raw).trim();
    if (!text) return null;
    const parts = text.split(':');
    if (parts.length < 6) return null;
    const [trackerIdRaw, firstCoordRaw, secondCoordRaw, altRaw, batteryRaw, hopsRaw] = parts;
    const trackerId = trackerIdRaw.trim();
    if (!trackerId) return null;
    if (!TRACKER_ID_PATTERN.test(trackerId)) return null;
    const candidateA = {
      longitude: Number(firstCoordRaw),
      latitude: Number(secondCoordRaw)
    };
    const candidateB = {
      longitude: Number(secondCoordRaw),
      latitude: Number(firstCoordRaw)
    };
    const isValid = (c) => Number.isFinite(c.longitude) && c.longitude >= -180 && c.longitude <= 180 && Number.isFinite(c.latitude) && c.latitude >= -90 && c.latitude <= 90;
    let coord = null;
    const prev = trackerStore.get(trackerId);
    const reference = prev ? { longitude: prev.longitude, latitude: prev.latitude } : { longitude: defaultStartLng, latitude: defaultStartLat };
    const distance = (c) => Math.abs((c.longitude ?? 0) - reference.longitude) + Math.abs((c.latitude ?? 0) - reference.latitude);

    if (isValid(candidateA) && isValid(candidateB)) {
      coord = distance(candidateA) <= distance(candidateB) ? candidateA : candidateB;
    } else if (isValid(candidateA)) {
      coord = candidateA;
    } else if (isValid(candidateB)) {
      coord = candidateB;
    }

    if (!coord) return null;

    const altitude = Number(altRaw);
    const battery = Number(batteryRaw);
    const hops = Number.parseInt(hopsRaw, 10);
    return {
      id: trackerId,
      longitude: coord.longitude,
      latitude: coord.latitude,
      altitude: Number.isFinite(altitude) ? altitude : null,
      battery: Number.isFinite(battery) ? battery : null,
      hops: Number.isFinite(hops) ? hops : null,
      raw: text
    };
  };

  const getTrackerFeatureCollection = () => {
    const features = [];
    trackerStore.forEach((tracker) => {
      if (!tracker || tracker.visible === false) return;
      if (!Number.isFinite(tracker.longitude) || !Number.isFinite(tracker.latitude)) return;
      const displayName = (tracker.name && tracker.name.trim()) || tracker.id;
      features.push({
        type: 'Feature',
        properties: {
          id: tracker.id,
          label: displayName,
          text: displayName,
          name: displayName,
          color: tracker.color || '#ff5722',
          battery: tracker.battery,
          altitude: tracker.altitude,
          hops: tracker.hops,
          updatedAt: tracker.updatedAt
        },
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
      if (!map.getLayer('tracker-dots')) {
        map.addLayer({
          id: 'tracker-dots',
          type: 'circle',
          source: 'trackers',
          paint: {
            'circle-radius': 5.75,
            'circle-color': ['coalesce', ['get', 'color'], '#ff5722'],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
          }
        });
      }
      if (!map.getLayer('tracker-labels')) {
        map.addLayer({
          id: 'tracker-labels',
          type: 'symbol',
          source: 'trackers',
          layout: {
            'text-field': ['coalesce', ['get', 'label'], ['get', 'id']],
            'text-offset': [0, 1.35],
            'text-anchor': 'top',
            'text-padding': 2,
            'text-size': 14,
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 4.5,
            'text-halo-blur': 0.2
          }
        });
      }
    } catch (err) {
      pointsReady = false;
      console.error('ensureTrackerLayer failed', err);
    }
    trackerSourceReady = pointsReady && !!map.getSource('trackers') && !!map.getLayer('tracker-dots') && !!map.getLayer('tracker-labels');

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
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#ff5722'],
            'line-width': 2.2,
            'line-opacity': 0.72,
            'line-cap': 'round',
            'line-join': 'round'
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
      if (src && src.setData) src.setData(getTrackerFeatureCollection());
    } catch (e) {
      console.error('updateTrackerSource failed', e);
    }
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

  const processTrackerLine = (raw) => {
    const data = parseTrackerLine(raw);
    if (!data) return;
    const prev = trackerStore.get(data.id);
    let color = prev?.color;
    if (!color) color = nextTrackerColor();
    const hasPrevPosition = prev && Number.isFinite(prev.longitude) && Number.isFinite(prev.latitude);
    const hasNextPosition = Number.isFinite(data.longitude) && Number.isFinite(data.latitude);
    let shouldAppendSegment = false;
    let movementDistance = 0;
    if (hasPrevPosition && hasNextPosition) {
      movementDistance = haversineMeters({ longitude: prev.longitude, latitude: prev.latitude }, { longitude: data.longitude, latitude: data.latitude });
      if (movementDistance > 3) {
        shouldAppendSegment = true;
      }
    }
    const timestamp = Date.now();
    const merged = {
      id: data.id,
      longitude: data.longitude,
      latitude: data.latitude,
      altitude: data.altitude,
      battery: data.battery,
      hops: data.hops,
      updatedAt: timestamp,
      raw: data.raw,
      name: prev?.name || null,
      color,
      visible: prev?.visible === false ? false : true,
    };
    trackerStore.set(data.id, merged);
    trackerDataSeen = true;
    captureRecordingSample(merged, prev, movementDistance, shouldAppendSegment, timestamp);
    if (shouldAppendSegment) {
      appendTrackerSegment(
        data.id,
        { longitude: prev.longitude, latitude: prev.latitude },
        { longitude: data.longitude, latitude: data.latitude },
        movementDistance,
        color,
        prev?.updatedAt,
        timestamp
      );
      updateTrackerPathSource();
    }
    trackerBlinkQueue.add(data.id);
    updateTrackerSource();
    renderTrackersList();
    updateTrackersPanelState();
    recordLiveTrackerLocation(merged);
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
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

      const storedCynoopsLiveKey = localStorage.getItem('cynoops.liveApiKey');
      if (settingCynoopsLiveKey) settingCynoopsLiveKey.value = storedCynoopsLiveKey !== null ? storedCynoopsLiveKey : defaultCynoopsLiveKey;

      const storedStyleUrl = localStorage.getItem('map.styleUrl');
      const storedSatelliteStyleUrl = localStorage.getItem('map.satelliteStyleUrl');
      if (settingStyleUrl) settingStyleUrl.value = storedStyleUrl !== null ? storedStyleUrl : defaultStyleUrl;
      if (settingSatelliteStyleUrl) settingSatelliteStyleUrl.value = storedSatelliteStyleUrl !== null ? storedSatelliteStyleUrl : defaultSatelliteStyleUrl;

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

      const storedBaud = localStorage.getItem('serial.baud');
      if (settingBaud) settingBaud.value = storedBaud !== null ? storedBaud : DEFAULT_SERIAL_BAUD;
      if (connectBaud) connectBaud.value = settingBaud?.value || DEFAULT_SERIAL_BAUD;

      const storedAuto = localStorage.getItem('serial.autoReconnect');
      if (settingAutoReconnect) settingAutoReconnect.value = storedAuto || DEFAULT_AUTO_RECONNECT;

      const storedCoord = (localStorage.getItem('map.coordinateSystem') || 'latlng').toLowerCase();
      currentCoordinateSystem = storedCoord;
      if (settingCoordinateSystem) settingCoordinateSystem.value = storedCoord;
      applyFooterCoordLabel(getFooterLabelKeyForSystem(currentCoordinateSystem));
      if (lastKnownCenter) updateFooterCenterDisplay(lastKnownCenter.lat, lastKnownCenter.lng);
      refreshGotoFormForSystem(false);

      satelliteStyleActive = localStorage.getItem('map.satelliteEnabled') === '1';
      setSatelliteButtonState(satelliteStyleActive);
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
    }
  };
  const gatherSettingsFromForm = () => {
    const accessToken = (settingAccessToken?.value || '').trim();
    const googleKey = (settingGoogleKey?.value || '').trim();
    const openaiKey = (settingOpenAIKey?.value || '').trim();
    const cynoopsLiveKey = (settingCynoopsLiveKey?.value || '').trim();
    let styleUrl = (settingStyleUrl?.value || '').trim();
    let satelliteStyleUrl = (settingSatelliteStyleUrl?.value || '').trim();
    if (!satelliteStyleUrl) satelliteStyleUrl = DEFAULT_SATELLITE_STYLE_URL;
    if (!styleUrl) styleUrl = DEFAULT_STYLE_URL;
    const homeAddress = (settingHomeAddress?.value || '').trim();
    const coords = parseStartInputs();
    if (!coords) {
      const lat = Number(settingStartLat?.value);
      const lng = Number(settingStartLng?.value);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        alert(t('alerts.invalidLatitude', 'Please enter a valid start latitude.'));
        settingStartLat?.focus();
      } else {
        alert(t('alerts.invalidLongitude', 'Please enter a valid start longitude.'));
        settingStartLng?.focus();
      }
      return null;
    }
    let startZoom = Number(settingStartZoom?.value);
    if (!Number.isFinite(startZoom)) startZoom = DEFAULT_START_ZOOM;
    if (startZoom < 0 || startZoom > 22) {
      alert(t('alerts.invalidZoom', 'Start zoom must be between 0 and 22.'));
      settingStartZoom?.focus();
      return null;
    }
    let baudValue = (settingBaud?.value || '').trim();
    if (!baudValue) baudValue = DEFAULT_SERIAL_BAUD;
    const baudNumber = Number(baudValue);
    if (!Number.isFinite(baudNumber) || baudNumber <= 0) {
      alert(t('alerts.invalidBaud', 'Please enter a valid positive baud rate.'));
      settingBaud?.focus();
      return null;
    }
    const baud = String(Math.round(baudNumber));
    const autoReconnect = (settingAutoReconnect?.value === 'off') ? 'off' : 'on';
    const language = normalizeAppLanguage(settingLanguage?.value);
    const coordinateSystem = (settingCoordinateSystem?.value || 'latlng').toLowerCase();

    return {
      accessToken,
      googleKey,
      openaiKey,
      cynoopsLiveKey,
      styleUrl,
      homeAddress,
      startPos: coords,
      startZoom,
      baud,
      autoReconnect,
      language,
      coordinateSystem,
      satelliteStyleUrl,
    };
  };
  const applySettings = async () => {
    const values = gatherSettingsFromForm();
    if (!values) return;

    const prevAccessToken = localStorage.getItem('map.accessToken') || '';
    const prevStyleUrl = localStorage.getItem('map.styleUrl') || '';
    const prevStartPos = parseStartPos(localStorage.getItem('map.startPos'));
    const prevStartZoom = Number(localStorage.getItem('map.startZoom') || DEFAULT_START_ZOOM);
    const prevSatelliteStyleUrl = localStorage.getItem('map.satelliteStyleUrl') || defaultSatelliteStyleUrl;
    const prevSatelliteEnabled = localStorage.getItem('map.satelliteEnabled') === '1';
    const styleChanged = values.styleUrl !== prevStyleUrl;
    const satelliteChanged = values.satelliteStyleUrl !== prevSatelliteStyleUrl;

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

    try {
      localStorage.setItem('map.accessToken', values.accessToken);
      localStorage.setItem('map.googleKey', values.googleKey);
      localStorage.setItem('openai.key', values.openaiKey);
      localStorage.setItem('cynoops.liveApiKey', values.cynoopsLiveKey);
      localStorage.setItem('map.styleUrl', values.styleUrl);
      localStorage.setItem('map.satelliteStyleUrl', values.satelliteStyleUrl);
      localStorage.setItem('map.homeAddress', values.homeAddress);
      localStorage.setItem('map.startPos', `${values.startPos[0].toFixed(6)}, ${values.startPos[1].toFixed(6)}`);
      localStorage.setItem('map.startZoom', String(values.startZoom));
      localStorage.setItem('serial.baud', values.baud);
      localStorage.setItem('serial.autoReconnect', values.autoReconnect);
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

    if (connectBaud && values.baud) connectBaud.value = values.baud;
    if (settingCoordinateSystem) settingCoordinateSystem.value = values.coordinateSystem;
    if (settingSatelliteStyleUrl) settingSatelliteStyleUrl.value = values.satelliteStyleUrl || DEFAULT_SATELLITE_STYLE_URL;
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
        const prevActiveStyleUrl = prevSatelliteEnabled ? prevSatelliteStyleUrl : prevStyleUrl;
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
    });
    settingsForm.addEventListener('change', (e) => {
      if (e && e.target === settingsSaveBtn) return;
      markSettingsDirty();
    });
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await applySettings();
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
      if (mapWelcome) mapWelcome.hidden = false;
      return;
    }

    if (mapWelcome) mapWelcome.hidden = true;

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
    setSatelliteButtonState(satelliteStyleActive);
    try { (window)._bindEditInteractions && (window)._bindEditInteractions(); } catch {}
    try { ensureTrackerLayer(map); } catch (e) { console.error('tracker layer init failed', e); }

    const fmt = (n, d=2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
    const computeScaleDenominator = (mapInstance) => {
      if (!mapInstance) return null;
      try {
        const zoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : null;
        const center = typeof mapInstance.getCenter === 'function' ? mapInstance.getCenter() : null;
        if (!Number.isFinite(zoom) || !center || !Number.isFinite(center.lat)) return null;
        const metersPerPixel = 156543.03392 * Math.cos(center.lat * DEG_TO_RAD) / Math.pow(2, zoom);
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
      updateMapCursor();
    });
    map.on('moveend', () => { if (!mapPinned) updatePlaceFromCenter(); });

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
      if (!map.getLayer('draw-fill')) {
        map.addLayer({
          id: 'draw-fill',
          type: 'fill',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          paint: { 'fill-color': ['coalesce', ['get','color'], '#2196F3'], 'fill-opacity': 0.17 }
        });
      }
      if (!map.getLayer('draw-fill-outline')) {
        map.addLayer({
          id: 'draw-fill-outline',
          type: 'line',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          paint: {
            'line-color': ['coalesce', ['get','color'], '#2196F3'],
            'line-width': 2.2,
            'line-opacity': 0.75,
            'line-join': 'round'
          }
        });
      }
      if (!map.getLayer('draw-line')) {
        map.addLayer({
          id: 'draw-line',
          type: 'line',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          paint: { 'line-color': ['coalesce', ['get','color'], '#64b5f6'], 'line-width': 2 }
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
            'icon-color': ['coalesce', ['get','color'], '#64b5f6'],
            'icon-opacity': 0.9
          }
        });
      }
      // Base point as colored circle for robust visibility
      if (!map.getLayer('draw-point-circle')) {
        map.addLayer({
          id: 'draw-point-circle', type: 'circle', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true]],
          paint: {
            'circle-color': ['coalesce', ['get','color'], '#2196F3'],
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
      // Optional label next to POI: show feature name when not empty/Untitled
      if (!map.getLayer('draw-point')) {
        map.addLayer({
          id: 'draw-point', type: 'symbol', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true], ['!=', ['get','_featureHidden'], true], ['!=', ['get','isLineEndpoint'], true]],
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
            'text-size': 14,
            'text-allow-overlap': true,
            'text-anchor': 'left',
            'text-offset': [1, 0],
            'text-letter-spacing': 0.02
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
            'text-halo-blur': 0.2
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
                  ['!=', ['downcase', ['coalesce', ['get', 'name'], '']], 'untitled']
                ],
                '\n',
                ''
              ],
              {},
              ['coalesce', ['get', 'area'], ''],
              { 'font-scale': 0.85 }
            ],
            'text-size': 14,
            'text-line-height': 1.1,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-justify': 'center',
            'text-max-width': 8,
            'text-allow-overlap': false,
            'text-padding': 2,
            'text-optional': true
          },
          paint: {
            'text-color': ['coalesce', ['get', 'color'], '#1f2933'],
            'text-halo-color': 'rgba(255,255,255,0.85)',
            'text-halo-width': 1.4,
            'text-halo-blur': 0.2
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
            'text-size': 13,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'text-anchor': 'bottom',
            'text-offset': [0, -0.7],
            'text-allow-overlap': false,
            'text-max-width': 6,
            'text-padding': 2,
            'text-optional': true
          },
          paint: {
            'text-color': ['coalesce', ['get', 'color'], '#1f2933'],
            'text-halo-color': 'rgba(255,255,255,0.85)',
            'text-halo-width': 1.2,
            'text-halo-blur': 0.2
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
            'text-size': 12,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'text-anchor': 'top',
            'text-offset': [0, 0.7],
            'text-allow-overlap': false,
            'text-max-width': 6,
            'text-padding': 2,
            'text-optional': true
          },
          paint: {
            'text-color': ['coalesce', ['get', 'color'], '#1f2933'],
            'text-halo-color': 'rgba(255,255,255,0.85)',
            'text-halo-width': 1.2,
            'text-halo-blur': 0.2
          }
        });
      }
      if (!map.getLayer('draw-draft-fill')) {
        map.addLayer({ id: 'draw-draft-fill', type: 'fill', source: 'draw-draft', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#2196F3', 'fill-opacity': 0.10 } });
      }
      if (!map.getLayer('draw-draft-line')) {
        map.addLayer({ id: 'draw-draft-line', type: 'line', source: 'draw-draft', paint: { 'line-color': '#64b5f6', 'line-width': 2, 'line-dasharray': [2,2] } });
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
      const src = map.getSource('draw');
      if (src) src.setData(drawStore);
      updateFeatureLabels();
      updateDrawingsPanel();
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
          requestLiveFeaturesSync();
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
          return f;
        }) : [];
        refreshDraw();
        requestLiveFeaturesSync(0);
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
          const geom = feature.geometry;
          const kind = (feature.properties?.kind || '').toLowerCase();
          const color = typeof feature.properties?.color === 'string' ? feature.properties.color : '#1f2933';
          if (geom?.type === 'Polygon' && kind !== 'arrow') {
            const rings = Array.isArray(geom.coordinates) ? geom.coordinates : [];
            const ring = Array.isArray(rings[0]) ? rings[0] : null;
            if (!ring || ring.length < 4) return;
            const centroid = polygonCentroid(ring);
            if (!centroid) return;
            const area = areaSqm(ring);
            if (!Number.isFinite(area)) return;
            const name = (feature.properties?.name || '').trim() || 'Untitled';
            labels.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: centroid },
              properties: {
                labelType: 'polygon',
                name,
                area: fmtArea(area),
                color
              }
            });
            return;
          }
          if (geom?.type === 'LineString' && (kind === 'line' || kind === 'polyline' || kind === 'path' || kind === '')) {
            const coords = Array.isArray(geom.coordinates) ? geom.coordinates : [];
            if (coords.length < 2) return;
            const start = coords[0];
            const end = coords[coords.length - 1];
            if (!Array.isArray(start) || !Array.isArray(end)) return;
            const name = (feature.properties?.name || '').trim() || 'Untitled';
            const lengthMetersValue = lengthMeters(coords);
            if (!Number.isFinite(lengthMetersValue)) return;
            const length = fmtLen(lengthMetersValue);
            labels.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [start[0], start[1]] },
              properties: {
                labelType: 'line-name',
                name,
                color
              }
            });
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
    const colorPalette = ['#e91e63','#9c27b0','#3f51b5','#03a9f4','#009688','#4caf50','#ff9800','#795548','#607d8b','#f44336'];
    // Picker palette (30+ choices)
    const colorChoices = [
      '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#009688',
      '#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722','#795548','#9e9e9e',
      '#607d8b','#000000','#ffffff','#b71c1c','#880e4f','#4a148c','#311b92','#1a237e','#0d47a1',
      '#01579b','#006064','#004d40','#1b5e20','#33691e','#827717','#f57f17','#ff6f00','#e65100',
      '#bf360c'
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
        const color = lineFeature.properties?.color || '#64b5f6';
        const lineId = lineFeature.properties?.id;
        const makePoint = (coord, kind, { opacity = 1, hasInnerDot = false } = {}) => ({
          type: 'Feature',
          properties: {
            id: newId(),
            kind,
            color,
            pointOpacity: opacity,
            hasInnerDot,
            relatedLineId: lineId,
            isLineEndpoint: true
          },
          geometry: { type: 'Point', coordinates: [coord[0], coord[1]] }
        });
        drawStore.features.push(makePoint(start, 'line-start', { opacity: 1, hasInnerDot: true }));
        drawStore.features.push(makePoint(end, 'line-end', { opacity: 1 }));
      } catch (err) {
        console.error('addLineEndpoints failed', err);
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
        drawStore.features.forEach((feat) => {
          if (!feat || feat.properties?.relatedLineId !== lineId) return;
          if (!feat.geometry || feat.geometry.type !== 'Point') return;
          if (feat.properties?.kind === 'line-start') {
            feat.geometry.coordinates = [start[0], start[1]];
          } else if (feat.properties?.kind === 'line-end') {
            feat.geometry.coordinates = [end[0], end[1]];
          }
        });
      } catch (err) {
        console.error('syncLineEndpoints failed', err);
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
      if (tool === 'weather') {
        if (e?.preventDefault) e.preventDefault();
        const lngLat = e?.lngLat;
        if (lngLat) sampleWeatherAtPoint(lngLat);
        return;
      }
      if (tool === 'crosshair') {
        if (e?.preventDefault) e.preventDefault();
        const lngLat = e?.lngLat;
        if (lngLat && Number.isFinite(lngLat.lng) && Number.isFinite(lngLat.lat)) {
          showCoordinatesDialog(lngLat.lng, lngLat.lat);
        }
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

    const renderRow = (f) => {
      if (f?.properties?.isLineEndpoint) return null;
      const row = document.createElement('div');
      row.className = 'drawing-row';
      row.dataset.id = f.properties.id;
      const main = document.createElement('div');
      main.className = 'drawing-main';
      const nameWrap = document.createElement('div');
      nameWrap.className = 'drawing-name';
      const nameEl = document.createElement('div');
      nameEl.className = 'drawing-title';
      nameEl.contentEditable = 'true';
      nameEl.setAttribute('data-placeholder', 'Untitled');
      nameEl.textContent = f.properties?.name || '';
      nameWrap.appendChild(nameEl);
      const meta = document.createElement('div');
      meta.className = 'drawing-meta';
      const typeEl = document.createElement('div');
      typeEl.className = 'drawing-type';
      const size = document.createElement('div');
      size.className = 'drawing-size';
      const actions = document.createElement('div');
      actions.className = 'drawing-actions';
      const colorWrap = document.createElement('button');
      colorWrap.type = 'button';
      colorWrap.className = 'drawing-color';
      const getColor = () => (f.properties && f.properties.color) ? String(f.properties.color) : '#2196F3';
      const applyColorToWrap = () => { try { colorWrap.style.backgroundColor = getColor(); } catch {} };
      applyColorToWrap();
      colorWrap.title = 'Change color';
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
      const geomType = g.type || '';
      const isPointFeature = geomType === 'Point';
      const isArrowFeature = (f.properties?.kind || '').toLowerCase() === 'arrow';
      const disableEditAi = isArrowFeature;
      let editBtn = null;
      let updateEditBtnState = () => {};
      let startEdit = () => {};
      let stopEdit = () => {};
      if (!disableEditAi) {
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
      let aiBtn = null;
      if (!disableEditAi) {
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
      let label = f.properties.kind || g.type;
      let sizeText = '';
      if (g.type === 'LineString') {
        sizeText = fmtLen(lengthMeters(g.coordinates));
        label = 'line';
      } else if (g.type === 'Polygon') {
        const ring = g.coordinates[0];
        sizeText = fmtArea(areaSqm(ring));
        label = f.properties.kind || 'polygon';
      } else if (g.type === 'Point') {
        label = 'poi';
        sizeText = '';
      }
      typeEl.textContent = label;
      size.textContent = sizeText;
      const isArrow = f.properties?.kind === 'arrow';
      if (isArrow && editBtn) {
        editBtn.hidden = true;
        editBtn.disabled = true;
        const lenMeters = Number(f.properties?.lengthMeters);
        if (Number.isFinite(lenMeters)) size.textContent = fmtLen(lenMeters);
      }
      meta.appendChild(typeEl); meta.appendChild(size);
      // Place as grid items: name (col 1, row 1), actions (col 2, row 1), meta spans both columns in row 2
      row.appendChild(nameWrap);
      actions.appendChild(colorWrap);
      if (editBtn) actions.appendChild(editBtn);
      actions.appendChild(toggleBtn);
      if (aiBtn) actions.appendChild(aiBtn);
      actions.appendChild(del);
      row.appendChild(actions);
      row.appendChild(meta);
      row.addEventListener('mouseenter', () => setHighlight(f.properties.id));
      row.addEventListener('mouseleave', () => setHighlight(null));
      const commitName = () => {
        f.properties = f.properties || {};
        f.properties.name = (nameEl.textContent || '').trim();
      };
      nameEl.addEventListener('blur', () => {
        commitName();
        setDirty(true);
        refreshDraw();
        notifyFeatureModified('Feature renamed');
      });
      nameEl.addEventListener('input', () => { commitName(); setDirty(true); refreshDrawMapOnly(); });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
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
      applyToggleState();
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
        if (!stoppedEditing) {
          setDirty(true);
          refreshDraw();
        }
        notifyFeatureModified(nextHidden ? 'messages.featureHidden' : 'messages.featureShown', nextHidden ? 'Feature hidden' : 'Feature shown');
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

    const normalizeImportedFeature = (feature, existingIds) => {
      if (!feature || feature.type !== 'Feature' || !feature.geometry) return null;
      let clone;
      try {
        clone = JSON.parse(JSON.stringify(feature));
      } catch (err) {
        console.error('Failed cloning feature', err);
        return null;
      }
      clone.properties = { ...(clone.properties || {}) };
      const geomType = clone.geometry?.type;
      if (!clone.properties.kind) {
        if (geomType === 'Polygon') clone.properties.kind = 'polygon';
        else if (geomType === 'LineString') clone.properties.kind = 'line';
        else if (geomType === 'Point') clone.properties.kind = 'poi';
      }
      if (!clone.properties.color) clone.properties.color = nextColor();
      if (!clone.properties.id || existingIds.has(clone.properties.id)) {
        let candidate;
        do {
          candidate = newId();
        } while (existingIds.has(candidate));
        clone.properties.id = candidate;
      }
      existingIds.add(clone.properties.id);
      return clone;
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
        requestLiveFeaturesSync(0);
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

    const handleFeaturesClear = () => {
      closeFeaturesActionsMenu();
      if (!Array.isArray(drawStore.features) || drawStore.features.length === 0) return;
      const ok = confirm('Clear all features? This cannot be undone.');
      if (!ok) return;
      drawStore.features = [];
      refreshDraw();
      setDirty(true);
      showToast('Features cleared');
      requestLiveFeaturesSync(0);
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

  function setStatus(state, path) {
    if (serialStatusDot) serialStatusDot.dataset.state = state;
    if (serialConnectBtn) {
      const labelKey = state === 'connected' ? 'serial.status.connected' : state === 'connecting' ? 'serial.status.connecting' : 'serial.connectButton';
      const computedLabel = t(labelKey, state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting…' : 'Connect');
      serialConnectBtn.setAttribute('aria-label', computedLabel);
      serialConnectBtn.setAttribute('title', computedLabel);
      if (state === 'connected') {
        serialConnectBtn.disabled = true;
        serialConnectBtn.setAttribute('aria-disabled', 'true');
      } else if (state === 'connecting') {
        serialConnectBtn.disabled = true;
        serialConnectBtn.setAttribute('aria-disabled', 'true');
      } else {
        serialConnectBtn.disabled = false;
        serialConnectBtn.removeAttribute('aria-disabled');
      }
    }

    if (state === 'connected') {
      serialConnected = true;
      serialConnecting = false;
      trackerDataSeen = trackerStore.size > 0;
    } else if (state === 'connecting') {
      serialConnected = false;
      serialConnecting = true;
      trackerDataSeen = false;
    } else {
      serialConnected = false;
      serialConnecting = false;
      trackerDataSeen = trackerStore.size > 0;
    }

    if (state !== 'connected' && trackersRecordingState.active) {
      trackersRecordingState.active = false;
    }

    updateTrackersPanelState();
  }

  async function refreshPortsList() {
    try {
      if (portsContainer) {
        portsContainer.innerHTML = '';
        const scanning = ce('div', 'muted');
        bindText(scanning, 'connectModal.scanning', 'Scanning ports…');
        portsContainer.appendChild(scanning);
      }
      const ports = await window.serial.listPorts();
      if (!ports || ports.length === 0) {
        if (portsContainer) {
          portsContainer.innerHTML = '';
          const empty = ce('div', 'muted');
          bindText(empty, 'connectModal.noPorts', 'No ports found');
          portsContainer.appendChild(empty);
        }
        selectedPath = null;
        return;
      }
      portsContainer.innerHTML = '';
      ports.forEach((p, idx) => {
        const row = ce('label', 'port-row');
        row.setAttribute('role', 'option');
        const input = ce('input');
        input.type = 'radio';
        input.name = 'port';
        input.value = p.path;
        if (idx === 0) { input.checked = true; selectedPath = p.path; }
        input.addEventListener('change', () => { selectedPath = input.value; });
        const meta = ce('div', 'port-meta');
        const title = ce('div', 'port-title');
        title.textContent = p.path;
        const sub = ce('div', 'port-sub');
        sub.textContent = [p.manufacturer, p.productId && `PID:${p.productId}`, p.vendorId && `VID:${p.vendorId}`].filter(Boolean).join(' • ');
        meta.appendChild(title); meta.appendChild(sub);
        row.appendChild(input); row.appendChild(meta);
        portsContainer.appendChild(row);
      });
    } catch (e) {
      portsContainer.innerHTML = `<div class="muted">Error listing ports: ${String(e)}</div>`;
    }
  }

  function openConnectModal() {
    connectModal.hidden = false;
    connectModal.querySelector('.modal-panel').focus?.();
    refreshPortsList();
  }
  function closeConnectModal() { connectModal.hidden = true; }

  async function connectSelected() {
    if (!selectedPath) return;
    setStatus('connecting');
    connectBtnAction.disabled = true;
    try {
      const baud = Number(connectBaud.value || 115200);
      setSerialMonitorVisible(false); // ensure hidden until confirmed connected
      await window.serial.open(selectedPath, baud);
      setStatus('connected', selectedPath);
      setSerialMonitorVisible(true);
      if (serialConnPath) serialConnPath.textContent = selectedPath;
      closeConnectModal();
    } catch (e) {
      setStatus('disconnected');
      setSerialMonitorVisible(false);
      alert(`Failed to open ${selectedPath}: ${String(e)}`);
    } finally {
      connectBtnAction.disabled = false;
    }
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
  serialConnectBtn?.addEventListener('click', openConnectModal);
  connectClose?.addEventListener('click', closeConnectModal);
  connectModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeConnectModal();
  });
  refreshPorts?.addEventListener('click', refreshPortsList);
  connectBtnAction?.addEventListener('click', connectSelected);

  trackersRecordBtn?.addEventListener('click', handleTrackersRecordClick);
  trackersSaveBtn?.addEventListener('click', handleTrackersSave);
  trackersOpenBtn?.addEventListener('click', handleTrackersOpen);

  refreshTrackersControlsState();

  // Ensure the serial monitor button starts hidden
  try { setSerialMonitorVisible(false); } catch {}

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
  mapWelcomeSettings?.addEventListener('click', () => {
    if (tabSettingsInput) tabSettingsInput.checked = true;
    if (tabMapInput) tabMapInput.checked = false;
    updateTabUI();
    try {
      if (tabSettingsLabel && typeof tabSettingsLabel.focus === 'function') tabSettingsLabel.focus();
    } catch {}
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
    const minW = 280, maxW = 400;
    let sidebarOpen = false;

    let resizeTimer = null;
    const scheduleResize = (delay=260) => {
      try { if (resizeTimer) clearTimeout(resizeTimer); } catch {}
      resizeTimer = setTimeout(() => { try { getMap()?.resize(); } catch {} }, delay);
    };
    const readW = () => {
      const saved = Number(localStorage.getItem('ui.sidebar.w'));
      return Number.isFinite(saved) ? Math.min(maxW, Math.max(minW, saved)) : 320;
    };
    const applyOpen = (open) => {
      const show = !!open;
      sidebarOpen = show;
      closeFeaturesActionsMenu();
      if (show) {
        const w = readW();
        root.style.setProperty('--sidebar-w', w + 'px');
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

    if (featuresResizer) {
      let startX=0, startW=readW(), dragging=false;
      const onMove = (e) => {
        if (!dragging) return;
        const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        const dx = clientX - startX;
        const w = Math.min(maxW, Math.max(minW, startW + dx));
        root.style.setProperty('--sidebar-w', w + 'px');
        try { localStorage.setItem('ui.sidebar.w', String(w)); } catch {}
        e.preventDefault?.();
        scheduleResize(50);
      };
      const onUp = () => { if (!dragging) return; dragging=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp); };
      const onDown = (e) => {
        if (!sidebarOpen) return;
        dragging=true;
        startX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        startW = parseFloat(getComputedStyle(root).getPropertyValue('--sidebar-w')) || readW();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive:false });
        document.addEventListener('touchend', onUp);
        e.preventDefault?.();
      };
      featuresResizer.addEventListener('mousedown', onDown);
      featuresResizer.addEventListener('touchstart', onDown, { passive:false });
    }

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
    const connectBtnEl = trackersConnectBtn || q('#trackersConnectBtn');
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
        toggleBtn.setAttribute('aria-label', show ? 'Hide trackers panel' : 'Show trackers panel');
        toggleBtn.title = show ? 'Hide trackers panel' : 'Show trackers panel';
      }
      if (collapseEl) {
        collapseEl.setAttribute('aria-expanded', String(show));
        collapseEl.title = show ? 'Hide tracker sidebar' : 'Show tracker sidebar';
        collapseEl.setAttribute('aria-label', show ? 'Hide tracker sidebar' : 'Show tracker sidebar');
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

    connectBtnEl?.addEventListener('click', () => {
      try { (window).openTrackersPanel && (window).openTrackersPanel(); } catch {}
      openConnectModal();
    });

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
      initMap();
    }, { once: true });
  } else {
    try { initSidebar(); } catch {}
    try { initTrackersSidebar(); } catch {}
    initMap();
  }

  // Serial event listeners
  window.serial.onStatus((payload) => {
    // Hide monitor button by default; only show on connected
    setSerialMonitorVisible(false);
    if (!payload) return;
    if (payload.state === 'connected') {
      setStatus('connected', payload.path);
      setSerialMonitorVisible(true);
      if (serialConnPath) serialConnPath.textContent = payload.path || 'connected';
      showToast(`Serial connected: ${payload.path || 'port'}`);
    } else if (payload.state === 'disconnected' || payload.state === 'connecting' || payload.state === 'error') {
      setStatus(payload.state === 'connecting' ? 'connecting' : 'disconnected');
      if (payload.state === 'error') console.error('Serial error:', payload.message);
      if (serialMonitorModal && serialMonitorModal.hidden === false) serialMonitorModal.hidden = true;
    }
  });

  const maxLines = 500;

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
      if (previousTool === 'arrow' && tool !== 'arrow') {
        window._cleanupArrowInteraction?.();
      }
      const all = [toolRect, toolPoly, toolCircle, toolLine, toolArrow, toolPOI, toolWeather, toolCrosshair];
      all.forEach(btn => btn?.classList.remove('active'));
      // aria-pressed state for buttons
      all.forEach(btn => btn && btn.setAttribute('aria-pressed', String(false)));
      // no POI palette in the toolbar
      switch (tool) {
        case 'rect': toolRect?.classList.add('active'); toolRect?.setAttribute('aria-pressed', String(true)); break;
        case 'poly': toolPoly?.classList.add('active'); toolPoly?.setAttribute('aria-pressed', String(true)); break;
        case 'circle': toolCircle?.classList.add('active'); toolCircle?.setAttribute('aria-pressed', String(true)); break;
        case 'line': toolLine?.classList.add('active'); toolLine?.setAttribute('aria-pressed', String(true)); break;
        case 'arrow': toolArrow?.classList.add('active'); toolArrow?.setAttribute('aria-pressed', String(true)); break;
        case 'poi':
          toolPOI?.classList.add('active');
          toolPOI?.setAttribute('aria-pressed', String(true));
          break;
        case 'weather':
          toolWeather?.classList.add('active');
          toolWeather?.setAttribute('aria-pressed', String(true));
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
      if (tool && tool !== 'poi' && tool !== 'weather' && tool !== 'crosshair') ensureFeaturesVisible();
    };
    // Expose for global key handlers
    (window).setActiveTool = setActiveTool;
    toolRect?.addEventListener('click', () => setActiveTool((window)._currentTool === 'rect' ? null : 'rect'));
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
    toolWeather?.addEventListener('click', () => setActiveTool((window)._currentTool === 'weather' ? null : 'weather'));
    toolCrosshair?.addEventListener('click', () => setActiveTool((window)._currentTool === 'crosshair' ? null : 'crosshair'));

    const applyScaleFromDenominator = (scaleValue) => {
      const map = getMap();
      if (!map || !Number.isFinite(scaleValue) || scaleValue <= 0) return false;
      const center = map.getCenter?.();
      if (!center || !Number.isFinite(center.lat)) return false;
      const latRad = center.lat * DEG_TO_RAD;
      const cosLat = Math.cos(latRad);
      if (!Number.isFinite(cosLat) || Math.abs(cosLat) < 1e-6) return false;
      const targetMetersPerPixel = (scaleValue * 0.0254) / 96;
      if (!Number.isFinite(targetMetersPerPixel) || targetMetersPerPixel <= 0) return false;
      const metersPerPixelAtLat = 156543.03392 * cosLat;
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

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Unable to prepare snapshot canvas');
      ctx.drawImage(canvas, 0, 0);

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
        ? 156543.03392 * Math.cos(latForScale * DEG_TO_RAD) / Math.pow(2, zoom)
        : null;
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

      const drawSnapshotPanel = () => {
        const padding = Math.round(Math.max(exportCanvas.width, exportCanvas.height) * 0.015);
        const baseFont = '"Inter", "Segoe UI", "Helvetica Neue", sans-serif';
        const valueFontSize = Math.max(9, Math.round(Math.max(exportCanvas.width, exportCanvas.height) * 0.01));
        const labelFontSize = Math.max(7, Math.round(valueFontSize * 0.65));
        const lineHeight = valueFontSize + 1;
        const labelSpacing = Math.round(labelFontSize * 0.2);
        const metricSpacing = Math.round(lineHeight * 0.3);

        const metrics = [
          { label: 'Latitude', lines: [formatDegrees(center?.lat)] },
          { label: 'Longitude', lines: [formatDegrees(center?.lng)] },
          { label: 'UTM', lines: formatUTMLines(utm) },
          { label: 'Zoom', lines: [formatZoom(zoom)] },
          { label: 'Heading', lines: [formatBearing(normalizedBearing)] },
          { label: 'Pitch', lines: [formatPitch(pitch)] },
          { label: 'Scale', lines: [formatScale(scaleDenominator)] }
        ];

        const labelFont = `600 ${labelFontSize}px ${baseFont}`;
        const valueFont = `500 ${valueFontSize}px ${baseFont}`;

        const wrapValueLines = (lines, width) => {
          ctx.font = valueFont;
          const result = [];
          const parts = Array.isArray(lines) ? lines : [lines];
          const measure = (text) => ctx.measureText(text).width;
          parts.forEach((textValue) => {
            const words = String(textValue).split(/\s+/);
            let current = '';
            words.forEach((word) => {
              const candidate = current ? `${current} ${word}` : word;
              if (measure(candidate) <= width) {
                current = candidate;
              } else {
                if (current) result.push(current);
                if (measure(word) <= width) {
                  current = word;
                } else {
                  let fragment = '';
                  for (const char of word) {
                    const next = fragment ? `${fragment}${char}` : char;
                    if (measure(next) > width && fragment) {
                      result.push(fragment);
                      fragment = char;
                    } else {
                      fragment = next;
                    }
                  }
                  current = fragment;
                }
              }
            });
            if (current) {
              result.push(current);
              current = '';
            }
          });
          if (!result.length) result.push('');
          return result;
        };

        const compassRadiusBase = Math.min(Math.round(Math.max(exportCanvas.width, exportCanvas.height) * 0.055), 56);
        const compassDiameter = compassRadiusBase * 2;
        const maxPanelWidth = exportCanvas.width - padding * 2;
        const minTextWidth = Math.max(150, Math.round(valueFontSize * 6));

        const measureMetrics = (textWidth) => {
          let maxWidth = 0;
          let totalHeight = 0;
          const wrappedMetrics = metrics.map((metric) => {
            ctx.font = labelFont;
            const labelText = metric.label.toUpperCase();
            const labelWidth = ctx.measureText(labelText).width;
            if (labelWidth > maxWidth) maxWidth = labelWidth;
            totalHeight += labelFontSize + labelSpacing;

            ctx.font = valueFont;
            const wrappedLines = wrapValueLines(metric.lines, textWidth);
            wrappedLines.forEach((line) => {
              const w = ctx.measureText(line).width;
              if (w > maxWidth) maxWidth = w;
            });
            totalHeight += wrappedLines.length * lineHeight + metricSpacing;
            return { label: metric.label, lines: wrappedLines };
          });
          if (wrappedMetrics.length) totalHeight -= metricSpacing;
          return { wrappedMetrics, maxWidth, totalHeight };
        };

        let textWidth = Math.max(minTextWidth, maxPanelWidth - (compassDiameter + padding * 3));
        if (textWidth < minTextWidth) textWidth = minTextWidth;

        let { wrappedMetrics, maxWidth, totalHeight } = measureMetrics(textWidth);
        textWidth = Math.max(minTextWidth, Math.min(textWidth, maxWidth));
        let panelWidth = compassDiameter + padding * 3 + textWidth;
        if (panelWidth > maxPanelWidth) {
          textWidth = Math.max(minTextWidth, maxPanelWidth - (compassDiameter + padding * 3));
          ({ wrappedMetrics, maxWidth, totalHeight } = measureMetrics(textWidth));
          textWidth = Math.max(minTextWidth, Math.min(textWidth, maxWidth));
          panelWidth = Math.min(maxPanelWidth, compassDiameter + padding * 3 + textWidth);
        }

        const innerHeight = Math.max(totalHeight, compassDiameter);
        const panelHeight = Math.min(exportCanvas.height - padding * 2, innerHeight + padding * 2);
        const x = exportCanvas.width - panelWidth - padding;
        const y = padding;

        ctx.save();

        const cornerRadius = Math.max(12, Math.round(panelWidth * 0.08));
        ctx.shadowColor = 'rgba(15, 23, 42, 0.55)';
        ctx.shadowBlur = Math.max(8, Math.round(panelWidth * 0.04));
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.round(panelWidth * 0.015);

        const gradient = ctx.createLinearGradient(x, y, x, y + panelHeight);
        gradient.addColorStop(0, 'rgba(30, 41, 59, 0.95)');
        gradient.addColorStop(1, 'rgba(17, 24, 39, 0.9)');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(x + cornerRadius, y);
        ctx.lineTo(x + panelWidth - cornerRadius, y);
        ctx.quadraticCurveTo(x + panelWidth, y, x + panelWidth, y + cornerRadius);
        ctx.lineTo(x + panelWidth, y + panelHeight - cornerRadius);
        ctx.quadraticCurveTo(x + panelWidth, y + panelHeight, x + panelWidth - cornerRadius, y + panelHeight);
        ctx.lineTo(x + cornerRadius, y + panelHeight);
        ctx.quadraticCurveTo(x, y + panelHeight, x, y + panelHeight - cornerRadius);
        ctx.lineTo(x, y + cornerRadius);
        ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const compassRadius = Math.min(compassRadiusBase, (panelHeight - padding * 2) / 2);
        const compassCx = x + panelWidth - padding - compassRadius;
        const compassCy = y + padding + compassRadius;
        drawCompass(ctx, compassCx, compassCy, compassRadius, normalizedBearing);

        const textLeft = x + padding;
        const textRightLimit = compassCx - compassRadius - Math.round(padding * 0.6);
        const availableTextWidth = Math.max(60, Math.min(textWidth, textRightLimit - textLeft));

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let textY = y + padding;
        wrappedMetrics.forEach((metric, idx) => {
          ctx.font = labelFont;
          ctx.fillStyle = 'rgba(203, 213, 225, 0.88)';
          ctx.fillText(metric.label.toUpperCase(), textLeft, textY);
          textY += labelFontSize + labelSpacing;

          ctx.font = valueFont;
          ctx.fillStyle = '#f8fafc';
          const lines = wrapValueLines(metric.lines, availableTextWidth);
          lines.forEach((line) => {
            ctx.fillText(line, textLeft, textY);
            textY += lineHeight;
          });

          if (idx !== wrappedMetrics.length - 1) {
            textY += metricSpacing;
          }
        });

        ctx.restore();
      };

      drawSnapshotPanel();

      const drawScaleBar = () => {
        if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return;
        const maxBarWidthPx = Math.min(exportCanvas.width * 0.28, 220);
        const niceSteps = [1, 2, 5];
        let bestMeters = null;
        let bestWidthPx = 0;
        const targetMeters = metersPerPixel * maxBarWidthPx;
        for (let exp = -3; exp <= 6; exp++) {
          const base = Math.pow(10, exp);
          niceSteps.forEach((step) => {
            const lengthMeters = step * base;
            const widthPx = lengthMeters / metersPerPixel;
            if (widthPx <= maxBarWidthPx) {
              if (widthPx > bestWidthPx) {
                bestWidthPx = widthPx;
                bestMeters = lengthMeters;
              }
            }
          });
        }
        if (!bestMeters) {
          // fallback: choose the smallest candidate greater than target
          let minOverflow = Infinity;
          let minLength = null;
          for (let exp = -3; exp <= 6; exp++) {
            const base = Math.pow(10, exp);
            niceSteps.forEach((step) => {
              const lengthMeters = step * base;
              const widthPx = lengthMeters / metersPerPixel;
              if (widthPx > maxBarWidthPx && widthPx < minOverflow) {
                minOverflow = widthPx;
                minLength = lengthMeters;
              }
            });
          }
          bestMeters = minLength || targetMeters || 1000;
          bestWidthPx = bestMeters / metersPerPixel;
        }
        if (!Number.isFinite(bestMeters) || !Number.isFinite(bestWidthPx) || bestWidthPx <= 0) return;

        const segments = 4;
        const segmentWidth = bestWidthPx / segments;
        const barHeight = Math.max(8, Math.round(exportCanvas.height * 0.015));
        const margin = Math.round(Math.max(exportCanvas.width, exportCanvas.height) * 0.02);
        const labelHeight = barHeight * 1.8;
        const panelPadding = Math.round(barHeight * 0.9);
        const contentWidth = bestWidthPx + panelPadding * 2 + 50;
        const contentHeight = barHeight + panelPadding * 2 + labelHeight;
        const panelWidth = Math.max(contentWidth, 160);
        const panelHeight = Math.max(contentHeight, barHeight + panelPadding * 2 + labelHeight);
        const panelX = exportCanvas.width - margin - panelWidth;
        const panelY = exportCanvas.height - margin - panelHeight;
        const barX = panelX + panelPadding;
        const barY = panelY + panelPadding + labelHeight;
        ctx.save();

        ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
        ctx.shadowBlur = Math.max(6, Math.round(panelWidth * 0.04));
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.round(panelWidth * 0.015);
        const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.88)');
        const cornerRadius = Math.max(10, Math.round(panelWidth * 0.08));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(panelX + cornerRadius, panelY);
        ctx.lineTo(panelX + panelWidth - cornerRadius, panelY);
        ctx.quadraticCurveTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + cornerRadius);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight - cornerRadius);
        ctx.quadraticCurveTo(panelX + panelWidth, panelY + panelHeight, panelX + panelWidth - cornerRadius, panelY + panelHeight);
        ctx.lineTo(panelX + cornerRadius, panelY + panelHeight);
        ctx.quadraticCurveTo(panelX, panelY + panelHeight, panelX, panelY + panelHeight - cornerRadius);
        ctx.lineTo(panelX, panelY + cornerRadius);
        ctx.quadraticCurveTo(panelX, panelY, panelX + cornerRadius, panelY);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.translate(barX, barY);

        for (let i = 0; i < segments; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#0f172a' : '#f8fafc';
          ctx.fillRect(segmentWidth * i, 0, segmentWidth, barHeight);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(segmentWidth * i + 0.4, 0.4, segmentWidth - 0.8, barHeight - 0.8);
        }
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1;
        ctx.strokeRect(-0.5, -0.5, bestWidthPx + 1, barHeight + 1);

        const useKilometers = bestMeters >= 1000;
        const unitLabel = useKilometers ? 'km' : 'm';
        const formatter = (meters) => {
          if (useKilometers) {
            const km = meters / 1000;
            return Math.abs(km - Math.round(km)) < 1e-6 ? `${Math.round(km)}` : km.toFixed(1);
          }
          return Math.round(meters).toLocaleString();
        };

        ctx.fillStyle = '#f8fafc';
        ctx.font = `600 ${Math.max(9, Math.round(barHeight * 0.85))}px "Inter", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (let i = 0; i <= segments; i++) {
          const valueMeters = bestMeters * (i / segments);
          const label = formatter(valueMeters);
          ctx.fillText(label, segmentWidth * i, -6);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${Math.max(8, Math.round(barHeight * 0.75))}px "Inter", "Segoe UI", sans-serif`;
        ctx.fillText(unitLabel.toUpperCase(), bestWidthPx + 10, barHeight / 2);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `600 ${Math.max(9, Math.round(barHeight * 0.72))}px "Inter", "Segoe UI", sans-serif`;
        ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
        const title = 'SCALE';
        ctx.fillText(title, -panelPadding, -labelHeight + Math.max(2, Math.round(barHeight * 0.2)));
        ctx.font = `500 ${Math.max(9, Math.round(barHeight * 0.78))}px "Inter", "Segoe UI", sans-serif`;
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`1 : ${Math.round(bestMeters / (segmentWidth / segments * metersPerPixel)).toLocaleString()}`, -panelPadding, -Math.max(4, Math.round(barHeight * 0.15)));

        ctx.restore();
      };

      drawScaleBar();

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

    const handleSaveMapSnapshot = async () => {
      if (!toolPrint || toolPrint.disabled) return;
      toolPrint.disabled = true;
      try {
        const map = getMap();
        if (!map) {
          showToast(t('alerts.mapNotReady', 'Map is not ready yet.'), 'error', 2200);
          return;
        }
        const snapshot = await captureMapSnapshot();
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
        toolPrint.disabled = false;
      }
    };

    toolPrint?.addEventListener('click', handleSaveMapSnapshot);

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

    const openPushLiveModal = () => {
      if (!pushLiveModal) return;
      abortLiveRequest();
      if (!currentLiveSession) currentLiveSession = loadStoredLiveSession();
      const shouldAutoStart = !currentLiveSession;
      applyLiveSessionState({ skipStatus: shouldAutoStart });
      pushLiveModal.hidden = false;
      pushLiveModal.setAttribute('aria-hidden', 'false');
      if (pushLiveClose) {
        setTimeout(() => {
          try { pushLiveClose.focus(); } catch {}
        }, 0);
      }
      if (shouldAutoStart) {
        startLiveSession().catch((err) => {
          console.error('startLiveSession failed', err);
        });
      }
    };
    const closePushLiveModal = () => {
      if (!pushLiveModal) return;
      abortLiveRequest();
      pushLiveModal.hidden = true;
      pushLiveModal.setAttribute('aria-hidden', 'true');
      applyLiveSessionState({ skipStatus: true });
    };
    toolPushLive?.addEventListener('click', openPushLiveModal);
    pushLiveClose?.addEventListener('click', closePushLiveModal);
    pushLiveModal?.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.action === 'close') closePushLiveModal();
    });
    pushLiveModal?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePushLiveModal();
        e.stopPropagation();
      }
    });
    pushLiveStart?.addEventListener('click', () => {
      startLiveSession().catch((err) => {
        console.error('startLiveSession failed', err);
      });
    });
    pushLiveEnd?.addEventListener('click', () => {
      endLiveSession().catch((err) => {
        console.error('endLiveSession failed', err);
      });
    });
    pushLiveCancel?.addEventListener('click', closePushLiveModal);

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

    const openSerialMonitorFromShortcut = () => {
      if (serialMonitorBtn && !serialMonitorBtn.hidden) {
        serialMonitorBtn.click();
      } else if (serialMonitorModal) {
        serialMonitorModal.hidden = false;
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
        case '7': toggleToolShortcut('weather'); event.preventDefault(); return;
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
        case 'T':
        case 't':
          toggleTrackersSidebarViaShortcut();
          event.preventDefault();
          return;
        case 'L':
        case 'l':
          if (!toolPushLive?.hidden && !toolPushLive?.disabled) {
            openPushLiveModal();
            event.preventDefault();
            return;
          }
          break;
        case 'C':
        case 'c':
          openGotoModal();
          event.preventDefault();
          return;
        case 'M':
        case 'm':
          openSerialMonitorFromShortcut();
          event.preventDefault();
          return;
        case 'S':
        case 's':
          if (event.shiftKey) {
            openConnectModal();
          } else {
            toolSearch?.click();
          }
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
    if (serialMonitorModal && serialMonitorModal.hidden === false) {
      serialMonitorModal.hidden = true;
      return true;
    }
    if (connectModal && connectModal.hidden === false) {
      closeConnectModal();
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
        m.off('mousemove', onMove);
        m.off('mouseup', onUp);
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup', onUp, true);
        document.removeEventListener('touchmove', onMove, { capture:true });
        document.removeEventListener('touchend', onUp, { capture:true });
      } catch {}
      try { (window)._refreshDraw && (window)._refreshDraw(); } catch {}
    };
    // Begin drag helpers
    const beginDrag = () => {
      try {
        const m = getM(); if (!m) return;
        m.getCanvas().style.cursor = 'grabbing';
        m.dragPan.disable();
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

  window.serial.onData((line) => {
    const outEl = serialMonitorBody;
    if (outEl) {
      const atBottom = Math.abs(outEl.scrollHeight - outEl.scrollTop - outEl.clientHeight) < 8;
      const text = typeof line === 'string' ? line : String(line);
      outEl.append(document.createTextNode(text.replace(/\r?\n$/, '')));
      outEl.append(document.createTextNode('\n'));
      const all = outEl.textContent || '';
      const lines = all.split('\n');
      if (lines.length > maxLines) {
        const trimmed = lines.slice(lines.length - maxLines).join('\n');
        outEl.textContent = trimmed;
      }
      if (atBottom) outEl.scrollTop = outEl.scrollHeight;
    }
    try { processTrackerLine(line); } catch (err) { console.error('tracker parse failed', err); }
  });
  if (typeof window.serial.onAutoProbe === 'function') {
    window.serial.onAutoProbe((payload) => {
      const path = payload?.path || '—';
      const responseRaw = String(payload?.response || '').trim();
      let handled = false;
      if (responseRaw.includes(':')) {
        const [typePart, ...rest] = responseRaw.split(':');
        const idPart = rest.join(':');
        const normalizedId = normalizeTrackerIdFromAutoProbe(typePart, idPart);
        if (normalizedId) {
          ensureTrackerStub(normalizedId, { name: normalizedId === 'CO-ROOT' ? 'CO-ROOT' : null });
          const template = t('status.autoProbeAdded', 'Auto probe discovered {id} on {path}');
          const msg = template
            .replace('{id}', normalizedId)
            .replace('{path}', path);
          showToast(msg);
          handled = true;
        }
      }
      if (!handled) {
        const template = t('status.autoProbeResponse', 'Auto probe response from {path}: {response}');
        const message = template
          .replace('{path}', path)
          .replace('{response}', responseRaw);
        showToast(message);
      }
    });
  }
  if (typeof window.serial.onAutoProbeError === 'function') {
    window.serial.onAutoProbeError((payload) => {
      const template = t('status.autoProbeError', 'Auto probe failed for {path}: {error}');
      const message = template
        .replace('{path}', payload?.path || '—')
        .replace('{error}', String(payload?.error || '').trim() || '—');
      showToast(message, 'error');
    });
  }
})();

// Serial monitor modal wiring
(function initSerialMonitor(){
  const btn = document.querySelector('#serialMonitorBtn');
  const modal = document.querySelector('#serialMonitorModal');
  const closeBtn = document.querySelector('#serialMonitorClose');
  const disconnectBtn = document.querySelector('#serialDisconnectBtn');
  const clearBtn = document.querySelector('#serialMonitorClear');
  const monitorBody = document.querySelector('#serialMonitorBody');
  if (btn && modal) {
    btn.addEventListener('click', () => { modal.hidden = false; });
    closeBtn?.addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', (e) => { const t=e.target; if (t && t.dataset && t.dataset.action==='close') modal.hidden = true; });
  }
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      try { await window.serial.close(); } catch {}
      try { modal.hidden = true; } catch {}
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      try {
        if (monitorBody) monitorBody.textContent = '';
      } catch {}
    });
  }
})();
