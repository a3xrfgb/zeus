import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeIsoDate, todayIso } from "../lib/financeExpenseBreakdown";

export type FinanceExpenseCategory =
  | "food"
  | "transport"
  | "bills"
  | "rent"
  | "subscriptions"
  | "shopping"
  | "other";

export interface FinanceExpense {
  id: string;
  label: string;
  category: FinanceExpenseCategory;
  amount: number;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Set when this expense was created from a receipt track action. */
  receiptId?: string;
}

interface FinanceState {
  expenses: FinanceExpense[];
  addExpense: (partial: {
    label: string;
    category: FinanceExpenseCategory;
    amount: number;
    date?: string;
    receiptId?: string;
  }) => string;
  removeExpense: (id: string) => void;
  updateExpense: (
    id: string,
    patch: Partial<Pick<FinanceExpense, "label" | "category" | "amount">>,
  ) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      expenses: [],

      addExpense: (partial) => {
        const id = newId();
        set((s) => ({
          expenses: [
            {
              id,
              label: partial.label.trim() || "Expense",
              category: partial.category,
              amount: Math.max(0, partial.amount),
              date: normalizeIsoDate(partial.date),
              ...(partial.receiptId ? { receiptId: partial.receiptId } : {}),
            },
            ...s.expenses,
          ],
        }));
        return id;
      },

      removeExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
      },

      updateExpense: (id, patch) => {
        set((s) => ({
          expenses: s.expenses.map((e) => {
            if (e.id !== id) return e;
            return {
              ...e,
              ...(patch.label !== undefined
                ? { label: patch.label.trim() || e.label }
                : {}),
              ...(patch.category !== undefined ? { category: patch.category } : {}),
              ...(patch.amount !== undefined
                ? { amount: Math.max(0, patch.amount) }
                : {}),
            };
          }),
        }));
      },
    }),
    { name: "zeus-finance" },
  ),
);
