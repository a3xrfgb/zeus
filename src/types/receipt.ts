import type { FinanceExpenseCategory } from "../store/financeStore";

export interface ParsedReceiptFields {
  storeName: string;
  itemType: string;
  category: FinanceExpenseCategory;
  totalAmount: number;
  currency: string | null;
  date: string;
  items: string[];
  rawText: string;
}

export interface ReceiptRecord extends ParsedReceiptFields {
  id: string;
  fileName: string;
  /** Path under Zeus data dir (`receipts/`) — stable copy, not the original import location */
  imageRef: string;
  importedAt: string;
  addedToFinance?: boolean;
  /** Linked row in Finance → Recent expenses (when tracked from this receipt). */
  financeExpenseId?: string;
}

export type ReceiptPeriod = "daily" | "weekly" | "monthly";
