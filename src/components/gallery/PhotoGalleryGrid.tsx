import { Film, Images, LayoutGrid, LayoutList, Loader2, Minus, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { getGalleryMediaUrl } from "../../lib/photoGalleryDisplay";
import { getVideoDurationSec, getVideoThumbnailUrl } from "../../lib/photoGalleryVideoThumbnail";
import { folderLabel, isVideoItem } from "../../lib/photoGalleryLocal";
import { photoTransformCss } from "../../lib/photoGalleryTransform";
import { cn } from "../../lib/utils";
import { getVisiblePhotos, usePhotoGalleryStore } from "../../store/photoGalleryStore";
import type { PhotoItem } from "../../types/photoGallery";
import {
  GALLERY_TILE_SIZE_MAX,
  GALLERY_TILE_SIZE_MIN,
  galleryGridMinPx,
  galleryListThumbPx,
} from "../../types/photoGallery";
import { PhotoGalleryImportMenu } from "./PhotoGalleryImportMenu";

export const GALLERY_PAGE_SIZE = 30;

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function VideoPosterFallback({
  src,
  fileName,
  className,
  onDuration,
}: {
  src: string;
  fileName: string;
  className?: string;
  onDuration?: (sec: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const seekToPoster = () => {
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      if (duration > 0) onDuration?.(duration);
      const target = duration > 0 ? duration / 2 : 0.25;
      try {
        video.currentTime = Math.min(Math.max(0, target), Math.max(0, duration - 0.05));
      } catch {
        /* ignore */
      }
    };

    video.addEventListener("loadedmetadata", seekToPoster);
    video.addEventListener("loadeddata", seekToPoster);
    return () => {
      video.removeEventListener("loadedmetadata", seekToPoster);
      video.removeEventListener("loadeddata", seekToPoster);
    };
  }, [src, onDuration]);

  return (
    <video
      ref={videoRef}
      src={src}
      preload="auto"
      muted
      playsInline
      aria-label={fileName}
      className={cn("block h-full w-full object-cover", className)}
    />
  );
}

function useGalleryTileMedia(photo: PhotoItem, scrollRoot: HTMLElement | null) {
  const isVideo = isVideoItem(photo);
  const [src, setSrc] = useState("");
  const [thumbSrc, setThumbSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [useVideoPoster, setUseVideoPoster] = useState(false);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(photo.durationSec ?? null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = scrollRoot ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    void (async () => {
      const url = await getGalleryMediaUrl(photo.path, photo.kind);
      if (cancelled) return;
      setSrc(url);

      if (!isVideo || !url) return;

      setThumbLoading(true);
      setThumbSrc("");
      setFailed(false);
      setUseVideoPoster(false);
      const thumb = await getVideoThumbnailUrl(photo.path, url);
      if (cancelled) return;
      setThumbLoading(false);
      if (thumb) {
        setThumbSrc(thumb);
        if (durationSec == null) {
          const d = await getVideoDurationSec(photo.path, url);
          if (!cancelled && d != null) setDurationSec(d);
        }
      } else {
        setUseVideoPoster(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photo.path, photo.kind, visible, isVideo]);

  const ready =
    Boolean(src) && (!isVideo || thumbSrc || thumbLoading || useVideoPoster) && !failed;

  return {
    ref: ref as RefObject<HTMLElement>,
    isVideo,
    src,
    thumbSrc,
    failed,
    useVideoPoster,
    thumbLoading,
    durationSec,
    setDurationSec,
    setThumbSrc,
    setUseVideoPoster,
    setFailed,
    ready,
  };
}

function GalleryMediaPreview({
  photo,
  media,
  className,
  overlayClassName,
}: {
  photo: PhotoItem;
  media: ReturnType<typeof useGalleryTileMedia>;
  className?: string;
  overlayClassName?: string;
}) {
  const { isVideo, src, thumbSrc, failed, useVideoPoster, thumbLoading, durationSec, setDurationSec, setThumbSrc, setUseVideoPoster, setFailed, ready } =
    media;

  if (!ready) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-[var(--gallery-elevated)] text-center",
          className,
        )}
      >
        {isVideo ? (
          <Film className="h-5 w-5 text-[var(--gallery-muted)]/60" />
        ) : (
          <Images className="h-5 w-5 text-[var(--gallery-muted)]/60" />
        )}
        <span className="line-clamp-2 px-2 text-[10px] text-[var(--gallery-muted)]">
          {photo.fileName}
        </span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={cn("relative overflow-hidden bg-zinc-900", className)}>
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={photo.fileName}
            className="block h-full w-full object-cover"
            draggable={false}
            onError={() => {
              setThumbSrc("");
              setUseVideoPoster(true);
            }}
          />
        ) : useVideoPoster ? (
          <VideoPosterFallback
            src={src}
            fileName={photo.fileName}
            onDuration={(d) => setDurationSec(d)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/50" />
          </div>
        )}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20",
            overlayClassName,
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/25">
            <Play className="h-4 w-4 fill-current pl-0.5" aria-hidden />
          </span>
        </div>
        {durationSec != null && durationSec > 0 ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {formatDuration(durationSec)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={photo.fileName}
      className={cn("block h-full w-full object-cover", className)}
      style={{ transform: photoTransformCss(photo.transform) }}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function PhotoGridTile({
  photo,
  scrollRoot,
  onView,
}: {
  photo: PhotoItem;
  scrollRoot: HTMLElement | null;
  onView: (photo: PhotoItem, src: string) => void;
}) {
  const media = useGalleryTileMedia(photo, scrollRoot);

  return (
    <article
      ref={media.ref}
      className={cn(
        "group relative overflow-hidden rounded-xl",
        "bg-[var(--gallery-elevated)]/60 shadow-[0_4px_24px_rgba(0,0,0,0.08)] ring-1 ring-[var(--gallery-border)]/70",
        "transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] hover:ring-[var(--gallery-accent)]/35",
      )}
    >
      <button
        type="button"
        onClick={() => media.src && onView(photo, media.src)}
        className="relative block w-full text-left"
      >
        <div className="aspect-[4/3] overflow-hidden transition duration-500 group-hover:scale-[1.03]">
          <GalleryMediaPreview photo={photo} media={media} className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        <p className="pointer-events-none absolute bottom-0 left-0 right-0 truncate px-2.5 py-2 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          {photo.fileName}
        </p>
      </button>
    </article>
  );
}

function PhotoListRow({
  photo,
  scrollRoot,
  thumbPx,
  onView,
}: {
  photo: PhotoItem;
  scrollRoot: HTMLElement | null;
  thumbPx: number;
  onView: (photo: PhotoItem, src: string) => void;
}) {
  const media = useGalleryTileMedia(photo, scrollRoot);
  const isVideo = isVideoItem(photo);

  return (
    <tr
      ref={media.ref as RefObject<HTMLTableRowElement>}
      className="group border-b border-[var(--gallery-border)]/60 transition hover:bg-[var(--gallery-elevated)]/50"
    >
      <td className="w-0 px-3 py-2">
        <button
          type="button"
          onClick={() => media.src && onView(photo, media.src)}
          className="block overflow-hidden rounded-md ring-1 ring-[var(--gallery-border)]/80 transition group-hover:ring-[var(--gallery-accent)]/40"
          style={{ width: thumbPx, height: thumbPx }}
        >
          <GalleryMediaPreview photo={photo} media={media} className="h-full w-full" />
        </button>
      </td>
      <td className="min-w-0 px-2 py-2">
        <button
          type="button"
          onClick={() => media.src && onView(photo, media.src)}
          className="block max-w-full truncate text-left text-sm font-medium text-[var(--gallery-text)] hover:underline"
        >
          {photo.fileName}
        </button>
        <p className="mt-0.5 truncate text-xs text-[var(--gallery-muted)]">
          {folderLabel(photo.folder)}
        </p>
      </td>
      <td className="hidden px-2 py-2 text-xs capitalize text-[var(--gallery-muted)] sm:table-cell">
        {isVideo ? "Video" : "Image"}
      </td>
      <td className="hidden px-2 py-2 text-xs tabular-nums text-[var(--gallery-muted)] md:table-cell">
        {formatFileSize(photo.sizeBytes)}
      </td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--gallery-muted)]">
        {isVideo && media.durationSec != null && media.durationSec > 0
          ? formatDuration(media.durationSec)
          : photo.width && photo.height
            ? `${photo.width}×${photo.height}`
            : "—"}
      </td>
    </tr>
  );
}

function GalleryViewToolbar() {
  const { t } = useTranslation();
  const viewMode = usePhotoGalleryStore((s) => s.viewMode);
  const tileSize = usePhotoGalleryStore((s) => s.tileSize);
  const setViewMode = usePhotoGalleryStore((s) => s.setViewMode);
  const increaseTileSize = usePhotoGalleryStore((s) => s.increaseTileSize);
  const decreaseTileSize = usePhotoGalleryStore((s) => s.decreaseTileSize);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div
        className="inline-flex rounded-md border border-[var(--gallery-border)] bg-[var(--gallery-elevated)]/80 p-0.5"
        role="group"
        aria-label={t("photoGallery.viewMode")}
      >
        <button
          type="button"
          title={t("photoGallery.viewList")}
          aria-pressed={viewMode === "list"}
          onClick={() => setViewMode("list")}
          className={cn(
            "rounded px-2 py-1.5 transition",
            viewMode === "list"
              ? "bg-[var(--gallery-accent)]/15 text-[var(--gallery-text)]"
              : "text-[var(--gallery-muted)] hover:text-[var(--gallery-text)]",
          )}
        >
          <LayoutList className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("photoGallery.viewGrid")}
          aria-pressed={viewMode === "grid"}
          onClick={() => setViewMode("grid")}
          className={cn(
            "rounded px-2 py-1.5 transition",
            viewMode === "grid"
              ? "bg-[var(--gallery-accent)]/15 text-[var(--gallery-text)]"
              : "text-[var(--gallery-muted)] hover:text-[var(--gallery-text)]",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>

      <div
        className="inline-flex items-center rounded-md border border-[var(--gallery-border)] bg-[var(--gallery-elevated)]/80 p-0.5"
        role="group"
        aria-label={t("photoGallery.viewSize")}
      >
        <button
          type="button"
          title={t("photoGallery.viewSizeDecrease")}
          aria-label={t("photoGallery.viewSizeDecrease")}
          disabled={tileSize <= GALLERY_TILE_SIZE_MIN}
          onClick={() => decreaseTileSize()}
          className={cn(
            "rounded px-2 py-1.5 transition",
            tileSize <= GALLERY_TILE_SIZE_MIN
              ? "cursor-not-allowed text-[var(--gallery-muted)]/40"
              : "text-[var(--gallery-muted)] hover:bg-[var(--gallery-accent)]/10 hover:text-[var(--gallery-text)]",
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          className="min-w-[2rem] px-1 text-center text-xs font-medium tabular-nums text-[var(--gallery-muted)]"
          aria-hidden
        >
          {tileSize}/{GALLERY_TILE_SIZE_MAX}
        </span>
        <button
          type="button"
          title={t("photoGallery.viewSizeIncrease")}
          aria-label={t("photoGallery.viewSizeIncrease")}
          disabled={tileSize >= GALLERY_TILE_SIZE_MAX}
          onClick={() => increaseTileSize()}
          className={cn(
            "rounded px-2 py-1.5 transition",
            tileSize >= GALLERY_TILE_SIZE_MAX
              ? "cursor-not-allowed text-[var(--gallery-muted)]/40"
              : "text-[var(--gallery-muted)] hover:bg-[var(--gallery-accent)]/10 hover:text-[var(--gallery-text)]",
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PhotoGalleryGrid({
  onViewPhoto,
}: {
  onViewPhoto: (photo: PhotoItem, src: string) => void;
}) {
  const { t } = useTranslation();
  const photos = usePhotoGalleryStore((s) => s.photos);
  const selectedFolder = usePhotoGalleryStore((s) => s.selectedFolder);
  const folderAliases = usePhotoGalleryStore((s) => s.folderAliases);
  const search = usePhotoGalleryStore((s) => s.search);
  const loading = usePhotoGalleryStore((s) => s.loading);
  const viewMode = usePhotoGalleryStore((s) => s.viewMode);
  const tileSize = usePhotoGalleryStore((s) => s.tileSize);
  const visible = useMemo(
    () => getVisiblePhotos({ photos, selectedFolder, search, folderAliases }),
    [photos, selectedFolder, search, folderAliases],
  );
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const gridMinPx = galleryGridMinPx(tileSize);
  const listThumbPx = galleryListThumbPx(tileSize);

  useEffect(() => {
    void usePhotoGalleryStore.getState().hydrate();
  }, []);

  useEffect(() => {
    setVisibleCount(GALLERY_PAGE_SIZE);
  }, [visible.length, selectedFolder, search, viewMode, tileSize]);

  const displayed = visible.slice(0, visibleCount);
  const hasMore = visibleCount < visible.length;

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setVisibleCount((c) => Math.min(c + GALLERY_PAGE_SIZE, visible.length));
    requestAnimationFrame(() => {
      loadingMoreRef.current = false;
    });
  }, [hasMore, visible.length]);

  useEffect(() => {
    const root = scrollRef.current;
    const el = sentinelRef.current;
    if (!root || !el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const { scrollHeight, clientHeight, scrollTop } = root;
        if (scrollHeight <= clientHeight + 8 && visibleCount >= GALLERY_PAGE_SIZE) return;
        if (scrollTop + clientHeight < scrollHeight - 48) return;
        loadMore();
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleCount]);

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--gallery-border)] bg-[var(--gallery-glass)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--gallery-elevated)]/80 to-[var(--gallery-bg)]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--gallery-border)]/80 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--gallery-text)]">
              {t("photoGallery.title")}
            </h2>
            <p className="text-xs text-[var(--gallery-muted)]">
              {t("photoGallery.subtitle", { count: visible.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {visible.length > 0 ? <GalleryViewToolbar /> : null}
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--gallery-muted)]" /> : null}
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {visible.length === 0 ? (
            <div className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--gallery-border)] bg-[var(--gallery-elevated)]/50 px-6 py-16 text-center">
              <Images className="h-10 w-10 text-[var(--gallery-muted)]/50" />
              <p className="mt-4 max-w-sm text-sm text-[var(--gallery-muted)]">
                {t("photoGallery.empty")}
              </p>
              <div className="mt-6">
                <PhotoGalleryImportMenu prominent />
              </div>
            </div>
          ) : viewMode === "list" ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-[var(--gallery-border)]/80 bg-[var(--gallery-elevated)]/30">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead className="sticky top-0 z-10 border-b border-[var(--gallery-border)] bg-[var(--gallery-elevated)]/95 text-left text-[11px] uppercase tracking-wider text-[var(--gallery-muted)] backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 font-medium" aria-hidden />
                      <th className="px-2 py-2 font-medium">{t("photoGallery.listName")}</th>
                      <th className="hidden px-2 py-2 font-medium sm:table-cell">
                        {t("photoGallery.listType")}
                      </th>
                      <th className="hidden px-2 py-2 font-medium md:table-cell">
                        {t("photoGallery.listSize")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("photoGallery.listDetails")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((photo) => (
                      <PhotoListRow
                        key={photo.id}
                        photo={photo}
                        scrollRoot={scrollRef.current}
                        thumbPx={listThumbPx}
                        onView={onViewPhoto}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore ? (
                <div ref={sentinelRef} className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--gallery-muted)]" />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinPx}px, 1fr))` }}
              >
                {displayed.map((photo) => (
                  <PhotoGridTile
                    key={photo.id}
                    photo={photo}
                    scrollRoot={scrollRef.current}
                    onView={onViewPhoto}
                  />
                ))}
              </div>
              {hasMore ? (
                <div ref={sentinelRef} className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--gallery-muted)]" />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
