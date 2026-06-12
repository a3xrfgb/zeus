import { readDir } from "@tauri-apps/plugin-fs";
import { isGalleryMediaFile } from "./photoGalleryLocal";
import { invoke, isTauri } from "./desktop/core";

function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  const base = dir.endsWith(sep) || dir.endsWith("/") ? dir.slice(0, -1) : dir;
  return `${base}${sep}${name}`;
}

async function scanFolderInRenderer(root: string): Promise<string[]> {
  const found: string[] = [];
  const MAX = 10_000;

  async function walk(dir: string): Promise<void> {
    if (found.length >= MAX) return;
    const entries = await readDir(dir);
    const subdirs: string[] = [];
    for (const entry of entries) {
      if (found.length >= MAX) break;
      const fullPath = joinPath(dir, entry.name);
      if (entry.isDirectory) {
        subdirs.push(fullPath);
      } else if (entry.isFile && isGalleryMediaFile(fullPath)) {
        found.push(fullPath);
      }
    }
    await Promise.all(subdirs.map((sub) => walk(sub)));
  }

  await walk(root);
  return found;
}

export async function scanFolderForImages(root: string): Promise<string[]> {
  if (isTauri()) {
    return invoke<string[]>("photo:scanFolder", { root });
  }
  return scanFolderInRenderer(root);
}
