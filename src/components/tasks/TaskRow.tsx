import { Check, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  formatDueLabel,
  isOverdue,
  priorityClasses,
  priorityLabel,
} from "../../lib/tasksUtils";
import { cn } from "../../lib/utils";
import type { TaskItem } from "../../types/tasks";

export function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  draggable = true,
}: {
  task: TaskItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  draggable?: boolean;
}) {
  const { t } = useTranslation();
  const overdue = isOverdue(task);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group flex items-start gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3 transition",
        "hover:border-[var(--app-text)]/15 hover:bg-[var(--app-bg)]",
        task.completed && "opacity-70",
        overdue && !task.completed && "border-rose-500/30",
      )}
    >
      {draggable && (
        <GripVertical
          className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-[var(--app-muted)] opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={task.completed ? t("tasks.markIncomplete") : t("tasks.markComplete")}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
          task.completed
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "border-[var(--app-border)] hover:border-[var(--app-text)]/25",
        )}
      >
        {task.completed && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "text-sm font-medium text-[var(--app-text)]",
              task.completed && "line-through text-[var(--app-muted)]",
            )}
          >
            {task.title}
          </p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              priorityClasses(task.priority),
            )}
          >
            {priorityLabel(task.priority)}
          </span>
          {overdue && !task.completed && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
              {t("tasks.overdueBadge")}
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--app-muted)]">{task.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--app-muted)]">
          <span>{formatDueLabel(task)}</span>
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--app-surface)] px-2 py-0.5"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-[var(--app-muted)] transition hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
          aria-label={t("tasks.editTask")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-[var(--app-muted)] transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
          aria-label={t("tasks.deleteTask")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
