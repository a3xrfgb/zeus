import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  Copy,
  Download,
  Loader2,
  Printer,
  Save,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPdfjs } from "../../lib/pdfjsClient";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { copyStudySelection } from "./studySelection";
import {
  STUDY_ZOOM_MAX,
  STUDY_ZOOM_MIN,
  useStudyZoomContext,
} from "./studyZoom";
const THUMB_MAX_WIDTH = 112;

type PageThumb = {
  pageNum: number;
  dataUrl: string;
};

function readestSurfaceClass(dark: boolean) {
  return dark
    ? "bg-[#161412] text-[#f5f2eb] border-[#2a2724]"
    : "bg-[var(--app-surface)] text-[var(--app-text)] border-[var(--app-border)]";
}

function toolbarBtnClass(dark: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40",
    dark
      ? "border-[#3f3a36] bg-[#1e1c19] hover:bg-[#2a2724]"
      : "border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-bg)]",
  );
}

function iconBtnClass(dark: boolean) {
  return cn(
    "rounded-lg border p-1.5 transition disabled:opacity-40",
    dark
      ? "border-[#3f3a36] hover:bg-[#2a2724]"
      : "border-[var(--app-border)] hover:bg-black/5",
  );
}

export function StudyPdfViewer({
  blobUrl,
  fileName,
  dark,
}: {
  blobUrl: string;
  fileName: string;
  dark: boolean;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesHostRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderGenRef = useRef(0);
  const scrollToPageRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const { zoom, zoomIn, zoomOut, zoomPercent } = useStudyZoomContext();
  const [containerWidth, setContainerWidth] = useState(0);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);

  const scrollToPage = useCallback((pageNum: number) => {
    const host = pagesHostRef.current;
    if (!host) return;
    const el = host.querySelector<HTMLElement>(`[data-pdf-page="${pageNum}"]`);
    if (!el) return;
    scrollToPageRef.current = pageNum;
    setActivePage(pageNum);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const renderPages = useCallback(async () => {
    const pdf = pdfRef.current;
    const host = pagesHostRef.current;
    const width = containerWidth;
    if (!pdf || !host || width < 40) return;

    const gen = ++renderGenRef.current;
    host.innerHTML = "";

    const pdfjs = await loadPdfjs();
    const pageGap = 16;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (renderGenRef.current !== gen) return;

      const page = await pdf.getPage(pageNum);
      if (renderGenRef.current !== gen) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = (width / baseViewport.width) * zoom;
      const viewport = page.getViewport({ scale: fitScale });

      const wrap = document.createElement("div");
      wrap.className = "study-pdf-page mx-auto";
      wrap.dataset.pdfPage = String(pageNum);
      wrap.style.width = `${viewport.width}px`;
      wrap.style.marginBottom = `${pageGap}px`;

      const sheet = document.createElement("div");
      sheet.className = cn(
        "relative overflow-hidden shadow-sm",
        dark ? "bg-[#fafafa]" : "bg-white",
      );
      sheet.style.width = `${viewport.width}px`;
      sheet.style.height = `${viewport.height}px`;

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.className = "block h-auto w-full";

      const textLayer = document.createElement("div");
      textLayer.className = "study-pdf-text-layer textLayer";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;

      sheet.append(canvas, textLayer);
      wrap.append(sheet);
      host.append(wrap);

      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;
      if (renderGenRef.current !== gen) return;

      const layer = new pdfjs.TextLayer({
        textContentSource: await page.getTextContent(),
        container: textLayer,
        viewport,
      });
      await layer.render();
    }
  }, [containerWidth, dark, zoom]);

  const buildThumbnails = useCallback(async (pdf: PDFDocumentProxy) => {
    setThumbsLoading(true);
    setThumbs([]);
    const items: PageThumb[] = [];

    try {
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const scale = THUMB_MAX_WIDTH / base.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
        items.push({ pageNum, dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
      }
      setThumbs(items);
    } finally {
      setThumbsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null;
    setLoading(true);
    setErr(null);
    setNumPages(0);
    setActivePage(1);
    setThumbs([]);

    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const res = await fetch(blobUrl);
        if (!res.ok) throw new Error(`Could not read PDF (${res.status})`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
        void buildThumbnails(pdf);
      } catch (e) {
        if (!cancelled) {
          setErr(String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderGenRef.current += 1;
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [blobUrl, buildThumbnails]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const next = Math.max(0, el.clientWidth - 32);
      setContainerWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (loading || !numPages || containerWidth < 40) return;
    void renderPages();
  }, [loading, numPages, containerWidth, zoom, renderPages]);

  useEffect(() => {
    const root = scrollRef.current;
    const host = pagesHostRef.current;
    if (!root || !host || loading || numPages === 0) return;

    const pages = Array.from(host.querySelectorAll<HTMLElement>("[data-pdf-page]"));
    if (pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollToPageRef.current != null) {
          const target = scrollToPageRef.current;
          const match = entries.find(
            (e) =>
              e.isIntersecting &&
              Number((e.target as HTMLElement).dataset.pdfPage) === target,
          );
          if (match) scrollToPageRef.current = null;
          return;
        }

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target as HTMLElement | undefined;
        if (top?.dataset.pdfPage) {
          const n = Number(top.dataset.pdfPage);
          if (!Number.isNaN(n)) setActivePage(n);
        }
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    );

    for (const page of pages) observer.observe(page);
    return () => observer.disconnect();
  }, [loading, numPages, zoom, containerWidth]);

  const onCopy = useCallback(async () => {
    const ok = await copyStudySelection();
    pushToast(ok ? "Copied to clipboard" : "Select text to copy", ok ? "success" : "info");
  }, [pushToast]);

  const onDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "document.pdf";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    pushToast("Download started", "success");
  }, [blobUrl, fileName, pushToast]);

  const onSave = useCallback(() => {
    onDownload();
  }, [onDownload]);

  const onPrint = useCallback(() => {
    window.print();
  }, []);

  if (err) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-6 text-center text-sm",
          readestSurfaceClass(dark),
        )}
      >
        <p>Could not open this PDF: {err}</p>
      </div>
    );
  }

  const shellBg = "bg-[var(--app-bg)]";
  const toolbarClass = readestSurfaceClass(dark);

  return (
    <div className={cn("study-pdf-viewer flex h-full min-h-0", shellBg)}>
      <aside
        className={cn(
          "study-pdf-page-sidebar flex w-[min(9.5rem,28vw)] shrink-0 flex-col border-r",
          toolbarClass,
        )}
      >
        <div className="shrink-0 border-b border-inherit px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Pages</p>
          <p className="mt-0.5 text-xs opacity-80">
            {numPages > 0 ? `${numPages} total` : "PDF"}
          </p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading || thumbsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin opacity-50" />
            </div>
          ) : null}
          <ul className="space-y-2">
            {thumbs.map((thumb) => {
              const active = activePage === thumb.pageNum;
              return (
                <li key={thumb.pageNum}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => scrollToPage(thumb.pageNum)}
                    className={cn(
                      "w-full rounded-lg border p-1.5 text-left transition",
                      active
                        ? dark
                          ? "border-[#c2410c] bg-[#c2410c]/20"
                          : "border-[#c2410c] bg-[#c2410c]/10"
                        : dark
                          ? "border-[#3f3a36] hover:bg-white/6"
                          : "border-[var(--app-border)] hover:bg-black/5",
                    )}
                    title={`Page ${thumb.pageNum}`}
                  >
                    <img
                      src={thumb.dataUrl}
                      alt=""
                      className="mx-auto block w-full rounded border border-black/10 bg-white object-contain"
                      draggable={false}
                    />
                    <span
                      className={cn(
                        "mt-1 block text-center text-[10px] font-medium tabular-nums",
                        active ? (dark ? "text-[#fdba74]" : "text-[#9a3412]") : "opacity-70",
                      )}
                    >
                      {thumb.pageNum}
                    </span>
                  </button>
                </li>
              );
            })}
            {!thumbsLoading && thumbs.length === 0 && numPages > 0
              ? Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <li key={pageNum}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => scrollToPage(pageNum)}
                      className={cn(
                        "w-full rounded-lg px-2 py-2 text-left text-xs tabular-nums transition",
                        activePage === pageNum
                          ? dark
                            ? "bg-[#c2410c]/25 text-[#fdba74]"
                            : "bg-[#c2410c]/12 text-[#9a3412]"
                          : dark
                            ? "hover:bg-white/8"
                            : "hover:bg-black/5",
                      )}
                    >
                      Page {pageNum}
                    </button>
                  </li>
                ))
              : null}
          </ul>
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "study-pdf-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2",
            toolbarClass,
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={toolbarBtnClass(dark)} onClick={onPrint} disabled={loading} title="Print">
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button type="button" className={toolbarBtnClass(dark)} onClick={onSave} disabled={loading} title="Save">
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              className={toolbarBtnClass(dark)}
              onClick={onDownload}
              disabled={loading}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button type="button" className={toolbarBtnClass(dark)} onClick={() => void onCopy()} disabled={loading} title="Copy selection">
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums opacity-80">
              {numPages > 0 ? `Page ${activePage} / ${numPages}` : "PDF"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={iconBtnClass(dark)}
                onClick={() => zoomOut()}
                disabled={loading || zoom <= STUDY_ZOOM_MIN}
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-xs tabular-nums opacity-80">
                {zoomPercent}%
              </span>
              <button
                type="button"
                className={iconBtnClass(dark)}
                onClick={() => zoomIn()}
                disabled={loading || zoom >= STUDY_ZOOM_MAX}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className={cn("study-pdf-print-root min-h-0 flex-1 overflow-auto px-4 py-4", shellBg)}>
          {loading ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin opacity-60" />
            </div>
          ) : (
            <div ref={pagesHostRef} className="study-pdf-pages mx-auto max-w-full" />
          )}
        </div>
      </div>
    </div>
  );
}
