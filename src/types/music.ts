export type MusicCategory =
  | "all"
  | "favorites"
  | "playlists"
  | "artists"
  | "albums"
  | "folders"
  | "genres";

export type MusicRepeatMode = "off" | "all" | "one";

export type MusicLibraryView = "list" | "grid";

export type MusicTrack = {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  folder: string;
  durationSec: number;
  /** Cached cover image on disk (app user data). */
  coverPath?: string;
  /** Legacy in-memory cover URL (not persisted). */
  coverDataUrl?: string;
};

export type PersistedMusicTrack = Omit<MusicTrack, "coverDataUrl">;

export type MusicPlaylist = {
  id: string;
  name: string;
  sourcePath: string;
  trackIds: string[];
};
