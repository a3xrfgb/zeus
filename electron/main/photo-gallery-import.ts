import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const IMAGE_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "pjpeg", "webp", "bmp", "gif", "tif", "tiff",
  "heic", "heif", "avif", "ico", "svg", "psd", "jxl", "jp2", "j2k", "jpx",
  "raw", "cr2", "cr3", "nef", "nrw", "orf", "sr2", "dng", "arw", "rw2", "pef",
  "srw", "raf", "x3f", "kdc", "dcr", "mrw", "erf", "mef", "mos", "3fr", "fff",
  "hdr", "exr", "pbm", "pgm", "ppm", "pnm", "pcx", "tga", "wbmp", "xbm", "xpm",
]);

const VIDEO_EXT = new Set([
  "mp4", "m4v", "mov", "qt", "3gp", "3g2", "3gpp", "3gpp2", "webm", "mkv", "mk3d",
  "avi", "wmv", "wm", "asf", "asx", "wmx", "flv", "f4v", "swf", "mpg", "mpeg",
  "mpe", "mpv", "mp2", "m2v", "vob", "mod", "tod", "ogv", "ogg", "ts", "m2ts",
  "mts", "mxf", "rm", "rmvb", "ram", "divx", "xvid", "hevc", "h265", "dv", "nut",
  "amv", "nsv", "mjpg", "mjpeg", "mj2", "insv", "r3d", "braw",
]);

const MAX_SCAN_RESULTS = 10_000;

function isGalleryMediaFile(filePath: string): boolean {
  const ext = extname(filePath).replace(/^\./, "").toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext);
}

export async function scanFolderForImages(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (found.length >= MAX_SCAN_RESULTS) return;
    const entries = await readdir(dir, { withFileTypes: true });
    const subdirs: string[] = [];
    for (const entry of entries) {
      if (found.length >= MAX_SCAN_RESULTS) break;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        subdirs.push(fullPath);
      } else if (entry.isFile() && isGalleryMediaFile(fullPath)) {
        found.push(fullPath);
      }
    }
    await Promise.all(subdirs.map((sub) => walk(sub)));
  }

  await walk(root);
  return found;
}
