import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { PersistedPhotoItem } from "../types/photoGallery";
import { galleryMediaKind } from "./photoGalleryLocal";
import { normalizePhotoTransform } from "./photoGalleryTransform";

const LIBRARY_FILE = "photo-gallery.json";
const LEGACY_KEY = "zeus-photo-gallery-v1";

export type PhotoGallerySnapshot = {
  version: 4;
  folders: string[];
  files: string[];
  hiddenPhotoIds: string[];
  /** Custom display names for imported folder roots (path → label). */
  folderAliases: Record<string, string>;
  photos: PersistedPhotoItem[];
};

export const EMPTY_PHOTO_GALLERY: PhotoGallerySnapshot = {
  version: 4,
  folders: [],
  files: [],
  hiddenPhotoIds: [],
  folderAliases: {},
  photos: [],
};

let cachedSnapshot: PhotoGallerySnapshot = EMPTY_PHOTO_GALLERY;

export function getPhotoGallerySnapshot(): PhotoGallerySnapshot {
  return cachedSnapshot;
}

export function setPhotoGallerySnapshot(snapshot: PhotoGallerySnapshot): void {
  cachedSnapshot = normalizeSnapshot(snapshot);
}

async function libraryFilePath(): Promise<string> {
  const dir = await appDataDir();
  return join(dir, LIBRARY_FILE);
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

function normalizeFolderAliases(aliases: Record<string, string> | undefined): Record<string, string> {
  if (!aliases || typeof aliases !== "object") return {};
  const out: Record<string, string> = {};
  for (const [path, label] of Object.entries(aliases)) {
    const trimmed = label?.trim();
    if (path && trimmed) out[path] = trimmed;
  }
  return out;
}

function normalizePhotos(photos: PersistedPhotoItem[]): PersistedPhotoItem[] {
  return photos.map((p) => {
    const kind = p.kind ?? galleryMediaKind(p.path) ?? "image";
    return {
      ...p,
      kind,
      transform: kind === "image" && p.transform ? normalizePhotoTransform(p.transform) : undefined,
    };
  });
}

function normalizeSnapshot(data: Partial<PhotoGallerySnapshot>): PhotoGallerySnapshot {
  return {
    version: 4,
    folders: uniquePaths(data.folders ?? []),
    files: uniquePaths(data.files ?? []),
    hiddenPhotoIds: [...new Set((data.hiddenPhotoIds ?? []).map((id) => id.toLowerCase()))],
    folderAliases: normalizeFolderAliases(data.folderAliases),
    photos: normalizePhotos(Array.isArray(data.photos) ? data.photos : []),
  };
}

export function rememberImportedPhotoFiles(paths: string[]): void {
  const snapshot = getPhotoGallerySnapshot();
  setPhotoGallerySnapshot({
    ...snapshot,
    files: uniquePaths([...snapshot.files, ...paths]),
  });
}

export function rememberImportedPhotoFolder(folder: string): void {
  const snapshot = getPhotoGallerySnapshot();
  setPhotoGallerySnapshot({
    ...snapshot,
    folders: uniquePaths([...snapshot.folders, folder]),
  });
}

export function rememberHiddenPhoto(id: string): void {
  const snapshot = getPhotoGallerySnapshot();
  const key = id.toLowerCase();
  if (snapshot.hiddenPhotoIds.includes(key)) return;
  setPhotoGallerySnapshot({
    ...snapshot,
    hiddenPhotoIds: [...snapshot.hiddenPhotoIds, key],
  });
}

function migrateLegacy(): PhotoGallerySnapshot | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PhotoGallerySnapshot>;
    localStorage.removeItem(LEGACY_KEY);
    return normalizeSnapshot({ ...parsed, version: 4 });
  } catch {
    return null;
  }
}

export async function loadPhotoGallery(): Promise<PhotoGallerySnapshot> {
  const legacy = migrateLegacy();
  if (legacy) {
    setPhotoGallerySnapshot(legacy);
    await savePhotoGallery(legacy);
    return legacy;
  }

  try {
    const path = await libraryFilePath();
    if (!(await exists(path))) {
      setPhotoGallerySnapshot(EMPTY_PHOTO_GALLERY);
      return EMPTY_PHOTO_GALLERY;
    }
    const text = await readTextFile(path);
    const parsed = JSON.parse(text) as Partial<PhotoGallerySnapshot>;
    const snapshot = normalizeSnapshot({ ...parsed, version: 4 });
    setPhotoGallerySnapshot(snapshot);
    return snapshot;
  } catch {
    setPhotoGallerySnapshot(EMPTY_PHOTO_GALLERY);
    return EMPTY_PHOTO_GALLERY;
  }
}

export async function savePhotoGallery(snapshot: PhotoGallerySnapshot): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);
  setPhotoGallerySnapshot(normalized);
  try {
    const path = await libraryFilePath();
    const dir = await appDataDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    await writeTextFile(path, JSON.stringify(normalized, null, 2));
  } catch {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }
}
