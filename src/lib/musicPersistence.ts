import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { MusicPlaylist, MusicTrack, PersistedMusicTrack } from "../types/music";

const LIBRARY_FILE = "music-library.json";
const LEGACY_TRACKS_KEY = "zeus-music-library-v1";
const LEGACY_PLAYLISTS_KEY = "zeus-music-playlists-v1";

export type MusicLibrarySnapshot = {
  version: 2;
  folders: string[];
  files: string[];
  hiddenTrackIds: string[];
  playlists: MusicPlaylist[];
  tracks: PersistedMusicTrack[];
  /** Display names for imported folder roots (key = folder path). */
  folderLabels: Record<string, string>;
  favoriteTrackIds: string[];
};

export const EMPTY_MUSIC_LIBRARY: MusicLibrarySnapshot = {
  version: 2,
  folders: [],
  files: [],
  hiddenTrackIds: [],
  playlists: [],
  tracks: [],
  folderLabels: {},
  favoriteTrackIds: [],
};

let cachedSnapshot: MusicLibrarySnapshot = EMPTY_MUSIC_LIBRARY;

export function getMusicLibrarySnapshot(): MusicLibrarySnapshot {
  return cachedSnapshot;
}

export function setMusicLibrarySnapshot(snapshot: MusicLibrarySnapshot): void {
  cachedSnapshot = normalizeSnapshot(snapshot);
}

async function libraryFilePath(): Promise<string> {
  const dir = await appDataDir();
  return join(dir, LIBRARY_FILE);
}

function normalizeFolderLabels(labels: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!labels) return out;
  for (const [path, label] of Object.entries(labels)) {
    const trimmed = label.trim();
    if (path && trimmed) out[path] = trimmed;
  }
  return out;
}

function normalizeSnapshot(data: Partial<MusicLibrarySnapshot>): MusicLibrarySnapshot {
  return {
    version: 2,
    folders: uniquePaths(data.folders ?? []),
    files: uniquePaths(data.files ?? []),
    hiddenTrackIds: [...new Set((data.hiddenTrackIds ?? []).map((id) => id.toLowerCase()))],
    playlists: Array.isArray(data.playlists) ? data.playlists : [],
    tracks: Array.isArray(data.tracks) ? data.tracks.map(slimPersistedTrack) : [],
    folderLabels: normalizeFolderLabels(data.folderLabels),
    favoriteTrackIds: [
      ...new Set((data.favoriteTrackIds ?? []).map((id) => id.toLowerCase())),
    ],
  };
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}

export function slimPersistedTrack(track: MusicTrack | PersistedMusicTrack): PersistedMusicTrack {
  const { coverDataUrl, ...rest } = track;
  void coverDataUrl;
  return {
    id: rest.id,
    path: rest.path,
    title: rest.title,
    artist: rest.artist,
    album: rest.album,
    genre: rest.genre,
    folder: rest.folder,
    durationSec: rest.durationSec,
    coverPath: rest.coverPath,
  };
}

export function tracksFromSnapshot(tracks: PersistedMusicTrack[]): MusicTrack[] {
  return tracks.map((track) => ({ ...track }));
}

function migrateLegacyLocalStorage(): MusicLibrarySnapshot {
  try {
    const tracksRaw = localStorage.getItem(LEGACY_TRACKS_KEY);
    const playlistsRaw = localStorage.getItem(LEGACY_PLAYLISTS_KEY);
    if (!tracksRaw && !playlistsRaw) return EMPTY_MUSIC_LIBRARY;

    let tracks: PersistedMusicTrack[] = [];
    if (tracksRaw) {
      const parsed = JSON.parse(tracksRaw) as PersistedMusicTrack[] | string[];
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === "string") {
          tracks = (parsed as string[]).map((path) => ({
            id: path.toLowerCase(),
            path,
            title: path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "Unknown track",
            artist: "Unknown artist",
            album: "Unknown album",
            genre: "Unknown genre",
            folder: "",
            durationSec: 0,
          }));
        } else {
          tracks = (parsed as PersistedMusicTrack[]).map(slimPersistedTrack);
        }
      }
    }

    let playlists: MusicPlaylist[] = [];
    if (playlistsRaw) {
      const parsed = JSON.parse(playlistsRaw) as MusicPlaylist[];
      playlists = Array.isArray(parsed) ? parsed : [];
    }

    const folders = uniquePaths(tracks.map((t) => t.folder).filter(Boolean));
    const files = tracks
      .map((t) => t.path)
      .filter((path) => {
        const folder = tracks.find((t) => t.path === path)?.folder;
        return !folder || !folders.some((f) => f.toLowerCase() === folder.toLowerCase());
      });

    localStorage.removeItem(LEGACY_TRACKS_KEY);
    localStorage.removeItem(LEGACY_PLAYLISTS_KEY);

    return normalizeSnapshot({ folders, files, playlists, tracks });
  } catch {
    return EMPTY_MUSIC_LIBRARY;
  }
}

export async function loadMusicLibrary(): Promise<MusicLibrarySnapshot> {
  try {
    const path = await libraryFilePath();
    if (await exists(path)) {
      const raw = await readTextFile(path);
      const parsed = JSON.parse(raw) as Partial<MusicLibrarySnapshot>;
      const snapshot = normalizeSnapshot(parsed);
      cachedSnapshot = snapshot;
      return snapshot;
    }
  } catch {
    /* fall through to migration */
  }

  const migrated = migrateLegacyLocalStorage();
  cachedSnapshot = migrated;
  if (migrated.tracks.length > 0 || migrated.folders.length > 0 || migrated.playlists.length > 0) {
    await saveMusicLibrary(migrated);
  }
  return migrated;
}

export async function saveMusicLibrary(snapshot: MusicLibrarySnapshot): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);
  cachedSnapshot = normalized;
  try {
    const dir = await appDataDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    const path = await libraryFilePath();
    await writeTextFile(path, JSON.stringify(normalized));
  } catch {
    /* ignore write failures */
  }
}

export function rememberImportedFolder(folderPath: string): void {
  cachedSnapshot = normalizeSnapshot({
    ...cachedSnapshot,
    folders: [...cachedSnapshot.folders, folderPath],
  });
}

export function rememberImportedFiles(paths: string[]): void {
  cachedSnapshot = normalizeSnapshot({
    ...cachedSnapshot,
    files: [...cachedSnapshot.files, ...paths],
  });
}

export function rememberHiddenTrack(id: string): void {
  const key = id.toLowerCase();
  cachedSnapshot = normalizeSnapshot({
    ...cachedSnapshot,
    hiddenTrackIds: [...cachedSnapshot.hiddenTrackIds, key],
    files: cachedSnapshot.files.filter((path) => path.toLowerCase() !== key),
  });
}
