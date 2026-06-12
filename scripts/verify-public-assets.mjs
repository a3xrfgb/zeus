/**
 * Post-build check: renderer bundle must use relative public paths (./…) not root-absolute (/…).
 * Root-absolute paths break in packaged Electron (file://) and hide PayPal QR + gallery icons.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rendererDir = join(root, "out", "renderer");
const assetsDir = join(rendererDir, "assets");

const requiredFiles = [
  "support-qr.png",
  "zeus-logo.png",
  "lock-icon.png",
  "icons/sora-icon.png",
  "icons/reve-icon.png",
  "icons/midjourney.svg",
  "icons/gallery-icon.png",
  "icons/attach-file.png",
  "icons/linktree.svg",
];

const missingFiles = requiredFiles.filter((rel) => !existsSync(join(rendererDir, rel)));
if (missingFiles.length > 0) {
  console.error("[verify-public-assets] Missing files in out/renderer/:");
  for (const rel of missingFiles) console.error(`  - ${rel}`);
  process.exit(1);
}

const badPatterns = [
  '"/support-qr.png"',
  "'/support-qr.png'",
  '"/icons/sora-icon.png"',
  '"/icons/reve-icon.png"',
  '"/icons/midjourney.svg"',
  '"/icons/gallery-icon.png"',
  '"/zeus-logo.png"',
  '"/lock-icon.png"',
];

if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (!name.endsWith(".js")) continue;
    const text = readFileSync(join(assetsDir, name), "utf8");
    const hits = badPatterns.filter((p) => text.includes(p));
    if (hits.length > 0) {
      console.error(`[verify-public-assets] ${name} still uses root-absolute asset paths:`);
      for (const hit of hits) console.error(`  - ${hit}`);
      console.error("Rebuild after sync-public-assets; src should use publicAsset().");
      process.exit(1);
    }
  }
}

console.log("[verify-public-assets] OK — renderer assets present and paths look relative");
