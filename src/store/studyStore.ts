import { create } from "zustand";
import type { LoadedDoc } from "../components/study/studyDocument";

function revokeDocAssets(doc: LoadedDoc | null) {
  if (!doc) return;
  if (doc.kind === "pdf" || doc.kind === "epub" || doc.kind === "mobi" || doc.kind === "kf8") {
    URL.revokeObjectURL(doc.blobUrl);
  }
  if ("assetUrls" in doc && doc.assetUrls?.length) {
    for (const url of doc.assetUrls) URL.revokeObjectURL(url);
  }
}

interface StudySessionState {
  doc: LoadedDoc | null;
  openDoc: (loaded: LoadedDoc) => void;
  clearDoc: () => void;
}

export const useStudyStore = create<StudySessionState>((set, get) => ({
  doc: null,
  openDoc: (loaded) => {
    revokeDocAssets(get().doc);
    set({ doc: loaded });
  },
  clearDoc: () => {
    revokeDocAssets(get().doc);
    set({ doc: null });
  },
}));
