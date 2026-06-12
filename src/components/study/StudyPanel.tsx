import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { BookMarked, BookOpen, ChevronLeft, ChevronRight, FileCode, FileText, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ICONS, RemoteIcon } from "../../lib/icons";
import { cn } from "../../lib/utils";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { NoteMarkdownPreview } from "../notes/NoteMarkdownPreview";
import { useStudyStore } from "../../store/studyStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import type { LoadedDoc, StudyCsvData, StudyDocKind } from "./studyDocument";
import {
  STUDY_DIALOG_EXTENSIONS,
  STUDY_FILE_ACCEPT,
  copyUint8ToArrayBuffer,
  extToKind,
  studyFormatLabel,
} from "./studyDocument";
import {
  parseDelimitedText,
  parseDocxBytes,
  parseHtmlText,
  parseOdtBytes,
  parseRtfBytes,
  parseSpreadsheetBytes,
  parseZippedHtmlBytes,
  type StudySpreadsheetData,
} from "./studyParsers";
import type { Kf8, Mobi, MobiCssPart } from "@lingo-reader/mobi-parser";
import { EpubViewer } from "./EpubViewer";
import { StudyDocumentShell } from "./StudyDocumentShell";
import { StudyPdfViewer } from "./StudyPdfViewer";
import { StudyZoomSurface } from "./studyZoom";
import { loadKindleDoc, openKindleBook, type KindleDocKind } from "./studyMobiParser";

/** Readest-inspired reading surface (warm paper / deep ink; [readest/readest](https://github.com/readest/readest)). */
function readestSurfaceClass(dark: boolean) {
  return dark
    ? "bg-[#161412] text-[#f5f2eb] border-[#2a2724] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "bg-[var(--app-bg)] text-[var(--app-text)] border-[var(--app-border)]";
}

function ReadestChrome({
  title,
  subtitle,
  distractionFree,
  onClose,
  dark,
  documentKey,
  children,
}: {
  title: string;
  subtitle?: string;
  distractionFree: boolean;
  onClose: () => void;
  dark: boolean;
  documentKey: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-[var(--app-bg)] font-[Literata,Georgia,serif]",
        distractionFree ? "study-distraction-free" : "",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5",
          readestSurfaceClass(dark),
          distractionFree ? "border-opacity-60" : "",
        )}
      >
        <div className="min-w-0 text-left">
          <h2 className="truncate font-semibold tracking-tight" style={{ fontFamily: "'Literata', Georgia, serif" }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-xs opacity-75" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-1.5 text-sm transition",
            dark
              ? "border-[#3f3a36] bg-[#1e1c19] hover:bg-[#2a2724]"
              : "border-[#e8e4dc] bg-white/80 hover:bg-white",
          )}
        >
          Close
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <StudyDocumentShell key={documentKey}>{children}</StudyDocumentShell>
      </div>
    </div>
  );
}

type KindleBook = Kf8 | Mobi;

function KindleChapterView({
  html,
  css,
  dark,
}: {
  html: string;
  css: MobiCssPart[];
  dark: boolean;
}) {
  return (
    <div className={cn("study-rich-html-root h-full select-text overflow-auto", readestSurfaceClass(dark))}>
      <StudyZoomSurface>
        <style>{`
          .study-rich-html-root article { font-family: 'Literata', Georgia, serif; font-size: 15px; line-height: 1.7; }
          .study-rich-html-root article p { margin: 0.75em 0; }
          .study-rich-html-root article img { max-width: 100%; height: auto; }
        `}</style>
        <article className="mx-auto max-w-3xl px-6 py-8">
          {css.map((part) => (
            <link key={part.id} rel="stylesheet" href={part.href} />
          ))}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </StudyZoomSurface>
    </div>
  );
}

function KindleViewer({ blobUrl, format, dark }: { blobUrl: string; format: KindleDocKind; dark: boolean }) {
  const bookRef = useRef<KindleBook | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [spineLen, setSpineLen] = useState(0);
  const [chapterHtml, setChapterHtml] = useState("");
  const [chapterCss, setChapterCss] = useState<MobiCssPart[]>([]);

  const showChapter = useCallback((book: KindleBook, index: number) => {
    const spine = book.getSpine();
    const chapter = spine[index];
    if (!chapter) return;
    const loaded = book.loadChapter(chapter.id);
    if (!loaded) return;
    setChapterHtml(loaded.html);
    setChapterCss(loaded.css);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setErr(null);
        setLoading(true);
        setChapterIndex(0);
        bookRef.current?.destroy();
        bookRef.current = null;

        const res = await fetch(blobUrl);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const book = await openKindleBook(bytes, format);
        if (cancelled) {
          book.destroy();
          return;
        }

        bookRef.current = book;
        const spine = book.getSpine();
        setSpineLen(spine.length);
        if (spine.length > 0) showChapter(book, 0);
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setErr(String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      bookRef.current?.destroy();
      bookRef.current = null;
    };
  }, [blobUrl, format, showChapter]);

  useEffect(() => {
    const book = bookRef.current;
    if (!book || loading) return;
    showChapter(book, chapterIndex);
  }, [chapterIndex, loading, showChapter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || spineLen === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setChapterIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setChapterIndex((i) => Math.min(spineLen - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, spineLen]);

  if (err) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-6 text-center text-sm",
          readestSurfaceClass(dark),
        )}
      >
        <p>Could not open this Kindle file: {err}</p>
      </div>
    );
  }

  const navBtn = cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-40",
    dark
      ? "border-[#3f3a36] bg-[#1e1c19] hover:bg-[#2a2724]"
      : "border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-bg)]",
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin opacity-60" />
          </div>
        ) : null}
        <KindleChapterView html={chapterHtml} css={chapterCss} dark={dark} />
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center gap-3 border-t px-4 py-2",
          readestSurfaceClass(dark),
        )}
      >
        <button
          type="button"
          className={navBtn}
          onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
          disabled={loading || chapterIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="text-xs opacity-70">
          {spineLen > 0 ? `${chapterIndex + 1} / ${spineLen}` : "—"}
        </span>
        <button
          type="button"
          className={navBtn}
          onClick={() => setChapterIndex((i) => Math.min(spineLen - 1, i + 1))}
          disabled={loading || chapterIndex >= spineLen - 1}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CsvViewer({ data, dark }: { data: StudyCsvData; dark: boolean }) {
  const rows = data.data;
  const cols = data.meta.fields?.length
    ? data.meta.fields
    : rows[0]
      ? Object.keys(rows[0])
      : [];

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-8 text-sm opacity-80",
          readestSurfaceClass(dark),
        )}
      >
        This CSV has no rows to display.
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col select-text", readestSurfaceClass(dark))}>
      <p
        className="shrink-0 px-4 pb-2 pt-4 text-xs opacity-80"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} · {cols.length} column
        {cols.length === 1 ? "" : "s"}. Scroll vertically and horizontally to explore large sheets.
      </p>
      <div className="study-sheet-scroll min-h-0 flex-1 overflow-auto px-4 pb-4">
        <StudyZoomSurface>
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead className={cn("sticky top-0 z-[1]", dark ? "bg-[#1e1c19]" : "bg-[var(--app-surface)]")}>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap border-b px-3 py-2 font-semibold"
                  style={{ borderColor: dark ? "#3f3a36" : "#e8e4dc" }}
                >
                  {c || "(empty)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  i % 2 === 0
                    ? dark
                      ? "bg-[#161412]"
                      : "bg-[var(--app-bg)]"
                    : dark
                      ? "bg-[#1a1816]"
                      : "bg-[var(--app-surface)]",
                )}
              >
                {cols.map((c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap border-t px-3 py-1.5 font-mono text-[13px]"
                    style={{ borderColor: dark ? "#2a2724" : "#ebe5dc" }}
                    title={row[c] ?? ""}
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </StudyZoomSurface>
      </div>
    </div>
  );
}

function TxtViewer({ text, dark }: { text: string; dark: boolean }) {
  return (
    <div
      className={cn("h-full select-text overflow-auto p-6", readestSurfaceClass(dark))}
    >
      <StudyZoomSurface>
        <pre
          className={cn(
            "select-text whitespace-pre-wrap break-words text-[13px] leading-relaxed",
            "font-[ui-monospace,SFMono-Regular,'Cascadia_Mono','Segoe_UI_Mono',Consolas,monospace]",
          )}
        >
          {text}
        </pre>
      </StudyZoomSurface>
    </div>
  );
}

function MdViewer({ markdown, dark }: { markdown: string; dark: boolean }) {
  return (
    <div className={cn("h-full select-text overflow-auto font-sans", readestSurfaceClass(dark))}>
      <StudyZoomSurface>
        <div className="mx-auto max-w-3xl px-5 py-6">
          <NoteMarkdownPreview markdown={markdown} className="text-[var(--app-text)]" />
        </div>
      </StudyZoomSurface>
    </div>
  );
}

function RichHtmlViewer({
  html,
  dark,
  framed,
}: {
  html: string;
  dark: boolean;
  framed?: boolean;
}) {
  if (framed) {
    return (
      <StudyZoomSurface className="h-full w-full">
        <iframe
          srcDoc={html}
          title="Document"
          sandbox="allow-same-origin"
          className={cn("h-full w-full border-0", dark ? "bg-[#161412]" : "bg-white")}
        />
      </StudyZoomSurface>
    );
  }

  return (
    <div className={cn("study-rich-html-root h-full select-text overflow-auto", readestSurfaceClass(dark))}>
      <StudyZoomSurface>
      <style>{`
        .study-rich-html-root article { font-family: 'Literata', Georgia, serif; font-size: 15px; line-height: 1.7; }
        .study-rich-html-root article p { margin: 0.75em 0; }
        .study-rich-html-root article h1, .study-rich-html-root article h2, .study-rich-html-root article h3,
        .study-rich-html-root article h4, .study-rich-html-root article h5, .study-rich-html-root article h6 {
          font-weight: 600; margin: 1.25em 0 0.5em; line-height: 1.3;
        }
        .study-rich-html-root article ul, .study-rich-html-root article ol { margin: 0.75em 0; padding-left: 1.5em; }
        .study-rich-html-root article table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 13px; }
        .study-rich-html-root article th, .study-rich-html-root article td {
          border: 1px solid ${dark ? "#3f3a36" : "#e8e4dc"};
          padding: 0.35em 0.6em; text-align: left; vertical-align: top;
        }
        .study-rich-html-root article th { font-weight: 600; }
      `}</style>
      <article className="mx-auto max-w-3xl px-6 py-8" dangerouslySetInnerHTML={{ __html: html }} />
      </StudyZoomSurface>
    </div>
  );
}

function SpreadsheetViewer({ data, dark }: { data: StudySpreadsheetData; dark: boolean }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const sheet = data.sheets[activeSheet] ?? data.sheets[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {data.sheets.length > 1 ? (
        <div
          className={cn(
            "flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2",
            readestSurfaceClass(dark),
          )}
        >
          {data.sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              onClick={() => setActiveSheet(i)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                i === activeSheet
                  ? dark
                    ? "bg-[#c2410c] text-white"
                    : "bg-[#c2410c] text-white"
                  : dark
                    ? "text-white/75 hover:bg-white/10"
                    : "text-[#57534e] hover:bg-black/5",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{sheet ? <CsvViewer data={sheet.data} dark={dark} /> : null}</div>
    </div>
  );
}

async function loadFromPath(path: string, name: string, kind: StudyDocKind): Promise<LoadedDoc> {
  if (kind === "pdf") {
    const raw = await readFile(path);
    const blob = new Blob([raw], { type: "application/pdf" });
    return { kind: "pdf", name, blobUrl: URL.createObjectURL(blob) };
  }
  if (kind === "epub") {
    const raw = await readFile(path);
    const blob = new Blob([copyUint8ToArrayBuffer(raw)], { type: "application/epub+zip" });
    return { kind: "epub", name, blobUrl: URL.createObjectURL(blob) };
  }
  if (kind === "mobi" || kind === "kf8") {
    const raw = await readFile(path);
    return loadKindleDoc(raw, name, kind);
  }
  if (kind === "spreadsheet" || kind === "docx" || kind === "odt" || kind === "rtf" || kind === "webzip") {
    const raw = await readFile(path);
    if (kind === "spreadsheet") {
      return { kind: "spreadsheet", name, data: parseSpreadsheetBytes(raw) };
    }
    if (kind === "docx") {
      return { kind: "docx", name, html: await parseDocxBytes(raw) };
    }
    if (kind === "odt") {
      return { kind: "odt", name, html: await parseOdtBytes(raw) };
    }
    if (kind === "rtf") {
      return { kind: "rtf", name, html: parseRtfBytes(raw) };
    }
    const zipped = await parseZippedHtmlBytes(raw);
    return {
      kind: "webzip",
      name,
      html: zipped.html,
      framed: zipped.framed,
      assetUrls: zipped.assetUrls ?? [],
    };
  }
  if (kind === "html") {
    const text = await readTextFile(path);
    const parsed = parseHtmlText(text);
    return { kind: "html", name, html: parsed.html, framed: parsed.framed };
  }
  if (kind === "csv" || kind === "tsv") {
    const t = await readTextFile(path);
    const parsed = parseDelimitedText(t, kind === "tsv" ? "\t" : ",");
    return { kind: "csv", name, data: parsed };
  }
  if (kind === "md") {
    const markdown = await readTextFile(path);
    return { kind: "md", name, markdown };
  }
  const text = await readTextFile(path);
  return { kind: kind === "unknown" ? "unknown" : "txt", name, text };
}

async function loadFromBrowserFile(file: File): Promise<LoadedDoc> {
  const name = file.name;
  const kind = extToKind(name);

  if (kind === "pdf") {
    return { kind: "pdf", name, blobUrl: URL.createObjectURL(file) };
  }
  if (kind === "epub") {
    return { kind: "epub", name, blobUrl: URL.createObjectURL(file) };
  }
  if (kind === "mobi" || kind === "kf8") {
    const raw = new Uint8Array(await file.arrayBuffer());
    return loadKindleDoc(raw, name, kind);
  }
  if (kind === "spreadsheet" || kind === "docx" || kind === "odt" || kind === "rtf" || kind === "webzip") {
    const raw = new Uint8Array(await file.arrayBuffer());
    if (kind === "spreadsheet") {
      return { kind: "spreadsheet", name, data: parseSpreadsheetBytes(raw) };
    }
    if (kind === "docx") {
      return { kind: "docx", name, html: await parseDocxBytes(raw) };
    }
    if (kind === "odt") {
      return { kind: "odt", name, html: await parseOdtBytes(raw) };
    }
    if (kind === "rtf") {
      return { kind: "rtf", name, html: parseRtfBytes(raw) };
    }
    const zipped = await parseZippedHtmlBytes(raw);
    return {
      kind: "webzip",
      name,
      html: zipped.html,
      framed: zipped.framed,
      assetUrls: zipped.assetUrls ?? [],
    };
  }
  if (kind === "html") {
    const parsed = parseHtmlText(await file.text());
    return { kind: "html", name, html: parsed.html, framed: parsed.framed };
  }

  const text = await file.text();
  if (kind === "csv" || kind === "tsv") {
    return { kind: "csv", name, data: parseDelimitedText(text, kind === "tsv" ? "\t" : ",") };
  }
  if (kind === "md") {
    return { kind: "md", name, markdown: text };
  }
  return { kind: kind === "unknown" ? "unknown" : "txt", name, text };
}

export function StudyPanel() {
  const effectiveDark = useEffectiveDark();
  const pushToast = useUiStore((s) => s.pushToast);
  const doc = useStudyStore((s) => s.doc);
  const openDoc = useStudyStore((s) => s.openDoc);
  const clearDoc = useStudyStore((s) => s.clearDoc);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!doc) return;
    useSettingsStore.getState().applyTheme();
  }, [doc]);

  const applyLoaded = useCallback(
    async (path: string, name: string) => {
      const kind = extToKind(name);
      if (kind === "doc") {
        pushToast(
          "Legacy Word (.doc) is not supported. Save as .docx in Word and import again.",
          "info",
        );
        return;
      }
      try {
        if (isTauri()) {
          const loaded = await loadFromPath(path, name, kind);
          openDoc(loaded);
        }
      } catch (e) {
        pushToast(String(e), "error");
      }
    },
    [openDoc, pushToast],
  );

  const pickFile = useCallback(async () => {
    try {
      if (isTauri()) {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: "Documents",
              extensions: [...STUDY_DIALOG_EXTENSIONS],
            },
            { name: "Microsoft Word (.docx)", extensions: ["docx"] },
            { name: "OpenDocument (.odt)", extensions: ["odt"] },
            { name: "Rich Text (.rtf)", extensions: ["rtf"] },
            { name: "Web page (.html, .zip)", extensions: ["html", "htm", "zip"] },
            { name: "Excel & CSV", extensions: ["xlsx", "xls", "xlsm", "csv", "tsv"] },
          ],
        });
        if (selected === null || Array.isArray(selected)) return;
        const base = selected.replace(/\\/g, "/").split("/").pop() ?? "document";
        await applyLoaded(selected, base);
        return;
      }
      fileInputRef.current?.click();
    } catch (e) {
      pushToast(String(e), "error");
    }
  }, [applyLoaded, pushToast]);

  const onInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (extToKind(file.name) === "doc") {
        pushToast(
          "Legacy Word (.doc) is not supported. Save as .docx in Word and import again.",
          "info",
        );
        return;
      }
      try {
        const loaded = await loadFromBrowserFile(file);
        openDoc(loaded);
      } catch (err) {
        pushToast(String(err), "error");
      }
    },
    [openDoc, pushToast],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (extToKind(file.name) === "doc") {
        pushToast(
          "Legacy Word (.doc) is not supported. Save as .docx in Word and import again.",
          "info",
        );
        return;
      }
      try {
        if (isTauri()) {
          pushToast("Use “Import file” to open from disk in the desktop app.", "info");
          return;
        }
        const loaded = await loadFromBrowserFile(file);
        openDoc(loaded);
      } catch (err) {
        pushToast(String(err), "error");
      }
    },
    [openDoc, pushToast],
  );

  const distraction =
    doc && (doc.kind === "pdf" || doc.kind === "epub" || doc.kind === "mobi" || doc.kind === "kf8");

  if (doc) {
    const subtitle =
      doc.kind === "spreadsheet"
        ? `Spreadsheet · ${doc.data.sheets.length} sheet${doc.data.sheets.length === 1 ? "" : "s"}`
        : studyFormatLabel(doc.kind);

    return (
      <ReadestChrome
        title={doc.name}
        subtitle={subtitle}
        distractionFree={!!distraction}
        onClose={clearDoc}
        dark={effectiveDark}
        documentKey={`${doc.kind}-${doc.name}`}
      >
        {doc.kind === "pdf" && (
          <StudyPdfViewer blobUrl={doc.blobUrl} fileName={doc.name} dark={effectiveDark} />
        )}
        {doc.kind === "epub" && <EpubViewer blobUrl={doc.blobUrl} dark={effectiveDark} />}
        {(doc.kind === "mobi" || doc.kind === "kf8") && (
          <KindleViewer blobUrl={doc.blobUrl} format={doc.kind} dark={effectiveDark} />
        )}
        {doc.kind === "csv" && <CsvViewer data={doc.data} dark={effectiveDark} />}
        {doc.kind === "spreadsheet" && <SpreadsheetViewer data={doc.data} dark={effectiveDark} />}
        {(doc.kind === "docx" ||
          doc.kind === "odt" ||
          doc.kind === "rtf" ||
          doc.kind === "html" ||
          doc.kind === "webzip") && (
          <RichHtmlViewer html={doc.html} dark={effectiveDark} framed={doc.framed} />
        )}
        {doc.kind === "md" && <MdViewer markdown={doc.markdown} dark={effectiveDark} />}
        {(doc.kind === "txt" || doc.kind === "unknown") && <TxtViewer text={doc.text} dark={effectiveDark} />}
      </ReadestChrome>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden font-sans"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={STUDY_FILE_ACCEPT}
        onChange={onInputChange}
      />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10",
          effectiveDark ? "bg-[#0f0e0d]" : "bg-[var(--app-bg)]",
        )}
      >
        <div
          className={cn(
            "w-full max-w-lg rounded-2xl p-8 text-center",
            "border border-white/50 bg-white/45 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150",
            "dark:border-white/[0.12] dark:bg-white/[0.06] dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
          )}
        >
          <div
            className={cn(
              "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border",
              effectiveDark
                ? "border-white/10 bg-white/[0.05]"
                : "border-white/60 bg-white/50",
            )}
          >
            <RemoteIcon
              src={ICONS.importDocument}
              alt=""
              size={28}
              className={cn(
                "h-7 w-7",
                effectiveDark ? "opacity-90 invert" : "opacity-85",
              )}
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">Import a document</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--app-muted)]">
            Import Word, PDF, OpenDocument, plain text, RTF, web pages, EPUB, Kindle, or Markdown
          </p>
          <ul className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2 text-left text-xs text-[var(--app-muted)]">
            {[
              { icon: FileText, label: "Word (.docx)" },
              { icon: BookMarked, label: "PDF (.pdf)" },
              { icon: FileText, label: "OpenDocument (.odt)" },
              { icon: FileText, label: "Plain text (.txt)" },
              { icon: FileText, label: "Rich text (.rtf)" },
              { icon: FileCode, label: "Web page (.html, .zip)" },
              { icon: BookOpen, label: "EPUB / EPUB3 (.epub)" },
              { icon: BookOpen, label: "MOBI (.mobi, .azw)" },
              { icon: BookOpen, label: "KF8 (.azw3, .kf8)" },
              { icon: FileCode, label: "Markdown (.md)" },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                  effectiveDark ? "border-white/10 bg-white/[0.04]" : "border-white/40 bg-white/35",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void pickFile()}
            className={cn(
              "mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition",
              effectiveDark
                ? "bg-[#c2410c] text-white hover:bg-[#ea580c]"
                : "bg-[#c2410c] text-white shadow-sm hover:bg-[#9a3412]",
            )}
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Import file
          </button>
          {!isTauri() ? (
            <p className="mt-4 text-xs text-[var(--app-muted)]">Or drop a file onto this area (web)</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
