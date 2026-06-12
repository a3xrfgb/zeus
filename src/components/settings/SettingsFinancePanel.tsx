import { useCallback } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { FinanceCurrencySelect } from "./FinanceCurrencySelect";
import { settingsFieldClassName } from "./settingsGlassSelectStyles";

const inputClass = cn(settingsFieldClassName, "max-w-md");

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--app-text)]">{label}</span>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </label>
  );
}

export function SettingsFinancePanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const persist = useCallback(
    async (patch: Parameters<typeof save>[0]) => {
      try {
        await save(patch);
      } catch (e) {
        pushToast(String(e), "error");
      }
    },
    [save, pushToast],
  );

  return (
    <div className="px-8 py-10 pb-12">
      <div className="max-w-2xl space-y-10">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">
          {t("settings.finance.title")}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--app-muted)]">
          {t("settings.finance.subtitle")}
        </p>
      </div>

      <section className="space-y-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
          {t("settings.finance.accounts")}
        </h3>
        <div className="space-y-6">
        <Field label={t("settings.finance.checking")} hint={t("settings.finance.checkingHint")}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.financeCheckingBalance || ""}
            onChange={(e) => {
              const n = e.target.value === "" ? 0 : Number.parseFloat(e.target.value);
              if (Number.isFinite(n)) void persist({ financeCheckingBalance: n });
            }}
            className={inputClass}
          />
        </Field>
        <Field label={t("settings.finance.savings")} hint={t("settings.finance.savingsHint")}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.financeSavingsBalance || ""}
            onChange={(e) => {
              const n = e.target.value === "" ? 0 : Number.parseFloat(e.target.value);
              if (Number.isFinite(n)) void persist({ financeSavingsBalance: n });
            }}
            className={inputClass}
          />
        </Field>
        <Field label={t("settings.finance.creditLimit")} hint={t("settings.finance.creditLimitHint")}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.financeCreditLimit || ""}
            onChange={(e) => {
              const n = e.target.value === "" ? 0 : Number.parseFloat(e.target.value);
              if (Number.isFinite(n)) void persist({ financeCreditLimit: n });
            }}
            className={inputClass}
          />
        </Field>
        <Field label={t("settings.finance.creditUsage")} hint={t("settings.finance.creditUsageHint")}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.financeCreditUsage || ""}
            onChange={(e) => {
              const n = e.target.value === "" ? 0 : Number.parseFloat(e.target.value);
              if (Number.isFinite(n)) void persist({ financeCreditUsage: n });
            }}
            className={inputClass}
          />
        </Field>
        <Field label={t("settings.finance.displayCurrency")} hint={t("settings.finance.displayCurrencyHint")}>
          <FinanceCurrencySelect
            value={settings.financeDisplayCurrency}
            onValueChange={(v) => void persist({ financeDisplayCurrency: v })}
          />
        </Field>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
          {t("settings.finance.exchange")}
        </h3>
        <Field
          label={t("settings.finance.exchangeCurrency")}
          hint={t("settings.finance.exchangeCurrencyHint")}
        >
          <FinanceCurrencySelect
            value={settings.financeExchangeCurrency}
            onValueChange={(v) => void persist({ financeExchangeCurrency: v })}
          />
        </Field>
      </section>
      </div>
    </div>
  );
}
