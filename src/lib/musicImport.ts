import { readTextFile, readDir } from "@tauri-apps/plugin-fs";
import { basename, dirname, extname } from "@tauri-apps/api/path";
import { isAudioFile } from "./musicLocal";
import { isTauri } from "./desktop/core";
import { scanFolderForAudioIpc } from "./musicMetadataIpc";

const PLAYLIST_EXT = new Set(["m3u", "m3u8", "pls"]);

function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  const base = dir.endsWith(sep) || dir.endsWith("/") ? dir.slice(0, -1) : dir;
  return `${base}${sep}${name}`;
}

export function isPlaylistFile(path: string): boolean {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  return PLAYLIST_EXT.has(ext);
}

async function resolveEntryPath(entry: string, baseDir: string): Promise<string> {
  const trimmed = entry.trim().replace(/^["']|["']$/g, "");
  if (!trimmed || trimmed.startsWith("#")) return "";
  if (/^https?:\/\//i.test(trimmed)) return "";
  if (/^[a-zA-Z]:\\/.test(trimmed) || trimmed.startsWith("\\\\") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return joinPath(baseDir, trimmed.replace(/\//g, "\\"));
}

function parseM3uLines(text: string, baseDir: string): Promise<string[]> {
  const lines = text.split(/\r?\n/);
  const paths: string[] = [];
  return (async () => {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const resolved = await resolveEntryPath(trimmed, baseDir);
      if (resolved && isAudioFile(resolved)) paths.push(resolved);
    }
    return paths;
  })();
}

function parsePlsLines(text: string, baseDir: string): Promise<string[]> {
  const paths: string[] = [];
  return (async () => {
    for (const line of text.split(/\r?\n/)) {
      const match = /^File\d+=(.+)$/i.exec(line.trim());
      if (!match) continue;
      const resolved = await resolveEntryPath(match[1], baseDir);
      if (resolved && isAudioFile(resolved)) paths.push(resolved);
    }
    return paths;
  })();
}

export async function parsePlaylistFile(playlistPath: string): Promise<string[]> {
  const text = await readTextFile(playlistPath);
  const baseDir = await dirname(playlistPath);
  const ext = (await extname(playlistPath)).replace(/^\./, "").toLowerCase();
  if (ext === "pls") return parsePlsLines(text, baseDir);
  return parseM3uLines(text, baseDir);
}

async function scanFolderInRenderer(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readDir(dir);
    const subdirs: string[] = [];
    for (const entry of entries) {
      const fullPath = joinPath(dir, entry.name);
      if (entry.isDirectory) {
        subdirs.push(fullPath);
      } else if (entry.isFile && isAudioFile(fullPath)) {
        found.push(fullPath);
      }
    }
    await Promise.all(subdirs.map((sub) => walk(sub)));
  }

  await walk(root);
  return found;
}

export async function scanFolderForAudio(root: string): Promise<string[]> {
  if (isTauri()) {
    return scanFolderForAudioIpc(root);
  }
  return scanFolderInRenderer(root);
}

export async function playlistDisplayName(playlistPath: string): Promise<string> {
  const name = await basename(playlistPath);
  return name.replace(/\.[^.]+$/, "") || name;
}
