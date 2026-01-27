# Command – Local Installation Guide

This document walks you through checking out the Command repository, installing dependencies, and running the Electron application locally.

## 1. Prerequisites

Before you begin, make sure the following tools are installed:

- **Git** – for cloning the repository.
- **Node.js** (v18 or newer recommended) – includes `npm`.
- **npm** – used for dependency management.

Optional but recommended:

- A Mapbox access token and Google Maps API key (required to unlock all map features inside the app).

## 2. Clone the Repository

```bash
git clone https://github.com/<your-org>/command.git
cd command
```

Replace `<your-org>` with the actual GitHub organization or user if different.

## 3. Install Dependencies

Install all runtime and build dependencies defined in `package.json`:

```bash
npm install
```

This will also run the post-install script that copies required assets.

## 4. Run the App Locally

Start the Electron application in development mode:

```bash
npm start
```

An Electron window will launch with the Command UI. If you need to rebuild static assets before starting, you can run the asset script manually:

```bash
npm run assets
```

## 5. Configure Map & API Keys

Inside the application:

1. Open the **Settings** tab.
2. Provide your Mapbox access token to load map tiles.
3. Optionally add a Google Maps API key for search and weather overlays.
4. Save the settings to persist them locally.

## 6. Packaging (optional)

To produce distributable builds using electron-builder:

```bash
npm run dist
```

Artifacts will be generated in the `dist/` folder for your platform.

---

You are now ready to explore Command locally. For issues or contributions, please open a pull request or issue in the repository.
