/** Electron desktop bridge — drop-in replacement for @tauri-apps/api/core */

function isElectronRenderer(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Electron");
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  if (window.zeus?.isDesktop) return true;
  return isElectronRenderer();
}

export function convertFileSrc(filePath: string, _protocol = "asset"): string {
  if (!filePath) return "";
  return `zeus-local://local?path=${encodeURIComponent(filePath)}`;
}

async function waitForDesktopApi(timeoutMs = 8000): Promise<void> {
  if (window.zeus?.invoke) return;

  if (!isElectronRenderer()) {
    throw new Error(
      "Desktop API unavailable — open the Electron window from `npm run dev`, not http://localhost:5173 in a browser.",
    );
  }

  const start = Date.now();
  while (!window.zeus?.invoke) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        "Desktop API unavailable — Electron preload did not load. Restart `npm run dev` and check the terminal for preload errors.",
      );
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

export async function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  await waitForDesktopApi();
  return window.zeus!.invoke<T>(cmd, args);
}
