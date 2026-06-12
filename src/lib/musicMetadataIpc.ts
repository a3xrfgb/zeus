import type { MusicTrack } from "../types/music";
import { invoke, isTauri } from "./desktop/core";

const PARSE_BATCH = 40;

export async function scanFolderForAudioIpc(root: string): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("music:scanFolder", { root });
}

export async function parseMusicFilesIpc(paths: string[]): Promise<MusicTrack[]> {
  if (!isTauri() || paths.length === 0) return [];

  const tracks: MusicTrack[] = [];
  for (let i = 0; i < paths.length; i += PARSE_BATCH) {
    const batch = paths.slice(i, i + PARSE_BATCH);
    const parsed = await invoke<MusicTrack[]>("music:parseFiles", { paths: batch });
    tracks.push(...parsed);
  }
  return tracks;
}
