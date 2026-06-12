import { Search, X } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import type { TaskPriority } from "../../types/tasks";

export function TasksSearchFilter({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  status,
  onStatusChange,
  tag,
  onTagChange,
  tags,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  priority: TaskPriority | "all";
  onPriorityChange: (v: TaskPriority | "all") => void;
  status: "all" | "pending" | "completed";
  onStatusChange: (v: "all" | "pending" | "completed") => void;
  tag: string;
  onTagChange: (v: string) => void;
  tags: string[];
}) {
  const { t } = useTranslation();
  const hasFilters =
    search.trim().length > 0 || priority !== "all" || status !== "all" || tag.length > 0;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("tasks.searchPlaceholder")}
          className={cn(
            "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] py-2 pl-9 pr-3 text-sm text-[var(--app-text)] outline-none",
            "placeholder:text-[var(--app-muted)] focus:border-[var(--app-text)]/20",
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value as TaskPriority | "all")}
          className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          aria-label={t("tasks.filterPriority")}
        >
          <option value="all">{t("tasks.filterAllPriorities")}</option>
          <option value="low">{t("tasks.priorityLow")}</option>
          <option value="medium">{t("tasks.priorityMedium")}</option>
          <option value="high">{t("tasks.priorityHigh")}</option>
        </select>
        <select
          value={status}
          onChange={(e) =>
            onStatusChange(e.target.value as "all" | "pending" | "completed")
          }
          className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          aria-label={t("tasks.filterStatus")}
        >
          <option value="all">{t("tasks.filterAllStatus")}</option>
          <option value="pending">{t("tasks.filterPending")}</option>
          <option value="completed">{t("tasks.filterCompleted")}</option>
        </select>
        <select
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          className="max-w-[10rem] rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          aria-label={t("tasks.filterTag")}
        >
          <option value="">{t("tasks.filterAllTags")}</option>
          {tags.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              onPriorityChange("all");
              onStatusChange("all");
              onTagChange("");
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-muted)] transition hover:text-[var(--app-text)]"
          >
            <X className="h-3.5 w-3.5" />
            {t("tasks.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
