import { FINANCE_EXPENSE_CATEGORIES } from "./financeCategoryIcons";
import type { FinanceExpense, FinanceExpenseCategory } from "../store/financeStore";

export type ExpenseCategorySlice = {
  category: FinanceExpenseCategory;
  amount: number;
  percent: number;
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Normalize receipt / manual dates to YYYY-MM-DD for finance charts and lists. */
export function normalizeIsoDate(raw: string | undefined, fallback = todayIso()): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return fallback;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    let [, a, b, yearPart] = slashMatch;
    let year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    let month = a;
    let day = b;
    if (Number(a) > 12 && Number(b) <= 12) {
      month = b;
      day = a;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return fallback;
}

export function expenseMonthKey(date: string): string | null {
  const iso = normalizeIsoDate(date, "");
  if (!iso || iso.length < 7) return null;
  return iso.slice(0, 7);
}

/** Date used when sending a receipt into Finance so it appears in this month's donut chart. */
export function financeDateForReceipt(receiptDate: string): string {
  const normalized = normalizeIsoDate(receiptDate);
  if (expenseMonthKey(normalized) === currentMonthKey()) {
    return normalized;
  }
  return todayIso();
}

/** Group expenses by category for the current calendar month. */
export function aggregateMonthlyExpensesByCategory(expenses: FinanceExpense[]): {
  slices: ExpenseCategorySlice[];
  total: number;
  monthKey: string;
} {
  const monthKey = currentMonthKey();
  const byCategory = new Map<FinanceExpenseCategory, number>();

  for (const e of expenses) {
    if (expenseMonthKey(e.date) !== monthKey) continue;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  const total = [...byCategory.values()].reduce((sum, n) => sum + n, 0);
  const slices = FINANCE_EXPENSE_CATEGORIES.map((category) => {
    const amount = byCategory.get(category) ?? 0;
    return {
      category,
      amount,
      percent: total > 0 ? amount / total : 0,
    };
  }).filter((s) => s.amount > 0);

  return { slices, total, monthKey };
}
