import { create } from "zustand";

import type { DropPartial } from "../lib/canvasFileDrop";

export type Toast = { id: string; message: string; type: "info" | "error" | "success" };

interface CanvasInsertRequest {
  token: number;
  partial: DropPartial;
}

interface UiState {
  sidebarCollapsed: boolean;
  /** Increment to apply `sidebarProjectFilterTargetId` in Sidebar (e.g. from Home). */
  sidebarProjectFilterToken: number;
  sidebarProjectFilterTargetId: string | null;
  rightPanelOpen: boolean;
  settingsOpen: boolean;
  /** When settings opens, navigate here once (e.g. `"runtime"`). */
  settingsEntryNavId: string | null;
  /** Incremented to ask the shell to switch to the Notes view (e.g. after saving a chat reply). */
  openNotesSignal: number;
  /** Incremented to ask the shell to switch to the Canvas view. */
  openCanvasSignal: number;
  /** Incremented to ask the shell to switch to the Chat view. */
  openChatSignal: number;
  /** Pending image/node to insert when Canvas mounts or is already open. */
  canvasInsertRequest: CanvasInsertRequest | null;
  toasts: Toast[];
  toggleSidebar: () => void;
  expandSidebar: () => void;
  requestSidebarProjectFilter: (projectId: string | null) => void;
  setRightPanel: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsEntryNavId: (id: string | null) => void;
  signalOpenNotes: () => void;
  signalOpenChat: () => void;
  requestCanvasImage: (partial: DropPartial) => void;
  clearCanvasInsertRequest: () => void;
  pushToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarProjectFilterToken: 0,
  sidebarProjectFilterTargetId: null,
  rightPanelOpen: false,
  settingsOpen: false,
  settingsEntryNavId: null,
  openNotesSignal: 0,
  openCanvasSignal: 0,
  openChatSignal: 0,
  canvasInsertRequest: null,
  toasts: [],
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  expandSidebar: () => set({ sidebarCollapsed: false }),
  requestSidebarProjectFilter: (projectId) =>
    set((s) => ({
      sidebarProjectFilterTargetId: projectId,
      sidebarProjectFilterToken: s.sidebarProjectFilterToken + 1,
      sidebarCollapsed: false,
    })),
  setRightPanel: (open) => set({ rightPanelOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsEntryNavId: (id) => set({ settingsEntryNavId: id }),
  signalOpenNotes: () =>
    set((s) => ({ openNotesSignal: s.openNotesSignal + 1 })),
  signalOpenChat: () =>
    set((s) => ({ openChatSignal: s.openChatSignal + 1 })),
  requestCanvasImage: (partial) =>
    set((s) => ({
      canvasInsertRequest: {
        token: (s.canvasInsertRequest?.token ?? 0) + 1,
        partial,
      },
      openCanvasSignal: s.openCanvasSignal + 1,
    })),
  clearCanvasInsertRequest: () => set({ canvasInsertRequest: null }),
  pushToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
