import type { CanvasNodeKind } from "../types/canvasWorkspace";
import { isImageFileByName } from "./imageFileTypes";

export const VIDEO_FILE_EXTENSIONS = [
  "mp4",
  "m4v",
  "mov",
  "qt",
  "webm",
  "mkv",
  "avi",
  "wmv",
  "asf",
  "flv",
  "f4v",
  "ogv",
  "ogm",
  "3gp",
  "3g2",
  "ts",
  "mts",
  "m2ts",
  "vob",
  "mpg",
  "mpeg",
  "mpe",
  "mpv",
  "m2v",
  "divx",
  "xvid",
  "rm",
  "rmvb",
  "amv",
  "f4p",
] as const;

export const AUDIO_FILE_EXTENSIONS = [
  "mp3",
  "mp2",
  "wav",
  "wave",
  "flac",
  "ogg",
  "oga",
  "ogm",
  "opus",
  "m4a",
  "m4b",
  "m4p",
  "aac",
  "wma",
  "aiff",
  "aif",
  "aifc",
  "caf",
  "mid",
  "midi",
  "kar",
  "amr",
  "awb",
  "ape",
  "alac",
  "ac3",
  "eac3",
  "dts",
  "mka",
  "weba",
  "ra",
  "ram",
  "au",
  "snd",
  "voc",
  "wv",
  "tta",
] as const;

const VIDEO_EXT_SET = new Set<string>(VIDEO_FILE_EXTENSIONS);
const AUDIO_EXT_SET = new Set<string>(AUDIO_FILE_EXTENSIONS);

export const VIDEO_EXT_RE = new RegExp(`\\.(${VIDEO_FILE_EXTENSIONS.join("|")})$`, "i");
export const AUDIO_EXT_RE = new RegExp(`\\.(${AUDIO_FILE_EXTENSIONS.join("|")})$`, "i");

function basename(name: string): string {
  return name.replace(/\\/g, "/").split("/").pop() ?? name;
}

function extensionFromFilename(name: string): string {
  const base = basename(name);
  return base.includes(".") ? (base.split(".").pop()?.toLowerCase() ?? "") : "";
}

export function videoExtensionFromFilename(name: string): string | null {
  const ext = extensionFromFilename(name);
  return VIDEO_EXT_SET.has(ext) ? ext : null;
}

export function audioExtensionFromFilename(name: string): string | null {
  const ext = extensionFromFilename(name);
  return AUDIO_EXT_SET.has(ext) ? ext : null;
}

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  ogv: "video/ogg",
  ogm: "video/ogg",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  ts: "video/mp2t",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
};

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  mp2: "audio/mpeg",
  wav: "audio/wav",
  wave: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  ogm: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  aac: "audio/aac",
  wma: "audio/x-ms-wma",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  aifc: "audio/aiff",
  caf: "audio/x-caf",
  mid: "audio/midi",
  midi: "audio/midi",
  amr: "audio/amr",
  ape: "audio/ape",
  alac: "audio/alac",
  ac3: "audio/ac3",
  weba: "audio/webm",
  mka: "audio/x-matroska",
};

export function inferVideoMime(name: string, mime?: string): string {
  const head = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (head.startsWith("video/")) return head;
  const ext = videoExtensionFromFilename(name);
  if (ext && VIDEO_MIME_BY_EXT[ext]) return VIDEO_MIME_BY_EXT[ext]!;
  return head || "video/mp4";
}

export function inferAudioMime(name: string, mime?: string): string {
  const head = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (head.startsWith("audio/")) return head;
  if (head === "application/ogg") return "audio/ogg";
  if (head === "application/x-flac" || head === "application/flac") return "audio/flac";
  const ext = audioExtensionFromFilename(name);
  if (ext && AUDIO_MIME_BY_EXT[ext]) return AUDIO_MIME_BY_EXT[ext]!;
  return head || "audio/mpeg";
}

export function isCanvasVideoFile(name: string, mime?: string): boolean {
  const head = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (head.startsWith("video/")) return true;
  if (head === "application/x-matroska") return true;
  if (head === "application/ogg") return VIDEO_EXT_RE.test(basename(name));
  return VIDEO_EXT_RE.test(basename(name));
}

export function isCanvasAudioFile(name: string, mime?: string): boolean {
  const head = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (head.startsWith("audio/")) return true;
  if (head === "application/ogg") return AUDIO_EXT_RE.test(basename(name));
  if (head === "application/x-flac" || head === "application/flac") return true;
  return AUDIO_EXT_RE.test(basename(name));
}

/** Classify a dropped file for canvas nodes (MIME + extension; handles empty OS MIME). */
export function guessCanvasNodeKind(name: string, mime?: string): CanvasNodeKind {
  if (isImageFileByName(name, mime)) return "image";
  if (isCanvasVideoFile(name, mime)) return "video";
  if (isCanvasAudioFile(name, mime)) return "audio";
  return "document";
}

/** Blob URL with a browser-playable MIME (Windows often uses `application/x-flac`, etc.). */
export function objectUrlForMediaFile(file: File, kind: "video" | "audio"): string {
  const inferred =
    kind === "video" ? inferVideoMime(file.name, file.type) : inferAudioMime(file.name, file.type);
  const head = (file.type ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const hasCanonical =
    kind === "video" ? head.startsWith("video/") : head.startsWith("audio/");
  if (!hasCanonical && inferred) {
    return URL.createObjectURL(new Blob([file], { type: inferred }));
  }
  return URL.createObjectURL(file);
}
