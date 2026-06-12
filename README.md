# Zeus (Electron)

Electron-based desktop build of Zeus. The original Tauri app lives in the parent folder; this folder is a standalone Electron port.

## Architecture

| Layer | Technology |
|-------|------------|
| UI | React + Vite (same `src/` as Tauri app) |
| Shell | Electron (frameless transparent window) |
| Native APIs | Electron main process (dialog, fs, shell, custom `zeus-local://` protocol) |
| Backend | Rust **sidecar** (`core/`) — same logic as `src-tauri/`, HTTP `/invoke` bridge |
| ML scripts | Python in `scripts/` (bundled as extraResources) |

## Prerequisites

- Node.js 20+
- Rust toolchain (for sidecar)
- Python 3 with deps for optional ML features (`scripts/requirements-audio.txt`)

## Development

```bash
cd zeus-electron
npm install
npm run dev
```

**You do not need `npm run build` for dev.** `electron-vite dev` opens the Electron window with hot reload on UI changes.

On first run, `npm run dev` automatically compiles the Rust sidecar (debug, faster). After that, startup is immediate unless you change Rust code.

If you changed Rust/backend code:

```bash
npm run build:sidecar:dev   # fast debug rebuild
# or
npm run build:sidecar       # optimized release build
```

Then restart `npm run dev`.

## Production build

```bash
npm run pack:win
```

Output (Windows):

| File | Purpose |
|------|---------|
| `release/Zeus Setup 0.1.0.exe` | Installer (this is what you distribute) |
| `release/win-unpacked/Zeus.exe` | Portable app with the Zeus owl icon |

The Rust sidecar is bundled inside the app as `zeus-sidecar.exe` (not a separate shortcut).

Cross-platform: `npm run pack` (builds for the current OS).

## Data directory

Same as Tauri: `~/.zeus/` (models, SQLite DB, logs, outputs).

## IPC mapping

- Frontend still imports `@tauri-apps/*` — aliased to `src/lib/desktop/*` shims.
- `src/lib/tauri.ts` `api.*` calls unchanged; routed through preload → main → sidecar or native handlers.
- Events: `zeus-token`, `zeus-download-progress`, `zeus-runtime-download`, `ai-hub-token`, `ai-hub-stream-done`.

## Differences from Tauri build

- Larger install size (Chromium + Node + sidecar).
- Window drag uses `-webkit-app-region` where applicable; custom resize handles preserved.
- No Tauri asset protocol — replaced by `zeus-local://local?path=...`.
