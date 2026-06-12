import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, stat } from "@tauri-apps/plugin-fs";
import type { PhotoItem, PhotoGalleryViewMode, PhotoTransform } from "../types/photoGallery";
import {
  GALLERY_TILE_SIZE_DEFAULT,
  GALLERY_TILE_SIZE_MAX,
  GALLERY_TILE_SIZE_MIN,
} from "../types/photoGallery";
import {
  galleryMediaKind,
  isGalleryMediaFile,
  isPhotoInImportedFolder,
  MEDIA_DIALOG_FILTER,
  photoId,
  splitPhotoPath,
  folderLabel as folderNameFromPath,
} from "../lib/photoGalleryLocal";
import { scanFolderForImages } from "../lib/photoGalleryImport";
import {
  getPhotoGallerySnapshot,
  loadPhotoGallery,
  rememberHiddenPhoto,
  rememberImportedPhotoFiles,
  rememberImportedPhotoFolder,
  savePhotoGallery,
} from "../lib/photoGalleryPersistence";
import { invalidatePhotoDisplayUrl } from "../lib/photoGalleryDisplay";
import {
  DEFAULT_PHOTO_TRANSFORM,
  flipHorizontal,
  flipVertical,
  normalizePhotoTransform,
  rotateLeft,
  rotateRight,
} from "../lib/photoGalleryTransform";

const IMPORT_BATCH = 80;

const VIEW_MODE_KEY = "zeus:photo-gallery-view";
const TILE_SIZE_KEY = "zeus:photo-gallery-tile-size";

function readViewMode(): PhotoGalleryViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function readTileSize(): number {
  try {
    const raw = Number(localStorage.getItem(TILE_SIZE_KEY));
    if (
      Number.isFinite(raw) &&
      raw >= GALLERY_TILE_SIZE_MIN &&
      raw <= GALLERY_TILE_SIZE_MAX
    ) {
      return Math.round(raw);
    }
  } catch {
    /* ignore */
  }
  return GALLERY_TILE_SIZE_DEFAULT;
}

function buildPhotoItem(path: string, importedAt = Date.now(), prev?: PhotoItem): PhotoItem {
  const { fileName, folder } = splitPhotoPath(path);
  const kind = prev?.kind ?? galleryMediaKind(path) ?? "image";
  return {
    id: photoId(path),
    path,
    fileName,
    folder,
    kind,
    importedAt: prev?.importedAt ?? importedAt,
    width: prev?.width,
    height: prev?.height,
    sizeBytes: prev?.sizeBytes,
    durationSec: prev?.durationSec,
    transform: kind === "image" && prev?.transform ? normalizePhotoTransform(prev.transform) : undefined,
  };
}

function normalizePhoto(p: PhotoItem): PhotoItem {
  const { fileName, folder } = splitPhotoPath(p.path);
  const kind = p.kind ?? galleryMediaKind(p.path) ?? "image";
  return {
    ...p,
    id: photoId(p.path),
    fileName: p.fileName || fileName,
    folder: p.folder ?? folder,
    kind,
    transform: kind === "image" && p.transform ? normalizePhotoTransform(p.transform) : undefined,
  };
}

async function enrichPhotoSizes(items: PhotoItem[]): Promise<PhotoItem[]> {
  const out: PhotoItem[] = [];
  for (let i = 0; i < items.length; i += IMPORT_BATCH) {
    const batch = items.slice(i, i + IMPORT_BATCH);
    const enriched = await Promise.all(
      batch.map(async (item) => {
        try {
          const s = await stat(item.path);
          return { ...item, sizeBytes: Number(s.size) };
        } catch {
          return item;
        }
      }),
    );
    out.push(...enriched);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

function sortPhotos(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) => b.importedAt - a.importedAt);
}

function slimPhotos(photos: PhotoItem[]) {
  return photos.map(
    ({ id, path, fileName, folder, importedAt, kind, width, height, sizeBytes, durationSec, transform }) => ({
      id,
      path,
      fileName,
      folder,
      importedAt,
      kind,
      width,
      height,
      sizeBytes,
      durationSec,
      transform: kind === "image" && transform ? normalizePhotoTransform(transform) : undefined,
    }),
  );
}

async function persistLibrary(photos: PhotoItem[]): Promise<void> {
  const snapshot = getPhotoGallerySnapshot();
  await savePhotoGallery({
    ...snapshot,
    photos: slimPhotos(photos),
  });
}

async function collectSourcePaths(): Promise<string[]> {
  const snapshot = getPhotoGallerySnapshot();
  const hidden = new Set(snapshot.hiddenPhotoIds);
  const paths = new Set<string>();

  for (const file of snapshot.files) {
    if (await exists(file)) paths.add(file);
  }
  for (const folder of snapshot.folders) {
    if (!(await exists(folder))) continue;
    const scanned = await scanFolderForImages(folder);
    for (const path of scanned) paths.add(path);
  }

  return [...paths].filter((path) => !hidden.has(photoId(path)));
}

function mergePhotosFromPaths(paths: string[], existing: PhotoItem[]): PhotoItem[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const next: PhotoItem[] = [];
  for (const path of paths) {
    const id = photoId(path);
    const prev = byId.get(id);
    next.push(buildPhotoItem(path, prev?.importedAt ?? Date.now(), prev));
  }
  return sortPhotos(next);
}

function updatePhotoTransform(
  photos: PhotoItem[],
  id: string,
  transform: PhotoTransform,
): PhotoItem[] {
  return photos.map((p) =>
    p.id === id ? { ...p, transform: normalizePhotoTransform(transform) } : p,
  );
}

type PhotoGalleryStore = {
  photos: PhotoItem[];
  importedFolders: string[];
  folderAliases: Record<string, string>;
  loading: boolean;
  syncing: boolean;
  hydrated: boolean;
  selectedFolder: string | null;
  sidebarCollapsed: boolean;
  search: string;
  viewMode: PhotoGalleryViewMode;
  tileSize: number;

  hydrate: () => Promise<void>;
  syncFromSources: () => Promise<void>;
  importFiles: () => Promise<number>;
  importFolder: () => Promise<number>;
  removePhoto: (id: string) => void;
  removeImportedFolder: (folderPath: string) => void;
  renameImportedFolder: (folderPath: string, label: string) => void;
  rotatePhotoLeft: (id: string) => void;
  rotatePhotoRight: (id: string) => void;
  flipPhotoHorizontal: (id: string) => void;
  flipPhotoVertical: (id: string) => void;
  setSelectedFolder: (folder: string | null) => void;
  setSearch: (search: string) => void;
  toggleSidebar: () => void;
  setViewMode: (viewMode: PhotoGalleryViewMode) => void;
  setTileSize: (tileSize: number) => void;
  increaseTileSize: () => void;
  decreaseTileSize: () => void;
  refresh: () => Promise<void>;
};

export function getVisiblePhotos(store: {
  photos: PhotoItem[];
  selectedFolder: string | null;
  search: string;
  folderAliases?: Record<string, string>;
}): PhotoItem[] {
  const q = store.search.trim().toLowerCase();
  return store.photos.filter((photo) => {
    if (
      store.selectedFolder &&
      !isPhotoInImportedFolder(photo.path, store.selectedFolder)
    ) {
      return false;
    }
    if (!q) return true;
    const alias =
      store.selectedFolder && store.folderAliases
        ? store.folderAliases[store.selectedFolder]
        : undefined;
    return (
      photo.fileName.toLowerCase().includes(q) ||
      folderNameFromPath(photo.folder).toLowerCase().includes(q) ||
      (alias?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function getImportedFolderEntries(
  importedRoots: string[],
  folderAliases: Record<string, string>,
  photos: PhotoItem[],
): { id: string; label: string; count: number }[] {
  return importedRoots
    .map((id) => ({
      id,
      label: folderAliases[id]?.trim() || folderNameFromPath(id),
      count: photos.filter((p) => isPhotoInImportedFolder(p.path, id)).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export const usePhotoGalleryStore = create<PhotoGalleryStore>((set, get) => ({
  photos: [],
  importedFolders: [],
  folderAliases: {},
  loading: false,
  syncing: false,
  hydrated: false,
  selectedFolder: null,
  sidebarCollapsed: false,
  search: "",
  viewMode: readViewMode(),
  tileSize: readTileSize(),

  hydrate: async () => {
    if (get().hydrated) return;
    const snapshot = await loadPhotoGallery();
    const photos = sortPhotos(snapshot.photos.map((p) => normalizePhoto(p as PhotoItem)));
    set({
      photos,
      hydrated: true,
      importedFolders: snapshot.folders,
      folderAliases: snapshot.folderAliases ?? {},
    });

    if (snapshot.folders.length > 0 || snapshot.files.length > 0) {
      void get().syncFromSources();
    }
  },

  syncFromSources: async () => {
    if (get().syncing) return;
    const snapshot = getPhotoGallerySnapshot();
    if (snapshot.folders.length === 0 && snapshot.files.length === 0) return;

    set({ syncing: true });
    try {
      const paths = await collectSourcePaths();
      const photos = mergePhotosFromPaths(paths, get().photos);
      await persistLibrary(photos);
      set({ photos });
    } finally {
      set({ syncing: false });
    }
  },

  importFiles: async () => {
    const picked = await open({
      multiple: true,
      directory: false,
      filters: [MEDIA_DIALOG_FILTER],
    });
    if (!picked) return 0;
    const paths = (Array.isArray(picked) ? picked : [picked]).filter(isGalleryMediaFile);
    if (paths.length === 0) return 0;

    set({ loading: true });
    try {
      const existing = new Map(get().photos.map((p) => [p.id, p]));
      let added = 0;
      for (const path of paths) {
        const id = photoId(path);
        if (existing.has(id)) continue;
        existing.set(id, buildPhotoItem(path));
        added++;
      }
      rememberImportedPhotoFiles(paths);
      const photos = sortPhotos([...existing.values()]);
      await persistLibrary(photos);
      set({ photos });
      void enrichPhotoSizes(photos).then((enriched) => {
        if (get().photos.length === enriched.length) {
          const sorted = sortPhotos(enriched);
          set({ photos: sorted });
          void persistLibrary(sorted);
        }
      });
      return added;
    } finally {
      set({ loading: false });
    }
  },

  importFolder: async () => {
    const picked = await open({
      multiple: false,
      directory: true,
    });
    if (!picked || Array.isArray(picked)) return 0;
    const folder = picked;

    set({ loading: true });
    try {
      const scanned = await scanFolderForImages(folder);
      if (scanned.length === 0) return 0;

      const existing = new Map(get().photos.map((p) => [p.id, p]));
      let added = 0;
      for (const path of scanned) {
        const id = photoId(path);
        if (existing.has(id)) continue;
        existing.set(id, buildPhotoItem(path));
        added++;
      }
      rememberImportedPhotoFolder(folder);
      const photos = sortPhotos([...existing.values()]);
      await persistLibrary(photos);
      const snapshot = getPhotoGallerySnapshot();
      set({
        photos,
        selectedFolder: folder,
        importedFolders: snapshot.folders,
        folderAliases: snapshot.folderAliases,
      });
      void enrichPhotoSizes(photos).then((enriched) => {
        if (get().photos.length === enriched.length) {
          const sorted = sortPhotos(enriched);
          set({ photos: sorted });
          void persistLibrary(sorted);
        }
      });
      return added;
    } finally {
      set({ loading: false });
    }
  },

  removePhoto: (id) => {
    const photo = get().photos.find((p) => p.id === id);
    if (photo) invalidatePhotoDisplayUrl(photo.path);
    const photos = get().photos.filter((p) => p.id !== id);
    rememberHiddenPhoto(id);
    void persistLibrary(photos);
    set({ photos });
  },

  removeImportedFolder: (folderPath) => {
    const snapshot = getPhotoGallerySnapshot();
    const key = folderPath.toLowerCase();
    const removed = get().photos.filter((p) => isPhotoInImportedFolder(p.path, folderPath));
    for (const photo of removed) {
      rememberHiddenPhoto(photo.id);
      invalidatePhotoDisplayUrl(photo.path);
    }

    const folders = snapshot.folders.filter((f) => f.toLowerCase() !== key);
    const folderAliases = { ...snapshot.folderAliases };
    delete folderAliases[folderPath];
    for (const aliasKey of Object.keys(folderAliases)) {
      if (aliasKey.toLowerCase() === key) delete folderAliases[aliasKey];
    }

    const photos = get().photos.filter((p) => !isPhotoInImportedFolder(p.path, folderPath));
    const selectedFolder =
      get().selectedFolder?.toLowerCase() === key ? null : get().selectedFolder;

    void savePhotoGallery({
      ...snapshot,
      folders,
      folderAliases,
      photos: slimPhotos(photos),
    });
    set({ photos, importedFolders: folders, folderAliases, selectedFolder });
  },

  renameImportedFolder: (folderPath, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const snapshot = getPhotoGallerySnapshot();
    const folderAliases = { ...snapshot.folderAliases, [folderPath]: trimmed };
    void savePhotoGallery({ ...snapshot, folderAliases });
    set({ folderAliases });
  },

  rotatePhotoLeft: (id) => {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) return;
    const transform = rotateLeft(photo.transform ?? DEFAULT_PHOTO_TRANSFORM);
    const photos = updatePhotoTransform(get().photos, id, transform);
    void persistLibrary(photos);
    set({ photos });
  },

  rotatePhotoRight: (id) => {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) return;
    const transform = rotateRight(photo.transform ?? DEFAULT_PHOTO_TRANSFORM);
    const photos = updatePhotoTransform(get().photos, id, transform);
    void persistLibrary(photos);
    set({ photos });
  },

  flipPhotoHorizontal: (id) => {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) return;
    const transform = flipHorizontal(photo.transform ?? DEFAULT_PHOTO_TRANSFORM);
    const photos = updatePhotoTransform(get().photos, id, transform);
    void persistLibrary(photos);
    set({ photos });
  },

  flipPhotoVertical: (id) => {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) return;
    const transform = flipVertical(photo.transform ?? DEFAULT_PHOTO_TRANSFORM);
    const photos = updatePhotoTransform(get().photos, id, transform);
    void persistLibrary(photos);
    set({ photos });
  },

  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  setSearch: (search) => set({ search }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setViewMode: (viewMode) => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* ignore */
    }
    set({ viewMode });
  },

  setTileSize: (tileSize) => {
    const next = Math.min(
      GALLERY_TILE_SIZE_MAX,
      Math.max(GALLERY_TILE_SIZE_MIN, Math.round(tileSize)),
    );
    try {
      localStorage.setItem(TILE_SIZE_KEY, String(next));
    } catch {
      /* ignore */
    }
    set({ tileSize: next });
  },

  increaseTileSize: () => {
    const { tileSize, setTileSize } = get();
    setTileSize(tileSize + 1);
  },

  decreaseTileSize: () => {
    const { tileSize, setTileSize } = get();
    setTileSize(tileSize - 1);
  },

  refresh: async () => {
    const snapshot = getPhotoGallerySnapshot();
    if (snapshot.folders.length === 0 && snapshot.files.length === 0) return;

    set({ loading: true });
    try {
      const paths = await collectSourcePaths();
      const photos = mergePhotosFromPaths(paths, get().photos);
      await persistLibrary(photos);
      set({ photos });
    } finally {
      set({ loading: false });
    }
  },
}));
