import { readFile } from "@tauri-apps/plugin-fs";
import type { GalleryMediaKind } from "../types/photoGallery";
import { isVideoFile } from "./photoGalleryLocal";
import { convertFileSrc, isTauri } from "./desktop/core";
import { invalidateVideoThumbnail } from "./photoGalleryVideoThumbnail";

const displayUrlCache = new Map<string, string>();
const pendingResolves = new Map<string, Promise<string>>();

const HEIC_EXT = new Set(["heic", "heif"]);

function extFromPath(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

let heicModule: typeof import("heic2any") | null = null;

async function heicToJpegBlob(bytes: Uint8Array): Promise<Blob | null> {
  try {
    if (!heicModule) {
      heicModule = await import("heic2any");
    }
    const heic2any = heicModule.default ?? heicModule;
    const result = await heic2any({
      blob: new Blob([bytes], { type: "image/heic" }),
      toType: "image/jpeg",
      quality: 0.85,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

async function resolveDisplayUrl(path: string): Promise<string> {
  if (!isTauri()) return "";
  const ext = extFromPath(path);

  // Fast path: let the local protocol serve the file (works for most formats).
  const assetUrl = convertFileSrc(path);
  if (!HEIC_EXT.has(ext)) {
    return assetUrl;
  }

  // HEIC/HEIF: convert to JPEG for Chromium preview.
  const bytes = await readFile(path);
  const jpeg = await heicToJpegBlob(bytes);
  if (jpeg) return URL.createObjectURL(jpeg);
  return assetUrl;
}

/** Display URL for gallery media (images may convert HEIC; videos use local protocol). */
export async function getGalleryMediaUrl(
  path: string,
  kind?: GalleryMediaKind,
): Promise<string> {
  const isVideo = kind === "video" || (!kind && isVideoFile(path));
  if (isVideo) {
    if (!isTauri()) return "";
    return convertFileSrc(path);
  }
  return getPhotoDisplayUrl(path);
}

/** Cached display URL for gallery tiles and lightbox (HEIC → JPEG when needed). */
export async function getPhotoDisplayUrl(path: string): Promise<string> {
  const cached = displayUrlCache.get(path);
  if (cached) return cached;

  const pending = pendingResolves.get(path);
  if (pending) return pending;

  const promise = resolveDisplayUrl(path)
    .then((url) => {
      displayUrlCache.set(path, url);
      pendingResolves.delete(path);
      return url;
    })
    .catch(() => {
      pendingResolves.delete(path);
      return convertFileSrc(path);
    });

  pendingResolves.set(path, promise);
  return promise;
}

export function invalidatePhotoDisplayUrl(path: string): void {
  const cached = displayUrlCache.get(path);
  if (cached?.startsWith("blob:")) {
    URL.revokeObjectURL(cached);
  }
  displayUrlCache.delete(path);
  pendingResolves.delete(path);
  invalidateVideoThumbnail(path);
}

export async function photoPathToDataUrl(path: string): Promise<string> {
  const displayUrl = await getPhotoDisplayUrl(path);
  if (displayUrl.startsWith("data:")) return displayUrl;
  const response = await fetch(displayUrl);
  if (!response.ok) throw new Error(`Failed to read image (${response.status})`);
  const blob = await response.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(new Blob([blob], { type }));
  });
}
