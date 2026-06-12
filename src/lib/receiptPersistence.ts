import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { resolveReceiptsFolder } from "./receiptFolder";
import { receiptImagePathsEqual } from "./receiptVision";
import type { ReceiptRecord } from "../types/receipt";

const LIBRARY_FILE = "receipts-library.json";
const LEGACY_KEY = "zeus-receipts";

export type ReceiptLibrarySnapshot = {
  version: 1;
  receiptsFolder: string;
  receipts: ReceiptRecord[];
};

export const EMPTY_RECEIPT_LIBRARY = (folder = ""): ReceiptLibrarySnapshot => ({
  version: 1,
  receiptsFolder: folder,
  receipts: [],
});

let cachedSnapshot: ReceiptLibrarySnapshot = EMPTY_RECEIPT_LIBRARY();

export function getReceiptLibrarySnapshot(): ReceiptLibrarySnapshot {
  return cachedSnapshot;
}

export function setReceiptLibrarySnapshot(snapshot: ReceiptLibrarySnapshot): void {
  cachedSnapshot = normalizeSnapshot(snapshot);
}

function normalizePathKey(path: string): string {
  return path.trim().replace(/\\/g, "/").toLowerCase();
}

function normalizeReceipts(receipts: ReceiptRecord[]): ReceiptRecord[] {
  const seen = new Set<string>();
  const out: ReceiptRecord[] = [];
  for (const receipt of receipts) {
    if (!receipt?.id || !receipt.imageRef) continue;
    const key = normalizePathKey(receipt.imageRef);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(receipt);
  }
  return out.sort(
    (a, b) => b.importedAt.localeCompare(a.importedAt) || b.date.localeCompare(a.date),
  );
}

function normalizeSnapshot(data: Partial<ReceiptLibrarySnapshot>): ReceiptLibrarySnapshot {
  return {
    version: 1,
    receiptsFolder: data.receiptsFolder?.trim() ?? "",
    receipts: normalizeReceipts(Array.isArray(data.receipts) ? data.receipts : []),
  };
}

async function libraryFilePath(folder: string): Promise<string> {
  return join(folder, LIBRARY_FILE);
}

function migrateLegacyLocalStorage(): ReceiptRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { state?: { receipts?: ReceiptRecord[] } };
    const receipts = parsed?.state?.receipts;
    if (!Array.isArray(receipts) || receipts.length === 0) return [];
    localStorage.removeItem(LEGACY_KEY);
    return normalizeReceipts(receipts);
  } catch {
    return [];
  }
}

export function reconcileReceiptsWithFolder(
  receipts: ReceiptRecord[],
  folderImages: string[],
): ReceiptRecord[] {
  const byKey = new Map<string, string>();
  for (const path of folderImages) {
    byKey.set(normalizePathKey(path), path);
  }

  return normalizeReceipts(
    receipts
      .map((receipt) => {
        const canonical = byKey.get(normalizePathKey(receipt.imageRef));
        if (!canonical) return null;
        return receipt.imageRef === canonical
          ? receipt
          : { ...receipt, imageRef: canonical };
      })
      .filter((receipt): receipt is ReceiptRecord => receipt != null),
  );
}

export async function loadReceiptLibrary(): Promise<ReceiptLibrarySnapshot> {
  const folder = await resolveReceiptsFolder();
  const legacy = migrateLegacyLocalStorage();

  try {
    const path = await libraryFilePath(folder);
    if (await exists(path)) {
      const text = await readTextFile(path);
      const parsed = JSON.parse(text) as Partial<ReceiptLibrarySnapshot>;
      const snapshot = normalizeSnapshot({
        ...parsed,
        version: 1,
        receiptsFolder: folder,
      });
      setReceiptLibrarySnapshot(snapshot);
      return snapshot;
    }
  } catch {
    /* fall through */
  }

  const snapshot = normalizeSnapshot({
    version: 1,
    receiptsFolder: folder,
    receipts: legacy,
  });
  setReceiptLibrarySnapshot(snapshot);
  if (legacy.length > 0) {
    await saveReceiptLibrary(snapshot);
  }
  return snapshot;
}

export async function saveReceiptLibrary(snapshot: ReceiptLibrarySnapshot): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);
  setReceiptLibrarySnapshot(normalized);
  try {
    const folder = normalized.receiptsFolder || (await resolveReceiptsFolder());
    if (!(await exists(folder))) {
      await mkdir(folder, { recursive: true });
    }
    const path = await libraryFilePath(folder);
    await writeTextFile(path, JSON.stringify({ ...normalized, receiptsFolder: folder }, null, 2));
  } catch {
    try {
      localStorage.setItem(
        LEGACY_KEY,
        JSON.stringify({ state: { receipts: normalized.receipts }, version: 0 }),
      );
    } catch {
      /* ignore */
    }
  }
}

export function receiptMatchesFolderImage(receipt: ReceiptRecord, folderImages: string[]): boolean {
  return folderImages.some((path) => receiptImagePathsEqual(receipt.imageRef, path));
}
