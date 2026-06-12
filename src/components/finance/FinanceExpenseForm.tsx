import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { useFinanceStore, type FinanceExpenseCategory } from "../../store/financeStore";
import { FinanceCategoryPicker } from "./FinanceCategoryPicker";
import { FinanceExpenseDonutChart } from "./FinanceExpenseDonutChart";

const inputClass = cn(
  "rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)]",
  "outline-none transition placeholder:text-[var(--app-muted)]/60",
  "focus:border-[var(--app-text)]/25 focus:ring-1 focus:ring-[var(--app-text)]/10",
);

/** Manual expense entry — sits on the Finance main panel above Recent expenses. */
export function FinanceExpenseForm() {
  const { t } = useTranslation();
  const addExpense = useFinanceStore((s) => s.addExpense);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<FinanceExpenseCategory>("other");

  const submit = () => {
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addExpense({ label, category, amount: n });
    setLabel("");
    setAmount("");
  };

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--app-text)]">{t("finance.trackExpense")}</h3>
      <p className="mt-0.5 text-xs text-[var(--app-muted)]">{t("finance.trackExpenseHint")}</p>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
        <FinanceExpenseDonutChart className="w-full lg:w-auto lg:min-w-[220px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-0 flex-1 sm:min-w-[10rem]">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
            {t("finance.expenseLabel")}
          </span>
          <input
            type="text"
            placeholder={t("finance.expenseLabelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className={cn(inputClass, "w-full")}
          />
        </label>
        <label className="w-full sm:w-28">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
            {t("finance.amount")}
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className={cn(inputClass, "w-full tabular-nums")}
          />
        </label>
        <div className="w-full min-w-0 sm:basis-full">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
            {t("finance.category")}
          </span>
          <FinanceCategoryPicker value={category} onChange={setCategory} />
        </div>
        <button
          type="button"
          onClick={submit}
          className={cn(
            "inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl px-5",
            "text-sm font-medium text-white bg-[var(--app-text)] transition",
            "hover:opacity-90 active:scale-[0.99] dark:text-[var(--app-bg)]",
          )}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t("finance.addExpense")}
        </button>
        </div>
      </div>
    </div>
  );
}
