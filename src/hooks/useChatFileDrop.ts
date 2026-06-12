import { useEffect, useRef, useState, type RefObject } from "react";
import { filesFromAbsolutePaths } from "../lib/composerDropFiles";
import { subscribeTauriFileDrop } from "../lib/canvasFileDrop";
import { useChatComposerStore } from "../store/chatComposerStore";
import { useUiStore } from "../store/uiStore";

function hasFilePayload(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types).includes("Files");
}

/**
 * Enables drag-and-drop onto the chat panel (thread + composer). Files are queued for ChatInput.
 */
export function useChatFileDrop(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const enqueueComposerDropFiles = useChatComposerStore((s) => s.enqueueComposerDropFiles);

  useEffect(() => {
    if (!enabled) {
      dragDepthRef.current = 0;
      setDragActive(false);
      return;
    }

    const onWindowDragOver = (e: DragEvent) => {
      if (!hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
    };
    const onWindowDrop = (e: DragEvent) => {
      if (!hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
    };

    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("drop", onWindowDrop);
    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [enabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    const onDragEnter = (e: DragEvent) => {
      if (!hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setDragActive(true);
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragActive(false);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setDragActive(false);
      enqueueComposerDropFiles(Array.from(e.dataTransfer.files));
    };

    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    };
  }, [containerRef, enabled, enqueueComposerDropFiles]);

  useEffect(() => {
    if (!enabled) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void subscribeTauriFileDrop((paths, clientX, clientY) => {
      const el = containerRef.current;
      if (!el || paths.length === 0) return;
      const r = el.getBoundingClientRect();
      if (
        clientX < r.left ||
        clientX > r.right ||
        clientY < r.top ||
        clientY > r.bottom
      ) {
        return;
      }
      void (async () => {
        try {
          const files = await filesFromAbsolutePaths(paths);
          enqueueComposerDropFiles(files);
        } catch (e) {
          useUiStore.getState().pushToast(String(e), "error");
        }
      })();
    }).then((fn) => {
      if (!cancelled) unlisten = fn;
      else fn();
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [containerRef, enabled, enqueueComposerDropFiles]);

  return dragActive;
}
