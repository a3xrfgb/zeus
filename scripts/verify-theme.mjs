/**
 * Smoke-test theme apply + settings save against a running sidecar.
 * Usage: node scripts/verify-theme.mjs [port]
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = process.platform === "win32" ? ".exe" : "";
const sidecarBin =
  [join(root, "core", "target", "debug", `zeus-sidecar${ext}`), join(root, "core", "target", "release", `zeus-sidecar${ext}`)].find(
    (p) => existsSync(p),
  ) ?? join(root, "core", "target", "debug", `zeus-sidecar${ext}`);

let port = Number(process.argv[2]) || 0;
let sidecar = null;

async function invoke(portNum, cmd, args = {}) {
  const res = await fetch(`http://127.0.0.1:${portNum}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd, args }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? `invoke failed: ${cmd}`);
  return body.result;
}

function startSidecarProcess() {
  return new Promise((resolve, reject) => {
    sidecar = spawn(sidecarBin, [], {
      env: {
        ...process.env,
        ZEUS_DATA_DIR: join(process.env.USERPROFILE || process.env.HOME || ".", ".zeus"),
        RUST_BACKTRACE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let buf = "";
    const timeout = setTimeout(() => reject(new Error("sidecar startup timeout")), 60_000);
    sidecar.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "ready" && msg.port) {
            clearTimeout(timeout);
            resolve(msg.port);
          }
        } catch {
          /* ignore */
        }
      }
    });
    sidecar.on("error", reject);
    sidecar.on("exit", (code) => reject(new Error(`sidecar exited ${code}`)));
  });
}

try {
  if (!port) {
    console.log("Starting sidecar:", sidecarBin);
    port = await startSidecarProcess();
    console.log("Sidecar ready on port", port);
  }

  const settings = await invoke(port, "get_settings");
  console.log("Initial theme:", settings.theme);

  const next = { ...settings, theme: settings.theme === "light" ? "dark" : "light" };
  await invoke(port, "save_settings", { settings: next });
  const saved = await invoke(port, "get_settings");
  console.log("Saved theme:", saved.theme);

  if (saved.theme !== next.theme) {
    throw new Error(`theme mismatch: expected ${next.theme}, got ${saved.theme}`);
  }

  // restore original theme
  await invoke(port, "save_settings", { settings });
  console.log("Theme persistence OK");
} finally {
  if (sidecar && !sidecar.killed) sidecar.kill();
}
