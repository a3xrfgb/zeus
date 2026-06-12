import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";

export const STUDY_ZOOM_MIN = 0.6;
export const STUDY_ZOOM_MAX = 2.5;
export const STUDY_ZOOM_BUTTON_STEP = 0.15;
export const STUDY_ZOOM_WHEEL_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.min(STUDY_ZOOM_MAX, Math.max(STUDY_ZOOM_MIN, +value.toFixed(2)));
}

export type StudyZoomValue = {
  zoom: number;
  setZoom: (value: number | ((prev: number) => number)) => void;
  zoomIn: (step?: number) => void;
  zoomOut: (step?: number) => void;
  zoomPercent: number;
  zoomStyle: CSSProperties;
};

const StudyZoomContext = createContext<StudyZoomValue | null>(null);

export function useStudyZoomContext(): StudyZoomValue {
  const ctx = useContext(StudyZoomContext);
  if (!ctx) {
    throw new Error("useStudyZoomContext must be used within StudyDocumentShell");
  }
  return ctx;
}

export function useStudyZoomProvider(): StudyZoomValue {
  const [zoom, setZoomState] = useState(1);

  const setZoom = useCallback((value: number | ((prev: number) => number)) => {
    setZoomState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      return clampZoom(next);
    });
  }, []);

  const zoomIn = useCallback(
    (step = STUDY_ZOOM_BUTTON_STEP) => setZoom((z) => z + step),
    [setZoom],
  );

  const zoomOut = useCallback(
    (step = STUDY_ZOOM_BUTTON_STEP) => setZoom((z) => z - step),
    [setZoom],
  );

  return useMemo(
    () => ({
      zoom,
      setZoom,
      zoomIn,
      zoomOut,
      zoomPercent: Math.round(zoom * 100),
      zoomStyle: { zoom } as CSSProperties,
    }),
    [zoom, setZoom, zoomIn, zoomOut],
  );
}

/** Document root: provides zoom state and listens for Ctrl/Cmd + scroll wheel. */
export function StudyZoomProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const value = useStudyZoomProvider();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? STUDY_ZOOM_WHEEL_STEP : -STUDY_ZOOM_WHEEL_STEP;
      value.setZoom((z) => z + delta);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [value.setZoom]);

  return (
    <StudyZoomContext.Provider value={value}>
      <div ref={rootRef} className={className} data-study-document-root>
        {children}
      </div>
    </StudyZoomContext.Provider>
  );
}

/** Applies CSS zoom to scrollable study content (EPUB, text, sheets, etc.). */
export function StudyZoomSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { zoomStyle } = useStudyZoomContext();
  return (
    <div className={cn("study-zoom-surface", className)} style={zoomStyle}>
      {children}
    </div>
  );
}
