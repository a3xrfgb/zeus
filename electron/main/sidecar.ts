import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

let sidecar: ChildProcessWithoutNullStreams | null = null;
let sidecarPort = 0;
let sidecarReady = false;
let sidecarStarting: Promise<void> | null = null;
let eventSink: ((event: string, payload: unknown) => void) | null = null;

/** Project root: out/main -> ../../ in dev, packaged layout differs. */
function projectRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return join(__dirname, "../..");
}

function sidecarBinaryPath(): string {
  if (app.isPackaged) {
    const name = process.platform === "win32" ? "zeus-sidecar.exe" : "zeus-sidecar";
    return join(process.resourcesPath, name);
  }
  const ext = process.platform === "win32" ? ".exe" : "";
  const root = projectRoot();
  const debugPath = join(root, "core", "target", "debug", `zeus-sidecar${ext}`);
  const releasePath = join(root, "core", "target", "release", `zeus-sidecar${ext}`);
  if (existsSync(debugPath)) return debugPath;
  if (existsSync(releasePath)) return releasePath;
  return releasePath;
}

function scriptsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "scripts");
  }
  return join(projectRoot(), "scripts");
}

export function startSidecar(onEvent: (event: string, payload: unknown) => void): Promise<void> {
  if (sidecarReady) return Promise.resolve();
  if (sidecarStarting) return sidecarStarting;

  eventSink = onEvent;
  sidecarStarting = new Promise<void>((resolve, reject) => {
    const bin = sidecarBinaryPath();
    if (!existsSync(bin)) {
      reject(
        new Error(
          `Zeus sidecar not found at ${bin}. Run "npm run build:sidecar:dev" from athena-electron first.`,
        ),
      );
      return;
    }

    console.log("[Zeus] Starting sidecar:", bin);
    sidecar = spawn(bin, [], {
      env: {
        ...process.env,
        ZEUS_SCRIPTS_DIR: scriptsDir(),
        ZEUS_DATA_DIR: join(app.getPath("home"), ".zeus"),
        RUST_BACKTRACE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let buf = "";
    const timeout = setTimeout(() => {
      reject(new Error("Sidecar startup timeout after 60s — check terminal for [sidecar stderr] output"));
    }, 60_000);

    const onLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as {
          type: string;
          port?: number;
          event?: string;
          payload?: unknown;
          message?: string;
        };
        if (msg.type === "ready" && msg.port) {
          sidecarPort = msg.port;
          sidecarReady = true;
          clearTimeout(timeout);
          console.log("[Zeus] Sidecar ready on port", msg.port);
          resolve();
        } else if (msg.type === "event" && msg.event) {
          eventSink?.(msg.event, msg.payload);
        } else if (msg.type === "error") {
          console.error("[sidecar]", msg.message);
        }
      } catch {
        console.log("[sidecar]", trimmed);
      }
    };

    sidecar.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        onLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    });

    sidecar.stderr!.on("data", (chunk: Buffer) => {
      console.error("[sidecar stderr]", chunk.toString());
    });

    sidecar.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    sidecar.on("exit", (code) => {
      console.error("[sidecar] exited with code", code);
      sidecarReady = false;
      sidecarPort = 0;
      sidecarStarting = null;
    });
  });

  return sidecarStarting;
}

export function stopSidecar(): void {
  if (sidecar && !sidecar.killed) {
    sidecar.kill();
  }
  sidecar = null;
  sidecarPort = 0;
  sidecarReady = false;
  sidecarStarting = null;
}

export function getSidecarPort(): number {
  return sidecarPort;
}

let activeLongRunningCmd: string | null = null;

function isSidecarTransportError(err: unknown): boolean {
  // Another panel's status call may time out while image generation is running — do not kill the sidecar.
  if (activeLongRunningCmd) return false;
  if (!(err instanceof Error)) return false;
  if (err.message === "Sidecar not ready") return true;
  if (err.message.startsWith("Sidecar HTTP 5")) return true;
  if (err.message.includes("fetch failed")) return true;
  if (err.name === "TimeoutError") return true;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = (cause as { code?: string }).code;
    if (code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ECONNABORTED") {
      return true;
    }
  }
  return false;
}

/** Long-running inference must not hit the default 2-minute IPC budget (that restarts the sidecar and drops the warm model). */
const INVOKE_TIMEOUT_MS: Record<string, number> = {
  stream_chat: 1_800_000,
  preload_chat_model: 900_000,
  send_message: 600_000,
  extract_receipt_vision: 900_000,
  preload_receipt_vision_model: 900_000,
};

function invokeTimeoutMs(cmd: string): number {
  return INVOKE_TIMEOUT_MS[cmd] ?? 120_000;
}

async function invokeOnce<T>(cmd: string, args: Record<string, unknown>, port: number): Promise<T> {
  const res = await fetch(`http://127.0.0.1:${port}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd, args }),
    signal: AbortSignal.timeout(invokeTimeoutMs(cmd)),
  });
  if (!res.ok) throw new Error(`Sidecar HTTP ${res.status} for ${cmd}`);
  const body = (await res.json()) as { ok: boolean; result?: T; error?: string };
  if (!body.ok) throw new Error(body.error ?? `Sidecar invoke failed: ${cmd}`);
  return body.result as T;
}

export async function sidecarInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const isLong = cmd in INVOKE_TIMEOUT_MS;
  if (isLong) activeLongRunningCmd = cmd;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (!sidecarReady) {
          await startSidecar(eventSink ?? (() => {}));
        }
        if (!sidecarPort) throw new Error("Sidecar not ready");
        return await invokeOnce<T>(cmd, args, sidecarPort);
      } catch (err) {
        if (attempt === 0 && isSidecarTransportError(err)) {
          console.warn("[Zeus] Sidecar transport error, restarting sidecar:", cmd, err);
          stopSidecar();
          await startSidecar(eventSink ?? (() => {}));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Sidecar invoke failed: ${cmd}`);
  } finally {
    if (activeLongRunningCmd === cmd) activeLongRunningCmd = null;
  }
}
