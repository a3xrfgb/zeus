/** Raster/vector image extensions when MIME is missing (common for .jfif on Windows). */
export const IMAGE_FILE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "pjpeg",
  "pjp",
  "png",
  "apng",
  "gif",
  "webp",
  "bmp",
  "dib",
  "tif",
  "tiff",
  "svg",
  "svgz",
  "ico",
  "cur",
  "avif",
  "avifs",
  "heic",
  "heif",
  "hif",
  "jxl",
] as const;

const IMAGE_EXT_SET = new Set<string>(IMAGE_FILE_EXTENSIONS);

export const IMAGE_EXT_RE = new RegExp(`\\.(${IMAGE_FILE_EXTENSIONS.join("|")})$`, "i");

/** File-picker `accept` — `image/*` plus extensions some OSes omit from the wildcard. */
export const CHAT_IMAGE_ACCEPT =
  "image/*,.jfif,.jpe,.pjpeg,.pjp,.heic,.heif,.avif,.jxl,.tif,.tiff,.bmp";

function basename(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop() ?? name;
}

export function imageExtensionFromFilename(name: string): string | null {
  const base = basename(name);
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() ?? "" : "";
  return IMAGE_EXT_SET.has(ext) ? ext : null;
}

export function isImageFileByName(name: string, mime?: string): boolean {
  const m = (mime ?? "").trim().toLowerCase();
  if (m.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(basename(name));
}

export function isComposerImageFile(file: File): boolean {
  return isImageFileByName(file.name, file.type);
}

export function inferImageMimeFromFilename(name: string): string | null {
  const ext = imageExtensionFromFilename(name);
  if (!ext) return null;
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jpe: "image/jpeg",
    jfif: "image/jpeg",
    pjpeg: "image/jpeg",
    pjp: "image/jpeg",
    png: "image/png",
    apng: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    dib: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    svg: "image/svg+xml",
    svgz: "image/svg+xml",
    ico: "image/x-icon",
    cur: "image/x-icon",
    avif: "image/avif",
    avifs: "image/avif",
    heic: "image/heic",
    heif: "image/heif",
    hif: "image/heif",
    jxl: "image/jxl",
  };
  return map[ext] ?? "image/jpeg";
}

/** Canonical image MIME for attachments and File blobs (handles empty type and JFIF aliases). */
export function resolveImageMime(name: string, mime?: string): string {
  const raw = (mime ?? "").trim();
  const head = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (head.startsWith("image/")) {
    if (head === "image/jfif" || head === "image/pjpeg") return "image/jpeg";
    return raw.split(";")[0].trim();
  }
  const inferred = inferImageMimeFromFilename(name);
  if (inferred) return inferred;
  return raw || "application/octet-stream";
}
