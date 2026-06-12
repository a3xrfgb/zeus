import {
  ArrowLeftRight,
  Building2,
  Coins,
  CreditCard,
  PiggyBank,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FINANCE_CURRENCIES,
  financeCurrencyName,
} from "../../constants/financeCurrencies";
import { useTranslation } from "../../i18n/I18nContext";
import {
  convertViaUsd,
  fetchUsdExchangeRates,
  rateUsdTo,
  type ExchangeRatesSnapshot,
} from "../../lib/financeExchange";
import { expenseMonthKey, currentMonthKey } from "../../lib/financeExpenseBreakdown";
import { formatMoney, formatRate } from "../../lib/financeFormat";
import { cn } from "../../lib/utils";
import { FinanceExpenseForm } from "./FinanceExpenseForm";
import { FinanceExpenseRow } from "./FinanceExpenseRow";
import { useFinanceStore } from "../../store/financeStore";
import { useReceiptStore } from "../../store/receiptStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";

function SummaryCard({
  title,
  value,
  hint,
  icon,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent: "green" | "blue" | "teal" | "amber" | "purple";
}) {
  const accentStyles =
    accent === "green"
      ? {
          ring: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          value: "text-emerald-600 dark:text-emerald-400",
        }
      : accent === "blue"
        ? {
            ring: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
            value: "text-blue-600 dark:text-blue-400",
          }
        : accent === "teal"
          ? {
              ring: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
              value: "text-teal-600 dark:text-teal-400",
            }
          : accent === "purple"
            ? {
                ring: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                value: "text-violet-600 dark:text-violet-400",
              }
            : {
                ring: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                value: "text-amber-600 dark:text-amber-400",
              };

  return (
    <div className="flex min-h-[11.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--app-muted)]">{title}</p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            accentStyles.ring,
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-3 min-w-0 text-xl font-semibold leading-tight tracking-tight tabular-nums sm:text-2xl",
          accentStyles.value,
        )}
        style={{ overflowWrap: "anywhere" }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]" style={{ overflowWrap: "anywhere" }}>
        {hint}
      </p>
    </div>
  );
}

function OverviewCardShell({
  title,
  hint,
  icon,
  iconRingClass,
  children,
}: {
  title: string;
  hint?: string;
  icon: ReactNode;
  iconRingClass: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[11.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--app-muted)]">
          {title}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            iconRingClass,
          )}
        >
          {icon}
        </span>
      </div>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]" style={{ overflowWrap: "anywhere" }}>
          {hint}
        </p>
      ) : null}
      <div className="mt-auto min-w-0 pt-3">{children}</div>
    </div>
  );
}

export function FinancePanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setSettingsEntryNavId = useUiStore((s) => s.setSettingsEntryNavId);
  const expenses = useFinanceStore((s) => s.expenses);
  const reconcileFinanceLinks = useReceiptStore((s) => s.reconcileFinanceLinks);

  const displayCurrency = settings.financeDisplayCurrency;
  const exchangeCurrency = settings.financeExchangeCurrency;

  const [rates, setRates] = useState<ExchangeRatesSnapshot | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const loadRates = useCallback(async (force = false) => {
    setRatesLoading(true);
    setRatesError(null);
    try {
      const snap = await fetchUsdExchangeRates({ force });
      setRates(snap);
    } catch (e) {
      setRatesError(String(e));
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates(false);
  }, [loadRates]);

  useEffect(() => {
    reconcileFinanceLinks();
  }, [expenses, reconcileFinanceLinks]);

  /** Pick up today's rates when returning to the app or after midnight. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadRates(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadRates]);

  const monthSpend = useMemo(() => {
    const ym = currentMonthKey();
    return expenses
      .filter((e) => expenseMonthKey(e.date) === ym)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const usdToDisplay = rates ? rateUsdTo(rates, displayCurrency) : null;
  const usdToExchange = rates ? rateUsdTo(rates, exchangeCurrency) : null;

  const convertedBalances = useMemo(() => {
    if (!rates || usdToExchange == null) return null;
    const checking = settings.financeCheckingBalance;
    const savings = settings.financeSavingsBalance;
    const to = (amount: number) => convertViaUsd(amount, displayCurrency, exchangeCurrency, rates);
    return {
      checking: to(checking),
      savings: to(savings),
      total: to(checking + savings),
    };
  }, [
    rates,
    usdToExchange,
    displayCurrency,
    exchangeCurrency,
    settings.financeCheckingBalance,
    settings.financeSavingsBalance,
  ]);

  const creditLimit = settings.financeCreditLimit;
  const creditUsage = settings.financeCreditUsage;
  const creditAvailable = Math.max(0, creditLimit - creditUsage);
  const creditHint =
    creditLimit > 0
      ? `${t("finance.creditUsed", {
          usage: formatMoney(creditUsage, displayCurrency),
          limit: formatMoney(creditLimit, displayCurrency),
        })} · ${t("finance.creditAvailable", {
          amount: formatMoney(creditAvailable, displayCurrency),
        })}`
      : t("finance.creditConfigureHint");

  const openFinanceSettings = () => {
    setSettingsEntryNavId("finance");
    setSettingsOpen(true);
  };

  const onExchangeCurrencyChange = (code: string) => {
    void save({ financeExchangeCurrency: code });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-text)]">{t("finance.overview")}</h2>
              <p className="mt-0.5 text-sm text-[var(--app-muted)]">{t("finance.overviewHint")}</p>
            </div>
            <button
              type="button"
              onClick={openFinanceSettings}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)]"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
              {t("finance.configure")}
            </button>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15.5rem),1fr))]">
            <SummaryCard
              title={t("finance.checking")}
              value={formatMoney(settings.financeCheckingBalance, displayCurrency)}
              hint={t("finance.availableBalance")}
              accent="amber"
              icon={<Building2 className="h-4 w-4" strokeWidth={1.75} />}
            />
            <SummaryCard
              title={t("finance.savings")}
              value={formatMoney(settings.financeSavingsBalance, displayCurrency)}
              hint={t("finance.availableBalance")}
              accent="green"
              icon={<PiggyBank className="h-4 w-4" strokeWidth={1.75} />}
            />
            <SummaryCard
              title={t("finance.credit")}
              value={formatMoney(creditUsage, displayCurrency)}
              hint={creditHint}
              accent="purple"
              icon={<CreditCard className="h-4 w-4" strokeWidth={1.75} />}
            />
            <OverviewCardShell
              title={t("finance.exchange")}
              hint={financeCurrencyName(exchangeCurrency)}
              iconRingClass="bg-teal-500/15 text-teal-600 dark:text-teal-400"
              icon={<ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} />}
            >
              {ratesLoading && !rates ? (
                <p className="text-sm text-[var(--app-muted)]">{t("finance.loadingRates")}</p>
              ) : usdToExchange != null ? (
                <p
                  className="text-sm font-semibold leading-tight tracking-tight text-[var(--app-text)] tabular-nums"
                  style={{ overflowWrap: "anywhere" }}
                >
                  1 USD = {formatRate(usdToExchange)} {exchangeCurrency}
                </p>
              ) : (
                <p className="text-sm text-[var(--app-muted)]">{ratesError ?? t("finance.rateUnavailable")}</p>
              )}
              <div className="mt-3 flex min-w-0 items-center gap-2">
                <select
                  value={exchangeCurrency}
                  onChange={(e) => onExchangeCurrencyChange(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 text-xs text-[var(--app-text)] outline-none focus:border-[var(--app-text)]/25"
                  aria-label={t("finance.selectCurrency")}
                >
                  {FINANCE_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title={t("finance.refreshRates")}
                  disabled={ratesLoading}
                  onClick={() => void loadRates(true)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] text-[var(--app-muted)] transition hover:bg-[var(--app-bg)] disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", ratesLoading && "animate-spin")} />
                </button>
              </div>
            </OverviewCardShell>

            <OverviewCardShell
              title={t("finance.convertedBoxTitle", { currency: exchangeCurrency })}
              hint={t("finance.convertedBoxHint")}
              iconRingClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              icon={<Coins className="h-4 w-4" strokeWidth={1.75} />}
            >
              {ratesLoading && !rates ? (
                <p className="text-sm text-[var(--app-muted)]">{t("finance.loadingRates")}</p>
              ) : convertedBalances ? (
                <ul className="space-y-2.5">
                  {[
                    {
                      key: "checking",
                      label: t("finance.checking"),
                      amount: settings.financeCheckingBalance,
                      converted: convertedBalances.checking,
                      bold: false,
                    },
                    {
                      key: "savings",
                      label: t("finance.savings"),
                      amount: settings.financeSavingsBalance,
                      converted: convertedBalances.savings,
                      bold: false,
                    },
                    {
                      key: "total",
                      label: t("finance.totalBalance"),
                      amount:
                        settings.financeCheckingBalance + settings.financeSavingsBalance,
                      converted: convertedBalances.total,
                      bold: true,
                    },
                  ].map((row) =>
                    row.converted != null ? (
                      <li
                        key={row.key}
                        className={cn(
                          "min-w-0",
                          row.bold && "border-t border-[var(--app-border)] pt-2.5",
                        )}
                      >
                        <div className="grid min-w-0 grid-cols-1 gap-0.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end sm:gap-x-2">
                          <span
                            className={cn(
                              "min-w-0 truncate text-xs text-[var(--app-muted)]",
                              row.bold &&
                                "text-sm font-semibold text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {row.label}
                          </span>
                          <div className="min-w-0 sm:text-right">
                            {displayCurrency !== exchangeCurrency ? (
                              <span
                                className="block text-[10px] leading-tight text-[var(--app-muted)] tabular-nums"
                                style={{ overflowWrap: "anywhere" }}
                              >
                                {formatMoney(row.amount, displayCurrency)}
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "block leading-tight tabular-nums",
                                row.bold
                                  ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400 sm:text-base"
                                  : "text-xs font-medium text-[var(--app-text)] sm:text-sm",
                              )}
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {formatMoney(row.converted, exchangeCurrency)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ) : (
                      <li key={row.key} className="text-xs text-[var(--app-muted)]">
                        {row.label}: {t("finance.rateUnavailable")}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="text-sm text-[var(--app-muted)]">
                  {ratesError ?? t("finance.rateUnavailable")}
                </p>
              )}
            </OverviewCardShell>
          </div>

          <div className="mt-6 space-y-4">
            <FinanceExpenseForm />
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--app-text)]">
                {t("finance.recentExpenses")}
              </h3>
              <span className="text-xs text-[var(--app-muted)]">
                {t("finance.monthSpend", {
                  amount: formatMoney(monthSpend, displayCurrency),
                })}
              </span>
            </div>
            {expenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--app-muted)]">
                {t("finance.noExpensesYet")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--app-border)]">
                {expenses.slice(0, 12).map((e) => (
                  <FinanceExpenseRow
                    key={e.id}
                    expense={e}
                    displayCurrency={displayCurrency}
                  />
                ))}
              </ul>
            )}
          </div>

          {usdToDisplay != null && displayCurrency !== "USD" ? (
            <p className="mt-4 text-center text-[10px] text-[var(--app-muted)]">
              {t("finance.usdEquivalent", {
                rate: formatRate(usdToDisplay),
                currency: displayCurrency,
              })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
