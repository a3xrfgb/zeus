import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import type {
  MusicCategory,
  MusicLibraryView,
  MusicPlaylist,
  MusicRepeatMode,
  MusicTrack,
} from "../types/music";
import { isAudioFile, parseMusicFiles } from "../lib/musicLocal";
import {
  parsePlaylistFile,
  playlistDisplayName,
  scanFolderForAudio,
} from "../lib/musicImport";
import { folderLabel } from "../lib/musicArt";
import { trackHasCover } from "../lib/musicCover";
import {
  getMusicLibrarySnapshot,
  loadMusicLibrary,
  rememberHiddenTrack,
  rememberImportedFiles,
  rememberImportedFolder,
  saveMusicLibrary,
  slimPersistedTrack,
  tracksFromSnapshot,
} from "../lib/musicPersistence";

const AUDIO_FILTER = {
  name: "Audio",
  extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "aiff", "aif"],
};

const PLAYLIST_FILTER = {
  name: "Playlist",
  extensions: ["m3u", "m3u8", "pls"],
};

const LIBRARY_VIEW_KEY = "zeus:music-library-view";
const SIDEBAR_COLLAPSED_KEY = "zeus:music-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function folderDisplayName(path: string, folderLabels: Record<string, string>): string {
  return folderLabels[path] ?? folderLabels[path.toLowerCase()] ?? folderLabel(path);
}

function readLibraryView(): MusicLibraryView {
  try {
    const raw = localStorage.getItem(LIBRARY_VIEW_KEY);
    return raw === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

async function collectLibraryPaths(): Promise<string[]> {
  const snapshot = getMusicLibrarySnapshot();
  const hidden = new Set(snapshot.hiddenTrackIds);
  const paths = new Set<string>();

  for (const folder of snapshot.folders) {
    if (!(await exists(folder))) continue;
    const scanned = await scanFolderForAudio(folder);
    for (const path of scanned) paths.add(path);
  }

  for (const file of snapshot.files) {
    if (await exists(file)) paths.add(file);
  }

  return [...paths].filter((path) => !hidden.has(path.toLowerCase()));
}

async function persistLibrary(tracks: MusicTrack[], playlists: MusicPlaylist[]): Promise<void> {
  const snapshot = getMusicLibrarySnapshot();
  await saveMusicLibrary({
    ...snapshot,
    tracks: tracks.map(slimPersistedTrack),
    playlists,
  });
}

async function refreshLibraryFromDisk(
  existingTracks: MusicTrack[],
  existingPlaylists: MusicPlaylist[],
): Promise<{ tracks: MusicTrack[]; playlists: MusicPlaylist[] }> {
  const snapshot = getMusicLibrarySnapshot();
  const pathList = await collectLibraryPaths();
  const byId = new Map(existingTracks.map((track) => [track.id, track]));

  const toParse = pathList.filter((path) => {
    const id = path.toLowerCase();
    const existing = byId.get(id);
    return !existing || !trackHasCover(existing);
  });
  if (toParse.length > 0) {
    const parsed = await parseMusicFiles(toParse);
    for (const track of parsed) {
      const prev = byId.get(track.id);
      byId.set(
        track.id,
        prev
          ? {
              ...prev,
              ...track,
              coverPath: track.coverPath ?? prev.coverPath,
            }
          : track,
      );
    }
  }

  const validIds = new Set(pathList.map((path) => path.toLowerCase()));
  const tracks = sortTracks(
    [...byId.values()].filter((track) => validIds.has(track.id)),
  );

  const playlists = existingPlaylists
    .map((playlist) => ({
      ...playlist,
      trackIds: playlist.trackIds.filter((id) => byId.has(id)),
    }))
    .filter((playlist) => playlist.trackIds.length > 0);

  await persistLibrary(tracks, playlists);
  return { tracks, playlists };
}

function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortTracks(tracks: MusicTrack[]): MusicTrack[] {
  return [...tracks].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
}

type MusicStore = {
  tracks: MusicTrack[];
  playlists: MusicPlaylist[];
  loading: boolean;
  category: MusicCategory;
  selectedGroup: string | null;
  search: string;
  queue: string[];
  queueIndex: number;
  playing: boolean;
  shuffle: boolean;
  repeat: MusicRepeatMode;
  volume: number;
  currentTime: number;
  hydrated: boolean;
  nowPlayingView: boolean;
  libraryView: MusicLibraryView;
  favoriteTrackIds: string[];
  folderLabels: Record<string, string>;
  sidebarCollapsed: boolean;

  hydrate: () => Promise<void>;
  importFiles: () => Promise<number>;
  importFolder: () => Promise<number>;
  importPlaylist: () => Promise<number>;
  removeTrack: (id: string) => void;
  removePlaylist: (id: string) => void;
  removeImportedFolder: (folderPath: string) => Promise<void>;
  renameImportedFolder: (folderPath: string, label: string) => void;
  toggleFavorite: (trackId: string) => void;
  toggleSidebar: () => void;
  setCategory: (category: MusicCategory) => void;
  setSelectedGroup: (group: string | null) => void;
  setSearch: (search: string) => void;
  setLibraryView: (view: MusicLibraryView) => void;
  playTrack: (id: string, filteredIds?: string[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  seek: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  browse: (category: MusicCategory, selectedGroup?: string | null) => void;
};

async function ingestPaths(
  paths: string[],
  existing: Map<string, MusicTrack>,
  options?: { skipExistsCheck?: boolean },
): Promise<number> {
  const toParse = paths.filter((path) => !existing.has(path.toLowerCase()));
  if (toParse.length === 0) return 0;

  const verified = options?.skipExistsCheck
    ? toParse
    : (
        await Promise.all(
          toParse.map(async (path) => ((await exists(path)) ? path : null)),
        )
      ).filter((path): path is string => path !== null);

  if (verified.length === 0) return 0;

  const parsed = await parseMusicFiles(verified);
  let added = 0;
  for (const track of parsed) {
    const prev = existing.get(track.id);
    if (!prev) {
      existing.set(track.id, track);
      added++;
      continue;
    }
    existing.set(track.id, {
      ...prev,
      ...track,
      coverPath: track.coverPath ?? prev.coverPath,
    });
  }
  return added;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  tracks: [],
  playlists: [],
  loading: false,
  category: "all",
  selectedGroup: null,
  search: "",
  queue: [],
  queueIndex: -1,
  playing: false,
  shuffle: false,
  repeat: "off",
  volume: 0.8,
  currentTime: 0,
  hydrated: false,
  nowPlayingView: false,
  libraryView: readLibraryView(),
  favoriteTrackIds: [],
  folderLabels: {},
  sidebarCollapsed: readSidebarCollapsed(),

  hydrate: async () => {
    if (get().hydrated) return;

    const snapshot = await loadMusicLibrary();
    const cachedTracks = sortTracks(tracksFromSnapshot(snapshot.tracks));
    const cachedPlaylists = snapshot.playlists;
    set({
      tracks: cachedTracks,
      playlists: cachedPlaylists,
      favoriteTrackIds: snapshot.favoriteTrackIds,
      folderLabels: snapshot.folderLabels,
      hydrated: true,
    });

    if (
      snapshot.folders.length === 0 &&
      snapshot.files.length === 0 &&
      snapshot.tracks.length === 0
    ) {
      return;
    }

    set({ loading: true });
    try {
      const { tracks, playlists } = await refreshLibraryFromDisk(
        cachedTracks,
        cachedPlaylists,
      );
      set({ tracks, playlists });
    } finally {
      set({ loading: false });
    }
  },

  importFiles: async () => {
    const picked = await open({
      multiple: true,
      directory: false,
      filters: [AUDIO_FILTER],
    });
    if (!picked) return 0;
    const paths = (Array.isArray(picked) ? picked : [picked]).filter(isAudioFile);
    if (paths.length === 0) return 0;

    set({ loading: true });
    try {
      const existing = new Map(get().tracks.map((t) => [t.id, t]));
      const added = await ingestPaths(paths, existing);
      const tracks = sortTracks(Array.from(existing.values()));
      rememberImportedFiles(paths);
      await persistLibrary(tracks, get().playlists);
      set({ tracks });
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

    set({ loading: true });
    try {
      rememberImportedFolder(picked);
      const paths = await scanFolderForAudio(picked);
      if (paths.length === 0) return 0;
      const existing = new Map(get().tracks.map((t) => [t.id, t]));
      const added = await ingestPaths(paths, existing, { skipExistsCheck: true });
      const tracks = sortTracks(Array.from(existing.values()));
      await persistLibrary(tracks, get().playlists);
      set({ tracks });
      return added;
    } finally {
      set({ loading: false });
    }
  },

  importPlaylist: async () => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [PLAYLIST_FILTER],
    });
    if (!picked || Array.isArray(picked)) return 0;

    set({ loading: true });
    try {
      const paths = await parsePlaylistFile(picked);
      const existing = new Map(get().tracks.map((t) => [t.id, t]));
      const added = await ingestPaths(paths, existing);
      const tracks = sortTracks(Array.from(existing.values()));

      const playlistId = picked.toLowerCase();
      const name = await playlistDisplayName(picked);
      const trackIds = paths.map((p) => p.toLowerCase()).filter((id) => existing.has(id));

      let playlists = [...get().playlists];
      const idx = playlists.findIndex((p) => p.id === playlistId);
      const entry: MusicPlaylist = { id: playlistId, name, sourcePath: picked, trackIds };
      if (idx >= 0) playlists[idx] = entry;
      else playlists.push(entry);
      playlists = playlists.filter((p) => p.trackIds.length > 0);

      await persistLibrary(tracks, playlists);
      set({
        tracks,
        playlists,
        category: "playlists",
        selectedGroup: playlistId,
        nowPlayingView: false,
      });
      return added;
    } finally {
      set({ loading: false });
    }
  },

  removeTrack: (id) => {
    rememberHiddenTrack(id);
    const snapshot = getMusicLibrarySnapshot();
    const key = id.toLowerCase();
    const favoriteTrackIds = snapshot.favoriteTrackIds.filter((fid) => fid !== key);
    if (favoriteTrackIds.length !== snapshot.favoriteTrackIds.length) {
      void saveMusicLibrary({ ...snapshot, favoriteTrackIds });
      set({ favoriteTrackIds });
    }
    const tracks = get().tracks.filter((t) => t.id !== id);
    const playlists = get()
      .playlists.map((p) => ({
        ...p,
        trackIds: p.trackIds.filter((tid) => tid !== id),
      }))
      .filter((p) => p.trackIds.length > 0);
    void persistLibrary(tracks, playlists);

    const { queue, queueIndex, playing, selectedGroup, category } = get();
    const qIdx = queue.indexOf(id);
    let nextQueue = queue.filter((x) => x !== id);
    let nextIndex = queueIndex;
    if (qIdx >= 0 && qIdx < queueIndex) nextIndex = Math.max(0, queueIndex - 1);
    if (qIdx === queueIndex) {
      nextIndex = Math.min(nextIndex, nextQueue.length - 1);
      if (nextQueue.length === 0) {
        set({
          tracks,
          playlists,
          queue: [],
          queueIndex: -1,
          playing: false,
          currentTime: 0,
          selectedGroup:
            category === "playlists" && !playlists.some((p) => p.id === selectedGroup)
              ? null
              : selectedGroup,
        });
        return;
      }
    }
    set({
      tracks,
      playlists,
      queue: nextQueue,
      queueIndex: nextIndex,
      playing: playing && nextQueue.length > 0,
      selectedGroup:
        category === "playlists" && !playlists.some((p) => p.id === selectedGroup)
          ? null
          : selectedGroup,
    });
  },

  removePlaylist: (id) => {
    const playlists = get().playlists.filter((p) => p.id !== id);
    void persistLibrary(get().tracks, playlists);
    const selectedGroup = get().selectedGroup === id ? null : get().selectedGroup;
    set({ playlists, selectedGroup });
  },

  removeImportedFolder: async (folderPath) => {
    const key = folderPath.toLowerCase();
    const snapshot = getMusicLibrarySnapshot();
    const folders = snapshot.folders.filter((f) => f.toLowerCase() !== key);
    const folderLabels = { ...snapshot.folderLabels };
    for (const labelKey of Object.keys(folderLabels)) {
      if (labelKey.toLowerCase() === key) delete folderLabels[labelKey];
    }

    await saveMusicLibrary({ ...snapshot, folders, folderLabels });
    set({ folderLabels, loading: true });
    try {
      const { tracks, playlists } = await refreshLibraryFromDisk(get().tracks, get().playlists);
      const { category, selectedGroup } = get();
      set({
        tracks,
        playlists,
        selectedGroup:
          category === "folders" && selectedGroup?.toLowerCase() === key ? null : selectedGroup,
      });
    } finally {
      set({ loading: false });
    }
  },

  renameImportedFolder: (folderPath, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const snapshot = getMusicLibrarySnapshot();
    const folderLabels = { ...snapshot.folderLabels, [folderPath]: trimmed };
    void saveMusicLibrary({ ...snapshot, folderLabels });
    set({ folderLabels });
  },

  toggleFavorite: (trackId) => {
    const key = trackId.toLowerCase();
    const snapshot = getMusicLibrarySnapshot();
    const favorites = new Set(snapshot.favoriteTrackIds);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    const favoriteTrackIds = [...favorites];
    void saveMusicLibrary({ ...snapshot, favoriteTrackIds });
    set({ favoriteTrackIds });
  },

  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ sidebarCollapsed });
  },

  setCategory: (category) => set({ category, selectedGroup: null, nowPlayingView: false }),
  setSelectedGroup: (selectedGroup) => set({ selectedGroup, nowPlayingView: false }),
  setSearch: (search) => set({ search }),
  setLibraryView: (libraryView) => {
    try {
      localStorage.setItem(LIBRARY_VIEW_KEY, libraryView);
    } catch {
      /* ignore */
    }
    set({ libraryView });
  },

  openNowPlaying: () => set({ nowPlayingView: true }),
  closeNowPlaying: () => set({ nowPlayingView: false }),
  browse: (category, selectedGroup = null) =>
    set({ category, selectedGroup, nowPlayingView: false }),

  playTrack: (id, filteredIds) => {
    const { tracks, shuffle, queue, queueIndex } = get();
    const currentId = queueIndex >= 0 ? queue[queueIndex] : null;

    if (currentId === id) {
      set({ playing: true, nowPlayingView: true });
      return;
    }

    const base = filteredIds ?? tracks.map((t) => t.id);
    const playable = base.filter((tid) => tracks.some((t) => t.id === tid));
    if (playable.length === 0) return;
    const nextQueue = shuffle ? shuffleIds(playable) : playable;
    const idx = nextQueue.indexOf(id);
    set({
      queue: nextQueue,
      queueIndex: idx >= 0 ? idx : 0,
      playing: true,
      currentTime: 0,
      nowPlayingView: true,
    });
  },

  togglePlay: () => {
    const { playing, queue, queueIndex, tracks, category, selectedGroup, search, playlists, favoriteTrackIds } =
      get();
    if (queue.length === 0 || queueIndex < 0) {
      const visible = getVisibleTrackIds(tracks, playlists, category, selectedGroup, search, favoriteTrackIds);
      const first = visible[0];
      if (first) get().playTrack(first, visible);
      return;
    }
    set({ playing: !playing });
  },

  playNext: () => {
    const { queue, queueIndex, repeat, shuffle, tracks, category, selectedGroup, search, playlists, favoriteTrackIds } =
      get();
    if (queue.length === 0) return;
    if (repeat === "one") {
      set({ currentTime: 0, playing: true });
      return;
    }
    let next = queueIndex + 1;
    if (next >= queue.length) {
      if (repeat === "all") next = 0;
      else {
        set({ playing: false });
        return;
      }
    }
    if (shuffle && next === 0) {
      const filtered = getVisibleTrackIds(tracks, playlists, category, selectedGroup, search, favoriteTrackIds);
      set({
        queue: shuffleIds(filtered),
        queueIndex: 0,
        playing: true,
        currentTime: 0,
      });
      return;
    }
    set({ queueIndex: next, playing: true, currentTime: 0 });
  },

  playPrevious: () => {
    const { queueIndex, currentTime, repeat } = get();
    if (queueIndex < 0) return;
    if (currentTime > 3 || repeat === "one") {
      set({ currentTime: 0, playing: true });
      return;
    }
    const prev = queueIndex > 0 ? queueIndex - 1 : 0;
    set({ queueIndex: prev, playing: true, currentTime: 0 });
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),

  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  seek: (time) => set({ currentTime: Math.max(0, time) }),
  setPlaying: (playing) => set({ playing }),
}));

function filterBySearch(tracks: MusicTrack[], search: string): MusicTrack[] {
  const q = search.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q),
  );
}

export function getVisibleTrackIds(
  tracks: MusicTrack[],
  playlists: MusicPlaylist[],
  category: MusicCategory,
  selectedGroup: string | null,
  search: string,
  favoriteTrackIds: string[] = [],
): string[] {
  if (category === "favorites") {
    const favSet = new Set(favoriteTrackIds.map((id) => id.toLowerCase()));
    const list = tracks.filter((t) => favSet.has(t.id.toLowerCase()));
    return filterBySearch(list, search).map((t) => t.id);
  }

  if (category === "playlists" && selectedGroup) {
    const playlist = playlists.find((p) => p.id === selectedGroup);
    if (!playlist) return [];
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const ordered = playlist.trackIds.map((id) => byId.get(id)).filter(Boolean) as MusicTrack[];
    return filterBySearch(ordered, search).map((t) => t.id);
  }

  let list = tracks;
  list = filterBySearch(list, search);

  if (selectedGroup) {
    switch (category) {
      case "artists":
        list = list.filter((t) => t.artist === selectedGroup);
        break;
      case "albums":
        list = list.filter((t) => t.album === selectedGroup);
        break;
      case "folders":
        list = list.filter((t) => t.folder === selectedGroup);
        break;
      case "genres":
        list = list.filter((t) => t.genre === selectedGroup);
        break;
      default:
        break;
    }
  }
  return list.map((t) => t.id);
}

export function getImportedMusicFolders(
  tracks: MusicTrack[],
  folderLabels: Record<string, string>,
): { id: string; label: string; count: number }[] {
  const snapshot = getMusicLibrarySnapshot();
  const roots = new Set<string>();
  for (const folder of snapshot.folders) roots.add(folder);
  for (const track of tracks) {
    if (track.folder) roots.add(track.folder);
  }
  return Array.from(roots)
    .map((id) => ({
      id,
      label: folderDisplayName(id, folderLabels),
      count: tracks.filter((t) => t.folder === id).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function getCategoryGroups(
  tracks: MusicTrack[],
  playlists: MusicPlaylist[],
  category: MusicCategory,
  folderLabels: Record<string, string> = {},
): { id: string; label: string }[] {
  if (category === "playlists") {
    return playlists.map((p) => ({ id: p.id, label: p.name }));
  }

  if (category === "folders") {
    return getImportedMusicFolders(tracks, folderLabels).map(({ id, label }) => ({ id, label }));
  }

  const key = (t: MusicTrack) => {
    switch (category) {
      case "artists":
        return t.artist;
      case "albums":
        return t.album;
      case "genres":
        return t.genre;
      default:
        return "";
    }
  };

  const set = new Set<string>();
  for (const t of tracks) {
    const v = key(t);
    if (v) set.add(v);
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((label) => ({ id: label, label }));
}

export function isTrackFavorite(trackId: string, favoriteTrackIds: string[]): boolean {
  return favoriteTrackIds.includes(trackId.toLowerCase());
}

export function getCurrentTrack(store: MusicStore): MusicTrack | null {
  const { queue, queueIndex, tracks } = store;
  if (queueIndex < 0 || queueIndex >= queue.length) return null;
  return tracks.find((t) => t.id === queue[queueIndex]) ?? null;
}
