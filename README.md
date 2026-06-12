# Zeus | Electron based AI desktop App

<img width="2191" height="1543" alt="zz" src="https://github.com/user-attachments/assets/33c4be3c-cca5-44a2-b4f1-e9cfbc7c5e63" />


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

 `~/.zeus/` (models, SQLite DB, logs, outputs).

