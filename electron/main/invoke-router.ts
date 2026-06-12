import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { handleNativeInvoke, isNativeCommand } from "./ipc-native";
import { isSidecarCommand, sidecarInvoke } from "./sidecar-proxy";

type InvokeEnvelope<T = unknown> =
  | { ok: true; result: T }
  | { ok: false; error: string };

export function registerInvokeRouter(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    "zeus:invoke",
    async (_event, cmd: string, args: Record<string, unknown>): Promise<InvokeEnvelope> => {
      try {
        if (isNativeCommand(cmd)) {
          const result = await handleNativeInvoke(cmd, args, getWindow);
          return { ok: true, result };
        }
        if (isSidecarCommand(cmd)) {
          const result = await sidecarInvoke(cmd, args);
          return { ok: true, result };
        }
        return { ok: false, error: `Unknown command: ${cmd}` };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    },
  );
}
