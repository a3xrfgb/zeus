/**
 * Verifies renderer theme application with a mocked desktop bridge.
 * Requires dev server: npm run dev (renderer on :5173)
 */
import { chromium } from "playwright";

const base = process.env.ZEUS_RENDERER_URL ?? "http://localhost:5173/";

const defaultSettings = {
  theme: "dark",
  language: "en",
  serverEnabled: false,
  defaultModel: "",
  serverPort: 11434,
  maxTokens: 2048,
  temperature: 0.7,
  contextLength: 4096,
  gpuLayers: -1,
  dataDir: "",
  apiKey: "",
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
  financeCreditLimit: 0,
  financeCreditUsage: 0,
  financeSavingsBalance: 0,
  financeDisplayCurrency: "USD",
  financeExchangeCurrency: "ETB",
};

const browser = await chromium.launch();
const page = await browser.newPage();

await page.addInitScript((initial) => {
  localStorage.setItem("zeus.firstLaunchOnboarding.v1", "1");
  let settings = structuredClone(initial);
  window.zeus = {
    isDesktop: true,
    invoke: async (cmd, args = {}) => {
      if (cmd === "get_settings") return structuredClone(settings);
      if (cmd === "save_settings") {
        settings = structuredClone(args.settings);
        return null;
      }
      if (cmd === "list_threads") return [];
      if (cmd === "list_projects") return [];
      if (cmd === "list_local_models") return [];
      if (cmd === "window:setBackgroundColor") return null;
      if (cmd === "window:isMaximized") return false;
      return null;
    },
    onEvent: () => () => {},
  };
}, defaultSettings);

await page.goto(base, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(2500);

async function readThemeState() {
  return page.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    dataTheme: document.documentElement.getAttribute("data-theme"),
    bg: getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim(),
  }));
}

const darkState = await readThemeState();
if (!darkState.dark || darkState.dataTheme !== "dark") {
  throw new Error(`Expected initial dark theme, got ${JSON.stringify(darkState)}`);
}
console.log("Initial dark theme OK");

await page.evaluate(async () => {
  const mod = await import("/src/store/settingsStore.ts");
  await mod.useSettingsStore.getState().save({ theme: "light" });
});

const lightState = await readThemeState();
if (lightState.dark || lightState.dataTheme !== "light") {
  throw new Error(`Expected light theme after save, got ${JSON.stringify(lightState)}`);
}
console.log("Light theme apply OK");

await page.evaluate(async () => {
  const mod = await import("/src/store/settingsStore.ts");
  await mod.useSettingsStore.getState().save({ theme: "gemini" });
});

const geminiState = await readThemeState();
if (geminiState.dark || geminiState.dataTheme !== "gemini") {
  throw new Error(`Expected gemini theme, got ${JSON.stringify(geminiState)}`);
}
console.log("Gemini preset theme OK");

await browser.close();
console.log("Renderer theme verification passed");
