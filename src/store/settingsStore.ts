import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import { normalizeAppTheme } from "../constants/themes";
import type { AppSettings } from "../types/settings";
import { setDocumentDirection } from "../i18n/messages";
import { applyAppFontStyle, normalizeFontStyleId } from "../lib/fontStyles";
import { api } from "../lib/tauri";

/** Bumped on every save so in-flight `load()` calls cannot overwrite newer UI state. */
let settingsRevision = 0;
let loadPromise: Promise<void> | null = null;
let lastWindowBackground: string | null = null;

const defaultSettings: AppSettings = {
  theme: "dark",
  defaultModel: "",
  maxTokens: 4096,
  temperature: 0.7,
  contextLength: 4096,
  gpuLayers: -1,
  dataDir: "",
  language: "en",
  developerMode: false,
  fontSizeScale: 1,
  fontWeightPreset: "normal",
  fontStyle: "inter",
  thinkingStyle: "bubble",
  profilePicturePath: "",
  profileFullName: "",
  profileNickname: "",
  profileOccupation: "",
  profileAboutMe: "",
  personalCustomInstructions: "",
  personalNickname: "",
  personalMoreAboutYou: "",
  personalMemoryEnabled: false,
  personalMemoryBlob: "",
  securityPinHash: "",
  securityPinSalt: "",
  securityAutoLockMinutes: 0,
  runtimeVariant: "cuda12",
  runtimeNotifyUpdates: true,
  systemPrompt: "",
  cpuThreads: -1,
  inferenceBatchSize: 2048,
  inferenceUbatchSize: 512,
  inferenceParallel: -1,
  inferenceFlashAttn: "auto",
  inferenceMmap: true,
  inferenceMlock: false,
  inferenceKvOffload: true,
  inferenceKvUnified: true,
  ropeFreqBase: 0,
  ropeFreqScale: 0,
  inferenceSeed: -1,
  inferenceCacheTypeK: "",
  inferenceCacheTypeV: "",
  showAdvancedInference: false,
  financeCheckingBalance: 0,
  financeSavingsBalance: 0,
  financeCreditLimit: 0,
  financeCreditUsage: 0,
  financeDisplayCurrency: "USD",
  financeExchangeCurrency: "ETB",
};

const LANG_HTML: Record<string, string> = {
  en: "en",
  am: "am",
  ti: "ti",
  om: "om",
  zh: "zh-CN",
  hi: "hi",
  es: "es",
  ar: "ar",
  fr: "fr",
  it: "it",
  bn: "bn",
  pt: "pt",
  ru: "ru",
  ur: "ur",
};

const DARK_THEMES = new Set(["dark", "anthropic"]);

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  save: (partial: Partial<AppSettings>) => Promise<void>;
  applyTheme: () => void;
  applyTypography: () => void;
}

function syncElectronWindowBackground(): void {
  if (typeof window === "undefined" || !isTauri()) return;
  requestAnimationFrame(() => {
    const bg =
      getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim() ||
      (document.documentElement.classList.contains("dark") ? "#0d0d0f" : "#f4f4f5");
    if (bg === lastWindowBackground) return;
    lastWindowBackground = bg;
    void invoke<void>("window:setBackgroundColor", { color: bg }).catch(() => {});
  });
}

export function getEffectiveDark(theme: string): boolean {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  if (DARK_THEMES.has(theme)) return true;
  return false;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  load: async (force = false) => {
    if (get().loaded && !force) return;
    if (loadPromise && !force) return loadPromise;

    loadPromise = (async () => {
      const revisionAtStart = settingsRevision;
      try {
        const raw = await api.getSettings();
        if (revisionAtStart !== settingsRevision) return;
        const settings = { ...defaultSettings, ...raw } as AppSettings;
        if ((settings.fontWeightPreset as string) === "thin") {
          settings.fontWeightPreset = "normal";
          void api.saveSettings(settings).catch(() => {});
        }
        if ((settings.thinkingStyle as string) === "chatgpt") {
          settings.thinkingStyle = "wide";
          void api.saveSettings(settings).catch(() => {});
        }
        settings.fontStyle = normalizeFontStyleId(settings.fontStyle);
        const theme = normalizeAppTheme(settings.theme);
        if (theme !== settings.theme) {
          settings.theme = theme;
          void api.saveSettings(settings).catch(() => {});
        }
        if (revisionAtStart !== settingsRevision) return;
        set({ settings, loaded: true });
        get().applyTheme();
        get().applyTypography();
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  },

  save: async (partial) => {
    settingsRevision += 1;
    const next = { ...get().settings, ...partial };
    if (partial.theme !== undefined) {
      next.theme = normalizeAppTheme(partial.theme);
    }
    set({ settings: next, loaded: true });
    get().applyTheme();
    get().applyTypography();
    await api.saveSettings(next);
  },

  applyTheme: () => {
    const { theme, language } = get().settings;
    const html = document.documentElement;
    html.classList.toggle("dark", getEffectiveDark(theme));
    html.setAttribute("data-theme", theme);
    const lang = language || "en";
    html.lang = LANG_HTML[lang] ?? lang;
    setDocumentDirection(lang);
    syncElectronWindowBackground();
  },

  applyTypography: () => {
    const { fontSizeScale, fontWeightPreset, fontStyle, language } = get().settings;
    const scale = Number.isFinite(fontSizeScale) ? Math.min(1.35, Math.max(0.8, fontSizeScale)) : 1;
    const w = fontWeightPreset === "bold" ? "700" : "400";
    document.documentElement.style.setProperty("--font-size-scale", String(scale));
    document.documentElement.style.setProperty("--font-weight-body", w);
    applyAppFontStyle(language ?? "en", fontStyle ?? "inter");
  },
}));
