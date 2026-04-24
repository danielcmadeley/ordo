# Ordo desktop

Electron shell using [Electron Forge](https://www.electronforge.io/) and the [Vite plugin](https://www.electronforge.io/config/plugins/vite) (same layout as the [Vite + TypeScript](https://www.electronforge.io/templates/vite-+-typescript) template).

## Scripts

- `bun run dev` — from repo root, runs all dev tasks; or from this package: `electron-forge start`
- `bun run build` / `bun run package` — `electron-forge package`
- `bun run make` — `electron-forge make`
- `bun run check-types` — `tsc --noEmit`

## Project layout

- `src/main.ts` — main process. Loads the Vite dev server in development via `MAIN_WINDOW_VITE_DEV_SERVER_URL`, or the built `index.html` in production ([docs](https://www.electronforge.io/config/plugins/vite#hot-module-replacement-hmr)).
- `src/preload.ts` — preload; exposes a small `window.ordo` API.
- `src/renderer.ts` — renderer entry (Vite), imports `index.css`.
- `index.html` — renderer HTML entry.
- `forge.config.ts` — Forge + VitePlugin (`main`, `preload`, `main_window` renderer).
- `package.json` — `"main": ".vite/build/main.js"` as required by the Vite plugin.

Vite is **experimental** in Forge 7.5+; see the [v7.5.0 release notes](https://github.com/electron/forge/releases/tag/v7.5.0) for context.
