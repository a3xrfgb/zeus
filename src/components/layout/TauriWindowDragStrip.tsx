import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { cn } from "../../lib/utils";

/**
 * Frameless windows need an explicit drag target. Use at the top of full-screen
 * overlays (e.g. first-launch onboarding) where the normal title bar is covered.
 */
export function TauriWindowDragStrip({ className }: { className?: string }) {
  const [tauri, setTauri] = useState(false);

  useEffect(() => {
    setTauri(isTauri());
  }, []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  }, []);

  if (!tauri) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto cursor-default select-none touch-none",
        className,
      )}
      data-tauri-drag-region
      onMouseDown={onMouseDown}
      aria-hidden
    />
  );
}
