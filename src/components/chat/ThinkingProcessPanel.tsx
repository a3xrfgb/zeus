import { BrainCircuit, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";

function ThinkingPulse() {
  return (
    <span className="inline-flex gap-0.5 pl-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 animate-pulse rounded-full bg-sky-500/80 dark:bg-sky-400/80"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Grok / DeepSeek-style collapsible reasoning block above the final answer.
 */
export function ThinkingProcessPanel({
  thinking,
  streaming,
  thinkActive,
  hasFinalContent,
}: {
  thinking: string;
  streaming?: boolean;
  /** Composer Think toggle — show panel while the model is reasoning. */
  thinkActive?: boolean;
  /** True once the assistant has started streaming the final answer. */
  hasFinalContent?: boolean;
}) {
  const { t } = useTranslation();
  const trimmed = thinking.trim();
  const hasThinking = trimmed.length > 0;
  const showPanel = hasThinking || Boolean(streaming && thinkActive);

  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  const autoOpen =
    Boolean(streaming && thinkActive) &&
    (!hasFinalContent || (hasThinking && !hasFinalContent));

  const isOpen = userOpen ?? autoOpen;

  useEffect(() => {
    if (!streaming) {
      setUserOpen(null);
    }
  }, [streaming]);

  if (!showPanel) return null;

  const inProgress = Boolean(streaming && thinkActive && !hasFinalContent);
  const headerLabel = inProgress && !hasThinking
    ? t("chat.thinking.inProgress")
    : t("chat.thinking.toggle");

  return (
    <div
      className={cn(
        "mb-3 w-full max-w-[min(72ch,100%)] overflow-hidden rounded-xl border shadow-sm",
        "border-zinc-200/90 bg-zinc-100/70 dark:border-zinc-700/55 dark:bg-zinc-900/45",
        inProgress && "ring-1 ring-sky-500/15 dark:ring-sky-400/10",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
          "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500/40",
        )}
        aria-expanded={isOpen}
        onClick={() => setUserOpen(!isOpen)}
      >
        <BrainCircuit
          className={cn(
            "h-4 w-4 shrink-0",
            inProgress
              ? "text-sky-600 dark:text-sky-400"
              : "text-[var(--app-muted)]",
          )}
          strokeWidth={1.75}
        />
        <span
          className={cn(
            "text-xs font-medium",
            inProgress
              ? "text-sky-700 dark:text-sky-300"
              : "text-[var(--app-muted)]",
          )}
        >
          {headerLabel}
        </span>
        {inProgress ? <ThinkingPulse /> : null}
        {hasThinking && !inProgress ? (
          <span className="text-[11px] text-[var(--app-muted)]">
            · {t("chat.thinking.tapToExpand")}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-[var(--app-muted)] transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>
      {isOpen && hasThinking ? (
        <div
          className={cn(
            "max-h-56 overflow-y-auto border-t px-3 py-2.5",
            "border-zinc-200/70 dark:border-zinc-700/45",
            "text-[13px] leading-relaxed text-[var(--app-muted)]",
          )}
        >
          <div className="whitespace-pre-wrap">{trimmed}</div>
        </div>
      ) : null}
    </div>
  );
}
