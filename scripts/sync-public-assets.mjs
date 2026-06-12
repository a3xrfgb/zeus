/**
 * Sync static UI assets from the Tauri app (repo root public/) into zeus-electron/public/.
 * Keeps Electron public/ aligned with the Tauri Vite public folder.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = join(root, "public");
const sources = [
  join(root, "..", "public"),
  join(root, "public"),
];

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full));
  }
  return out;
}

function copyIfMissingOrNewer(src, dest) {
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest)) {
    cpSync(src, dest);
    return true;
  }
  const srcMtime = statSync(src).mtimeMs;
  const destMtime = statSync(dest).mtimeMs;
  if (srcMtime > destMtime) {
    cpSync(src, dest);
    return true;
  }
  return false;
}

let copied = 0;
const seen = new Set();

for (const sourceRoot of sources) {
  if (!existsSync(sourceRoot)) continue;
  for (const rel of listFiles(sourceRoot)) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    const src = join(sourceRoot, rel);
    const dest = join(destRoot, rel);
    if (copyIfMissingOrNewer(src, dest)) copied++;
  }
}

const required = [
  "zeus-logo.png",
  "lock-icon.png",
  "support-qr.png",
  "icons/attach-file.png",
  "icons/gallery-icon.png",
  "icons/linktree.svg",
  "icons/midjourney.svg",
  "icons/reve-icon.png",
  "icons/sora-icon.png",
];

const missing = required.filter((rel) => !existsSync(join(destRoot, rel)));
if (missing.length > 0) {
  console.error("[sync-public-assets] Missing required assets in public/:");
  for (const rel of missing) console.error(`  - ${rel}`);
  process.exit(1);
}

console.log(
  `[sync-public-assets] OK — ${required.length} required assets present` +
    (copied > 0 ? ` (${copied} updated from Tauri public/)` : ""),
);
