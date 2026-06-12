import { invoke } from "./core";

export function getCurrentWindow() {
  return {
    setTitle(title: string) {
      return invoke<void>("window:setTitle", { title }).catch(() => {});
    },
    minimize() {
      return invoke<void>("window:minimize");
    },
    toggleMaximize() {
      return invoke<void>("window:toggleMaximize");
    },
    close() {
      return invoke<void>("window:close");
    },
    startDragging() {
      return invoke<void>("window:startDragging");
    },
    startResizeDragging(direction: string) {
      return invoke<void>("window:startResizeDragging", { direction });
    },
    endResizeDragging() {
      return invoke<void>("window:endResizeDragging");
    },
    isMaximized() {
      return invoke<boolean>("window:isMaximized");
    },
    setBackgroundColor(color: string) {
      return invoke<void>("window:setBackgroundColor", { color });
    },
    scaleFactor() {
      return invoke<number>("window:scaleFactor");
    },
    async onResized(handler: () => void) {
      if (!window.zeus?.onEvent) {
        const start = Date.now();
        while (!window.zeus?.onEvent) {
          if (Date.now() - start > 8000) return () => {};
          await new Promise((r) => setTimeout(r, 25));
        }
      }
      return window.zeus!.onEvent("window:resized", handler);
    },
  };
}

export type Window = ReturnType<typeof getCurrentWindow>;
