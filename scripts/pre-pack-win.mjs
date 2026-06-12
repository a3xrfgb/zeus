/**
 * Stop Zeus processes and clear the pack staging folder.
 * We never touch release\ — old locked builds there cannot block packaging.
 */
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = join(root, "dist", "pack-staging");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

if (process.platform === "win32") {
  for (const name of ["Zeus.exe", "electron.exe", "zeus-sidecar.exe"]) {
    spawnSync("taskkill", ["/F", "/IM", name, "/T"], { stdio: "ignore", shell: true });
  }
  sleep(400);
}

if (existsSync(stagingDir)) {
  rmSync(stagingDir, { recursive: true, force: true });
}
mkdirSync(stagingDir, { recursive: true });
console.log("[pre-pack-win] staging ready: dist\\pack-staging");
