import type { GalleryMediaKind } from "../types/photoGallery";

/** Raster and common camera / design formats — aligned with Studio captioner coverage. */
export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "jfif",
  "pjpeg",
  "webp",
  "bmp",
  "gif",
  "tif",
  "tiff",
  "heic",
  "heif",
  "avif",
  "ico",
  "svg",
  "psd",
  "jxl",
  "jp2",
  "j2k",
  "jpx",
  "raw",
  "cr2",
  "cr3",
  "nef",
  "nrw",
  "orf",
  "sr2",
  "dng",
  "arw",
  "rw2",
  "pef",
  "srw",
  "raf",
  "x3f",
  "kdc",
  "dcr",
  "mrw",
  "erf",
  "mef",
  "mos",
  "3fr",
  "fff",
  "hdr",
  "exr",
  "pbm",
  "pgm",
  "ppm",
  "pnm",
  "pcx",
  "tga",
  "wbmp",
  "xbm",
  "xpm",
]);

export const IMAGE_DIALOG_FILTER = {
  name: "Images",
  extensions: [...IMAGE_EXTENSIONS],
};

/** Common local + web video containers (MOV, MP4, MKV, etc.). */
export const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "m4v",
  "mov",
  "qt",
  "3gp",
  "3g2",
  "3gpp",
  "3gpp2",
  "webm",
  "mkv",
  "mk3d",
  "avi",
  "wmv",
  "wm",
  "asf",
  "asx",
  "wmx",
  "flv",
  "f4v",
  "swf",
  "mpg",
  "mpeg",
  "mpe",
  "mpv",
  "mp2",
  "m2v",
  "vob",
  "mod",
  "tod",
  "ogv",
  "ogg",
  "ts",
  "m2ts",
  "mts",
  "mxf",
  "rm",
  "rmvb",
  "ram",
  "divx",
  "xvid",
  "hevc",
  "h265",
  "dv",
  "nut",
  "amv",
  "nsv",
  "mjpg",
  "mjpeg",
  "mj2",
  "insv",
  "r3d",
  "braw",
]);

export const VIDEO_DIALOG_FILTER = {
  name: "Videos",
  extensions: [...VIDEO_EXTENSIONS],
};

export const MEDIA_DIALOG_FILTER = {
  name: "Photos & videos",
  extensions: [...new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS])],
};

function extOf(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extOf(path));
}

export function isVideoFile(path: string): boolean {
  return VIDEO_EXTENSIONS.has(extOf(path));
}

export function isGalleryMediaFile(path: string): boolean {
  return isImageFile(path) || isVideoFile(path);
}

export function galleryMediaKind(path: string): "image" | "video" | null {
  if (isImageFile(path)) return "image";
  if (isVideoFile(path)) return "video";
  return null;
}

export function isVideoItem(item: { kind?: GalleryMediaKind; path: string }): boolean {
  return item.kind === "video" || (!item.kind && isVideoFile(item.path));
}

export function photoId(path: string): string {
  return path.toLowerCase();
}

export function folderLabel(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function normPath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase().replace(/\/$/, "");
}

/** True when a file lives inside an imported folder root (including subfolders). */
export function isPhotoInImportedFolder(photoPath: string, rootFolder: string): boolean {
  const root = normPath(rootFolder);
  const path = normPath(photoPath);
  if (!root || !path) return false;
  return path === root || path.startsWith(`${root}/`);
}

/** Sync path split — avoids per-file IPC round-trips in Electron. */
export function splitPhotoPath(path: string): { fileName: string; folder: string } {
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(/[/\\]/).filter(Boolean);
  const fileName = parts[parts.length - 1] || path;
  const folder = parts.length > 1 ? parts.slice(0, -1).join(sep) : "";
  return { fileName, folder };
}
