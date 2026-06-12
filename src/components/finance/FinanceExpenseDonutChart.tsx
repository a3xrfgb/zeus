import { useMemo } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { FINANCE_CATEGORY_CHART_COLOR } from "../../lib/financeCategoryIcons";
import { aggregateMonthlyExpensesByCategory } from "../../lib/financeExpenseBreakdown";
import { formatMoney } from "../../lib/financeFormat";
import { cn } from "../../lib/utils";
import { useFinanceStore } from "../../store/financeStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { FinanceExpenseCategory } from "../../store/financeStore";

function chartColor(category: FinanceExpenseCategory): string {
  return FINANCE_CATEGORY_CHART_COLOR[category];
}

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 68;
const STROKE = 20;
const GAP_PX = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function SegmentedDonut({ slices }: { slices: { category: FinanceExpenseCategory; percent: number }[] }) {
  let offset = CIRCUMFERENCE * 0.25;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={CX}
        cy={CY}
        r={RADIUS}
        fill="none"
        stroke="var(--app-border)"
        strokeWidth={STROKE}
        opacity={0.35}
      />
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        {slices.map((slice) => {
          const arc = Math.max(0, slice.percent * CIRCUMFERENCE - GAP_PX);
          const dashoffset = -offset;
          offset += slice.percent * CIRCUMFERENCE;
          return (
            <circle
              key={slice.category}
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke={chartColor(slice.category)}
              strokeWidth={STROKE}
              strokeDasharray={`${arc} ${CIRCUMFERENCE - arc}`}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </svg>
  );
}

export function FinanceExpenseDonutChart({ className }: { className?: string }) {
  const { t } = useTranslation();
  const expenses = useFinanceStore((s) => s.expenses);
  const currency = useSettingsStore((s) => s.settings.financeDisplayCurrency);

  const { slices, total } = useMemo(() => {
    const { slices: raw, total: sum } = aggregateMonthlyExpensesByCategory(expenses);
    return { slices: raw, total: sum };
  }, [expenses]);

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/40 p-4",
        className,
      )}
    >
      <div className="relative">
        <SegmentedDonut slices={slices} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            {t("finance.chartTotal")}
          </span>
          <span className="mt-1 text-xl font-bold tabular-nums leading-none tracking-tight text-[var(--app-text)]">
            {formatMoney(total, currency)}
          </span>
        </div>
      </div>

      {slices.length > 0 ? (
        <ul className="mt-4 w-full max-w-[220px] space-y-2">
          {slices.map((slice) => (
            <li
              key={slice.category}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chartColor(slice.category) }}
                  aria-hidden
                />
                <span className="truncate text-[var(--app-text)]">
                  {t(`finance.category.${slice.category}`)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--app-text)]">
                {Math.round(slice.percent * 100)}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 max-w-[12rem] text-center text-xs text-[var(--app-muted)]">
          {t("finance.chartEmpty")}
        </p>
      )}
    </div>
  );
}
