import {
  app,
  dialog,
  screen,
  shell,
  type BrowserWindow,
} from "electron";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  basename,
  dirname,
  extname,
  join,
} from "node:path";
import { tmpdir, homedir } from "node:os";
import { parseMusicFiles, scanFolderForAudio } from "./music-import";
import { scanFolderForImages } from "./photo-gallery-import";
import { resolveBaseDir } from "./protocol";
import { startResizeDrag, stopResizeDrag } from "./window-resize";

const NATIVE_PREFIXES = ["window:", "dialog:", "path:", "fs:", "shell:", "music:", "photo:"];

export function isNativeCommand(cmd: string): boolean {
  return NATIVE_PREFIXES.some((p) => cmd.startsWith(p));
}

export async function handleNativeInvoke(
  cmd: string,
  args: Record<string, unknown>,
  getWindow: () => BrowserWindow | null,
): Promise<unknown> {
  if (cmd.startsWith("window:")) {
    const win = getWindow();
    if (!win) return;
    switch (cmd) {
      case "window:setTitle":
        win.setTitle(String(args.title ?? "Zeus"));
        return;
      case "window:minimize":
        win.minimize();
        return;
      case "window:toggleMaximize":
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
        return;
      case "window:close":
        win.close();
        return;
      case "window:isMaximized":
        return win.isMaximized();
      case "window:setBackgroundColor":
        win.setBackgroundColor(String(args.color ?? "#0d0d0f"));
        return;
      case "window:scaleFactor": {
        const w = getWindow();
        if (!w) return 1;
        const display = screen.getDisplayMatching(w.getBounds());
        return display.scaleFactor;
      }
      case "window:startDragging":
        return;
      case "window:startResizeDragging":
        startResizeDrag(win, String(args.direction ?? "SouthEast"));
        return;
      case "window:endResizeDragging":
        stopResizeDrag();
        return;
    }
  }

  if (cmd.startsWith("dialog:")) {
    const parent = getWindow() ?? undefined;
    switch (cmd) {
      case "dialog:open": {
        const options = (args.options ?? {}) as {
          directory?: boolean;
          multiple?: boolean;
          filters?: { name: string; extensions: string[] }[];
          defaultPath?: string;
        };
        const result = await dialog.showOpenDialog(parent, {
          properties: [
            ...(options.directory ? ["openDirectory" as const] : ["openFile" as const]),
            ...(options.multiple ? ["multiSelections" as const] : []),
          ],
          filters: options.filters,
          defaultPath: options.defaultPath,
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return options.multiple ? result.filePaths : result.filePaths[0];
      }
      case "dialog:save": {
        const options = (args.options ?? {}) as {
          defaultPath?: string;
          filters?: { name: string; extensions: string[] }[];
        };
        const result = await dialog.showSaveDialog(parent, {
          defaultPath: options.defaultPath,
          filters: options.filters,
        });
        return result.canceled ? null : result.filePath ?? null;
      }
      case "dialog:message": {
        await dialog.showMessageBox(parent, {
          message: String(args.message),
          title: (args.options as { title?: string })?.title,
          type: mapKind((args.options as { kind?: string })?.kind),
        });
        return;
      }
      case "dialog:ask": {
        const result = await dialog.showMessageBox(parent, {
          message: String(args.message),
          title: (args.options as { title?: string })?.title,
          type: mapKind((args.options as { kind?: string })?.kind),
          buttons: ["Yes", "No"],
        });
        return result.response === 0;
      }
    }
  }

  if (cmd.startsWith("path:")) {
    switch (cmd) {
      case "path:join":
        return join(...((args.parts as string[]) ?? []));
      case "path:tempDir":
        return tmpdir();
      case "path:appDataDir":
        return app.getPath("userData");
      case "path:homeDir":
        return homedir();
      case "path:downloadDir":
        return app.getPath("downloads");
      case "path:documentDir":
        return app.getPath("documents");
      case "path:basename":
        return basename(String(args.path));
      case "path:dirname":
        return dirname(String(args.path));
      case "path:extname":
        return extname(String(args.path));
    }
  }

  if (cmd.startsWith("fs:")) {
    switch (cmd) {
      case "fs:readTextFile":
        return readFile(String(args.path), "utf8");
      case "fs:readFile": {
        const buf = await readFile(String(args.path));
        return Array.from(buf);
      }
      case "fs:writeTextFile":
        await writeFile(String(args.path), String(args.contents), "utf8");
        return;
      case "fs:writeFile":
        await writeFile(String(args.path), Buffer.from(args.contents as number[]));
        return;
      case "fs:mkdir":
        await mkdir(String(args.path), { recursive: Boolean(args.recursive) });
        return;
      case "fs:remove":
        await rm(String(args.path), { recursive: true, force: true });
        return;
      case "fs:exists":
        return existsSync(String(args.path));
      case "fs:stat": {
        const s = await stat(String(args.path));
        return {
          size: s.size,
          isDirectory: s.isDirectory(),
          isFile: s.isFile(),
          mtime: s.mtimeMs,
        };
      }
      case "fs:copyFile":
        await copyFile(String(args.source), String(args.destination));
        return;
      case "fs:rename":
        await rename(String(args.oldPath), String(args.newPath));
        return;
      case "fs:readDir": {
        const entries = await readdir(String(args.path), { withFileTypes: true });
        return entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          isFile: e.isFile(),
        }));
      }
      case "fs:resolvePath": {
        const base = args.baseDir ? resolveBaseDir(String(args.baseDir)) : homedir();
        return join(base, String(args.path));
      }
    }
  }

  if (cmd.startsWith("shell:")) {
    switch (cmd) {
      case "shell:open":
        await shell.openExternal(String(args.url));
        return;
      case "shell:openPath":
        await shell.openPath(String(args.path));
        return;
      case "shell:showItemInFolder":
        shell.showItemInFolder(String(args.path));
        return;
    }
  }

  if (cmd.startsWith("music:")) {
    switch (cmd) {
      case "music:scanFolder":
        return scanFolderForAudio(String(args.root));
      case "music:parseFiles":
        return parseMusicFiles((args.paths as string[]) ?? []);
    }
  }

  if (cmd.startsWith("photo:")) {
    switch (cmd) {
      case "photo:scanFolder":
        return scanFolderForImages(String(args.root));
    }
  }

  throw new Error(`Unhandled native command: ${cmd}`);
}

export function registerNativeExtras(getWindow: () => BrowserWindow | null): void {
  app.on("browser-window-created", (_e, window) => {
    window.webContents.on("drop", (event, files, _x, _y) => {
      const pos = screen.getCursorScreenPoint();
      const bounds = window.getBounds();
      window.webContents.send("zeus:event", "webview:drag-drop", {
        type: "drop",
        paths: files,
        position: { x: pos.x - bounds.x, y: pos.y - bounds.y },
      });
    });
    window.on("maximize", () => getWindow()?.webContents.send("zeus:event", "window:resized", {}));
    window.on("unmaximize", () => getWindow()?.webContents.send("zeus:event", "window:resized", {}));
  });
}

function mapKind(kind?: string): "info" | "warning" | "error" | "question" {
  if (kind === "warning") return "warning";
  if (kind === "error") return "error";
  return "info";
}
