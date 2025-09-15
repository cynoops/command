(() => {
  const q = (sel) => document.querySelector(sel);
  const ce = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };

  // Map stats UI
  const statZoom = q('#statZoom');
  const statCenter = q('#statCenter');
  const statBearing = q('#statBearing');
  const statPitch = q('#statPitch');
  const statLayer = q('#statLayer');

  const serialConnectBtn = q('#serialConnectBtn');
  const serialStatusDot = q('#serialStatusDot');
  const statSerial = q('#statSerial');
  const statRxRate = q('#statRxRate');
  const fullscreenBtn = q('#fullscreenBtn');
  const tabMapInput = q('#tab-map');
  const tabSettingsInput = q('#tab-settings');
  const tabMapLabel = document.querySelector('label[for="tab-map"]');
  const tabSettingsLabel = document.querySelector('label[for="tab-settings"]');

  const connectModal = q('#connectModal');
  const portsContainer = q('#portsContainer');
  const connectClose = q('#connectClose');
  const refreshPorts = q('#refreshPorts');
  const connectBtnAction = q('#connectBtnAction');
  const connectBaud = q('#connectBaud');

  const serialFloat = q('#serialFloat');
  const serialFloatBody = q('#serialFloatBody');
  const serialFloatToggle = q('#serialFloatToggle');
  const inputLng = q('#inputLng');
  const inputLat = q('#inputLat');
  const toolRect = q('#toolRect');
  const toolPoly = q('#toolPoly');
  const toolCircle = q('#toolCircle');
  const toolLine = q('#toolLine');
  const toolPOI = q('#toolPOI');
  const toolEdit = q('#toolEdit');
  const toolSearch = q('#toolSearch');
  const drawingsList = q('#drawingsList');
  const coordFloat = q('.coord-float');
  const drawingsFloat = q('#drawingsFloat');
  const drawingsToggle = q('#drawingsToggle');
  const coordPlace = q('#coordPlace');
  const coordPin = q('#coordPin');
  const toolPin = q('#toolPin');
  const settingHomeAddress = q('#settingHomeAddress');
  const coordToggle = q('#coordToggle');
  const resetLayoutBtn = q('#resetLayoutBtn');
  const resetLayoutToolbarBtn = q('#resetLayoutToolbarBtn');
  const searchModal = q('#searchModal');
  const searchClose = q('#searchClose');
  const searchQuery = q('#searchQuery');
  const searchResults = q('#searchResults');
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

  let selectedPath = null;
  let rxCount = 0;
  let lastTick = Date.now();
  let isDirty = false;
  const setDirty = (v=true) => { isDirty = !!v; (window)._dirty = isDirty; };
  // Per-drawing edit state
  (window)._editTarget = (window)._editTarget || null;
  let currentFilePath = null;
  window.file?.onCurrentFile?.((p) => { currentFilePath = p; });

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
      if (!input) return [6.13, 49.61];
      const parts = String(input).split(',').map(s => Number(s.trim()));
      if (parts.length === 2 && parts.every(n => Number.isFinite(n))) return [parts[0], parts[1]];
      return [6.13, 49.61];
    } catch { return [6.13, 49.61]; }
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
    const styleInput = q('#settingStyleUrl');
    const tokenInput = q('#settingAccessToken');
    const googleKeyInput = q('#settingGoogleKey');
    const startPosInput = q('#settingStartPos');
    const startZoomInput = q('#settingStartZoom');

    const accessToken = (localStorage.getItem('map.accessToken') || tokenInput?.value || '').trim();
    const styleUrl = (localStorage.getItem('map.styleUrl') || styleInput?.value || 'mapbox://styles/mapbox/streets-v12').trim();
    const startPos = parseStartPos(localStorage.getItem('map.startPos') || startPosInput?.value || '6.13, 49.61');
    const startZoom = Number(localStorage.getItem('map.startZoom') || startZoomInput?.value || 12);

    if (!accessToken) {
      console.warn('No Mapbox access token set. Skipping map init.');
      return;
    }

    (window).mapboxgl.accessToken = accessToken;
    const map = new (window).mapboxgl.Map({
      container: mapEl,
      style: styleUrl,
      center: startPos,
      zoom: Number.isFinite(startZoom) ? startZoom : 12,
      attributionControl: true,
    });
    (window)._map = map; // for debugging
    try { (window)._bindEditInteractions && (window)._bindEditInteractions(); } catch {}

    const fmt = (n, d=2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
    function updateStats() {
      try {
        const c = map.getCenter();
        statZoom && (statZoom.textContent = fmt(map.getZoom(), 2));
        statCenter && (statCenter.textContent = `${fmt(c.lng, 5)}, ${fmt(c.lat, 5)}`);
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
    map.on('load', () => { syncInputsFromMap(); updatePlaceFromCenter(); });
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
        if (!coordPlace) return;
        const c = map.getCenter();
        const key = (localStorage.getItem('map.googleKey') || q('#settingGoogleKey')?.value || '').trim();
        if (!key) { coordPlace.textContent = '—'; return; }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(c.lat + ',' + c.lng)}&key=${encodeURIComponent(key)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
          coordPlace.textContent = '—';
          return;
        }
        const res = data.results[0];
        coordPlace.textContent = res.formatted_address || res.formattedAddress || '—';
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
      if (!map.getLayer('draw-fill')) {
        map.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['coalesce', ['get','color'], '#2196F3'], 'fill-opacity': 0.2 } });
      }
      if (!map.getLayer('draw-line')) {
        map.addLayer({ id: 'draw-line', type: 'line', source: 'draw', paint: { 'line-color': ['coalesce', ['get','color'], '#64b5f6'], 'line-width': 2 } });
      }
      // Base point as colored circle for robust visibility
      if (!map.getLayer('draw-point-circle')) {
        map.addLayer({
          id: 'draw-point-circle', type: 'circle', source: 'draw',
          filter: ['==', ['geometry-type'], 'Point'],
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
          filter: ['==', ['geometry-type'], 'Point'],
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
        map.addLayer({ id: 'draw-hl-fill', type: 'fill', source: 'draw', filter: ['==', ['get','id'], '__none__'], paint: { 'fill-color': '#FFC107', 'fill-opacity': 0.35 } });
      }
      if (!map.getLayer('draw-hl-line')) {
        map.addLayer({ id: 'draw-hl-line', type: 'line', source: 'draw', filter: ['==', ['get','id'], '__none__'], paint: { 'line-color': '#FFC107', 'line-width': 4 } });
      }
      if (!map.getLayer('draw-hl-point')) {
        map.addLayer({ id: 'draw-hl-point', type: 'circle', source: 'draw', filter: ['==', ['get','id'], '__none__'], paint: { 'circle-color': '#FFC107', 'circle-radius': 8, 'circle-opacity': 0.5 } });
      }
      if (!map.getLayer('edit-verts')) {
        map.addLayer({ id: 'edit-verts', type: 'circle', source: 'edit-verts', paint: { 'circle-color': '#FFEB3B', 'circle-stroke-color': '#333', 'circle-stroke-width': 1, 'circle-radius': 7 }, layout: { visibility: 'none' } });
      }
    };
    map.on('load', ensureDrawLayers);
    // When switching styles (map.setStyle), the style graph resets; re-add our drawing layers
    map.on('style.load', () => { try { ensureDrawLayers(); refreshDraw(); (window)._bindEditInteractions && (window)._bindEditInteractions(); if ((window)._editTarget) { refreshEditVerts(); map.setLayoutProperty('edit-verts','visibility','visible'); } } catch {} });

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
    const refreshEditVerts = () => {
      try{
        const verts = [];
        const eid = (window)._editTarget;
        if (eid) {
          const f = drawStore.features.find(x => x.properties?.id === eid);
          if (f && f.geometry?.type === 'Polygon') {
            const ring = (f.geometry.coordinates?.[0] || []).slice();
            if (ring.length >= 4) {
              for (let i=0;i<ring.length-1;i++){
                const c = ring[i];
                verts.push({ type:'Feature', properties:{ fid: f.properties?.id, idx: i }, geometry:{ type:'Point', coordinates:[c[0], c[1]] } });
              }
            }
          }
        }
        const src = map.getSource('edit-verts');
        if (src) src.setData({ type:'FeatureCollection', features: verts });
      }catch{}
    };
    (window)._refreshEditVerts = refreshEditVerts;
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
      vertCoords.push([e.lngLat.lng, e.lngLat.lat]);
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
      nameEl.addEventListener('blur', () => { commitName(); setDirty(true); refreshDraw(); });
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
            const m = (window)._map; if (m) m.fitBounds([[minLng,minLat],[maxLng,maxLat]], { padding: 80, duration: 500, maxZoom: 17 });
          }
        }catch{}
      };
      const startEdit = () => {
        (window)._editTarget = f.properties?.id || null;
        updateEditBtnState();
        try{ const m=(window)._map; if (m){ m.setLayoutProperty('edit-verts','visibility','visible'); refreshEditVerts(); try{ m.moveLayer('edit-verts'); }catch{} } }catch{}
        if (f.geometry?.type==='Polygon') flyToFeaturePolygon(f);
      };
      const stopEdit = () => {
        (window)._editTarget = null;
        updateEditBtnState();
        try{ const m=(window)._map; if (m){ m.setLayoutProperty('edit-verts','visibility','none'); refreshEditVerts(); } }catch{}
        setDirty(true); refreshDraw();
      };
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); const active = (window)._editTarget && f.properties?.id === (window)._editTarget; if (active) stopEdit(); else startEdit(); });
      aiBtn.addEventListener('click', (e) => { e.stopPropagation(); openAiModal(f); });
      return row;
    };
    const updateDrawingsPanel = () => {
      if (!drawingsList) return;
      drawingsList.innerHTML = '';
      drawStore.features.forEach(f => drawingsList.appendChild(renderRow(f)));
    };
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
        const key = (localStorage.getItem('map.googleKey') || q('#settingGoogleKey')?.value || '').trim();
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
        if (!aiTarget) return;
        const prompt = (aiInput?.value || '').trim();
        aiError.textContent = '';
        aiSubmit.disabled = true; aiSubmit.textContent = 'Submitting…'; if (aiSpinner) aiSpinner.style.display='inline-block'; if (aiInput) aiInput.disabled = true;
        // API key from settings/localStorage
        const openaiKey = (localStorage.getItem('openai.key') || q('#settingOpenAIKey')?.value || '').trim();
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
        candidates.forEach(feat => {
          drawStore.features.push(annotateFeature(feat, (feat.geometry?.type === 'Polygon') ? 'polygon' : (feat.geometry?.type === 'LineString') ? 'line' : 'poi'));
        });
        setDirty(true);
        refreshDraw();
        closeAiModal();
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

    // Persist settings when changed in UI
    tokenInput?.addEventListener('change', () => {
      console.log(tokenInput.value);
      const t = tokenInput.value.trim();
      localStorage.setItem('map.accessToken', t);
      (window).mapboxgl.accessToken = t;
    });
    googleKeyInput?.addEventListener('change', () => {
      const k = googleKeyInput.value.trim();
      localStorage.setItem('map.googleKey', k);
    });
    // Persist home address
    if (settingHomeAddress) {
      const savedHome = localStorage.getItem('map.homeAddress');
      if (savedHome && !settingHomeAddress.value) settingHomeAddress.value = savedHome;
      settingHomeAddress.addEventListener('change', () => {
        localStorage.setItem('map.homeAddress', settingHomeAddress.value.trim());
      });
    }
    // Persist OpenAI API key
    const settingOpenAIKey = q('#settingOpenAIKey');
    if (settingOpenAIKey) {
      const saved = localStorage.getItem('openai.key');
      if (saved && !settingOpenAIKey.value) settingOpenAIKey.value = saved;
      settingOpenAIKey.addEventListener('change', () => { localStorage.setItem('openai.key', settingOpenAIKey.value.trim()); });
    }
    const applyStyle = () => {
      try {
        const v = (styleInput?.value || '').trim();
        if (!v) return;
        const prev = (window)._lastStyleUrl || '';
        if (v === prev) return;
        localStorage.setItem('map.styleUrl', v);
        (window)._lastStyleUrl = v;
        map.setStyle(v);
      } catch (e) { console.error('setStyle failed', e); }
    };
    styleInput?.addEventListener('change', applyStyle);
    styleInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyStyle(); } });
    startPosInput?.addEventListener('change', () => {
      const p = parseStartPos(startPosInput.value);
      localStorage.setItem('map.startPos', p.join(', '));
      try { map.setCenter(p); } catch {}
    });
    startZoomInput?.addEventListener('change', () => {
      const z = Number(startZoomInput.value);
      localStorage.setItem('map.startZoom', String(z));
      try { map.setZoom(z); } catch {}
    });
  }

  function setStatus(state, path) {
    serialStatusDot.dataset.state = state;
    statSerial.textContent = state === 'connected' ? (path || 'connected') : state;
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

  function openModal() {
    connectModal.hidden = false;
    connectModal.querySelector('.modal-panel').focus?.();
    refreshPortsList();
  }
  function closeModal() { connectModal.hidden = true; }

  async function connectSelected() {
    if (!selectedPath) return;
    setStatus('connecting');
    connectBtnAction.disabled = true;
    try {
      const baud = Number(connectBaud.value || 115200);
      await window.serial.open(selectedPath, baud);
      setStatus('connected', selectedPath);
      serialFloat.hidden = false;
      serialFloat.classList.add('collapsed');
      if (serialFloatToggle) serialFloatToggle.setAttribute('aria-expanded', 'false');
      closeModal();
    } catch (e) {
      setStatus('disconnected');
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
      statRxRate.textContent = `${rate}/s`;
      rxCount = 0; lastTick = now;
    }
  }, 250);

  // Wire buttons
  serialConnectBtn?.addEventListener('click', openModal);
  connectClose?.addEventListener('click', closeModal);
  connectModal?.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.action === 'close') closeModal();
  });
  refreshPorts?.addEventListener('click', refreshPortsList);
  connectBtnAction?.addEventListener('click', connectSelected);

  serialFloatToggle?.addEventListener('click', () => {
    if (!serialFloat) return;
    const isCollapsed = serialFloat.classList.toggle('collapsed');
    serialFloatToggle.setAttribute('aria-expanded', String(!isCollapsed));
  });

  fullscreenBtn?.addEventListener('click', async () => {
    try { await window.app.toggleFullScreen(); } catch {}
  });

  // ---- Tabs UI state + toolbar height ----
  function updateTabUI(){
    const isMap = !!tabMapInput?.checked;
    if (tabMapLabel) { tabMapLabel.classList.toggle('active', isMap); tabMapLabel.setAttribute('aria-selected', String(isMap)); }
    if (tabSettingsLabel) { tabSettingsLabel.classList.toggle('active', !isMap); tabSettingsLabel.setAttribute('aria-selected', String(!isMap)); }
    // Adjust toolbar height var so layout collapses when hidden
    document.body.style.setProperty('--toolbar-h', isMap ? '44px' : '0px');
  }
  tabMapInput?.addEventListener('change', updateTabUI);
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

  // If no token yet, bootstrap map init when user enters one
  (function attachTokenBootstrap(){
    const tokenInput = q('#settingAccessToken');
    if (!tokenInput) return;
    const onFirstToken = () => {
      const t = tokenInput.value.trim();
      if (!t) return;
      try { localStorage.setItem('map.accessToken', t); } catch {}
      try { if ((window).mapboxgl) (window).mapboxgl.accessToken = t; } catch {}
      // If map already exists, just remove bootstrap listener
      if ((window)._map) {
        tokenInput.removeEventListener('change', onFirstToken);
        return;
      }
      tokenInput.removeEventListener('change', onFirstToken);
      try { initMap(); } catch (e) { console.error(e); }
    };
    tokenInput.addEventListener('change', onFirstToken);
  })();

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

  // Initialize panels + map after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initFloatingPanels(); initMap(); }, { once: true });
  } else {
    initFloatingPanels();
    initMap();
  }

  // Serial event listeners
  window.serial.onStatus((payload) => {
    console.log({payload})
    if (!payload) return;
    if (payload.state === 'connected') {
      setStatus('connected', payload.path);
      if (serialFloat) {
        serialFloat.hidden = false;
        serialFloat.classList.add('collapsed');
      }
      if (serialFloatToggle) serialFloatToggle.setAttribute('aria-expanded', 'false');
    } else if (payload.state === 'disconnected') {
      setStatus('disconnected');
      if (serialFloat) serialFloat.hidden = true;
      if (serialFloat) serialFloat.classList.remove('collapsed');
    } else if (payload.state === 'error') {
      setStatus('disconnected');
      console.error('Serial error:', payload.message);
      if (serialFloat) serialFloat.hidden = true;
      if (serialFloat) serialFloat.classList.remove('collapsed');
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
  resetLayoutBtn?.addEventListener('click', (e) => { e.preventDefault(); resetFloatingPanels(); });
  resetLayoutToolbarBtn?.addEventListener('click', (e) => { e.preventDefault(); resetFloatingPanels(); });

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
  window.file && window.file.onSaved && window.file.onSaved(() => setDirty(false));
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
          const b = (function computeBounds(fc){
            if (!fc || !Array.isArray(fc.features)) return null;
            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
            const extend = (lng, lat) => {
              if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
              if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
              if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
            };
            const walk = (geom) => {
              if (!geom) return;
              const t = geom.type;
              const c = geom.coordinates;
              if (t === 'Point') {
                extend(c[0], c[1]);
              } else if (t === 'LineString' || t === 'MultiPoint') {
                c.forEach(pt => extend(pt[0], pt[1]));
              } else if (t === 'Polygon' || t === 'MultiLineString') {
                c.forEach(ring => ring.forEach(pt => extend(pt[0], pt[1])));
              } else if (t === 'MultiPolygon') {
                c.forEach(poly => poly.forEach(ring => ring.forEach(pt => extend(pt[0], pt[1]))));
              } else if (t === 'GeometryCollection' && Array.isArray(geom.geometries)) {
                geom.geometries.forEach(g => walk(g));
              }
            };
            fc.features.forEach(f => walk(f.geometry));
            if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null;
            return { minLng, minLat, maxLng, maxLat };
          })(payload);
          if (b) {
            const sw = [b.minLng, b.minLat], ne = [b.maxLng, b.maxLat];
            const spanLng = b.maxLng - b.minLng, spanLat = b.maxLat - b.minLat;
            // If all features collapse to a near-point, just center and pick a reasonable zoom
            if (Math.abs(spanLng) < 0.0005 && Math.abs(spanLat) < 0.0005) {
              const centerLng = (b.minLng + b.maxLng) / 2;
              const centerLat = (b.minLat + b.maxLat) / 2;
              m.flyTo({ center: [centerLng, centerLat], zoom: Math.max(12, m.getZoom() || 12), duration: 600 });
            } else {
              m.fitBounds([sw, ne], { padding: 60, duration: 800, maxZoom: 16 });
            }
          }
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
        const key = (localStorage.getItem('map.googleKey') || q('#settingGoogleKey')?.value || '').trim();
        const home = (localStorage.getItem('map.homeAddress') || q('#settingHomeAddress')?.value || '').trim();
        if (!home) { alert('Please set a Home Address in Settings.'); return; }
        if (!key) { alert('Please set Google Maps API key in Settings.'); return; }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(home)}&key=${encodeURIComponent(key)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status !== 'OK' || !data.results?.length) { alert('Could not find the home address.'); return; }
        const loc = data.results[0].geometry.location; // { lat, lng }
        m.flyTo({ center: [loc.lng, loc.lat], zoom: Math.max(12, m.getZoom() || 12), duration: 700 });
      } catch (e) { console.error('New file action failed', e); }
    });
  }

  // ---- Toolbar wiring ----
  (function initToolbar(){
    const setActiveTool = (tool) => {
      (window)._currentTool = tool;
      const all = [toolRect, toolPoly, toolCircle, toolLine, toolPOI, toolEdit];
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
        case 'edit':
          toolEdit?.classList.add('active');
          toolEdit?.setAttribute('aria-pressed', String(true));
          try {
            const m = (window)._map; if (m) {
              m.setLayoutProperty('edit-verts','visibility','visible');
              refreshEditVerts();
              try { m.moveLayer('edit-verts'); } catch {}
            }
          } catch {}
          break;
        default: break;
      }
      if (tool !== 'edit') { try { (window)._map && (window)._map.setLayoutProperty('edit-verts','visibility','none'); } catch {} }
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
    toolEdit?.addEventListener('click', () => setActiveTool((window)._currentTool === 'edit' ? null : 'edit'));

    // Legacy prompt search removed; using modal + Places API (New) instead
    // Search modal open
    function openSearchModal(){
      if (!searchModal) return;
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

    // Live search with debounce
    let searchTimer = null;
    async function performSearch(qstr){
      if (!searchResults) return;
      const key = (localStorage.getItem('map.googleKey') || q('#settingGoogleKey')?.value || '').trim();
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
    const getMap = () => (window)._map;
    toolZoomIn?.addEventListener('click', () => { try { getMap()?.zoomIn({ duration: 300 }); } catch {} });
    toolZoomOut?.addEventListener('click', () => { try { getMap()?.zoomOut({ duration: 300 }); } catch {} });
    toolResetView?.addEventListener('click', () => {
      const m = getMap(); if (!m) return;
      try { m.easeTo({ bearing: 0, pitch: 0, duration: 400 }); } catch {}
    });
  })();

  // Global ESC handler: close modals first; else exit active tool and cancel any drafts
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Close color modal if open
    if (colorModal && colorModal.hidden === false) {
      try { colorModal.hidden = true; } catch {}
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
  console.log('Setting up edit interactions');
  (function initEditInteractions(){
    console.log('Init edit interactions');
    let dragging = null; // { fid, idx }
    const getM = () => (window)._map;
    const toLngLatFromEvent = (ev) => {
      const m = getM(); if (!m) return null;
      if (ev && ev.lngLat) return ev.lngLat;
      const oe = ev && (ev.originalEvent || ev);
      if (oe && (oe.clientX != null) && (oe.clientY != null)) {
        return m.unproject([oe.clientX, oe.clientY]);
      }
      if (oe && oe.touches && oe.touches[0]) {
        return m.unproject([oe.touches[0].clientX, oe.touches[0].clientY]);
      }
      return null;
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
    const onDown = (e) => {
      console.log((window)._editTarget);
      if (!(window)._editTarget) return;
      const feat = e.features && e.features[0];
      if (!feat) return;
      if (e.originalEvent && 'button' in e.originalEvent && e.originalEvent.button !== 0) return; // left click only
      dragging = { fid: feat.properties?.fid, idx: Number(feat.properties?.idx) };
      try {
        const m = getM(); if (!m) return;
        m.getCanvas().style.cursor = 'grabbing';
        m.dragPan.disable();
        // use document-level listeners to avoid duplicate events from map + document
        // Also listen on document to ensure we keep tracking outside the canvas
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
        document.addEventListener('touchmove', onMove, { capture:true, passive:false });
        document.addEventListener('touchend', onUp, { capture:true });
      } catch {}
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
          m.on('mouseenter', 'edit-verts', () => { if ((window)._editTarget) m.getCanvas().style.cursor = 'grab'; });
          m.on('mouseleave', 'edit-verts', () => { if ((window)._editTarget && !dragging) m.getCanvas().style.cursor = ''; });
          bound = true;
        } catch {}
      };
    })();
    try { (window)._bindEditInteractions(); } catch {}
  })();

  window.serial.onData((line) => {
    console.log({line})
    if (!serialFloatBody) return;
    rxCount += 1;
    const atBottom = Math.abs(serialFloatBody.scrollHeight - serialFloatBody.scrollTop - serialFloatBody.clientHeight) < 8;
    const text = typeof line === 'string' ? line : String(line);
    serialFloatBody.append(document.createTextNode(text.replace(/\r?\n$/, '')));
    serialFloatBody.append(document.createTextNode('\n'));
    // Trim lines
    const all = serialFloatBody.textContent || '';
    const lines = all.split('\n');
    if (lines.length > maxLines) {
      const trimmed = lines.slice(lines.length - maxLines).join('\n');
      serialFloatBody.textContent = trimmed;
    }
    if (atBottom) serialFloatBody.scrollTop = serialFloatBody.scrollHeight;
  });
})();
