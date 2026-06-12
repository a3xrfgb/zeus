/** Normalize GGUF stem so hyphen/dot/legacy `_` variants match. */
export function normalizeModelStem(s: string): string {
  return s.trim().replace(/\./g, "_").replace(/-/g, "_").toLowerCase();
}

const QUANT_SUFFIXES = [
  "Q8_0",
  "Q6_K",
  "Q5_K_M",
  "Q5_K_S",
  "Q5_0",
  "Q4_K_M",
  "Q4_K_S",
  "Q4_0",
  "Q3_K_M",
  "Q3_K_S",
  "Q2_K",
  "IQ4_NL",
  "BF16",
  "F16",
  "F32",
] as const;

/** Strip trailing quant tag so Q8_0 and Q4_K_M variants of the same model match. */
export function stripQuantSuffix(stem: string): string {
  const upper = stem.toUpperCase();
  for (const q of QUANT_SUFFIXES) {
    for (const sep of ["-", "_"] as const) {
      const suffix = `${sep}${q}`;
      if (upper.endsWith(suffix)) {
        return stem.slice(0, -suffix.length);
      }
    }
  }
  return stem;
}

export function modelFamilyStem(stem: string): string {
  return normalizeModelStem(stripQuantSuffix(stem));
}

/** Match catalog `modelId` to `list_local_models` ids (legacy `_`/`.` stems + alt quants). */
export function catalogIdMatchesDiskId(diskId: string, catalogModelId: string): boolean {
  if (diskId === catalogModelId) return true;
  if (normalizeModelStem(diskId) === normalizeModelStem(catalogModelId)) return true;
  return modelFamilyStem(diskId) === modelFamilyStem(catalogModelId);
}

/** @deprecated Use `catalogIdMatchesDiskId`. */
export function isCatalogFileOnDisk(localIds: Set<string>, catalogModelId: string): boolean {
  for (const id of localIds) {
    if (catalogIdMatchesDiskId(id, catalogModelId)) return true;
  }
  return false;
}

/** Vision projector GGUFs are loaded with the main model — hide from chat model pickers. */
export function isMMPROJModelId(id: string): boolean {
  if (id.startsWith("mmproj-")) return true;
  const lower = id.toLowerCase();
  return lower.includes("-mmproj-");
}

/** GPT-OSS family weights are excluded — match Rust `is_legacy_gpt_oss_excluded`. */
export function isLegacyGptOssExcludedModelId(id: string): boolean {
  const norm = normalizeModelStem(id);
  return norm.includes("gpt_oss");
}

export function filterMainChatModels<T extends { id: string }>(models: T[]): T[] {
  return models.filter(
    (m) => !isMMPROJModelId(m.id) && !isLegacyGptOssExcludedModelId(m.id),
  );
}

/** Catalog id for stock Gemma 4 E4B IT (LM Studio GGUFs often break on current llama.cpp). */
export const STOCK_GEMMA_4_E4B_CATALOG_ID = "gemma-4-E4B-it-Q4_K_M";

/** Working Gemma 4B substitute installed alongside the stock bundle. */
export const GEMMA_UNCENSORED_MAIN_ID =
  "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M";

/** True for stock Gemma 4 E4B IT weights (not the heretic uncensored fork). */
export function isStockGemma4E4bIt(id: string): boolean {
  const n = normalizeModelStem(id);
  if (n.includes("uncensored") || n.includes("heretic")) return false;
  return catalogIdMatchesDiskId(id, STOCK_GEMMA_4_E4B_CATALOG_ID);
}
