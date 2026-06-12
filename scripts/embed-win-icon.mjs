/**
 * Apply the app icon to the NSIS installer exe.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import rcedit from "rcedit";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icon = join(root, "core/icons/icon.ico");
const releaseDir = join(root, "release");

if (process.platform !== "win32") {
  process.exit(0);
}

if (!existsSync(icon)) {
  console.error("embed-win-icon: missing", icon);
  process.exit(1);
}

const installer = existsSync(releaseDir)
  ? readdirSync(releaseDir).find(
      (name) => name.endsWith(".exe") && name.toLowerCase().includes("setup"),
    )
  : null;

if (!installer) {
  console.warn("embed-win-icon: no Setup installer found under release\\");
  process.exit(0);
}

const installerPath = join(releaseDir, installer);
await rcedit(installerPath, { icon });
