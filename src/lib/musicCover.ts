import { convertFileSrc } from "@tauri-apps/api/core";
import type { MusicTrack } from "../types/music";

export type TrackCoverFields = Pick<MusicTrack, "coverPath" | "coverDataUrl">;

export function trackHasCover(track: TrackCoverFields): boolean {
  if (track.coverPath) return true;
  if (!track.coverDataUrl) return false;
  return (
    track.coverDataUrl.startsWith("data:") ||
    track.coverDataUrl.startsWith("blob:") ||
    track.coverDataUrl.startsWith("zeus-local:")
  );
}

export function getTrackCoverSrc(track: TrackCoverFields): string | undefined {
  if (track.coverPath) {
    return convertFileSrc(track.coverPath);
  }
  if (track.coverDataUrl) {
    return track.coverDataUrl;
  }
  return undefined;
}
