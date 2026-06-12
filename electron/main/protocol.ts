import { app, net, protocol } from "electron";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".jxl": "image/jxl",
  ".jp2": "image/jp2",
  ".j2k": "image/jp2",
  ".psd": "image/vnd.adobe.photoshop",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/opus",
  ".wma": "audio/x-ms-wma",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mk3d": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".wm": "video/x-ms-wmv",
  ".asf": "video/x-ms-asf",
  ".asx": "video/x-ms-asf",
  ".wmx": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".f4v": "video/mp4",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".mpe": "video/mpeg",
  ".mpv": "video/mpeg",
  ".mp2": "video/mpeg",
  ".m2v": "video/mpeg",
  ".vob": "video/mpeg",
  ".ogv": "video/ogg",
  ".3gp": "video/3gpp",
  ".3g2": "video/3gpp2",
  ".3gpp": "video/3gpp",
  ".3gpp2": "video/3gpp2",
  ".ts": "video/mp2t",
  ".m2ts": "video/mp2t",
  ".mts": "video/mp2t",
  ".mxf": "application/mxf",
  ".rm": "application/vnd.rn-realmedia",
  ".rmvb": "application/vnd.rn-realmedia-vbr",
  ".divx": "video/divx",
  ".mjpg": "video/x-motion-jpeg",
  ".mjpeg": "video/x-motion-jpeg",
  ".mj2": "video/mj2",
  ".insv": "video/mp4",
  ".r3d": "video/mp4",
  ".braw": "video/mp4",
};

const AUDIO_FILE_EXTS = new Set([
  ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wma", ".aiff", ".aif",
  ".weba", ".mka", ".ac3", ".eac3", ".dts", ".ape", ".alac", ".amr", ".awb", ".mid", ".midi",
]);

const VIDEO_FILE_EXTS = new Set([
  ".mp4", ".m4v", ".mov", ".qt", ".webm", ".mkv", ".mk3d", ".avi", ".wmv", ".wm",
  ".asf", ".asx", ".wmx", ".flv", ".f4v", ".mpg", ".mpeg", ".mpe", ".mpv", ".mp2",
  ".m2v", ".vob", ".ogv", ".ogm", ".3gp", ".3g2", ".3gpp", ".3gpp2", ".ts", ".m2ts",
  ".mts", ".mxf", ".rm", ".rmvb", ".divx", ".mjpg", ".mjpeg", ".mj2", ".insv", ".r3d",
  ".braw",
]);

function mimeForPath(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function isVideoPath(filePath: string): boolean {
  return VIDEO_FILE_EXTS.has(extname(filePath).toLowerCase());
}

function isAudioPath(filePath: string): boolean {
  return AUDIO_FILE_EXTS.has(extname(filePath).toLowerCase());
}

function isStreamableMediaPath(filePath: string): boolean {
  return isVideoPath(filePath) || isAudioPath(filePath);
}

function videoResponseHeaders(filePath: string, size: number): Record<string, string> {
  return {
    "Content-Type": mimeForPath(filePath),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": String(size),
  };
}

function parseByteRange(
  rangeHeader: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
  let end = match[2] === "" ? size - 1 : Number.parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

async function serveVideoFile(filePath: string, request: Request): Promise<Response> {
  const size = statSync(filePath).size;
  const baseHeaders = videoResponseHeaders(filePath, size);
  const rangeHeader = request.headers.get("range");

  if (!rangeHeader) {
    try {
      const response = await net.fetch(pathToFileURL(filePath).href);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(baseHeaders)) {
        headers.set(key, value);
      }
      return new Response(response.body, { status: response.status, headers });
    } catch {
      const stream = createReadStream(filePath);
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: baseHeaders,
      });
    }
  }

  const range = parseByteRange(rangeHeader, size);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const { start, end } = range;
  const chunkSize = end - start + 1;
  const stream = createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}

export function registerLocalFileProtocol(): void {
  protocol.handle("zeus-local", async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.searchParams.get("path") ?? "");
    if (!filePath) {
      return new Response("Missing path", { status: 400 });
    }
    if (!existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }
    try {
      // Stream media with byte-range support (required for seeking + some codecs in Chromium).
      if (isStreamableMediaPath(filePath)) {
        return serveVideoFile(filePath, request);
      }
      const data = await readFile(filePath);
      return new Response(data, {
        headers: {
          "Content-Type": mimeForPath(filePath),
          "Content-Length": String(data.length),
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      return net.fetch(pathToFileURL(filePath).href);
    }
  });
}

export function resolveBaseDir(name: string): string {
  switch (name) {
    case "home":
      return app.getPath("home");
    case "appData":
      return app.getPath("userData");
    case "download":
      return app.getPath("downloads");
    case "document":
      return app.getPath("documents");
    default:
      return app.getPath("home");
  }
}
