import { parseBuffer } from "music-metadata";
import { readFile } from "@tauri-apps/plugin-fs";
import { basename, dirname } from "@tauri-apps/api/path";
import type { MusicTrack } from "../types/music";
import { isTauri } from "./desktop/core";
import { parseMusicFilesIpc } from "./musicMetadataIpc";

const AUDIO_EXT = new Set(["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "aiff", "aif"]);

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wma: "audio/x-ms-wma",
  aiff: "audio/aiff",
  aif: "audio/aiff",
};

const METADATA_READ_BYTES = 512 * 1024;

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
}

export function isAudioFile(path: string): boolean {
  return AUDIO_EXT.has(extOf(path));
}

function trackId(path: string): string {
  return path.toLowerCase();
}

function pictureToDataUrl(data: Uint8Array, format: string): string {
  const blob = new Blob([data], { type: format || "image/jpeg" });
  return URL.createObjectURL(blob);
}

async function parseMusicFileInRenderer(filePath: string): Promise<MusicTrack | null> {
  if (!isAudioFile(filePath)) return null;
  try {
    const bytes = await readFile(filePath);
    const head = bytes.byteLength > METADATA_READ_BYTES ? bytes.subarray(0, METADATA_READ_BYTES) : bytes;
    const ext = extOf(filePath);
    const metadata = await parseBuffer(head, {
      mimeType: MIME_BY_EXT[ext] ?? "audio/mpeg",
      size: bytes.byteLength,
    });
    const common = metadata.common;
    const fileName = await basename(filePath);
    const title =
      common.title?.trim() ||
      fileName.replace(/\.[^.]+$/, "") ||
      "Unknown track";
    const artist = common.artist?.trim() || common.artists?.[0]?.trim() || "Unknown artist";
    const album = common.album?.trim() || "Unknown album";
    const genre = common.genre?.[0]?.trim() || "Unknown genre";
    const folder = await dirname(filePath);
    const durationSec = metadata.format.duration ?? 0;
    const pic = common.picture?.[0];
    const coverDataUrl = pic ? pictureToDataUrl(pic.data, pic.format) : undefined;

    return {
      id: trackId(filePath),
      path: filePath,
      title,
      artist,
      album,
      genre,
      folder,
      durationSec,
      coverDataUrl,
    };
  } catch {
    const fileName = await basename(filePath).catch(() => filePath);
    const title = fileName.replace(/\.[^.]+$/, "") || "Unknown track";
    let folder = "";
    try {
      folder = await dirname(filePath);
    } catch {
      /* ignore */
    }
    return {
      id: trackId(filePath),
      path: filePath,
      title,
      artist: "Unknown artist",
      album: "Unknown album",
      genre: "Unknown genre",
      folder,
      durationSec: 0,
    };
  }
}

export async function parseMusicFile(filePath: string): Promise<MusicTrack | null> {
  if (isTauri()) {
    const [track] = await parseMusicFilesIpc([filePath]);
    return track ?? null;
  }
  return parseMusicFileInRenderer(filePath);
}

export async function parseMusicFiles(paths: string[]): Promise<MusicTrack[]> {
  if (paths.length === 0) return [];
  if (isTauri()) {
    return parseMusicFilesIpc(paths);
  }
  const tracks: MusicTrack[] = [];
  for (const path of paths) {
    const track = await parseMusicFileInRenderer(path);
    if (track) tracks.push(track);
  }
  return tracks;
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
