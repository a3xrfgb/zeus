import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = join(root, "dist", "pack-staging");
const releaseDir = join(root, "release");

if (!existsSync(stagingDir)) {
  console.error("[pack:win] dist\\pack-staging not found — build may have failed.");
  process.exit(1);
}

const installerName = readdirSync(stagingDir).find(
  (name) => name.endsWith(".exe") && name.toLowerCase().includes("setup"),
);

if (!installerName) {
  console.error("[pack:win] Setup installer not found in dist\\pack-staging");
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });
const dest = join(releaseDir, installerName);
copyFileSync(join(stagingDir, installerName), dest);

console.log("");
console.log("Installer ready:");
console.log(`  ${dest}`);
console.log("");
