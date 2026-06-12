import type { ReactNode } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import type { TaskItem } from "../../types/tasks";
import { TaskRow } from "./TaskRow";

export function TasksListSection({
  title,
  tasks,
  emptyMessage,
  tone = "default",
  headerAction,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  tasks: TaskItem[];
  emptyMessage: string;
  tone?: "default" | "danger" | "accent" | "muted";
  headerAction?: ReactNode;
  onToggle: (id: string) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3
          className={cn(
            "text-sm font-semibold tracking-tight",
            tone === "danger"
              ? "text-rose-600 dark:text-rose-400"
              : tone === "accent"
                ? "text-blue-600 dark:text-blue-400"
                : tone === "muted"
                  ? "text-[var(--app-muted)]"
                  : "text-[var(--app-text)]",
          )}
        >
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {headerAction}
          <span className="text-xs tabular-nums text-[var(--app-muted)]">
            {tasks.length}
          </span>
        </div>
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => onToggle(task.id)}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TasksEmptyState({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] px-6 py-16 text-center">
      <p className="text-sm font-medium text-[var(--app-text)]">{t("tasks.emptyTitle")}</p>
      <p className="mt-2 max-w-sm text-sm text-[var(--app-muted)]">{message}</p>
    </div>
  );
}
