import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function TasksSummaryCard({
  title,
  value,
  hint,
  icon,
  accent,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  accent: "blue" | "green" | "amber" | "rose";
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
        : accent === "rose"
          ? {
              ring: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
              value: "text-rose-600 dark:text-rose-400",
            }
          : {
              ring: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              value: "text-amber-600 dark:text-amber-400",
            };

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-[var(--app-muted)]">{title}</p>
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
          "mt-3 text-2xl font-semibold tracking-tight tabular-nums",
          accentStyles.value,
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--app-muted)]">{hint}</p>
    </div>
  );
}
