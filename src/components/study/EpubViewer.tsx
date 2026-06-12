import ePub, { type Book, type Rendition } from "epubjs";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import {
  enableEpubTextSelection,
  fetchEpubArrayBuffer,
  flattenEpubToc,
  spineFallbackToc,
  type EpubTocRow,
} from "./studyEpub";
import { StudyZoomSurface, useStudyZoomContext } from "./studyZoom";

const EPUB_OPEN_OPTS = { replacements: "blobUrl" as const };

function readestSurfaceClass(dark: boolean) {
  return dark
    ? "bg-[#161412] text-[#f5f2eb] border-[#2a2724]"
    : "bg-[var(--app-bg)] text-[var(--app-text)] border-[var(--app-border)]";
}

function applyEpubTheme(rendition: Rendition, dark: boolean) {
  if (!rendition.themes) return;
  if (dark) {
    rendition.themes.register("zeus", {
      body: { background: "#161412", color: "#f5f2eb" },
      a: { color: "#fdba74" },
    });
    rendition.themes.select("zeus");
  } else {
    rendition.themes.register("zeus", {
      body: { background: "#ffffff", color: "#18181b" },
      a: { color: "#c2410c" },
    });
    rendition.themes.select("zeus");
  }
}

export function EpubViewer({ blobUrl, dark }: { blobUrl: string; dark: boolean }) {
  const { zoomPercent } = useStudyZoomContext();
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toc, setToc] = useState<EpubTocRow[]>([]);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const goTo = useCallback(async (href: string) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    try {
      await rendition.display(href);
      setActiveHref(href);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;
    let book: Book | null = null;
    let rendition: Rendition | null = null;

    const onRendered = () => {
      if (!cancelled) setLoading(false);
    };
    const onRelocated = (loc: { start?: { href?: string } }) => {
      const href = loc?.start?.href;
      if (href) setActiveHref(href);
    };
    const onDisplayError = (error: unknown) => {
      if (!cancelled) {
        setErr(String(error));
        setLoading(false);
      }
    };

    void (async () => {
      try {
        setErr(null);
        setLoading(true);
        setToc([]);
        setActiveHref(null);
        el.innerHTML = "";

        const data = await fetchEpubArrayBuffer(blobUrl);
        if (cancelled || !el) return;

        book = ePub(data, EPUB_OPEN_OPTS);
        bookRef.current = book;
        await book.opened;
        await book.ready;
        if (cancelled || !el) return;

        const meta = await book.loaded.metadata;
        setTitle(meta?.title?.trim() || "EPUB");

        const navigation = await book.loaded.navigation;
        let rows = flattenEpubToc(navigation?.toc);
        if (rows.length === 0) {
          const spine = await book.loaded.spine;
          rows = spineFallbackToc(
            spine.map((item, index) => ({
              href: item.href,
              index,
              label: item.id || `Section ${index + 1}`,
            })),
          );
        }
        setToc(rows);

        rendition = book.renderTo(el, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        applyEpubTheme(rendition, dark);
        enableEpubTextSelection(rendition);

        rendition.on("rendered", onRendered);
        rendition.on("relocated", onRelocated);
        rendition.on("displayError", onDisplayError);

        const startHref = rows[0]?.href;
        await rendition.display(startHref);
        if (startHref) setActiveHref(startHref);
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
      renditionRef.current = null;
      bookRef.current = null;
      try {
        rendition?.off("rendered", onRendered);
        rendition?.off("relocated", onRelocated);
        rendition?.off("displayError", onDisplayError);
        rendition?.destroy?.();
      } catch {
        /* ignore */
      }
      try {
        book?.destroy?.();
      } catch {
        /* ignore */
      }
      if (el) el.innerHTML = "";
    };
  }, [blobUrl, dark]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    applyEpubTheme(rendition, dark);
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = renditionRef.current;
      if (!r || loading) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void r.prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void r.next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading]);

  if (err) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-6 text-center text-sm",
          readestSurfaceClass(dark),
        )}
      >
        <p>Could not open this EPUB: {err}</p>
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
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          "flex w-[min(17rem,34vw)] shrink-0 flex-col border-r",
          readestSurfaceClass(dark),
        )}
      >
        <div className="shrink-0 border-b border-inherit px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Chapters</p>
          <p className="mt-1 truncate text-sm font-medium" title={title}>
            {title}
          </p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading && toc.length === 0 ? (
            <p className="px-2 py-3 text-xs opacity-60">Loading table of contents…</p>
          ) : null}
          <ul className="space-y-0.5">
            {toc.map((row) => {
              const active = activeHref === row.href;
              return (
                <li key={`${row.href}-${row.depth}-${row.label}`}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void goTo(row.href)}
                    className={cn(
                      "w-full rounded-lg px-2 py-1.5 text-left text-xs leading-snug transition",
                      row.depth > 0 ? "pl-4" : "",
                      row.depth > 1 ? "pl-6" : "",
                      active
                        ? dark
                          ? "bg-[#c2410c]/25 text-[#fdba74]"
                          : "bg-[#c2410c]/12 text-[#9a3412]"
                        : dark
                          ? "hover:bg-white/8"
                          : "hover:bg-black/5",
                    )}
                    title={row.label}
                  >
                    {row.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "relative min-h-0 flex-1",
            dark ? "bg-[#161412]" : "bg-[var(--app-surface)]",
          )}
        >
          {loading ? (
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin opacity-60" />
            </div>
          ) : null}
          <StudyZoomSurface className="h-full min-h-[280px] w-full">
            <div ref={hostRef} className="h-full min-h-[280px] w-full" />
          </StudyZoomSurface>
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
            onClick={() => void renditionRef.current?.prev()}
            disabled={loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-xs tabular-nums opacity-70">{zoomPercent}%</span>
          <button
            type="button"
            className={navBtn}
            onClick={() => void renditionRef.current?.next()}
            disabled={loading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
