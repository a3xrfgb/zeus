import type { MusicTrack } from "../types/music";
import { getTrackCoverSrc } from "./musicCover";

/** One representative cover per imported folder (first track with art in each folder). */
export function getFolderCoverArts(tracks: MusicTrack[]): string[] {
  const arts: string[] = [];
  const seen = new Set<string>();
  for (const t of tracks) {
    const src = getTrackCoverSrc(t);
    if (!t.folder || !src || seen.has(t.folder)) continue;
    seen.add(t.folder);
    arts.push(src);
  }
  return arts;
}

export function getContextCoverArts(visibleTracks: MusicTrack[], allTracks: MusicTrack[]): string[] {
  const fromVisible = visibleTracks
    .map((t) => getTrackCoverSrc(t))
    .filter(Boolean) as string[];
  if (fromVisible.length > 0) return fromVisible.slice(0, 4);
  const folderArts = getFolderCoverArts(allTracks);
  if (folderArts.length > 0) return folderArts.slice(0, 4);
  const any = allTracks.find((t) => getTrackCoverSrc(t));
  const src = any ? getTrackCoverSrc(any) : undefined;
  return src ? [src] : [];
}

export function folderLabel(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
