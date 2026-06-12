import { homeDir, join } from "@tauri-apps/api/path";
import { api } from "./tauri";

const RECEIPTS_SUBDIR = "receipts";

/** Resolve Zeus's receipts directory, with fallbacks when the sidecar is stale. */
export async function resolveReceiptsFolder(): Promise<string> {
  try {
    return await api.getReceiptsFolder();
  } catch {
    try {
      const settings = await api.getSettings();
      const dataDir = settings.dataDir?.trim();
      if (dataDir) {
        return join(dataDir, RECEIPTS_SUBDIR);
      }
    } catch {
      /* fall through */
    }
    return join(await homeDir(), ".zeus", RECEIPTS_SUBDIR);
  }
}

export async function listReceiptImagesSafe(): Promise<string[]> {
  try {
    return await api.listReceiptImages();
  } catch {
    return [];
  }
}
