import { isTauri } from "@tauri-apps/api/core";

import { create } from "zustand";

import type { DownloadProgress, ModelInfo } from "../types/model";

import {
  buildExtendedChatPickerModels,
  getPreferredDefaultChatModelId,
  resolveEffectivePickerModelId,
} from "../lib/chatModelPicker";

import { filterMainChatModels } from "../lib/modelDisk";
import { getLlamaRuntimeBlockReason } from "../lib/llamaRuntime";

import { api } from "../lib/tauri";

import { useChatStore } from "./chatStore";

import { useSettingsStore } from "./settingsStore";

import { useUiStore } from "./uiStore";



export type ModelLoadState = "idle" | "loading" | "loaded" | "error";



interface ModelStore {

  localModels: ModelInfo[];

  /** User's selection in the sidebar picker (may not be loaded into GPU yet). */

  activeModelId: string | null;

  /** Model currently resident in llama-server after a successful Load. */

  loadedModelId: string | null;

  modelLoadState: ModelLoadState;

  downloadingModels: Record<string, DownloadProgress>;



  loadLocalModels: () => Promise<void>;

  downloadModel: (id: string, url: string) => Promise<void>;

  /**

   * Downloads into `models/<bundleSubdir>/`. When `bundleSubdir` is omitted, uses the first file's id

   * (same layout as General Qwen / Gemma).

   */

  downloadModelFiles: (

    files: { id: string; url: string }[],

    bundleSubdir?: string,

  ) => Promise<void>;

  deleteModel: (id: string) => Promise<void>;

  /** Set active id only (e.g. after download). */

  setActiveModel: (id: string) => void;

  /** Sidebar picker: choose model without loading into llama-server. */

  setSelectedModel: (id: string) => void;

  /** Sidebar Load button: preload GGUF into CUDA llama-server. */

  loadSelectedModel: () => Promise<void>;

  clearLoadedModel: () => void;

  /** @deprecated Use setSelectedModel + loadSelectedModel */

  selectChatModel: (id: string) => Promise<void>;

  setDownloadProgress: (modelId: string, p: DownloadProgress) => void;

  /** Remove progress rows (e.g. after complete or when refreshing UI). */

  clearDownloadProgress: (modelIds?: string[]) => void;

}



function resolveCanonicalModelId(get: () => ModelStore, id: string): string | null {

  const mains = filterMainChatModels(get().localModels);

  const picker = buildExtendedChatPickerModels(
    mains.map((m) => ({ id: m.id, name: m.name })),
  );

  return resolveEffectivePickerModelId(picker, mains, id);

}



export const useModelStore = create<ModelStore>((set, get) => ({

  localModels: [],

  activeModelId: null,

  loadedModelId: null,

  modelLoadState: "idle",

  downloadingModels: {},



  loadLocalModels: async () => {

    const localModels = await api.listLocalModels();

    set({ localModels });

    const { activeModelId: prevActive } = get();

    const mains = filterMainChatModels(localModels);
    const picker = buildExtendedChatPickerModels(
      mains.map((m) => ({ id: m.id, name: m.name })),
    );

    const settingsDefault = useSettingsStore.getState().settings.defaultModel;

    const next =
      resolveEffectivePickerModelId(picker, mains, prevActive, settingsDefault) ??
      getPreferredDefaultChatModelId(mains);

    if (next !== prevActive) {
      const { loadedModelId } = get();
      set({
        activeModelId: next,
        ...(loadedModelId !== next
          ? { loadedModelId: null, modelLoadState: "idle" as const }
          : {}),
      });
    }

  },



  downloadModel: async (id, url) => {

    await api.downloadModel(id, url);

    await get().loadLocalModels();

    get().clearDownloadProgress([id]);

    get().setSelectedModel(id);

  },



  downloadModelFiles: async (files, bundleSubdir) => {

    if (files.length === 0) return;

    const subdir = bundleSubdir ?? files[0].id;

    await api.downloadModelBundle(subdir, files);

    await get().loadLocalModels();

    get().clearDownloadProgress(files.map((f) => f.id));

    get().setSelectedModel(files[0].id);

  },



  deleteModel: async (id) => {

    await api.deleteModel(id);

    const { activeModelId, loadedModelId } = get();

    if (activeModelId === id || loadedModelId === id) {

      set({ loadedModelId: null, modelLoadState: "idle" });

    }

    await get().loadLocalModels();

  },



  setActiveModel: (id) => {

    const { loadedModelId } = get();

    set({
      activeModelId: id,
      ...(loadedModelId !== id ? { modelLoadState: "idle" as const } : {}),
    });
  },



  setSelectedModel: (id) => {

    const canonical = resolveCanonicalModelId(get, id);

    if (!canonical) {

      useUiStore.getState().pushToast("Selected model is not installed.", "error");

      return;

    }

    const { loadedModelId } = get();

    const switchingAway =

      loadedModelId != null &&

      loadedModelId !== canonical &&

      get().modelLoadState === "loaded";

    set({

      activeModelId: canonical,

      ...(switchingAway

        ? { loadedModelId: null, modelLoadState: "idle" as const }

        : loadedModelId !== canonical

          ? { modelLoadState: "idle" as const }

          : {}),

    });

    if (switchingAway && isTauri()) {

      void api.restartInferenceEngine().catch((e) =>

        useUiStore.getState().pushToast(String(e), "error"),

      );

    }

  },



  loadSelectedModel: async () => {

    const id = get().activeModelId;

    if (!id) {

      useUiStore.getState().pushToast("Select a model first.", "error");

      return;

    }

    const canonical = resolveCanonicalModelId(get, id);

    if (!canonical) {
      useUiStore.getState().pushToast("Selected model is not installed.", "error");
      return;
    }

    if (useChatStore.getState().isStreaming) {
      await useChatStore.getState().stopStreaming();
    }

    const { loadedModelId: previousLoaded, modelLoadState: prevLoadState } = get();

    const switching =

      previousLoaded != null &&

      previousLoaded !== canonical &&

      prevLoadState === "loaded";

    set({

      modelLoadState: "loading",

      activeModelId: canonical,

      loadedModelId: null,

    });

    try {
      if (isTauri()) {
        const blockReason = await getLlamaRuntimeBlockReason();
        if (blockReason) {
          set({ modelLoadState: "error", loadedModelId: null });
          useUiStore.getState().pushToast(blockReason, "error");
          return;
        }
      }

      await useSettingsStore.getState().save({ defaultModel: canonical });

      if (isTauri()) {
        await api.preloadChatModel(canonical);
      }

      set({

        loadedModelId: canonical,

        modelLoadState: "loaded",

      });

      const toastMsg = switching

        ? "Switched model — ready to chat."

        : "Model loaded — ready to chat.";

      useUiStore.getState().pushToast(toastMsg, "success");

    } catch (e) {

      set({ modelLoadState: "error", loadedModelId: null });

      useUiStore.getState().pushToast(String(e), "error");

    }

  },



  clearLoadedModel: () =>

    set({ loadedModelId: null, modelLoadState: "idle" }),



  selectChatModel: async (id) => {

    get().setSelectedModel(id);

    await get().loadSelectedModel();

  },



  setDownloadProgress: (modelId, p) =>

    set((s) => ({

      downloadingModels: { ...s.downloadingModels, [modelId]: p },

    })),



  clearDownloadProgress: (modelIds) =>

    set((s) => {

      if (!modelIds?.length) {

        return { downloadingModels: {} };

      }

      const next = { ...s.downloadingModels };

      for (const id of modelIds) {

        delete next[id];

      }

      return { downloadingModels: next };

    }),

}));
