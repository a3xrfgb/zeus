import { Calendar, Store, Tag, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { formatMoney } from "../../lib/financeFormat";
import { FinanceCategoryIcon } from "../../lib/financeCategoryIcons";
import type { ReceiptRecord } from "../../types/receipt";

export function ReceiptImageViewer({
  open,
  receipt,
  src,
  currency,
  onClose,
}: {
  open: boolean;
  receipt: ReceiptRecord | null;
  src: string | null;
  currency: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !receipt || !src) return null;

  const amountCurrency = receipt.currency ?? currency;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("receipt.viewerTitle")}
      className="fixed inset-0 z-[200]"
    >
      <div
        className="absolute inset-0 bg-[var(--app-bg)]/55 backdrop-blur-xl dark:bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      <button
        type="button"
        className="absolute right-4 top-4 z-[210] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)]/90 text-[var(--app-text)] shadow-lg backdrop-blur-md transition hover:bg-[var(--app-surface)]"
        aria-label={t("receipt.viewerClose")}
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="absolute inset-0 z-[205] flex items-center justify-center overflow-y-auto px-4 py-16">
        <div
          className="flex w-full max-w-3xl flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
            <img
              src={src}
              alt={receipt.storeName}
              draggable={false}
              className="block max-h-[min(72vh,900px)] w-full object-contain"
            />
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-4 py-3 backdrop-blur-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
                  <Store className="h-4 w-4 shrink-0 text-violet-500" strokeWidth={1.75} />
                  <span className="truncate">{receipt.storeName}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--app-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {receipt.itemType}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {receipt.date}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FinanceCategoryIcon category={receipt.category} className="h-3.5 w-3.5" />
                    {t(`finance.category.${receipt.category}`)}
                  </span>
                </div>
              </div>
              <p className="shrink-0 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(receipt.totalAmount, amountCurrency)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
