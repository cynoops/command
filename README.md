# Command

Cross‑platform desktop app for planning and annotating maps, built with Electron and Mapbox GL. Command lets you browse a map, search places, draw shapes/lines/POIs, measure distance/area, and save your work as a portable GeoJSON FeatureCollection.

[![Build & Release](https://github.com/cynoops/command/actions/workflows/release.yml/badge.svg)](https://github.com/cynoops/command/actions/workflows/release.yml)

## Features

- Mapbox GL map with live stats: zoom, center, bearing, pitch, and current style.
- Place search (Google Places) and reverse geocoding of the map center (Google Geocoding).
- Pin/unpin map to freeze interactions while inspecting coordinates and addresses.
- Drawing tools: rectangle, polygon, circle, line, and POI markers (with icon palette).
- Measurements: automatic length for lines and area for polygons in the drawings list.
- Drawings panel: editable names, hover highlight on map, one‑click delete.
- Save/Open drawings as JSON (GeoJSON FeatureCollection) with Save/Save As, and unsaved‑changes prompts on Open/New/Close.
- Suggested filenames using country/city from reverse geocoding plus date.
- Floating panels (coordinates, drawings) that you can drag, collapse, and persist across sessions; one‑click layout reset.
- Full‑screen toggle and sensible keyboard shortcuts (New/Open/Save/Save As).
- CSP‑friendly Mapbox setup (local `mapbox-gl-csp.js` + worker) for packaging.
- Cross‑platform builds via electron‑builder (macOS DMG, Windows NSIS, Linux AppImage).

## Getting Started

Prerequisites

- Node.js 20+ (CI uses Node 22)
- A Mapbox Access Token
- A Google API key with Places API and Geocoding API enabled

Install and run

```
npm install
npm start
```

During install, Mapbox GL assets are copied into `dist/vendor/mapbox-gl` for CSP‑friendly packaging.

## Configuration

Open the Settings tab inside the app and fill in:

- Map Style URL (e.g., `mapbox://styles/mapbox/streets-v12`)
- Access Token (Mapbox)
- Google Maps API Key
- Home Address (used by File → New to fly home)
- Start Position (lng,lat) and Start Zoom

Settings persist in `localStorage` on your machine. Tokens are not synced anywhere.

### Firebase (Teams)

Optional Firebase integrations are configured under Settings → Firebase:

- Paste Firebase config JSON (client) and Firebase Admin credentials (service account).
- Edit `functions/index.js` in the Functions editor to mirror tracker updates into `/sessions/{sessionId}/updates`.
- Click Deploy to run a local deploy (temp project folder, `npm install`, and Cloud Functions deploy in Europe/Germany).

## Using Drawings

- Pick a tool: Rectangle, Polygon, Circle, Line, or POI.
- Draw on the map; measurements appear in the Drawings panel.
- Rename items inline; hover to highlight; click × to delete.
- File → Save (Cmd/Ctrl+S) saves a GeoJSON FeatureCollection to disk.
- File → Open loads an existing file and fits the view to your data.

Saved file format

The app saves a standard GeoJSON FeatureCollection. Each Feature may include properties:

- `id`: opaque unique id
- `kind`: one of `rectangle` | `polygon` | `circle` | `line` | `poi`
- `name`: optional user label
- `icon`: POI marker text (for `poi`)

Example skeleton:

```
{
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "properties": { "id": "f_…", "kind": "polygon", "name": "Area A" }, "geometry": { "type": "Polygon", "coordinates": [[…]] } }
  ]
}
```

## Keyboard Shortcuts

- New: Cmd/Ctrl+N
- Open: Cmd/Ctrl+O
- Save: Cmd/Ctrl+S
- Save As: Shift+Cmd/Ctrl+S
- Toggle DevTools: Ctrl+Shift+I (Win/Linux) or Alt+Cmd+I (macOS)

## Build & Release

Local builds

```
npm run dist
```

Artifacts are written to `dist/` for your platform (DMG/NSIS/AppImage).

GitHub Releases

This repo includes a GitHub Actions workflow at `.github/workflows/release.yml` that builds on macOS, Windows, and Linux when you push a tag `v*`. To publish assets to a draft release, set `GH_TOKEN` in repo secrets.

```
git tag v0.0.1
git push origin v0.0.1
```

## Privacy & Network

- The app fetches tiles/assets from Mapbox and hits Google Geocoding/Places endpoints when you use those features.
- API keys and settings are stored locally in `localStorage`.
- No analytics are built into the app.

## License

ISC
