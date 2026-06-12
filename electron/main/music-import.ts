import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { app } from "electron";
import { parseFile, type IPicture } from "music-metadata";

const AUDIO_EXT = new Set([
  "mp3",
  "wav",
  "flac",
  "m4a",
  "aac",
  "ogg",
  "opus",
  "wma",
  "aiff",
  "aif",
]);

const PARSE_CONCURRENCY = 12;

export type ParsedMusicTrack = {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  folder: string;
  durationSec: number;
  coverPath?: string;
};

function isAudioFile(filePath: string): boolean {
  const ext = extname(filePath).replace(/^\./, "").toLowerCase();
  return AUDIO_EXT.has(ext);
}

function trackId(path: string): string {
  return path.toLowerCase();
}

function coversDir(): string {
  return join(app.getPath("userData"), "music-covers");
}

function coverFileKey(trackKey: string): string {
  return createHash("sha256").update(trackKey).digest("hex").slice(0, 24);
}

function extFromFormat(format: string): string {
  const f = format.trim().toLowerCase();
  if (f.includes("png")) return "png";
  if (f.includes("webp")) return "webp";
  if (f.includes("gif")) return "gif";
  if (f.includes("bmp")) return "bmp";
  return "jpg";
}

function pickCoverPicture(pictures: IPicture[] | undefined): IPicture | undefined {
  if (!pictures?.length) return undefined;
  const front = pictures.find(
    (pic) => pic.type === "Cover (front)" || pic.type === "3" || pic.type === 3,
  );
  return front ?? pictures[0];
}

async function saveCoverArt(
  trackKey: string,
  data: Uint8Array,
  format: string,
): Promise<string | undefined> {
  if (!data.byteLength) return undefined;

  const dir = coversDir();
  await mkdir(dir, { recursive: true });
  const ext = extFromFormat(format);
  const filePath = join(dir, `${coverFileKey(trackKey)}.${ext}`);

  await writeFile(filePath, data);
  return filePath;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function scanFolderForAudio(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    const subdirs: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        subdirs.push(fullPath);
      } else if (entry.isFile() && isAudioFile(fullPath)) {
        found.push(fullPath);
      }
    }
    await Promise.all(subdirs.map((sub) => walk(sub)));
  }

  await walk(root);
  return found;
}

async function parseOneMusicFile(filePath: string): Promise<ParsedMusicTrack | null> {
  if (!isAudioFile(filePath)) return null;
  const fileName = basename(filePath);
  const folder = dirname(filePath);
  const fallbackTitle = fileName.replace(/\.[^.]+$/, "") || "Unknown track";
  const id = trackId(filePath);

  try {
    const metadata = await parseFile(filePath, { duration: true });
    const common = metadata.common;
    const pic = pickCoverPicture(common.picture);
    const coverPath = pic ? await saveCoverArt(id, pic.data, pic.format) : undefined;

    return {
      id,
      path: filePath,
      title: common.title?.trim() || fallbackTitle,
      artist: common.artist?.trim() || common.artists?.[0]?.trim() || "Unknown artist",
      album: common.album?.trim() || "Unknown album",
      genre: common.genre?.[0]?.trim() || "Unknown genre",
      folder,
      durationSec: metadata.format.duration ?? 0,
      coverPath,
    };
  } catch {
    return {
      id,
      path: filePath,
      title: fallbackTitle,
      artist: "Unknown artist",
      album: "Unknown album",
      genre: "Unknown genre",
      folder,
      durationSec: 0,
    };
  }
}

export async function parseMusicFiles(paths: string[]): Promise<ParsedMusicTrack[]> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return [];

  const parsed = await mapPool(unique, PARSE_CONCURRENCY, parseOneMusicFile);
  return parsed.filter((t): t is ParsedMusicTrack => t !== null);
}
