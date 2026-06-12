import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  MessageCircle,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { isVideoItem } from "../../lib/photoGalleryLocal";
import { normalizePhotoTransform, photoTransformCss } from "../../lib/photoGalleryTransform";
import { cn } from "../../lib/utils";
import type { PhotoItem } from "../../types/photoGallery";

const MIN_ZOOM = 0.25;
/** Hard cap — fit scale can push effective zoom much higher for large images. */
const MAX_ZOOM_CAP = 256;
/** Lower = slower scroll zoom. */
const ZOOM_WHEEL_SENSITIVITY = 0.00065;

function effectiveNaturalSize(size: { w: number; h: number }, rotation: number) {
  if (rotation === 90 || rotation === 270) return { w: size.h, h: size.w };
  return size;
}

function wheelDeltaY(e: WheelEvent): number {
  let dy = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 16;
  else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) dy *= window.innerHeight;
  return dy;
}

export function PhotoGalleryViewer({
  open,
  photo,
  src,
  navIndex,
  navTotal,
  hasPrevious,
  hasNext,
  copying,
  deleting,
  onClose,
  onCopy,
  onDelete,
  onSendToChat,
  onPrevious,
  onNext,
  onRotateLeft,
  onRotateRight,
  onFlipHorizontal,
  onFlipVertical,
  sendingToChat,
}: {
  open: boolean;
  photo: PhotoItem | null;
  src: string;
  navIndex: number;
  navTotal: number;
  hasPrevious: boolean;
  hasNext: boolean;
  copying?: boolean;
  deleting?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onSendToChat: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  sendingToChat?: boolean;
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const maxZoomRef = useRef(MAX_ZOOM_CAP);
  const hasUserPannedRef = useRef(false);
  const panSession = useRef<{
    pointerId: number;
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNaturalSize(null);
    hasUserPannedRef.current = false;
    panSession.current = null;
    setIsPanning(false);
  }, [open, photo?.id]);

  const syncNaturalSize = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const img = imageRef.current;
    if (img?.complete) syncNaturalSize(img);
  }, [open, src, syncNaturalSize]);

  useEffect(() => {
    if (!open) return;
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setFrameSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const rotation = normalizePhotoTransform(photo?.transform).rotation;
  const orientedNatural = useMemo(
    () => (naturalSize ? effectiveNaturalSize(naturalSize, rotation) : null),
    [naturalSize, rotation],
  );

  const fitScale = useMemo(() => {
    if (!orientedNatural || frameSize.w < 1 || frameSize.h < 1) return 1;
    return Math.min(frameSize.w / orientedNatural.w, frameSize.h / orientedNatural.h);
  }, [orientedNatural, frameSize]);

  const maxZoom = useMemo(() => {
    if (fitScale <= 0) return MAX_ZOOM_CAP;
    // At least 32× native resolution so scroll-zoom can reach individual pixels.
    return Math.min(MAX_ZOOM_CAP, Math.max(MAX_ZOOM_CAP / 2, (1 / fitScale) * 32));
  }, [fitScale]);

  useEffect(() => {
    maxZoomRef.current = maxZoom;
  }, [maxZoom]);

  const baseW = orientedNatural ? orientedNatural.w * fitScale : 0;
  const baseH = orientedNatural ? orientedNatural.h * fitScale : 0;
  const displayScale = fitScale * zoom;
  const displayW = baseW * zoom;
  const displayH = baseH * zoom;
  const canPan =
    orientedNatural != null &&
    frameSize.w > 0 &&
    (displayW > frameSize.w + 2 || displayH > frameSize.h + 2);
  const atNativePixels = displayScale >= 1;

  useEffect(() => {
    if (!canPan) {
      setPan({ x: 0, y: 0 });
      hasUserPannedRef.current = false;
      panSession.current = null;
      setIsPanning(false);
    }
  }, [canPan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (hasPrevious) onPrevious();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (hasNext) onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrevious, onNext, hasPrevious, hasNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dy = wheelDeltaY(e);
    const factor = Math.exp(-dy * ZOOM_WHEEL_SENSITIVITY);
    setZoom((z) => Math.min(maxZoomRef.current, Math.max(MIN_ZOOM, z * factor)));
    if (!hasUserPannedRef.current) {
      setPan({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = frameRef.current;
    if (!el) return;
    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener("wheel", handleWheel, opts);
    return () => el.removeEventListener("wheel", handleWheel, opts);
  }, [open, handleWheel]);

  const endPan = useCallback((pointerId: number) => {
    const sess = panSession.current;
    if (!sess || sess.pointerId !== pointerId) return;
    panSession.current = null;
    setIsPanning(false);
    try {
      frameRef.current?.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canPan || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      panSession.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      setIsPanning(true);
      try {
        frameRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [canPan, pan.x, pan.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sess = panSession.current;
    if (!sess || e.pointerId !== sess.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - sess.x;
    const dy = e.clientY - sess.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasUserPannedRef.current = true;
    }
    setPan({ x: sess.px + dx, y: sess.py + dy });
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endPan(e.pointerId);
    },
    [endPan],
  );

  if (!open || !photo) return null;

  const actionBtn =
    "flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55 disabled:opacity-50";

  const navBtn =
    "absolute top-1/2 z-[310] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/55 disabled:pointer-events-none disabled:opacity-30";

  if (isVideoItem(photo)) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("photoGallery.videoViewerTitle")}
        className="fixed inset-0 z-[300]"
      >
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-xl"
          onClick={onClose}
          aria-hidden
        />

        <button
          type="button"
          className="absolute right-4 top-4 z-[310] flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-lg backdrop-blur-md transition hover:bg-black/50"
          aria-label={t("photoGallery.viewerClose")}
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        {navTotal > 1 ? (
          <p className="pointer-events-none absolute left-1/2 top-4 z-[310] -translate-x-1/2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs tabular-nums text-white/90 backdrop-blur-md">
            {t("photoGallery.viewerPosition", { current: navIndex + 1, total: navTotal })}
          </p>
        ) : null}

        <button
          type="button"
          className={cn(navBtn, "left-4")}
          aria-label={t("photoGallery.previous")}
          disabled={!hasPrevious}
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          type="button"
          className={cn(navBtn, "right-4")}
          aria-label={t("photoGallery.next")}
          disabled={!hasNext}
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          className="absolute inset-0 z-[305] flex items-center justify-center px-16 py-20"
          onClick={(e) => e.stopPropagation()}
        >
          <video
            key={src}
            src={src}
            controls
            playsInline
            preload="metadata"
            className="max-h-[min(82vh,900px)] max-w-[min(94vw,1400px)] rounded-xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          />
        </div>

        <div className="absolute bottom-6 left-1/2 z-[310] flex -translate-x-1/2 items-center gap-3">
          <button
            type="button"
            className={cn(actionBtn, "h-11 w-11 hover:border-red-400/50 hover:bg-red-600/60")}
            aria-label={t("photoGallery.delete")}
            disabled={deleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        <p className="pointer-events-none absolute bottom-20 left-1/2 z-[310] max-w-[min(90vw,520px)] -translate-x-1/2 truncate text-center text-xs text-white/75">
          {photo.fileName}
        </p>
      </div>
    );
  }

  const imageTransform = photoTransformCss(photo.transform, 1);
  const nativeZoomPct = Math.round(displayScale * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("photoGallery.viewerTitle")}
      className="fixed inset-0 z-[300]"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden
      />

      <button
        type="button"
        className="absolute right-4 top-4 z-[310] flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-lg backdrop-blur-md transition hover:bg-black/50"
        aria-label={t("photoGallery.viewerClose")}
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="absolute left-4 top-4 z-[310] flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-center text-xs tabular-nums text-white backdrop-blur-md"
          title={
            orientedNatural
              ? `${t("photoGallery.viewerZoomHint")} · ${nativeZoomPct}% of full resolution (${orientedNatural.w}×${orientedNatural.h})`
              : t("photoGallery.viewerZoomHint")
          }
        >
          {nativeZoomPct}%
        </span>
        <span className="mx-1 h-6 w-px bg-white/20" aria-hidden />
        <button
          type="button"
          className={actionBtn}
          aria-label={t("photoGallery.rotateLeft")}
          onClick={(e) => {
            e.stopPropagation();
            onRotateLeft();
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={actionBtn}
          aria-label={t("photoGallery.rotateRight")}
          onClick={(e) => {
            e.stopPropagation();
            onRotateRight();
          }}
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={actionBtn}
          aria-label={t("photoGallery.flipHorizontal")}
          onClick={(e) => {
            e.stopPropagation();
            onFlipHorizontal();
          }}
        >
          <FlipHorizontal2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={actionBtn}
          aria-label={t("photoGallery.flipVertical")}
          onClick={(e) => {
            e.stopPropagation();
            onFlipVertical();
          }}
        >
          <FlipVertical2 className="h-4 w-4" />
        </button>
      </div>

      {navTotal > 1 ? (
        <p className="pointer-events-none absolute left-1/2 top-4 z-[310] -translate-x-1/2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs tabular-nums text-white/90 backdrop-blur-md">
          {t("photoGallery.viewerPosition", { current: navIndex + 1, total: navTotal })}
        </p>
      ) : null}

      <button
        type="button"
        className={cn(navBtn, "left-4")}
        aria-label={t("photoGallery.previous")}
        disabled={!hasPrevious}
        onClick={(e) => {
          e.stopPropagation();
          onPrevious();
        }}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        type="button"
        className={cn(navBtn, "right-4")}
        aria-label={t("photoGallery.next")}
        disabled={!hasNext}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div
        ref={frameRef}
        className={cn(
          "absolute inset-0 z-[305] flex select-none items-center justify-center overflow-hidden px-16 py-20",
          canPan && (isPanning ? "cursor-grabbing" : "cursor-grab"),
        )}
        style={{ touchAction: canPan ? "none" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={(e) => endPan(e.pointerId)}
      >
        <div
          className="inline-flex shrink-0 items-center justify-center"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="inline-flex items-center justify-center"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <img
              ref={imageRef}
              src={src}
              alt={photo.fileName}
              draggable={false}
              onLoad={(e) => syncNaturalSize(e.currentTarget)}
              className="block max-w-none rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              style={{
                width: baseW > 0 ? baseW : undefined,
                height: baseH > 0 ? baseH : undefined,
                maxHeight: baseW > 0 ? undefined : "min(82vh, 1200px)",
                maxWidth: baseW > 0 ? undefined : "min(94vw, 1400px)",
                objectFit: "contain",
                transform: imageTransform,
                transformOrigin: "center center",
                imageRendering: atNativePixels ? "pixelated" : "auto",
              }}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-[310] flex -translate-x-1/2 items-center gap-3">
        <button
          type="button"
          className={cn(actionBtn, "h-11 w-11")}
          aria-label={t("photoGallery.copy")}
          disabled={copying || deleting}
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
        >
          {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        </button>

        <button
          type="button"
          className={cn(
            "flex h-12 items-center gap-2 rounded-full border border-white/30 bg-[var(--gallery-accent)] px-5 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:scale-[1.02] hover:bg-[var(--gallery-accent-hover)] disabled:opacity-50",
          )}
          disabled={sendingToChat || deleting}
          onClick={(e) => {
            e.stopPropagation();
            void onSendToChat();
          }}
        >
          {sendingToChat ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          {t("photoGallery.sendToChat")}
        </button>

        <button
          type="button"
          className={cn(actionBtn, "h-11 w-11 hover:border-red-400/50 hover:bg-red-600/60")}
          aria-label={t("photoGallery.delete")}
          disabled={copying || deleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-20 left-1/2 z-[310] max-w-[min(90vw,520px)] -translate-x-1/2 truncate text-center text-xs text-white/75">
        {photo.fileName}
      </p>
    </div>
  );
}
