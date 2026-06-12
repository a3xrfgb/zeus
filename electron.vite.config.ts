import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload/index.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
    },
  },
  renderer: {
    root: ".",
    base: "./",
    publicDir: resolve(__dirname, "public"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@tauri-apps/api/core": resolve(__dirname, "src/lib/desktop/core.ts"),
        "@tauri-apps/api/window": resolve(__dirname, "src/lib/desktop/window.ts"),
        "@tauri-apps/api/event": resolve(__dirname, "src/lib/desktop/event.ts"),
        "@tauri-apps/api/path": resolve(__dirname, "src/lib/desktop/path.ts"),
        "@tauri-apps/api/dpi": resolve(__dirname, "src/lib/desktop/dpi.ts"),
        "@tauri-apps/api/webview": resolve(__dirname, "src/lib/desktop/webview.ts"),
        "@tauri-apps/plugin-dialog": resolve(__dirname, "src/lib/desktop/dialog.ts"),
        "@tauri-apps/plugin-fs": resolve(__dirname, "src/lib/desktop/fs.ts"),
        "@tauri-apps/plugin-shell": resolve(__dirname, "src/lib/desktop/shell.ts"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  },
});
