import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = process.platform === "win32" ? ".exe" : "";
const debug = join(root, "core", "target", "debug", `zeus-sidecar${ext}`);
const release = join(root, "core", "target", "release", `zeus-sidecar${ext}`);
const coreSrc = join(root, "core", "src");
const coreManifest = join(root, "core", "Cargo.toml");

/** Newest mtime of any Rust source under core/src (rebuild when backend changes). */
function newestCoreSourceMtime(dir) {
  let newest = 0;
  if (!existsSync(dir)) return newest;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      newest = Math.max(newest, newestCoreSourceMtime(path));
    } else if (ent.name.endsWith(".rs")) {
      newest = Math.max(newest, statSync(path).mtimeMs);
    }
  }
  return newest;
}

function newestMtime(paths) {
  let newest = 0;
  for (const path of paths) {
    if (!existsSync(path)) continue;
    newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

function sidecarBinary() {
  if (existsSync(debug)) return debug;
  if (existsSync(release)) return release;
  return null;
}

function sidecarStale() {
  const binary = sidecarBinary();
  if (!binary) return true;
  const binaryMtime = statSync(binary).mtimeMs;
  const sourceMtime = Math.max(
    newestCoreSourceMtime(coreSrc),
    newestMtime([coreManifest]),
  );
  return sourceMtime > binaryMtime;
}

function buildSidecar() {
  console.log("Building Zeus sidecar (debug)…");
  const result = spawnSync(
    "cargo",
    ["build", "--manifest-path", join(root, "core", "Cargo.toml"), "--bin", "zeus-sidecar"],
    { stdio: "inherit", cwd: root, shell: process.platform === "win32" },
  );
  process.exit(result.status ?? 1);
}

if (!sidecarBinary()) {
  console.log("Zeus sidecar not found — building debug binary (first run only, ~1–3 min)…");
  buildSidecar();
}

if (sidecarStale()) {
  console.log("Zeus sidecar is out of date — rebuilding…");
  buildSidecar();
}

process.exit(0);
