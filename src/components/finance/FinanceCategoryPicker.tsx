import { useTranslation } from "../../i18n/I18nContext";
import {
  FINANCE_CATEGORY_META,
  FINANCE_EXPENSE_CATEGORIES,
} from "../../lib/financeCategoryIcons";
import { cn } from "../../lib/utils";
import type { FinanceExpenseCategory } from "../../store/financeStore";

export function FinanceCategoryPicker({
  value,
  onChange,
}: {
  value: FinanceExpenseCategory;
  onChange: (category: FinanceExpenseCategory) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="radiogroup"
      aria-label={t("finance.category")}
    >
      {FINANCE_EXPENSE_CATEGORIES.map((c) => {
        const active = value === c;
        const { Icon, ring, icon: iconColor } = FINANCE_CATEGORY_META[c];
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(`finance.category.${c}`)}
            title={t(`finance.category.${c}`)}
            onClick={() => onChange(c)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left transition",
              active
                ? "border-emerald-500/45 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/25"
                : "border-[var(--app-border)]/80 hover:border-[var(--app-border)] hover:bg-[var(--app-bg)]/80",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                active ? "bg-emerald-500/20" : ring,
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  active ? "text-emerald-600 dark:text-emerald-400" : iconColor,
                )}
                strokeWidth={1.75}
                aria-hidden
              />
            </span>
            <span
              className={cn(
                "pr-0.5 text-xs font-medium",
                active
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-[var(--app-muted)]",
              )}
            >
              {t(`finance.category.${c}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
