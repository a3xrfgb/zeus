import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Calendar,
  Loader2,
  Plus,
  Receipt,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { financeDateForReceipt } from "../../lib/financeExpenseBreakdown";
import { formatMoney } from "../../lib/financeFormat";
import { FinanceCategoryIcon } from "../../lib/financeCategoryIcons";
import { receiptImageSrc } from "../../lib/receiptImageSrc";
import {
  extractReceiptFromStoredPath,
  findExistingReceiptForImport,
  formatInvokeError,
  receiptFileNamesEqual,
  storeReceiptImage,
  type ReceiptExtractStage,
} from "../../lib/receiptVision";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";
import { useFinanceStore } from "../../store/financeStore";
import {
  ReceiptVisionModelPicker,
  loadReceiptVisionModelId,
  pickDefaultReceiptVisionModel,
} from "./ReceiptVisionModelPicker";
import {
  receiptsForPeriod,
  sumAllReceipts,
  sumReceiptsForPeriod,
  isReceiptTrackedInFinance,
  useReceiptStore,
} from "../../store/receiptStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import type { ReceiptPeriod, ReceiptRecord } from "../../types/receipt";
import {
  RECEIPT_IMAGE_EXTENSIONS,
  type ReceiptVisionModelOption,
} from "../../types/receiptVision";
import { ReceiptImageViewer } from "./ReceiptImageViewer";

const PERIOD_ACCENTS: Record<
  ReceiptPeriod,
  { ring: string; gradient: string; dot: string }
> = {
  daily: {
    ring: "from-violet-500/20 to-fuchsia-500/20",
    gradient: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    dot: "bg-violet-500",
  },
  weekly: {
    ring: "from-emerald-500/20 to-teal-500/20",
    gradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
    dot: "bg-emerald-500",
  },
  monthly: {
    ring: "from-amber-500/20 to-orange-500/20",
    gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
    dot: "bg-amber-500",
  },
};

function ReceiptImageThumb({
  receipt,
  onView,
}: {
  receipt: ReceiptRecord;
  onView?: () => void;
}) {
  const { t } = useTranslation();
  const src = useMemo(() => receiptImageSrc(receipt), [receipt]);

  if (!src) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--app-bg)] text-[var(--app-muted)]">
        <Receipt className="h-6 w-6" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onView}
      disabled={!onView}
      title={onView ? t("receipt.viewReceipt") : undefined}
      className={cn(
        "h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]",
        onView &&
          "cursor-zoom-in transition hover:ring-2 hover:ring-fuchsia-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400",
      )}
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

function ReceiptTotalsStrip({
  daily,
  weekly,
  monthly,
  total,
  currency,
}: {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
  currency: string;
}) {
  const { t } = useTranslation();

  const items: { key: ReceiptPeriod | "total"; amount: number }[] = [
    { key: "daily", amount: daily },
    { key: "weekly", amount: weekly },
    { key: "monthly", amount: monthly },
    { key: "total", amount: total },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ key, amount }) => (
        <div
          key={key}
          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            {t(`receipt.period.${key}`)} {t("receipt.totalLabel")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-[var(--app-text)]">
            {formatMoney(amount, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ImportHero({
  importing,
  stage,
  disabled,
  onImport,
}: {
  importing: boolean;
  stage: ReceiptExtractStage | null;
  disabled: boolean;
  onImport: () => void;
}) {
  const { t } = useTranslation();

  const stageLabel =
    stage === "copying"
      ? t("receipt.copyingImage")
      : stage === "loadingModel"
        ? t("receipt.loadingModel")
        : stage === "analyzing"
          ? t("receipt.analyzing")
          : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 sm:p-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(139,92,246,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, rgba(16,185,129,0.14), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(251,191,36,0.12), transparent 55%)",
        }}
      />
      <div className="relative flex flex-col items-center text-center">
        <button
          type="button"
          onClick={onImport}
          disabled={disabled || importing}
          className={cn(
            "group relative flex h-28 w-28 items-center justify-center rounded-full",
            "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-[3px]",
            "shadow-lg shadow-fuchsia-500/25 transition hover:scale-[1.02] hover:shadow-xl hover:shadow-fuchsia-500/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          aria-label={t("receipt.import")}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--app-surface)]">
            {importing ? (
              <Loader2 className="h-10 w-10 animate-spin text-fuchsia-500" strokeWidth={1.75} />
            ) : (
              <Receipt className="h-10 w-10 text-fuchsia-600 dark:text-fuchsia-400" strokeWidth={1.5} />
            )}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-4 ring-[var(--app-surface)] transition group-hover:scale-105">
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </span>
        </button>
        <h2 className="mt-5 text-lg font-semibold tracking-tight text-[var(--app-text)]">
          {t("receipt.heroTitle")}
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-[var(--app-muted)]">{t("receipt.heroHint")}</p>
        {importing && stageLabel ? (
          <p className="mt-3 text-xs font-medium text-fuchsia-600 dark:text-fuchsia-400">
            {stageLabel}
          </p>
        ) : (
          <p className="mt-3 text-[11px] uppercase tracking-wide text-[var(--app-muted)]">
            {t("receipt.supportedFormats")}
          </p>
        )}
      </div>
    </div>
  );
}

function PeriodStatCard({
  period,
  active,
  amount,
  currency,
  count,
  countHint,
  onSelect,
}: {
  period: ReceiptPeriod;
  active: boolean;
  amount: number;
  currency: string;
  count: number;
  countHint?: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const accent = PERIOD_ACCENTS[period];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 text-left transition",
        active
          ? "border-transparent shadow-md"
          : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-text)]/15",
      )}
    >
      {active ? (
        <div
          className={cn("absolute inset-0 opacity-[0.08]", accent.gradient)}
          aria-hidden
        />
      ) : null}
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", accent.dot)} aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              {t(`receipt.period.${period}`)}
            </span>
          </div>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
              active ? "text-[var(--app-text)]" : "text-[var(--app-text)]/90",
            )}
          >
            {formatMoney(amount, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            {countHint ?? t("receipt.receiptCount", { count })}
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br",
            accent.ring,
          )}
        >
          <Sparkles className="h-4 w-4 text-[var(--app-muted)]" strokeWidth={1.75} />
        </span>
      </div>
    </button>
  );
}

function ReceiptRow({
  receipt,
  onViewImage,
}: {
  receipt: ReceiptRecord;
  onViewImage: (receipt: ReceiptRecord) => void;
}) {
  const { t } = useTranslation();
  const displayCurrency = useSettingsStore((s) => s.settings.financeDisplayCurrency);
  const removeReceipt = useReceiptStore((s) => s.removeReceipt);
  const linkFinanceExpense = useReceiptStore((s) => s.linkFinanceExpense);
  const financeExpenses = useFinanceStore((s) => s.expenses);
  const financeExpenseIds = useMemo(
    () => new Set(financeExpenses.map((e) => e.id)),
    [financeExpenses],
  );
  const trackedInFinance = isReceiptTrackedInFinance(receipt, financeExpenseIds);
  const addExpense = useFinanceStore((s) => s.addExpense);
  const pushToast = useUiStore((s) => s.pushToast);

  const amountCurrency = receipt.currency ?? displayCurrency;

  const viewReceipt = () => {
    if (!receiptImageSrc(receipt)) {
      pushToast(t("receipt.noImageToView"), "error");
      return;
    }
    onViewImage(receipt);
  };

  const addToFinance = () => {
    if (receipt.totalAmount <= 0) {
      pushToast(t("receipt.noAmountFound"), "error");
      return;
    }
    const expenseId = addExpense({
      label: receipt.storeName,
      category: receipt.category,
      amount: receipt.totalAmount,
      date: financeDateForReceipt(receipt.date),
      receiptId: receipt.id,
    });
    linkFinanceExpense(receipt.id, expenseId);
    pushToast(t("receipt.addedToFinance"), "success");
  };

  const handleRemoveReceipt = async (id: string) => {
    const ok = await removeReceipt(id);
    if (ok) pushToast(t("receipt.removed"), "success");
    else pushToast(t("receipt.removeFailed"), "error");
  };

  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <ReceiptImageThumb receipt={receipt} onView={viewReceipt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--app-text)]">
              {receipt.storeName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--app-muted)]">
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {receipt.itemType}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {receipt.date}
              </span>
            </div>
          </div>
          <p className="shrink-0 text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatMoney(receipt.totalAmount, amountCurrency)}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)]">
            <FinanceCategoryIcon category={receipt.category} className="h-3.5 w-3.5" />
            {t(`finance.category.${receipt.category}`)}
          </span>
          {receipt.items.length > 0 ? (
            <span className="truncate text-[11px] text-[var(--app-muted)]">
              {receipt.items.slice(0, 2).join(" · ")}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!trackedInFinance ? (
            <button
              type="button"
              onClick={addToFinance}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-text)] px-3 py-1.5 text-xs font-medium text-[var(--app-bg)] transition hover:opacity-90"
            >
              <Wallet className="h-3.5 w-3.5" />
              {t("receipt.trackExpense")}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {t("receipt.tracked")}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleRemoveReceipt(receipt.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-muted)] transition hover:bg-[var(--app-bg)] hover:text-red-600"
            title={t("receipt.remove")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("receipt.remove")}
          </button>
        </div>
      </div>
    </li>
  );
}

export function ReceiptPanel() {
  const { t } = useTranslation();
  const receipts = useReceiptStore((s) => s.receipts);
  const hydrate = useReceiptStore((s) => s.hydrate);
  const addReceipt = useReceiptStore((s) => s.addReceipt);
  const displayCurrency = useSettingsStore((s) => s.settings.financeDisplayCurrency);
  const pushToast = useUiStore((s) => s.pushToast);

  const [period, setPeriod] = useState<ReceiptPeriod>("monthly");
  const [importing, setImporting] = useState(false);
  const [stage, setStage] = useState<ReceiptExtractStage | null>(null);
  const [visionModels, setVisionModels] = useState<ReceiptVisionModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [viewerReceipt, setViewerReceipt] = useState<ReceiptRecord | null>(null);

  const periodReceipts = useMemo(
    () => receiptsForPeriod(receipts, period),
    [receipts, period],
  );

  const dailyTotal = useMemo(() => sumReceiptsForPeriod(receipts, "daily"), [receipts]);
  const weeklyTotal = useMemo(() => sumReceiptsForPeriod(receipts, "weekly"), [receipts]);
  const monthlyTotal = useMemo(() => sumReceiptsForPeriod(receipts, "monthly"), [receipts]);
  const allTimeTotal = useMemo(() => sumAllReceipts(receipts), [receipts]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const visionReady =
    visionModels.length > 0 && selectedModelId != null && visionModels.some((m) => m.id === selectedModelId);

  useEffect(() => {
    if (!isTauri()) return;
    void api.getReceiptVisionStatus().then((status) => {
      setVisionModels(status.models);
      const picked = pickDefaultReceiptVisionModel(status.models, loadReceiptVisionModelId());
      setSelectedModelId(picked);
    }).catch(() => {
      setVisionModels([]);
      setSelectedModelId(null);
    });
  }, []);

  const processImagePath = useCallback(
    async (imagePath: string, fileName: string) => {
      if (!selectedModelId) {
        pushToast(t("receipt.selectVisionModel"), "error");
        return;
      }
      const knownReceipts = useReceiptStore.getState().receipts;
      const alreadyTracked = knownReceipts.find((r) =>
        receiptFileNamesEqual(r.fileName, fileName),
      );
      if (alreadyTracked) {
        pushToast(t("receipt.alreadyImported"), "info");
        return;
      }

      setImporting(true);
      setStage("copying");
      try {
        const { path: storedPath, reused } = await storeReceiptImage(imagePath);
        const existing = findExistingReceiptForImport(
          useReceiptStore.getState().receipts,
          storedPath,
          fileName,
        );
        if (reused || existing) {
          pushToast(t("receipt.alreadyImported"), "info");
          return;
        }
        const parsed = await extractReceiptFromStoredPath(storedPath, selectedModelId, setStage);
        addReceipt({
          ...parsed,
          fileName,
        });
        const updated = useReceiptStore.getState().receipts;
        const daily = sumReceiptsForPeriod(updated, "daily");
        const weekly = sumReceiptsForPeriod(updated, "weekly");
        const monthly = sumReceiptsForPeriod(updated, "monthly");
        const total = sumAllReceipts(updated);
        pushToast(
          t("receipt.importSuccessTotals", {
            store: parsed.storeName,
            daily: formatMoney(daily, displayCurrency),
            weekly: formatMoney(weekly, displayCurrency),
            monthly: formatMoney(monthly, displayCurrency),
            total: formatMoney(total, displayCurrency),
          }),
          "success",
        );
      } catch (e) {
        const msg = formatInvokeError(e);
        if (msg.includes("RECEIPT_VISION_DESKTOP_ONLY")) {
          pushToast(t("receipt.desktopOnly"), "error");
        } else {
          pushToast(msg || t("receipt.importFailed"), "error");
        }
        console.error(e);
      } finally {
        setImporting(false);
        setStage(null);
      }
    },
    [addReceipt, displayCurrency, pushToast, selectedModelId, t],
  );

  const onImport = useCallback(async () => {
    if (importing || !visionReady || !selectedModelId) return;

    if (!isTauri()) {
      pushToast(t("receipt.desktopOnly"), "error");
      return;
    }

    const picked = await open({
      multiple: false,
      filters: [
        {
          name: "Receipt images",
          extensions: [...RECEIPT_IMAGE_EXTENSIONS],
        },
      ],
    });
    if (typeof picked !== "string") return;
    const fileName = picked.split(/[/\\]/).pop() ?? "receipt.jpg";
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!RECEIPT_IMAGE_EXTENSIONS.includes(ext as (typeof RECEIPT_IMAGE_EXTENSIONS)[number])) {
      pushToast(t("receipt.unsupportedFormat"), "error");
      return;
    }
    await processImagePath(picked, fileName);
  }, [importing, processImagePath, pushToast, selectedModelId, t, visionReady]);

  const periodAmounts = { daily: dailyTotal, weekly: weeklyTotal, monthly: monthlyTotal };

  const periodCounts = {
    daily: receiptsForPeriod(receipts, "daily").length,
    weekly: receiptsForPeriod(receipts, "weekly").length,
    monthly: receiptsForPeriod(receipts, "monthly").length,
  };

  const viewerSrc = useMemo(
    () => (viewerReceipt ? receiptImageSrc(viewerReceipt) : null),
    [viewerReceipt],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Store className="h-5 w-5 text-violet-500" strokeWidth={1.75} />
                <h2 className="text-lg font-semibold text-[var(--app-text)]">{t("receipt.title")}</h2>
              </div>
            </div>
            <ReceiptVisionModelPicker
              models={visionModels}
              modelId={selectedModelId}
              onModelChange={setSelectedModelId}
              disabled={importing}
            />
          </div>

          <ImportHero
            importing={importing}
            stage={stage}
            disabled={!visionReady || !isTauri()}
            onImport={() => void onImport()}
          />
          <ReceiptTotalsStrip
            daily={dailyTotal}
            weekly={weeklyTotal}
            monthly={monthlyTotal}
            total={allTimeTotal}
            currency={displayCurrency}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {(["daily", "weekly", "monthly"] as ReceiptPeriod[]).map((p) => (
              <PeriodStatCard
                key={p}
                period={p}
                active={period === p}
                amount={periodAmounts[p]}
                currency={displayCurrency}
                count={periodCounts[p]}
                onSelect={() => setPeriod(p)}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--app-text)]">
                {t(`receipt.period.${period}`)} {t("receipt.receiptsHeading")}
              </h3>
              <span className="text-xs text-[var(--app-muted)]">
                {t("receipt.periodTotal", {
                  amount: formatMoney(periodAmounts[period], displayCurrency),
                })}
              </span>
            </div>
            {periodReceipts.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--app-muted)]">
                {t("receipt.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--app-border)]">
                {periodReceipts.map((r) => (
                  <ReceiptRow key={r.id} receipt={r} onViewImage={setViewerReceipt} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ReceiptImageViewer
        open={viewerReceipt != null}
        receipt={viewerReceipt}
        src={viewerSrc}
        currency={displayCurrency}
        onClose={() => setViewerReceipt(null)}
      />
    </div>
  );
}
