import { isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import { listReceiptImagesSafe, resolveReceiptsFolder } from "../lib/receiptFolder";
import {
  receiptFileNamesEqual,
  receiptImagePathsEqual,
} from "../lib/receiptVision";
import {
  loadReceiptLibrary,
  reconcileReceiptsWithFolder,
  saveReceiptLibrary,
} from "../lib/receiptPersistence";
import { api } from "../lib/tauri";
import { useFinanceStore } from "./financeStore";
import type { ParsedReceiptFields, ReceiptPeriod, ReceiptRecord } from "../types/receipt";

interface ReceiptState {
  receipts: ReceiptRecord[];
  receiptsFolder: string | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  addReceipt: (partial: Omit<ReceiptRecord, "id" | "importedAt">) => string;
  removeReceipt: (id: string) => Promise<boolean>;
  updateReceipt: (id: string, patch: Partial<ReceiptRecord>) => void;
  linkFinanceExpense: (receiptId: string, expenseId: string) => void;
  unlinkFinanceExpense: (expenseId: string) => void;
  reconcileFinanceLinks: () => void;
}

export function isReceiptTrackedInFinance(
  receipt: ReceiptRecord,
  expenseIds: ReadonlySet<string>,
): boolean {
  if (receipt.financeExpenseId) {
    return expenseIds.has(receipt.financeExpenseId);
  }
  return Boolean(receipt.addedToFinance);
}

function newId(): string {
  return crypto.randomUUID();
}

function receiptInPeriod(r: ReceiptRecord, period: ReceiptPeriod, ref: Date): boolean {
  const start = periodStart(period, ref);
  const end = periodEnd(period, ref);
  const importedDay = r.importedAt.slice(0, 10);
  return (
    (r.date >= start && r.date <= end) ||
    (importedDay >= start && importedDay <= end)
  );
}

export function sumAllReceipts(receipts: ReceiptRecord[]): number {
  return receipts.reduce((sum, r) => sum + r.totalAmount, 0);
}

export function sumReceiptsForPeriod(
  receipts: ReceiptRecord[],
  period: ReceiptPeriod,
  refDate = new Date(),
): number {
  return receipts
    .filter((r) => receiptInPeriod(r, period, refDate))
    .reduce((sum, r) => sum + r.totalAmount, 0);
}

export function receiptsForPeriod(
  receipts: ReceiptRecord[],
  period: ReceiptPeriod,
  refDate = new Date(),
): ReceiptRecord[] {
  return receipts
    .filter((r) => receiptInPeriod(r, period, refDate))
    .sort((a, b) => b.date.localeCompare(a.date) || b.importedAt.localeCompare(a.importedAt));
}

function periodStart(period: ReceiptPeriod, ref: Date): string {
  const d = new Date(ref);
  if (period === "daily") return isoDate(d);
  if (period === "weekly") {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return isoDate(d);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function periodEnd(period: ReceiptPeriod, ref: Date): string {
  const d = new Date(ref);
  if (period === "daily") return isoDate(d);
  if (period === "weekly") {
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return isoDate(d);
  }
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return isoDate(last);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function persistReceipts(receipts: ReceiptRecord[], folder: string | null): Promise<void> {
  const receiptsFolder = folder ?? (isTauri() ? await resolveReceiptsFolder() : "");
  await saveReceiptLibrary({
    version: 1,
    receiptsFolder,
    receipts,
  });
}

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  receipts: [],
  receiptsFolder: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (!isTauri()) {
      set({ hydrated: true });
      return;
    }

    set({ loading: true });
    try {
      const [snapshot, folderImages, folder] = await Promise.all([
        loadReceiptLibrary(),
        listReceiptImagesSafe(),
        resolveReceiptsFolder(),
      ]);
      const receipts =
        folderImages.length > 0
          ? reconcileReceiptsWithFolder(snapshot.receipts, folderImages)
          : snapshot.receipts;
      set({
        receipts,
        receiptsFolder: folder,
        hydrated: true,
      });
      if (receipts.length !== snapshot.receipts.length || folder !== snapshot.receiptsFolder) {
        await persistReceipts(receipts, folder);
      }
      get().reconcileFinanceLinks();
    } catch {
      try {
        const snapshot = await loadReceiptLibrary();
        set({
          receipts: snapshot.receipts,
          receiptsFolder: snapshot.receiptsFolder || null,
          hydrated: true,
        });
        get().reconcileFinanceLinks();
      } catch {
        set({ hydrated: true });
      }
    } finally {
      set({ loading: false });
    }
  },

  addReceipt: (partial) => {
    const id = newId();
    const receipt: ReceiptRecord = {
      ...partial,
      id,
      importedAt: new Date().toISOString(),
    };
    set((s) => ({ receipts: [receipt, ...s.receipts] }));
    void persistReceipts(get().receipts, get().receiptsFolder);
    return id;
  },

  removeReceipt: async (id) => {
    const receipt = get().receipts.find((r) => r.id === id);
    if (!receipt) return false;

    if (receipt.financeExpenseId) {
      useFinanceStore.getState().removeExpense(receipt.financeExpenseId);
    }

    if (isTauri() && receipt.imageRef) {
      const folderImages = await listReceiptImagesSafe();
      const targets = new Set<string>([receipt.imageRef]);
      for (const path of folderImages) {
        if (
          receiptImagePathsEqual(path, receipt.imageRef) ||
          receiptFileNamesEqual(path, receipt.fileName) ||
          receiptFileNamesEqual(path, receipt.imageRef)
        ) {
          targets.add(path);
        }
      }

      let deletedAny = false;
      for (const target of targets) {
        try {
          await api.deleteReceiptImage(target);
          deletedAny = true;
        } catch {
          /* try next resolved path */
        }
      }

      const remaining = await listReceiptImagesSafe();
      const stillOnDisk = remaining.some(
        (path) =>
          receiptImagePathsEqual(path, receipt.imageRef) ||
          receiptFileNamesEqual(path, receipt.fileName) ||
          receiptFileNamesEqual(path, receipt.imageRef),
      );
      if (stillOnDisk && !deletedAny) {
        return false;
      }
    }

    set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) }));
    await persistReceipts(get().receipts, get().receiptsFolder);
    return true;
  },

  updateReceipt: (id, patch) => {
    set((s) => ({
      receipts: s.receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    void persistReceipts(get().receipts, get().receiptsFolder);
  },

  linkFinanceExpense: (receiptId, expenseId) => {
    set((s) => ({
      receipts: s.receipts.map((r) =>
        r.id === receiptId
          ? { ...r, addedToFinance: true, financeExpenseId: expenseId }
          : r,
      ),
    }));
    void persistReceipts(get().receipts, get().receiptsFolder);
  },

  unlinkFinanceExpense: (expenseId) => {
    set((s) => ({
      receipts: s.receipts.map((r) =>
        r.financeExpenseId === expenseId
          ? { ...r, addedToFinance: false, financeExpenseId: undefined }
          : r,
      ),
    }));
    void persistReceipts(get().receipts, get().receiptsFolder);
  },

  reconcileFinanceLinks: () => {
    const expenses = useFinanceStore.getState().expenses;
    const expenseIds = new Set(expenses.map((e) => e.id));
    const expenseIdByReceiptId = new Map(
      expenses
        .filter((e) => e.receiptId)
        .map((e) => [e.receiptId!, e.id] as const),
    );
    set((s) => {
      let changed = false;
      const receipts = s.receipts.map((r) => {
        const linkedId = expenseIdByReceiptId.get(r.id) ?? r.financeExpenseId;
        if (linkedId && expenseIds.has(linkedId)) {
          if (r.financeExpenseId === linkedId && r.addedToFinance) return r;
          changed = true;
          return { ...r, addedToFinance: true, financeExpenseId: linkedId };
        }
        if (!r.financeExpenseId && !r.addedToFinance) return r;
        changed = true;
        return { ...r, addedToFinance: false, financeExpenseId: undefined };
      });
      if (!changed) return s;
      void persistReceipts(receipts, s.receiptsFolder);
      return { receipts };
    });
  },
}));

export type { ParsedReceiptFields, ReceiptRecord, ReceiptPeriod };
