import { app, BrowserWindow, ipcMain, Menu, nativeImage, protocol, shell } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { registerInvokeRouter } from "./invoke-router";
import { registerNativeExtras } from "./ipc-native";
import { startSidecar, stopSidecar } from "./sidecar";
import { registerLocalFileProtocol } from "./protocol";

// Windows + frameless/transparent Electron windows often stay black until GPU path is fixed.
if (process.platform === "win32") {
  app.disableHardwareAcceleration();
}

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

if (process.platform === "win32") {
  app.setAppUserModelId("ai.zeus.app");
}

function resolveWindowIcon() {
  const candidates = [
    join(process.resourcesPath, "icon.ico"),
    join(__dirname, "../renderer/zeus-logo.png"),
    join(app.getAppPath(), "core/icons/icon.ico"),
    join(app.getAppPath(), "core/icons/icon.png"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return nativeImage.createFromPath(p);
  }
  return undefined;
}

// Must run before app.ready (Electron requirement).
protocol.registerSchemesAsPrivileged([
  {
    scheme: "zeus-local",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function revealWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

async function createWindow(): Promise<void> {
  const preloadCandidates = [
    join(__dirname, "../preload/index.cjs"),
    join(__dirname, "../preload/index.js"),
    join(__dirname, "../preload/index.mjs"),
  ];
  const preload = preloadCandidates.find((p) => existsSync(p)) ?? preloadCandidates[0];

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 910,
    minWidth: 900,
    minHeight: 600,
    center: true,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#f4f4f5",
    hasShadow: true,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("[Zeus] Preload failed:", preloadPath, error);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("[Zeus] Failed to load:", url, code, desc);
  });

  mainWindow.on("maximize", () => mainWindow?.webContents.send("zeus:event", "window:resized", {}));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("zeus:event", "window:resized", {}));
  mainWindow.on("resize", () => mainWindow?.webContents.send("zeus:event", "window:resized", {}));

  mainWindow.webContents.on("context-menu", (_event, params) => {
    const hasSelection = Boolean(params.selectionText?.trim());
    const template: MenuItemConstructorOptions[] = [];

    if (params.editFlags.canCut || hasSelection) {
      template.push({ role: "cut", enabled: params.editFlags.canCut });
    }
    if (params.editFlags.canCopy || hasSelection) {
      template.push({ role: "copy", enabled: params.editFlags.canCopy || hasSelection });
    }
    if (params.editFlags.canPaste) {
      template.push({ role: "paste", enabled: params.editFlags.canPaste });
    }
    if (params.editFlags.canSelectAll) {
      if (template.length > 0) template.push({ type: "separator" });
      template.push({ role: "selectAll", enabled: params.editFlags.canSelectAll });
    }

    if (template.length === 0) return;
    Menu.buildFromTemplate(template).popup({ window: mainWindow ?? undefined });
  });

  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("http://localhost") && !url.startsWith("file://") && !url.startsWith("zeus-local://")) {
      e.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    revealWindow(mainWindow!);
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  // Safety net — force visible if ready-to-show never fires (common on Windows + transparent).
  setTimeout(() => {
    if (mainWindow) revealWindow(mainWindow);
  }, 2500);

  const url = process.env.ELECTRON_RENDERER_URL;
  if (url) {
    console.log("[Zeus] Loading renderer:", url);
    await mainWindow.loadURL(url);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  registerLocalFileProtocol();
  registerInvokeRouter(() => mainWindow);
  registerNativeExtras(() => mainWindow);

  // Start sidecar before the renderer so settings/threads IPC works on first paint.
  try {
    await startSidecar((event, payload) => {
      mainWindow?.webContents.send("zeus:event", event, payload);
    });
  } catch (err) {
    console.error("[Zeus] Sidecar failed to start:", err);
  }

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    } else {
      revealWindow(mainWindow!);
    }
  });
}).catch((err) => {
  console.error("[Zeus] Failed to start:", err);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopSidecar();
});

ipcMain.on("zeus:open-settings", () => {
  mainWindow?.webContents.send("zeus:event", "zeus:open-settings", {});
});
