(() => {
  const q = (sel) => document.querySelector(sel);
  const ce = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };
  const DEFAULT_HOME_CENTER = [6.3729914, 49.5658574];
  const DEFAULT_MAP_START = [6.13, 49.61];
  const DEFAULT_STYLE_URL = 'mapbox://styles/mapbox/streets-v12';
  const DEFAULT_START_ZOOM = 12;
  const DEFAULT_SERIAL_BAUD = '115200';
  const DEFAULT_AUTO_RECONNECT = 'on';
  const TRACKERS_PANEL_WIDTH = 320;
  const TRACKERS_RECORD_ICON = './assets/icons/regular/record.svg';
  const TRACKERS_PAUSE_ICON = './assets/icons/regular/pause.svg';

  // Map stats UI
  const statZoom = q('#statZoom');
  const statCenter = q('#statCenter');
  const statBearing = q('#statBearing');
  const statPitch = q('#statPitch');
  const statLayer = q('#statLayer');

  const serialConnectBtn = q('#serialConnectBtn');
  const serialConnectLabel = serialConnectBtn?.querySelector('.serial-label');
  const serialStatusDot = q('#serialStatusDot');
  const statSerial = q('#statSerial');
  const statRxRate = q('#statRxRate');
  const footerAddress = q('#footerAddress');
  const fullscreenBtn = q('#fullscreenBtn');
  const tabMapInput = q('#tab-map');
  const tabSettingsInput = q('#tab-settings');
  const tabMapLabel = document.querySelector('label[for="tab-map"]');
  const tabSettingsLabel = document.querySelector('label[for="tab-settings"]');
  const mapWelcome = q('#mapWelcome');
  const mapWelcomeSettings = q('#mapWelcomeSettings');

  const connectModal = q('#connectModal');
  const portsContainer = q('#portsContainer');
  const connectClose = q('#connectClose');
  const refreshPorts = q('#refreshPorts');
  const connectBtnAction = q('#connectBtnAction');
  const connectBaud = q('#connectBaud');

  const serialFloat = q('#serialFloat');
  const serialFloatBody = q('#serialFloatBody');
  const serialFloatToggle = q('#serialFloatToggle');
  // New serial monitor modal
  const serialMonitorBtn = q('#serialMonitorBtn');
  const serialMonitorModal = q('#serialMonitorModal');
  const serialMonitorClose = q('#serialMonitorClose');
  const serialMonitorBody = q('#serialMonitorBody');
  const serialConnPath = q('#serialConnPath');
  const serialDisconnectBtn = q('#serialDisconnectBtn');
  const serialMonitorClearBtn = q('#serialMonitorClear');
  const inputLng = q('#inputLng');
  const inputLat = q('#inputLat');
  const toolRect = q('#toolRect');
  const toolPoly = q('#toolPoly');
  const toolCircle = q('#toolCircle');
  const toolLine = q('#toolLine');
  const toolPOI = q('#toolPOI');
  const toolSearch = q('#toolSearch');
  const toolGoTo = q('#toolGoTo');
  const drawingsList = q('#drawingsList');
  const featuresActions = q('#featuresActions');
  const featuresActionsToggleBtn = q('#featuresActionsToggle');
  const featuresActionsMenu = q('#featuresActionsMenu');
  const featuresSaveBtn = q('#featuresSaveBtn');
  const featuresLoadBtn = q('#featuresLoadBtn');
  const featuresClearBtn = q('#featuresClearBtn');
  const coordFloat = q('.coord-float');
  const drawingsFloat = q('#drawingsFloat');
  const drawingsToggle = q('#drawingsToggle');
  const coordPlace = q('#coordPlace');
  const coordPin = q('#coordPin');
  const toolPin = q('#toolPin');
  const settingHomeAddress = q('#settingHomeAddress');
  const settingAccessToken = q('#settingAccessToken');
  const settingGoogleKey = q('#settingGoogleKey');
  const settingOpenAIKey = q('#settingOpenAIKey');
  const settingStyleUrl = q('#settingStyleUrl');
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
  const defaultStyleUrl = settingStyleUrl?.defaultValue || DEFAULT_STYLE_URL;
  const defaultHomeAddress = settingHomeAddress?.defaultValue || '';
  const defaultStartLng = Number(settingStartLng?.defaultValue || DEFAULT_MAP_START[0]);
  const defaultStartLat = Number(settingStartLat?.defaultValue || DEFAULT_MAP_START[1]);
  const defaultStartZoom = Number(settingStartZoom?.defaultValue || DEFAULT_START_ZOOM);
  const coordToggle = q('#coordToggle');
  const searchModal = q('#searchModal');
  const searchClose = q('#searchClose');
  const searchQuery = q('#searchQuery');
  const searchResults = q('#searchResults');
  // Go To modal
  const gotoModal = q('#gotoModal');
  const gotoClose = q('#gotoClose');
  const gotoLng = q('#gotoLng');
  const gotoLat = q('#gotoLat');
  const gotoAddPoi = q('#gotoAddPoi');
  const gotoSubmit = q('#gotoSubmit');
  const gotoPoiNameField = q('#gotoPoiNameField');
  const gotoPoiName = q('#gotoPoiName');
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
  let aiTarget = null;
  const toastContainer = q('#toastContainer');

  const toastIcons = {
    success: './assets/icons/regular/check-circle.svg',
    error: './assets/icons/regular/x-circle.svg',
  };

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
    if (suppressFeatureToasts) return;
    const label = labelForKind(kind);
    showToast(`${label} added`);
  };

  const notifyFeatureModified = (label = 'Feature updated') => {
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

  // Helper to get current Mapbox instance
  const getMap = () => (window)._map;
  const readMapboxToken = () => (localStorage.getItem('map.accessToken') || defaultAccessToken || '').trim();
  const readGoogleKey = () => (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
  const readOpenAIKey = () => (localStorage.getItem('openai.key') || defaultOpenAIKey || '').trim();

  let googleServicesEnabled = false;
  let aiEnabled = false;
  let serialConnected = false;
  let serialConnecting = false;
  let trackerDataSeen = false;
  let lastKnownCenter = null;
  let lastKnownAddress = '';

  const refreshAiButtonsVisibility = () => {
    const buttons = document.querySelectorAll('.drawing-ai');
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = !aiEnabled;
      btn.hidden = !aiEnabled;
    });
  };

  const applyServiceAvailability = () => {
    const hasMapbox = !!readMapboxToken();
    googleServicesEnabled = !!readGoogleKey();
    aiEnabled = !!readOpenAIKey();

    if (mapWelcome) mapWelcome.hidden = hasMapbox;

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
      if (coordPlace) coordPlace.textContent = '—';
      if (footerAddress) footerAddress.textContent = '—';
    }

    refreshAiButtonsVisibility();
    updateTrackersPanelState();
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

  let selectedPath = null;
  let rxCount = 0;
  let lastTick = Date.now();
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
      alert('Saving tracker recordings is not available in this build.');
      return;
    }
    const payload = getTrackersRecordingPayload();
    if (!payload.trackers.length) {
      alert('No tracker data is available to save yet.');
      return;
    }
    try {
      const defaultPath = getTrackersSuggestedPath();
      const result = await window.file.saveTrackers(payload, defaultPath);
      if (!result || !result.ok) {
        if (!result || !result.canceled) showToast('Save failed', 'error');
        return;
      }
      showToast('Trackers saved');
    } catch (err) {
      console.error('Saving trackers failed', err);
      alert('Could not save trackers. Check the console for details.');
      showToast('Save failed', 'error');
    }
  }

  async function handleTrackersOpen() {
    closeTrackersMenu();
    if (!window.file || typeof window.file.openTrackers !== 'function') {
      alert('Opening tracker recordings is not available in this build.');
      return;
    }
    if (trackersRecordingHasData && trackersRecordingState.entries.size > 0) {
      const proceed = confirm('Opening a recording will replace the current recorded data. Continue?');
      if (!proceed) return;
    }
    try {
      const defaultPath = getTrackersSuggestedPath();
      const result = await window.file.openTrackers(defaultPath);
      if (!result || !result.ok) {
        if (!result || !result.canceled) showToast('Open failed', 'error');
        return;
      }
      const normalized = normalizeTrackersRecordingPayload(result.data);
      if (!normalized) {
        alert('The selected file does not contain tracker tracks.');
        return;
      }
      const applied = applyImportedTrackers(normalized);
      if (!applied) {
        alert('No tracker tracks could be loaded from the selected file.');
        return;
      }
      showToast('Tracker tracks loaded');
    } catch (err) {
      console.error('Opening trackers failed', err);
      alert('Could not open tracker tracks. Check the console for details.');
      showToast('Open failed', 'error');
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
            'line-opacity': 0.85,
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
    try { (window).applyTrackerVisibilityToDrawings?.(); } catch {}
  };

  const syncGotoPoiControls = (shouldFocus=false) => {
    const enabled = !!gotoAddPoi?.checked;
    if (gotoAddPoi) gotoAddPoi.setAttribute('aria-checked', String(enabled));
    if (gotoPoiNameField) gotoPoiNameField.hidden = !enabled;
    if (enabled && shouldFocus && gotoPoiName) setTimeout(() => gotoPoiName.focus(), 0);
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
    setSettingsStatus('Unsaved changes');
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

      const storedStyleUrl = localStorage.getItem('map.styleUrl');
      if (settingStyleUrl) settingStyleUrl.value = storedStyleUrl !== null ? storedStyleUrl : defaultStyleUrl;

      const storedHome = localStorage.getItem('map.homeAddress');
      if (settingHomeAddress) settingHomeAddress.value = storedHome !== null ? storedHome : defaultHomeAddress;

      const storedStartPosRaw = localStorage.getItem('map.startPos');
      const startPos = parseStartPos(storedStartPosRaw || `${defaultStartLng}, ${defaultStartLat}`);
      if (settingStartLng) settingStartLng.value = Number(startPos[0]).toFixed(6);
      if (settingStartLat) settingStartLat.value = Number(startPos[1]).toFixed(6);

      const storedZoomRaw = localStorage.getItem('map.startZoom');
      const zoom = Number.isFinite(Number(storedZoomRaw)) ? Number(storedZoomRaw) : defaultStartZoom;
      if (settingStartZoom) settingStartZoom.value = String(zoom);

      const storedBaud = localStorage.getItem('serial.baud');
      if (settingBaud) settingBaud.value = storedBaud !== null ? storedBaud : DEFAULT_SERIAL_BAUD;
      if (connectBaud) connectBaud.value = settingBaud?.value || DEFAULT_SERIAL_BAUD;

      const storedAuto = localStorage.getItem('serial.autoReconnect');
      if (settingAutoReconnect) settingAutoReconnect.value = storedAuto || DEFAULT_AUTO_RECONNECT;
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
    let styleUrl = (settingStyleUrl?.value || '').trim();
    if (!styleUrl) styleUrl = DEFAULT_STYLE_URL;
    const homeAddress = (settingHomeAddress?.value || '').trim();
    const coords = parseStartInputs();
    if (!coords) {
      const lat = Number(settingStartLat?.value);
      const lng = Number(settingStartLng?.value);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        alert('Please enter a valid start latitude.');
        settingStartLat?.focus();
      } else {
        alert('Please enter a valid start longitude.');
        settingStartLng?.focus();
      }
      return null;
    }
    let startZoom = Number(settingStartZoom?.value);
    if (!Number.isFinite(startZoom)) startZoom = DEFAULT_START_ZOOM;
    if (startZoom < 0 || startZoom > 22) {
      alert('Start zoom must be between 0 and 22.');
      settingStartZoom?.focus();
      return null;
    }
    let baudValue = (settingBaud?.value || '').trim();
    if (!baudValue) baudValue = DEFAULT_SERIAL_BAUD;
    const baudNumber = Number(baudValue);
    if (!Number.isFinite(baudNumber) || baudNumber <= 0) {
      alert('Please enter a valid positive baud rate.');
      settingBaud?.focus();
      return null;
    }
    const baud = String(Math.round(baudNumber));
    const autoReconnect = (settingAutoReconnect?.value === 'off') ? 'off' : 'on';

    return {
      accessToken,
      googleKey,
      openaiKey,
      styleUrl,
      homeAddress,
      startPos: coords,
      startZoom,
      baud,
      autoReconnect,
    };
  };
  const applySettings = () => {
    const values = gatherSettingsFromForm();
    if (!values) return;

    const prevAccessToken = localStorage.getItem('map.accessToken') || '';
    const prevStyleUrl = localStorage.getItem('map.styleUrl') || '';
    const prevStartPos = parseStartPos(localStorage.getItem('map.startPos'));
    const prevStartZoom = Number(localStorage.getItem('map.startZoom') || DEFAULT_START_ZOOM);

    let saveErrored = false;
    try {
      localStorage.setItem('map.accessToken', values.accessToken);
      localStorage.setItem('map.googleKey', values.googleKey);
      localStorage.setItem('openai.key', values.openaiKey);
      localStorage.setItem('map.styleUrl', values.styleUrl);
      localStorage.setItem('map.homeAddress', values.homeAddress);
      localStorage.setItem('map.startPos', `${values.startPos[0].toFixed(6)}, ${values.startPos[1].toFixed(6)}`);
      localStorage.setItem('map.startZoom', String(values.startZoom));
      localStorage.setItem('serial.baud', values.baud);
      localStorage.setItem('serial.autoReconnect', values.autoReconnect);
    } catch (e) {
      saveErrored = true;
      console.error('Failed saving settings', e);
    }

    if (saveErrored) {
      setSettingsStatus('Failed to save settings', 4000);
      return;
    }

    if (connectBaud && values.baud) connectBaud.value = values.baud;

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
        if (values.styleUrl && values.styleUrl !== prevStyleUrl) {
          (window)._lastStyleUrl = values.styleUrl;
          map.setStyle(values.styleUrl);
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
    setSettingsStatus('Settings saved', 2500);
  };

  loadSettingsForm();
  applyServiceAvailability();
  if (settingsForm) {
    settingsForm.addEventListener('input', (e) => {
      if (e && e.target === settingsSaveBtn) return;
      markSettingsDirty();
    });
    settingsForm.addEventListener('change', (e) => {
      if (e && e.target === settingsSaveBtn) return;
      markSettingsDirty();
    });
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applySettings();
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
    const styleUrl = (localStorage.getItem('map.styleUrl') || defaultStyleUrl || DEFAULT_STYLE_URL).trim();
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
      center: startPos,
      zoom: Number.isFinite(startZoom) ? startZoom : 12,
      attributionControl: true,
    });
    (window)._map = map; // for debugging
    (window)._lastStyleUrl = styleUrl;
    try { (window)._bindEditInteractions && (window)._bindEditInteractions(); } catch {}
    try { ensureTrackerLayer(map); } catch (e) { console.error('tracker layer init failed', e); }

    const fmt = (n, d=2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

    function updateStats() {
      try {
        const c = map.getCenter();
        lastKnownCenter = { lat: c.lat, lng: c.lng };
        statZoom && (statZoom.textContent = fmt(map.getZoom(), 2));
        statCenter && (statCenter.textContent = `${fmt(c.lat, 5)}, ${fmt(c.lng, 5)}`);
        statBearing && (statBearing.textContent = fmt(map.getBearing(), 1));
        statPitch && (statPitch.textContent = fmt(map.getPitch(), 1));
        const s = map.getStyle();
        statLayer && (statLayer.textContent = s && s.name ? s.name : (typeof s === 'string' ? s : '—'));
      } catch {}
    }
    map.on('load', updateStats);
    map.on('move', updateStats);

    // Coordinate input bindings
    const syncInputsFromMap = () => {
      try {
        const c = map.getCenter();
        if (inputLng) inputLng.value = Number(c.lng).toFixed(6);
        if (inputLat) inputLat.value = Number(c.lat).toFixed(6);
      } catch {}
    };
    // Pin toggle state
    let mapPinned = false;
    map.on('load', () => {
      syncInputsFromMap();
      updatePlaceFromCenter();
      maybeFlyHomeOnStartup();
      trackerSourceReady = false;
      trackerPathSourceReady = false;
      ensureTrackerLayer(map);
      updateTrackerSource();
      updateTrackerPathSource();
    });
    map.on('style.load', () => {
      trackerSourceReady = false;
      trackerPathSourceReady = false;
      ensureTrackerLayer(map);
      updateTrackerSource();
      updateTrackerPathSource();
    });
    map.on('moveend', () => { syncInputsFromMap(); if (!mapPinned) updatePlaceFromCenter(); });

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
      coordPin?.setAttribute('aria-pressed', String(mapPinned));
      coordPin?.classList.toggle('active', mapPinned);
      toolPin?.setAttribute('aria-pressed', String(mapPinned));
      toolPin?.classList.toggle('active', mapPinned);
    };
    coordPin?.addEventListener('click', () => setPinned(!mapPinned));
    toolPin?.addEventListener('click', () => setPinned(!mapPinned));

    async function updatePlaceFromCenter(){
      try{
        // If footer address element is missing and no coord place, skip
        if (!coordPlace && !footerAddress) return;
        const c = map.getCenter();
        lastKnownCenter = { lat: c.lat, lng: c.lng };
        if (!googleServicesEnabled) {
          if (coordPlace) coordPlace.textContent = '—';
          if (footerAddress) footerAddress.textContent = '—';
          lastKnownAddress = '';
          return;
        }
        const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
        if (!key) {
          if (coordPlace) coordPlace.textContent = '—';
          if (footerAddress) footerAddress.textContent = '—';
          return;
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(c.lat + ',' + c.lng)}&key=${encodeURIComponent(key)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
          if (coordPlace) coordPlace.textContent = '—';
          if (footerAddress) footerAddress.textContent = '—';
          lastKnownAddress = '';
          return;
        }
        const res = data.results[0];
        const addr = res.formatted_address || res.formattedAddress || '—';
        if (coordPlace) coordPlace.textContent = addr;
        if (footerAddress) footerAddress.textContent = addr;
        lastKnownAddress = addr;
        try{
          const comps = res.address_components || [];
          const country = comps.find(c => (c.types||[]).includes('country'));
          const city = comps.find(c => (c.types||[]).includes('locality')) || comps.find(c => (c.types||[]).includes('postal_town'));
          (window)._placeCountryCode = country?.short_name || country?.long_name || '';
          (window)._placeCity = city?.short_name || city?.long_name || '';
        }catch{}
      } catch (e) { console.error(e); }
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
      if (!map.getLayer('draw-fill')) {
        map.addLayer({
          id: 'draw-fill',
          type: 'fill',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get','_trackerHidden'], true]],
          paint: { 'fill-color': ['coalesce', ['get','color'], '#2196F3'], 'fill-opacity': 0.2 }
        });
      }
      if (!map.getLayer('draw-line')) {
        map.addLayer({
          id: 'draw-line',
          type: 'line',
          source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get','_trackerHidden'], true]],
          paint: { 'line-color': ['coalesce', ['get','color'], '#64b5f6'], 'line-width': 2 }
        });
      }
      // Base point as colored circle for robust visibility
      if (!map.getLayer('draw-point-circle')) {
        map.addLayer({
          id: 'draw-point-circle', type: 'circle', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true]],
          paint: {
            'circle-color': ['coalesce', ['get','color'], '#2196F3'],
            'circle-radius': 9,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1
          }
        });
      }
      // Optional label next to POI: show feature name when not empty/Untitled
      if (!map.getLayer('draw-point')) {
        map.addLayer({
          id: 'draw-point', type: 'symbol', source: 'draw',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get','_trackerHidden'], true]],
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
      if (!map.getLayer('draw-draft-fill')) {
        map.addLayer({ id: 'draw-draft-fill', type: 'fill', source: 'draw-draft', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#2196F3', 'fill-opacity': 0.12 } });
      }
      if (!map.getLayer('draw-draft-line')) {
        map.addLayer({ id: 'draw-draft-line', type: 'line', source: 'draw-draft', paint: { 'line-color': '#64b5f6', 'line-width': 2, 'line-dasharray': [2,2] } });
      }
      if (!map.getLayer('draw-hl-fill')) {
        map.addLayer({ id: 'draw-hl-fill', type: 'fill', source: 'draw', filter: ['all', ['==', ['get','id'], '__none__'], ['!=', ['get','_trackerHidden'], true]], paint: { 'fill-color': '#FFC107', 'fill-opacity': 0.35 } });
      }
      if (!map.getLayer('draw-hl-line')) {
        map.addLayer({ id: 'draw-hl-line', type: 'line', source: 'draw', filter: ['all', ['==', ['get','id'], '__none__'], ['!=', ['get','_trackerHidden'], true]], paint: { 'line-color': '#FFC107', 'line-width': 4 } });
      }
      if (!map.getLayer('draw-hl-point')) {
        map.addLayer({ id: 'draw-hl-point', type: 'circle', source: 'draw', filter: ['all', ['==', ['get','id'], '__none__'], ['!=', ['get','_trackerHidden'], true]], paint: { 'circle-color': '#FFC107', 'circle-radius': 9.2, 'circle-opacity': 0.5 } });
      }
      if (!map.getLayer('edit-verts')) {
        map.addLayer({ id: 'edit-verts', type: 'circle', source: 'edit-verts', paint: { 'circle-color': '#FFEB3B', 'circle-stroke-color': '#333', 'circle-stroke-width': 1, 'circle-radius': 7 }, layout: { visibility: 'none' } });
      }
      if (!map.getLayer('edit-mid')) {
        map.addLayer({ id: 'edit-mid', type: 'circle', source: 'edit-mid', paint: { 'circle-color': '#00E5FF', 'circle-stroke-color': '#004d5a', 'circle-stroke-width': 1, 'circle-radius': 5 }, layout: { visibility: 'none' } });
      }
    };
    map.on('load', ensureDrawLayers);
    // When switching styles (map.setStyle), the style graph resets; re-add our drawing layers
    map.on('style.load', () => { try { ensureDrawLayers(); refreshDraw(); (window)._bindEditInteractions && (window)._bindEditInteractions(); if ((window)._editTarget) { refreshEditVerts(); map.setLayoutProperty('edit-verts','visibility','visible'); map.setLayoutProperty('edit-mid','visibility','visible'); } } catch {} });

    const setDraft = (featureOrNull) => {
      const src = map.getSource('draw-draft');
      if (!src) return;
      const fc = { type: 'FeatureCollection', features: featureOrNull ? [featureOrNull] : [] };
      src.setData(fc);
    };
    const refreshDraw = () => {
      const src = map.getSource('draw');
      if (src) src.setData(drawStore);
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
        if (changed) refreshDraw();
      } catch (err) {
        console.error('applyTrackerVisibilityToDrawings failed', err);
      }
    };
    (window).applyTrackerVisibilityToDrawings = applyTrackerVisibilityToDrawings;
    try { applyTrackerVisibilityToDrawings(); } catch {}

    const refreshEditVerts = () => {
      try{
        const verts = [];
        const mids = [];
        const eid = (window)._editTarget;
        if (eid) {
          const f = drawStore.features.find(x => x.properties?.id === eid);
          if (f && f.geometry?.type === 'Polygon') {
            const ring = (f.geometry.coordinates?.[0] || []).slice();
            if (ring.length >= 4) {
              for (let i=0;i<ring.length-1;i++){
                const c = ring[i];
                verts.push({ type:'Feature', properties:{ fid: f.properties?.id, idx: i }, geometry:{ type:'Point', coordinates:[c[0], c[1]] } });
                const n = ring[i+1];
                const mx = (c[0]+n[0])/2, my = (c[1]+n[1])/2;
                mids.push({ type:'Feature', properties:{ fid: f.properties?.id, insAfter: i }, geometry:{ type:'Point', coordinates:[mx, my] } });
              }
            }
          }
        }
        const src = map.getSource('edit-verts');
        if (src) src.setData({ type:'FeatureCollection', features: verts });
        const msrc = map.getSource('edit-mid');
        if (msrc) msrc.setData({ type:'FeatureCollection', features: mids });
      }catch{}
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
        if (!f || f.geometry?.type !== 'Polygon') { (window)._editTarget = null; map.setLayoutProperty('edit-verts','visibility','none'); map.setLayoutProperty('edit-mid','visibility','none'); (window)._refreshEditVerts && (window)._refreshEditVerts(); (window)._refreshDraw && (window)._refreshDraw(); return; }
        const ring = f.geometry.coordinates && f.geometry.coordinates[0];
        if (!Array.isArray(ring) || ring.length < 4) { (window)._editTarget = null; map.setLayoutProperty('edit-verts','visibility','none'); map.setLayoutProperty('edit-mid','visibility','none'); (window)._refreshEditVerts && (window)._refreshEditVerts(); (window)._refreshDraw && (window)._refreshDraw(); return; }
        const inside = pointInRing([e.lngLat.lng, e.lngLat.lat], ring);
        if (!inside) {
          (window)._editTarget = null;
          try { map.setLayoutProperty('edit-verts','visibility','none'); map.setLayoutProperty('edit-mid','visibility','none'); } catch {}
          try { (window)._refreshEditVerts && (window)._refreshEditVerts(); } catch {}
          try { (window)._refreshDraw && (window)._refreshDraw(); } catch {}
        }
      }catch{}
    });
    const refreshDrawMapOnly = () => {
      try { const src = map.getSource('draw'); if (src) src.setData(drawStore); } catch {}
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
      return f;
    };
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
        drawStore.features.push(annotateFeature({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: vertCoords.slice() } }, 'line'));
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
      try { setDraft(null); } catch {}
      try { (window)._lineInProgress = false; } catch {}
      try { vertCoords = null; dragStart = null; } catch {}
      try { const m = (window)._map; if (m) { m.dragPan.enable(); m.getCanvas().style.cursor = ''; } } catch {}
    };

    // ---------- Drawings floating list ----------
    let hoveredId = null;
    const setHighlight = (id) => {
      hoveredId = id || null;
      const filt = id ? ['==', ['get','id'], id] : ['==', ['get','id'], '__none__'];
      try { map.setFilter('draw-hl-fill', filt); } catch {}
      try { map.setFilter('draw-hl-line', filt); } catch {}
      try { map.setFilter('draw-hl-point', filt); } catch {}
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
      del.className = 'drawing-del'; del.textContent = '×'; del.title = 'Delete';
      const editBtn = document.createElement('button');
      editBtn.className = 'drawing-edit'; editBtn.title = 'Edit polygon'; editBtn.setAttribute('aria-label','Edit polygon'); editBtn.textContent = '✎';
      const updateEditBtnState = () => {
        const active = (window)._editTarget && f.properties?.id === (window)._editTarget;
        editBtn.classList.toggle('active', !!active);
        editBtn.title = active ? 'Save edits' : 'Edit polygon';
        editBtn.textContent = active ? '💾' : '✎';
      };
      updateEditBtnState();
      const aiBtn = document.createElement('button');
      aiBtn.className = 'drawing-ai'; aiBtn.title = 'AI…'; aiBtn.setAttribute('aria-label','AI suggestions'); aiBtn.textContent = 'AI';
      if (!aiEnabled) {
        aiBtn.disabled = true;
        aiBtn.hidden = true;
      }
      const g = f.geometry;
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
      meta.appendChild(typeEl); meta.appendChild(size);
      // Place as grid items: name (col 1, row 1), actions (col 2, row 1), meta spans both columns in row 2
      row.appendChild(nameWrap);
      actions.appendChild(colorWrap);
      actions.appendChild(editBtn);
      actions.appendChild(aiBtn);
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
        if (idx >= 0) { drawStore.features.splice(idx, 1); setDirty(true); refreshDraw(); setHighlight(null); }
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
      const startEdit = () => {
        try { (window).abortActiveTool && (window).abortActiveTool(); } catch {}
        try { (window).setActiveTool && (window).setActiveTool(null); } catch {}
        (window)._editTarget = f.properties?.id || null;
        updateEditBtnState();
        try{ const m=(window)._map; if (m){ m.setLayoutProperty('edit-verts','visibility','visible'); m.setLayoutProperty('edit-mid','visibility','visible'); refreshEditVerts(); try{ m.moveLayer('edit-mid'); m.moveLayer('edit-verts'); }catch{} } }catch{}
        if (f.geometry?.type==='Polygon') flyToFeaturePolygon(f);
      };
      const stopEdit = () => {
        (window)._editTarget = null;
        updateEditBtnState();
        try{ const m=(window)._map; if (m){ m.setLayoutProperty('edit-verts','visibility','none'); m.setLayoutProperty('edit-mid','visibility','none'); refreshEditVerts(); } }catch{}
        setDirty(true); refreshDraw();
        notifyFeatureModified();
      };
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); const active = (window)._editTarget && f.properties?.id === (window)._editTarget; if (active) stopEdit(); else startEdit(); });
      aiBtn.addEventListener('click', (e) => {
        if (!aiEnabled) return;
        e.stopPropagation();
        openAiModal(f);
      });
      return row;
    };
    const updateFeaturesActionsState = (hasFeaturesParam) => {
      const hasFeatures = (typeof hasFeaturesParam === 'boolean') ? hasFeaturesParam : (Array.isArray(drawStore.features) && drawStore.features.length > 0);
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
          showToast('Features saved');
        }
      } catch (err) {
        console.error('Saving features failed', err);
        showToast('Save failed', 'error');
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
    };

    const updateDrawingsPanel = () => {
      if (!drawingsList) return;
      drawingsList.innerHTML = '';
      const hasFeatures = Array.isArray(drawStore.features) && drawStore.features.length > 0;
      if (!hasFeatures) {
        const empty = document.createElement('div');
        empty.className = 'features-empty';
        empty.textContent = 'No features yet. Start drawing on the map.';
        drawingsList.appendChild(empty);
        updateFeaturesActionsState(false);
        return;
      }
      drawStore.features.forEach(f => drawingsList.appendChild(renderRow(f)));
      updateFeaturesActionsState(true);
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
      if (aiModal) aiModal.hidden = false;
      if (aiMeta) {
        aiMeta.innerHTML = '<div>Loading…</div>';
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
          aiError.textContent = 'Add an OpenAI API key in Settings to use AI features.';
          return;
        }
        if (!aiTarget) return;
        const prompt = (aiInput?.value || '').trim();
        aiError.textContent = '';
        aiSubmit.disabled = true; aiSubmit.textContent = 'Submitting…'; if (aiSpinner) aiSpinner.style.display='inline-block'; if (aiInput) aiInput.disabled = true;
        // API key from settings/localStorage
        const openaiKey = (localStorage.getItem('openai.key') || defaultOpenAIKey || '').trim();
        const result = await window.ai.transformDrawing({ type:'Feature', properties:{}, geometry: aiTarget.geometry }, prompt, openaiKey);
        if (!result || !result.ok) { aiError.textContent = result?.error || 'AI request failed'; return; }
        // Constrain features to original geometry region
        const constrained = constrainToOriginal(aiTarget, result.featureCollection);
        const candidates = (constrained && Array.isArray(constrained.features)) ? constrained.features.filter(f => f && f.type === 'Feature' && f.geometry && ['Polygon','LineString','Point'].includes(f.geometry.type)) : [];
        if (!candidates.length) {
          aiError.textContent = 'The AI response did not contain valid features within the original area. The drawing was not changed.';
          return;
        }
        // Replace the target with new features only after validating we have some
        const idx = drawStore.features.findIndex(x => x.properties?.id === aiTarget.properties?.id);
        if (idx >= 0) drawStore.features.splice(idx, 1);
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
        aiSubmit.disabled = false; aiSubmit.textContent = 'SUBMIT'; if (aiSpinner) aiSpinner.style.display='none'; if (aiInput) aiInput.disabled = false;
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
    if (statSerial) statSerial.textContent = state === 'connected' ? (path || 'connected') : state;
    if (serialConnectBtn) {
      if (state === 'connected') {
        serialConnectBtn.disabled = true;
        serialConnectBtn.setAttribute('aria-disabled', 'true');
        if (serialConnectLabel) serialConnectLabel.textContent = 'Connected';
      } else if (state === 'connecting') {
        serialConnectBtn.disabled = true;
        serialConnectBtn.setAttribute('aria-disabled', 'true');
        if (serialConnectLabel) serialConnectLabel.textContent = 'Connecting…';
      } else {
        serialConnectBtn.disabled = false;
        serialConnectBtn.removeAttribute('aria-disabled');
        if (serialConnectLabel) serialConnectLabel.textContent = 'Connect';
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
      portsContainer.innerHTML = '<div class="muted">Scanning ports…</div>';
      const ports = await window.serial.listPorts();
      if (!ports || ports.length === 0) {
        portsContainer.innerHTML = '<div class="muted">No ports found</div>';
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

  // RX rate ticker
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    if (dt >= 1) {
      const rate = Math.round(rxCount / dt);
      if (statRxRate) statRxRate.textContent = `${rate}/s`;
      rxCount = 0; lastTick = now;
    }
  }, 250);

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
      showToast(isFull ? 'Entered fullscreen' : 'Exited fullscreen');
    } catch (err) {
      console.error('Toggle fullscreen failed', err);
      showToast('Fullscreen toggle failed', 'error');
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
      alert('You have unsaved settings. Please save before returning to the map.');
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

  function initFloatingPanels(){
    const mapView = q('.view-map');
    if (!mapView) return;
    // Location panel is fixed (no drag/collapse). Position via CSS/reset only.
    // Drawings panel: default top-left
    makeDraggable(drawingsFloat, {
      handle: q('.drawings-header') || drawingsFloat,
      container: mapView,
      storageKey: 'ui.panel.drawings',
      defaultPos: () => ({ left: 10, top: 10 })
    });
    // Serial panel: draggable via header (default top-right)
    makeDraggable(serialFloat, {
      handle: q('#serialFloat .serial-float-header'),
      container: mapView,
      storageKey: 'ui.panel.serial',
      defaultPos: () => {
        const mvRect = mapView.getBoundingClientRect();
        const mainRect = q('.app-main')?.getBoundingClientRect();
        const containerWidth = mvRect.width > 0 ? mvRect.width : (mainRect?.width || window.innerWidth);
        const elW = serialFloat?.offsetWidth || 360; // fallback to CSS width
        const margin = 10;
        const left = Math.max(0, containerWidth - elW - margin);
        const top = margin;
        return { left, top };
      }
    });

    // Track container size for responsive repositioning
    let lastW = mapView.getBoundingClientRect().width;
    let lastH = mapView.getBoundingClientRect().height;

    const getRelPos = (el) => {
      const crect = mapView.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { left: r.left - crect.left, top: r.top - crect.top, width: r.width, height: r.height };
    };
    const clamp01 = (n, min, max) => Math.max(min, Math.min(max, n));

    const adjustPanelsOnResize = () => {
      const crect = mapView.getBoundingClientRect();
      const newW = crect.width || lastW || 1;
      const newH = crect.height || lastH || 1;
      if (!newW || !newH) return;

      // Drawings: presumed top-left anchored unless close to right
      if (drawingsFloat) {
        const p = getRelPos(drawingsFloat);
        const rightOld = Math.max(0, lastW - p.left - p.width);
        let left;
        if (rightOld < p.left) {
          // right-anchored
          const rightNew = Math.max(0, rightOld * (newW / Math.max(1, lastW)));
          left = clamp01(newW - p.width - rightNew, 0, Math.max(0, newW - p.width));
        } else {
          left = clamp01(p.left * (newW / Math.max(1, lastW)), 0, Math.max(0, newW - p.width));
        }
        const top = clamp01(p.top * (newH / Math.max(1, lastH)), 0, Math.max(0, newH - p.height));
        drawingsFloat.style.left = `${left}px`;
        drawingsFloat.style.top = `${top}px`;
        try { localStorage.setItem('ui.panel.drawings', JSON.stringify({ left, top })); } catch {}
      }

      // Serial: often right-anchored; adjust similarly
      if (serialFloat) {
        const p = getRelPos(serialFloat);
        const rightOld = Math.max(0, lastW - p.left - p.width);
        const rightNew = Math.max(0, rightOld * (newW / Math.max(1, lastW)));
        const left = clamp01(newW - p.width - rightNew, 0, Math.max(0, newW - p.width));
        const top = clamp01(p.top * (newH / Math.max(1, lastH)), 0, Math.max(0, newH - p.height));
        serialFloat.style.left = `${left}px`;
        serialFloat.style.top = `${top}px`;
        try { localStorage.setItem('ui.panel.serial', JSON.stringify({ left, top })); } catch {}
      }

      // Coord (location) panel stays fixed via CSS bottom/left; no adjustment needed

      lastW = newW; lastH = newH;
    };

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(adjustPanelsOnResize);
    });
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

  // Reset floating panels to initial positions
  function resetFloatingPanels(){
    try{
      localStorage.removeItem('ui.panel.coord');
      localStorage.removeItem('ui.panel.drawings');
    }catch{}
    const mapView = q('.view-map');
    if (!mapView) return;
    // Coord default: bottom-left (50px)
    if (coordFloat){
      const left = 10; const bottom = 50;
      coordFloat.style.left = left + 'px';
      coordFloat.style.bottom = bottom + 'px';
      coordFloat.style.top = '';
      try{ localStorage.setItem('ui.panel.coord', JSON.stringify({ left, bottom })); }catch{}
    }
    // Drawings default: top-left
    if (drawingsFloat){
      const left = 10, top = 10;
      drawingsFloat.style.left = left + 'px';
      drawingsFloat.style.top = top + 'px';
      try{ localStorage.setItem('ui.panel.drawings', JSON.stringify({ left, top })); }catch{}
    }
    // Serial default: top-right, robust even if map view is hidden
    if (serialFloat){
      const mvRect = mapView.getBoundingClientRect();
      const mainRect = q('.app-main')?.getBoundingClientRect();
      const containerWidth = mvRect.width > 0 ? mvRect.width : (mainRect?.width || window.innerWidth);
      const elW = serialFloat?.offsetWidth || 360;
      const margin = 10;
      const left = Math.max(0, containerWidth - elW - margin);
      const top = margin;
      serialFloat.style.left = left + 'px';
      serialFloat.style.top = top + 'px';
      try{ localStorage.setItem('ui.panel.serial', JSON.stringify({ left, top })); }catch{}
    }
  }

  // Drawings panel collapse toggle
  drawingsToggle?.addEventListener('click', () => {
    if (!drawingsFloat) return;
    const collapsed = drawingsFloat.classList.toggle('collapsed');
    drawingsToggle.setAttribute('aria-expanded', String(!collapsed));
  });
  coordToggle?.addEventListener('click', () => {
    if (!coordFloat) return;
    const collapsed = coordFloat.classList.toggle('collapsed');
    coordToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  // Initialize panels + sidebar + map after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initFloatingPanels();
      try { initSidebar(); } catch {}
      try { initTrackersSidebar(); } catch {}
      initMap();
    }, { once: true });
  } else {
    initFloatingPanels();
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
  // When user changes coords manually, re-center the map
  function centerFromInputs() {
    const map = (window)._map;
    if (!map) return;
    const lng = Number(inputLng?.value);
    const lat = Number(inputLat?.value);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return;
    try { map.setCenter([lng, lat]); } catch (e) { console.error(e); }
  }
  inputLng?.addEventListener('change', centerFromInputs);
  inputLat?.addEventListener('change', centerFromInputs);

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
    showToast('Features saved');
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
          const promptRes = await window.file.askSaveDiscardCancel('You have unsaved drawings.', 'Do you want to save before opening a file?');
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
        const promptRes = await window.file.askSaveDiscardCancel('You have unsaved drawings.', 'Do you want to save before closing?');
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
          const res = await window.file.askSaveDiscardCancel('You have unsaved drawings.', 'Do you want to save before creating a new file?');
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
      (window)._currentTool = tool;
      const all = [toolRect, toolPoly, toolCircle, toolLine, toolPOI];
      all.forEach(btn => btn?.classList.remove('active'));
      // aria-pressed state for buttons
      all.forEach(btn => btn && btn.setAttribute('aria-pressed', String(false)));
      // no POI palette in the toolbar
      switch (tool) {
        case 'rect': toolRect?.classList.add('active'); toolRect?.setAttribute('aria-pressed', String(true)); break;
        case 'poly': toolPoly?.classList.add('active'); toolPoly?.setAttribute('aria-pressed', String(true)); break;
        case 'circle': toolCircle?.classList.add('active'); toolCircle?.setAttribute('aria-pressed', String(true)); break;
        case 'line': toolLine?.classList.add('active'); toolLine?.setAttribute('aria-pressed', String(true)); break;
        case 'poi':
          toolPOI?.classList.add('active');
          toolPOI?.setAttribute('aria-pressed', String(true));
          break;
        default: break;
      }
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
    toolPOI?.addEventListener('click', () => setActiveTool((window)._currentTool === 'poi' ? null : 'poi'));

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
      try{
        const c = (window)._map?.getCenter();
        if (gotoLat && c) gotoLat.value = Number(c.lat).toFixed(6);
        if (gotoLng && c) gotoLng.value = Number(c.lng).toFixed(6);
      }catch{}
      syncGotoPoiControls();
      gotoModal.hidden = false;
      setTimeout(() => gotoLat?.focus(), 0);
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
    const performGoto = async () => {
      try{
        const lng = Number(gotoLng?.value);
        const lat = Number(gotoLat?.value);
        if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          alert('Please enter valid coordinates.'); return;
        }
        const m = (window)._map; if (!m) return;
        m.flyTo({ center: [lng, lat], zoom: Math.max(14, m.getZoom() || 14), duration: 600 });
        if (gotoAddPoi && gotoAddPoi.checked) {
          try {
            const ds = (window)._drawStore || drawStore;
            const poi = { type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:[lng, lat] } };
            const name = (gotoPoiName?.value || '').trim();
            if (name) poi.properties.name = name;
            const af = (typeof annotateFeature === 'function') ? annotateFeature : (f)=>f;
            ds.features.push(af(poi, 'poi'));
            setDirty(true);
            if (typeof (window)._refreshDraw === 'function') (window)._refreshDraw(); else refreshDraw();
          } catch (err) { console.error('Add POI failed', err); }
        }
        closeGotoModal();
      } catch {}
    };
    gotoSubmit?.addEventListener('click', performGoto);
    // Allow Enter key to submit from either field
    gotoLat?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performGoto(); } });
    gotoLng?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performGoto(); } });

    // Clicking the LAT/LONG in footer opens the same Go To dialog
    try {
      if (statCenter) {
        statCenter.style.cursor = 'pointer';
        statCenter.title = 'Click to enter coordinates';
        statCenter.addEventListener('click', openGotoModal);
      }
    } catch {}

    if (footerAddress) {
      footerAddress.style.cursor = 'pointer';
      footerAddress.title = 'Click to copy address';
      footerAddress.addEventListener('click', async () => {
        try {
          const addr = (footerAddress.textContent || '').trim() || lastKnownAddress || '';
          const lat = Number(lastKnownCenter?.lat);
          const lng = Number(lastKnownCenter?.lng);
          const latStr = Number.isFinite(lat) ? lat.toFixed(6) : '—';
          const lngStr = Number.isFinite(lng) ? lng.toFixed(6) : '—';
          const text = addr ? `${addr}, LAT ${latStr}, LONG ${lngStr}` : `LAT ${latStr}, LONG ${lngStr}`;
          try {
            const ok = await writeToClipboard(text);
            if (!ok) throw new Error('clipboard unavailable');
            footerAddress.classList.add('copied');
            setTimeout(() => footerAddress.classList.remove('copied'), 1200);
            showToast('Address copied to clipboard');
          } catch (err) {
            console.error('Copy address failed', err);
            showToast('Copy failed', 'error');
          }
        } catch (err) {
          console.error('Copy address wrapper failed', err);
          showToast('Copy failed', 'error');
        }
      });
    }

    // Live search with debounce
    let searchTimer = null;
    async function performSearch(qstr){
      if (!googleServicesEnabled || !searchResults) return;
      const key = (localStorage.getItem('map.googleKey') || defaultGoogleKey || '').trim();
      if (!key) { searchResults.innerHTML = '<div class="muted">Set Google API key in Settings.</div>'; return; }
      if (!qstr || qstr.trim().length < 3) { searchResults.innerHTML = '<div class="muted">Type at least 3 characters…</div>'; return; }
      searchResults.innerHTML = '<div class="muted">Searching…</div>';
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
        if (!items.length) { searchResults.innerHTML = '<div class="muted">No results</div>'; return; }
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
        searchResults.innerHTML = '<div class="muted">Search failed</div>';
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
      if (!f || f.geometry?.type !== 'Polygon') return;
      const ring = f.geometry.coordinates && f.geometry.coordinates[0];
      if (!Array.isArray(ring)) return;
      const i = dragging.idx;
      if (!Number.isInteger(i) || i < 0 || i >= ring.length-1) return;
      ring[i] = [lng, lat];
      ring[ring.length-1] = ring[0]; // keep closed
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
      dragging = { fid: feat.properties?.fid, idx: Number(feat.properties?.idx) };
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
          m.on('mousedown', 'edit-mid', (e) => {
            if (!(window)._editTarget) return;
            const feat = e.features && e.features[0]; if (!feat) return;
            const fid = feat.properties?.fid; const after = Number(feat.properties?.insAfter);
            const ds = (window)._drawStore; if (!ds) return;
            const f = ds.features.find(x => x.properties?.id === fid); if (!f || f.geometry?.type !== 'Polygon') return;
            const ring = f.geometry.coordinates && f.geometry.coordinates[0];
            if (!Array.isArray(ring) || after < 0 || after >= ring.length-1) return;
            const coord = feat.geometry && feat.geometry.coordinates; if (!coord) return;
            ring.splice(after+1, 0, [coord[0], coord[1]]);
            ring[ring.length-1] = ring[0];
            try{ const src = m.getSource('draw'); if (src) src.setData(ds); }catch{}
            try{ (window)._refreshEditVerts && (window)._refreshEditVerts(); }catch{}
            dragging = { fid, idx: after+1 };
            beginDrag();
            e.preventDefault();
          });
          m.on('touchstart', 'edit-mid', (e) => {
            if (!(window)._editTarget) return;
            const feat = e.features && e.features[0]; if (!feat) return;
            const fid = feat.properties?.fid; const after = Number(feat.properties?.insAfter);
            const ds = (window)._drawStore; if (!ds) return;
            const f = ds.features.find(x => x.properties?.id === fid); if (!f || f.geometry?.type !== 'Polygon') return;
            const ring = f.geometry.coordinates && f.geometry.coordinates[0];
            if (!Array.isArray(ring) || after < 0 || after >= ring.length-1) return;
            const coord = feat.geometry && feat.geometry.coordinates; if (!coord) return;
            ring.splice(after+1, 0, [coord[0], coord[1]]);
            ring[ring.length-1] = ring[0];
            try{ const src = m.getSource('draw'); if (src) src.setData(ds); }catch{}
            try{ (window)._refreshEditVerts && (window)._refreshEditVerts(); }catch{}
            dragging = { fid, idx: after+1 };
            beginDrag();
            e.preventDefault();
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
    const outEl = serialMonitorBody || serialFloatBody;
    if (outEl) {
      rxCount += 1;
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
})();

// Serial monitor modal wiring
(function initSerialMonitor(){
  const btn = document.querySelector('#serialMonitorBtn');
  const modal = document.querySelector('#serialMonitorModal');
  const closeBtn = document.querySelector('#serialMonitorClose');
  const disconnectBtn = document.querySelector('#serialDisconnectBtn');
  const clearBtn = document.querySelector('#serialMonitorClear');
  const monitorBody = document.querySelector('#serialMonitorBody');
  const floatBody = document.querySelector('#serialFloatBody');
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
        if (floatBody) floatBody.textContent = '';
      } catch {}
    });
  }
})();
