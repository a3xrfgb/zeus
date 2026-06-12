import { MODEL_CATALOG, type CatalogEntry } from "../constants/modelCatalog";
import { catalogIdMatchesDiskId, isMMPROJModelId } from "./modelDisk";

/** Default when Gemma 4 E4B is installed. */
export const DEFAULT_CHAT_MODEL_CATALOG_ID = "gemma-4-E4B-it-Q4_K_M";

/** Zeus chat supports exactly these catalog bundles (Models section). */
export const CHAT_APP_CATALOG = MODEL_CATALOG;

export type ChatPickerModel = {
  /** Stable catalog key (`gemma-4-e4b`, `qwen35-9b-uncensored`, …). */
  catalogKey: string;
  /** Disk stem when installed; catalog main id when not. */
  id: string;
  name: string;
  installed: boolean;
};

function catalogMainWeightId(entry: CatalogEntry): string | null {
  const main = entry.files.find((f) => !isMMPROJModelId(f.modelId));
  return main?.modelId ?? null;
}

function catalogEntryForDiskId(diskId: string): CatalogEntry | null {
  for (const entry of MODEL_CATALOG) {
    const mainId = catalogMainWeightId(entry);
    if (mainId && catalogIdMatchesDiskId(diskId, mainId)) return entry;
  }
  return null;
}

/**
 * Map any known id / catalog string to the exact `list_local_models` id (filename stem).
 */
export function resolveToInstalledMainModelId(
  mains: { id: string }[],
  requestId: string | null | undefined,
): string | null {
  if (requestId == null || !String(requestId).trim()) return null;
  const r = String(requestId).trim();
  for (const m of mains) {
    if (m.id === r) return m.id;
  }
  for (const m of mains) {
    for (const entry of MODEL_CATALOG) {
      const mainId = catalogMainWeightId(entry);
      if (mainId && catalogIdMatchesDiskId(m.id, mainId) && catalogIdMatchesDiskId(r, mainId)) {
        return m.id;
      }
    }
    if (catalogIdMatchesDiskId(m.id, r)) return m.id;
  }
  return null;
}

/** Zeus catalog bundles for the chat model picker. */
export function buildExtendedChatPickerModels(
  localMains: { id: string; name: string }[],
): ChatPickerModel[] {
  return buildChatPickerModels(localMains);
}

/** All three app models — installed rows are selectable; missing ones show as not installed. */
export function buildChatPickerModels(localMains: { id: string; name: string }[]): ChatPickerModel[] {
  return MODEL_CATALOG.flatMap((entry) => {
    const mainId = catalogMainWeightId(entry);
    if (!mainId) return [];
    const found = localMains.find((m) => catalogIdMatchesDiskId(m.id, mainId));
    return [
      {
        catalogKey: entry.id,
        id: found?.id ?? mainId,
        name: entry.name,
        installed: Boolean(found),
      },
    ];
  });
}

/** First installed picker id matching candidates, else first installed row. */
export function resolveEffectivePickerModelId(
  pickerModels: ChatPickerModel[],
  mains: { id: string }[],
  ...candidates: (string | null | undefined)[]
): string | null {
  const installed = pickerModels.filter((m) => m.installed);
  if (installed.length === 0) return null;
  const pickerIds = new Set(installed.map((m) => m.id));
  for (const c of candidates) {
    const raw = c != null ? String(c).trim() : "";
    if (raw && pickerIds.has(raw)) return raw;
    const resolved = resolveToInstalledMainModelId(mains, c);
    if (resolved && pickerIds.has(resolved)) return resolved;
  }
  return installed[0]?.id ?? null;
}

/** Prefer Gemma 4 E4B when installed, else first installed catalog model. */
export function getPreferredDefaultChatModelId(
  localMains: { id: string; name?: string }[],
): string | null {
  const picker = buildChatPickerModels(
    localMains.map((m) => ({ id: m.id, name: m.name ?? m.id })),
  );
  return resolveEffectivePickerModelId(picker, localMains, DEFAULT_CHAT_MODEL_CATALOG_ID);
}

/** UI label matching the composer picker (disk id → short name). */
export function getChatModelDisplayLabel(modelId: string | null | undefined): string {
  if (modelId == null || !String(modelId).trim()) return "";
  const id = String(modelId);
  const entry = catalogEntryForDiskId(id);
  if (entry) return entry.name;
  for (const cat of MODEL_CATALOG) {
    const mainId = catalogMainWeightId(cat);
    if (mainId && catalogIdMatchesDiskId(id, mainId)) return cat.name;
  }
  return id;
}

/** Re-export for callers that still import from here. */
export { catalogIdMatchesDiskId as diskIdMatchesCatalogId } from "./modelDisk";
export { normalizeModelStem } from "./modelDisk";
