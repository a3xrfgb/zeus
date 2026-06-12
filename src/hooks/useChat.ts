import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useChatStore } from "../store/chatStore";

export function useChatEvents() {
  useEffect(() => {
    let cancelled = false;
    let unToken: (() => void) | undefined;
    let unStatus: (() => void) | undefined;

    void listen<{ threadId: string; token: string; kind?: string }>(
      "zeus-token",
      (e) => {
        if (cancelled) return;
        const p = e.payload;
        if (p?.threadId && typeof p.token === "string") {
          const kind = p.kind === "reasoning" ? "reasoning" : "content";
          useChatStore.getState().appendToken(p.threadId, p.token, kind);
        }
      },
    ).then((fn) => {
      if (cancelled) fn();
      else unToken = fn;
    });

    void listen<{ threadId: string; phase: "loading" | "generating" }>(
      "zeus-chat-status",
      (e) => {
        if (cancelled) return;
        const p = e.payload;
        if (!p?.threadId || !p.phase) return;
        useChatStore.setState((s) => ({
          streamPhase: { ...s.streamPhase, [p.threadId]: p.phase },
        }));
      },
    ).then((fn) => {
      if (cancelled) fn();
      else unStatus = fn;
    });

    return () => {
      cancelled = true;
      unToken?.();
      unStatus?.();
    };
  }, []);
}
