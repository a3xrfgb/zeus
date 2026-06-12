import { convertFileSrc, isTauri } from "./desktop/core";

const THUMB_MAX_WIDTH = 720;
const CAPTURE_TIMEOUT_MS = 20_000;

/** Prefer mid-video frame; fall back to early offsets if seek/capture fails. */
function thumbnailSeekTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [0.25, 1, 0];
  }

  const middle = duration / 2;
  const candidates = [
    middle,
    Math.max(0.01, middle - 1),
    Math.min(Math.max(0.01, duration - 0.05), middle + 1),
    duration * 0.25,
    duration * 0.75,
    0.25,
    0,
  ];

  const seen = new Set<string>();
  const out: number[] = [];
  for (const t of candidates) {
    const clamped = Math.min(Math.max(0, t), Math.max(0, duration - 0.05));
    const key = clamped.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clamped);
  }
  return out;
}

const THUMB_CACHE_KEY = "mid-v1";

const thumbnailCache = new Map<string, string>();
const pendingCaptures = new Map<string, Promise<string | null>>();

function cacheKey(path: string): string {
  return `${THUMB_CACHE_KEY}:${path}`;
}

function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
      "image/jpeg",
      0.84,
    );
  });
}

function captureFrame(video: HTMLVideoElement): Promise<string | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 2 || h < 2) return Promise.resolve(null);

  const scale = Math.min(1, THUMB_MAX_WIDTH / w);
  const cw = Math.max(2, Math.round(w * scale));
  const ch = Math.max(2, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, cw, ch);
  return canvasToBlobUrl(canvas);
}

function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = timeSec;
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

async function captureFromVideoElement(videoSrc: string): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  video.src = videoSrc;

  const cleanup = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("metadata timeout"));
      }, CAPTURE_TIMEOUT_MS);

      const onMeta = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("error", onErr);
        resolve();
      };
      const onErr = () => {
        window.clearTimeout(timeout);
        cleanup();
        reject(new Error("load failed"));
      };
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      video.addEventListener("error", onErr, { once: true });
      video.load();
    });

    const duration =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;

    for (const target of thumbnailSeekTimes(duration)) {
      try {
        await seekVideo(video, target);
      } catch {
        continue;
      }
      const url = await captureFrame(video);
      if (url) return url;
    }

    return null;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

async function probeDuration(videoSrc: string): Promise<number | null> {
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = videoSrc;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("timeout")), 8000);
      video.addEventListener(
        "loadedmetadata",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      video.addEventListener(
        "error",
        () => {
          window.clearTimeout(timeout);
          reject(new Error("metadata"));
        },
        { once: true },
      );
      video.load();
    });
    const d = video.duration;
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

async function resolveThumbnail(path: string, videoSrc: string): Promise<string | null> {
  const captured = await captureFromVideoElement(videoSrc);
  if (captured) {
    thumbnailCache.set(cacheKey(path), captured);
    return captured;
  }
  return null;
}

/** Duration in seconds (for tile badges). */
export async function getVideoDurationSec(path: string, videoSrc?: string): Promise<number | null> {
  const src = videoSrc || videoSrcForPath(path);
  if (!src) return null;
  return probeDuration(src);
}

function videoSrcForPath(path: string): string {
  if (!isTauri()) return "";
  return convertFileSrc(path);
}

/** Cached JPEG poster for a local gallery video (canvas capture after seek). */
export async function getVideoThumbnailUrl(path: string, videoSrc?: string): Promise<string | null> {
  const key = cacheKey(path);
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const pending = pendingCaptures.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const src = videoSrc || videoSrcForPath(path);
    if (!src) return null;
    return resolveThumbnail(path, src);
  })().finally(() => {
    pendingCaptures.delete(key);
  });

  pendingCaptures.set(key, promise);
  return promise;
}

export function invalidateVideoThumbnail(path: string): void {
  const key = cacheKey(path);
  const cached = thumbnailCache.get(key);
  if (cached?.startsWith("blob:")) {
    URL.revokeObjectURL(cached);
  }
  thumbnailCache.delete(key);
  pendingCaptures.delete(key);
}
