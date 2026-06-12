import { contextBridge, ipcRenderer } from "electron";

const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();

ipcRenderer.on("zeus:event", (_event, eventName: string, payload: unknown) => {
  const handlers = eventHandlers.get(eventName);
  if (!handlers) return;
  for (const handler of handlers) {
    handler(payload);
  }
});

type InvokeEnvelope<T = unknown> =
  | { ok: true; result: T }
  | { ok: false; error: string };

const zeusApi = {
  isDesktop: true as const,
  invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    return ipcRenderer.invoke("zeus:invoke", cmd, args).then((body: InvokeEnvelope<T>) => {
      if (body && typeof body === "object" && "ok" in body) {
        if (!body.ok) throw new Error(body.error ?? "Invoke failed");
        return body.result as T;
      }
      return body as T;
    });
  },
  onEvent<T>(event: string, handler: (payload: T) => void): () => void {
    let set = eventHandlers.get(event);
    if (!set) {
      set = new Set();
      eventHandlers.set(event, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => {
      set?.delete(handler as (payload: unknown) => void);
    };
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("zeus", zeusApi);
    console.log("[Zeus preload] bridge ready");
  } catch (err) {
    console.error("[Zeus preload] contextBridge.exposeInMainWorld failed:", err);
  }
} else {
  // Fallback when context isolation is disabled
  (globalThis as unknown as { zeus: typeof zeusApi }).zeus = zeusApi;
  console.log("[Zeus preload] bridge ready (no isolation)");
}
