# Unused Code & Refactor Plan

## Findings (candidates for removal)

- `api/` (Firebase Functions backend). Not referenced anywhere in the Electron app or docs (`rg` only shows matches inside `api/index.js`). No `firebase-functions`/`firebase-admin` deps in `package.json`, and no deploy scripts. Likely orphaned or intended for a separate repo.
- `build_translations.py`. Not referenced by any npm script or docs; translations are consumed from `translations.json`. Looks like a legacy generator.
- `assets/symbols.json`. Not referenced at runtime (`renderer.js` uses `assets/symbolsCombine.json`). Generator script exists but is not run in normal installs.
- `assets/icons/assets/**`. No references to `assets/icons/assets` in code; appears to be a duplicate copy from `npm run install:icons`.
- `assets/icons/{bold,duotone,fill,light,thin}`. No references in `index.html`/`renderer.js` (only `assets/icons/regular/**` is used).
- `dist/` packaged artifacts (DMGs, blockmaps, builder yaml). Not used by the app at runtime; should not live in source control unless intentionally storing releases.
- `electron-updater` (devDependency). No references to `autoUpdater` or `electron-updater` in code.
- `dist/vendor/mapbox-gl/mapbox-gl.js`. Not referenced by `index.html` (CSP build uses `mapbox-gl-csp.js`).

## Removal Plan (execute later)

1. Confirm each candidate is truly unused in your workflows:
   - Run `rg -n "apiLive|firebase-functions|firebase-admin" -S .` to verify `api/` is isolated.
   - Search for any ad-hoc scripts or CI steps that reference `build_translations.py` or `assets/symbols.json`.
   - Validate icon usage by checking `index.html` and `renderer.js` references (only `assets/icons/regular/**`).
2. If `api/` is unused, remove it or move it to a dedicated backend repo.
3. Remove `build_translations.py` if it is no longer used to regenerate `translations.json`.
4. Remove `assets/symbols.json` and, if not needed anymore, `scripts/generate-symbols-json.js` and the `symbols:json` npm script.
5. Remove unused icon directories:
   - Delete `assets/icons/assets/**`.
   - Delete `assets/icons/{bold,duotone,fill,light,thin}` if you intend to keep only `regular` icons.
6. Clean `dist/` packaged artifacts (keep `dist/vendor` if you rely on it for local runs), and add a `.gitignore` entry for build outputs if desired.
7. Remove `electron-updater` from `package.json` and `package-lock.json` if you do not plan to use auto-updates.
8. Adjust `scripts/copy-mapbox-assets.js` to only copy files actually referenced (`mapbox-gl-csp.js`, `mapbox-gl-csp-worker.js`, `mapbox-gl.css`) and drop `mapbox-gl.js`.

## Refactor Plan (optional, to do alongside removals)

1. Icon pipeline cleanup:
   - Update `npm run install:icons` to copy only `regular` icons into `assets/icons/regular` (avoid duplicating `assets/icons/assets`).
   - Consider adding a small manifest of used icons to prevent future drift.
2. Symbols packaging:
   - If `assets/symbols/png`, `assets/symbols/svg`, and `assets/symbols/print` are only build inputs, exclude them from `electron-builder` `build.files` to reduce app size.
   - Optionally move symbol source assets to a `tools/` or `resources/` folder outside the packaged app.
3. Firebase SDK path:
   - Renderer supports both compat and modular SDKs, but only compat scripts are loaded. Decide on one approach:
     - Remove modular branch in `resolveFirebaseSdk` if you will stay compat-only, or
     - Switch to modular SDK, remove compat script tags, and simplify code paths.
4. Clipboard bridge cleanup:
   - Consolidate `window.clipboard` and `window.electronAPI.writeClipboard` into a single API to reduce duplication and fallback complexity.
5. General structure (if you’re touching large sections anyway):
   - Split `renderer.js` into smaller modules (map, settings, teams, file I/O) to make dead-code detection and future removals easier.

## Validation (after changes)

- Run the app (`npm start`) and exercise: map load, drawing tools, save/open, GPX import, teams/session flow, weather, and settings.
- Package a build (`npm run dist`) and confirm icons, symbols, and map assets load correctly.
