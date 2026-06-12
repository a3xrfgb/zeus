import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { FinanceCategoryIcon } from "../../lib/financeCategoryIcons";
import { formatMoney } from "../../lib/financeFormat";
import { cn } from "../../lib/utils";
import { useFinanceStore, type FinanceExpense } from "../../store/financeStore";
import { useReceiptStore } from "../../store/receiptStore";

export function FinanceExpenseRow({
  expense,
  displayCurrency,
}: {
  expense: FinanceExpense;
  displayCurrency: string;
}) {
  const { t } = useTranslation();
  const updateExpense = useFinanceStore((s) => s.updateExpense);
  const removeExpense = useFinanceStore((s) => s.removeExpense);
  const unlinkFinanceExpense = useReceiptStore((s) => s.unlinkFinanceExpense);

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingAmount) {
      setAmountDraft(expense.amount > 0 ? String(expense.amount) : "");
    }
  }, [expense.amount, editingAmount]);

  useEffect(() => {
    if (editingAmount) inputRef.current?.focus();
  }, [editingAmount]);

  const commitAmount = () => {
    const n = Number.parseFloat(amountDraft);
    if (Number.isFinite(n) && n >= 0) {
      updateExpense(expense.id, { amount: n });
    }
    setEditingAmount(false);
  };

  const cancelAmount = () => {
    setAmountDraft(expense.amount > 0 ? String(expense.amount) : "");
    setEditingAmount(false);
  };

  return (
    <li className="group flex items-center gap-3 py-3 text-sm">
      <FinanceCategoryIcon category={expense.category} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--app-text)]">{expense.label}</p>
        <p className="text-xs text-[var(--app-muted)]">
          {t(`finance.category.${expense.category}`)} · {expense.date}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {editingAmount ? (
          <input
            ref={inputRef}
            type="number"
            min={0}
            step="0.01"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            onBlur={commitAmount}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAmount();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelAmount();
              }
            }}
            className={cn(
              "w-24 rounded-lg border border-emerald-500/40 bg-[var(--app-bg)] px-2 py-1",
              "text-right text-sm font-semibold tabular-nums text-[var(--app-text)] outline-none",
              "ring-1 ring-emerald-500/25 focus:border-emerald-500/50",
            )}
            aria-label={t("finance.editAmount")}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingAmount(true)}
            title={t("finance.editAmount")}
            className={cn(
              "rounded-lg px-2 py-1 font-semibold tabular-nums text-[var(--app-text)] transition",
              "hover:bg-[var(--app-bg)] group-hover:ring-1 group-hover:ring-[var(--app-border)]",
            )}
          >
            −{formatMoney(expense.amount, displayCurrency)}
          </button>
        )}
        {!editingAmount ? (
          <button
            type="button"
            title={t("finance.editAmount")}
            onClick={() => setEditingAmount(true)}
            className="rounded-lg p-1.5 text-[var(--app-muted)] opacity-0 transition hover:bg-[var(--app-bg)] hover:text-[var(--app-text)] group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
        <button
          type="button"
          title={t("finance.removeExpense")}
          className="rounded-lg p-1.5 text-[var(--app-muted)] opacity-0 transition hover:bg-[var(--app-bg)] hover:text-[var(--dropdown-danger)] group-hover:opacity-100"
          onClick={() => {
            removeExpense(expense.id);
            unlinkFinanceExpense(expense.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}
