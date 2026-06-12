import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { getChatModelDisplayLabel } from "../../lib/chatModelPicker";
import { cn } from "../../lib/utils";
import type { ReceiptVisionModelOption } from "../../types/receiptVision";

const STORAGE_KEY = "zeus-receipt-vision-model";

export function loadReceiptVisionModelId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveReceiptVisionModelId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function ReceiptVisionModelPicker({
  models,
  modelId,
  onModelChange,
  disabled,
}: {
  models: ReceiptVisionModelOption[];
  modelId: string | null;
  onModelChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLabel = useMemo(() => {
    if (!modelId) return t("receipt.selectVisionModel");
    const match = models.find((m) => m.id === modelId);
    if (match) return match.name;
    return getChatModelDisplayLabel(modelId) || modelId;
  }, [modelId, models, t]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (id: string) => {
      onModelChange(id);
      saveReceiptVisionModelId(id);
      setOpen(false);
    },
    [onModelChange],
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled || models.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("receipt.visionModel")}
        className={cn(
          "inline-flex max-w-[13rem] items-center gap-2 rounded-xl border border-[var(--app-border)]",
          "bg-[var(--app-surface)] px-3 py-2 text-left shadow-sm transition",
          "hover:border-[var(--app-text)]/20 hover:bg-[var(--app-bg)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onClick={() => {
          if (models.length === 0) return;
          setOpen((v) => !v);
        }}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400">
          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
            {t("receipt.visionModel")}
          </span>
          <span className="block truncate text-[13px] font-semibold text-[var(--app-text)]">
            {currentLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--app-muted)] transition-transform duration-200",
            open && "rotate-180",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open && models.length > 0 ? (
        <ul
          role="listbox"
          className={cn(
            "absolute right-0 top-full z-[320] mt-2 min-w-[13rem] max-w-[20rem] overflow-hidden rounded-xl py-1",
            "border border-white/35 bg-white/[0.72] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.22)]",
            "backdrop-blur-xl backdrop-saturate-150",
            "dark:border-white/[0.14] dark:bg-[rgba(22,22,26,0.78)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)]",
          )}
        >
          {models.map((m) => {
            const selected = m.id === modelId;
            return (
              <li key={m.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "w-full px-3 py-2 text-left text-[13px] font-medium tracking-tight",
                    "text-[var(--app-text)] transition-all duration-150",
                    "hover:bg-black/[0.06] dark:hover:bg-white/[0.1]",
                    selected && "bg-fuchsia-500/10 font-semibold text-fuchsia-700 dark:text-fuchsia-300",
                  )}
                  onClick={() => pick(m.id)}
                >
                  <span className="block truncate">{m.name}</span>
                  <span className="block truncate text-[10px] font-normal text-[var(--app-muted)]">
                    + {m.mmprojId}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function pickDefaultReceiptVisionModel(
  models: ReceiptVisionModelOption[],
  savedId: string | null,
): string | null {
  if (savedId && models.some((m) => m.id === savedId)) return savedId;
  const gemma = models.find((m) => m.id.toLowerCase().includes("gemma"));
  if (gemma) return gemma.id;
  return models[0]?.id ?? null;
}
