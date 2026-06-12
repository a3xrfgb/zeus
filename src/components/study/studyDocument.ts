import type { ParseResult } from "papaparse";
import type { StudySpreadsheetData } from "./studyParsers";

export type StudyDocKind =
  | "pdf"
  | "epub"
  | "mobi"
  | "kf8"
  | "csv"
  | "tsv"
  | "txt"
  | "md"
  | "docx"
  | "odt"
  | "rtf"
  | "html"
  | "webzip"
  | "spreadsheet"
  | "doc"
  | "unknown";

const SPREADSHEET_EXTS = new Set(["xlsx", "xls", "xlsm", "xlsb", "ods", "numbers"]);

export function extToKind(name: string): StudyDocKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "epub" || ext === "epub3") return "epub";
  if (ext === "azw3" || ext === "kf8") return "kf8";
  if (ext === "mobi" || ext === "azw") return "mobi";
  if (ext === "csv") return "csv";
  if (ext === "tsv") return "tsv";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (ext === "odt") return "odt";
  if (ext === "rtf") return "rtf";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "zip") return "webzip";
  if (SPREADSHEET_EXTS.has(ext)) return "spreadsheet";
  if (ext === "txt" || ext === "text") return "txt";
  return "unknown";
}

export type StudyCsvData = ParseResult<Record<string, string>>;

type HtmlDocBase = {
  name: string;
  html: string;
  framed?: boolean;
  assetUrls?: string[];
};

/** In-memory study document payload (kept in study store across tab switches). */
export type LoadedDoc =
  | { kind: "pdf"; name: string; blobUrl: string }
  | { kind: "epub"; name: string; blobUrl: string }
  | { kind: "mobi" | "kf8"; name: string; blobUrl: string }
  | { kind: "csv"; name: string; data: StudyCsvData }
  | { kind: "txt" | "unknown"; name: string; text: string }
  | { kind: "md"; name: string; markdown: string }
  | ({ kind: "docx" } & HtmlDocBase)
  | ({ kind: "odt" } & HtmlDocBase)
  | ({ kind: "rtf" } & HtmlDocBase)
  | ({ kind: "html" } & HtmlDocBase)
  | ({ kind: "webzip" } & HtmlDocBase & { assetUrls: string[] })
  | { kind: "spreadsheet"; name: string; data: StudySpreadsheetData };

export function uint8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

/** Copy bytes into a standalone ArrayBuffer (safe for Blob / epubjs). */
export function copyUint8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

/** Matches common Readest / word-processor export formats. */
export const STUDY_DIALOG_EXTENSIONS = [
  "docx",
  "pdf",
  "odt",
  "txt",
  "rtf",
  "html",
  "htm",
  "zip",
  "epub",
  "epub3",
  "mobi",
  "azw",
  "azw3",
  "kf8",
  "md",
  "markdown",
  "csv",
  "tsv",
  "xlsx",
  "xls",
  "xlsm",
] as const;

export const STUDY_FILE_ACCEPT =
  ".docx,.pdf,.odt,.txt,.rtf,.html,.htm,.zip,.epub,.epub3,.mobi,.azw,.azw3,.kf8,.md,.markdown,.csv,.tsv,.xlsx,.xls,text/plain,text/html,text/rtf,application/pdf,application/epub+zip,application/x-mobipocket-ebook,application/vnd.amazon.ebook,application/vnd.amazon.mobi8-ebook,application/vnd.oasis.opendocument.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf";

export function studyFormatLabel(kind: LoadedDoc["kind"]): string {
  switch (kind) {
    case "docx":
      return "Microsoft Word · DOCX";
    case "pdf":
      return "Distraction-free reading · PDF";
    case "odt":
      return "OpenDocument · ODT";
    case "txt":
      return "Plain text · TXT";
    case "rtf":
      return "Rich Text · RTF";
    case "html":
      return "Web page · HTML";
    case "webzip":
      return "Web page · zipped HTML";
    case "epub":
      return "Distraction-free reading · EPUB / EPUB3";
    case "mobi":
      return "Distraction-free reading · MOBI";
    case "kf8":
      return "Distraction-free reading · KF8 (Kindle)";
    case "md":
      return "Markdown";
    case "csv":
      return "Table view · CSV";
    case "spreadsheet":
      return "Spreadsheet";
    case "unknown":
      return "Plain text (unknown type)";
    default:
      return "Document";
  }
}
