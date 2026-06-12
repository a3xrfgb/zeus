import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  addDays,
  monthGridDays,
  priorityClasses,
  tasksForDate,
  todayIso,
  weekDays,
} from "../../lib/tasksUtils";
import { cn } from "../../lib/utils";
import type { CalendarViewMode, TaskItem } from "../../types/tasks";

function dateLabel(iso: string, mode: CalendarViewMode): string {
  const d = new Date(`${iso}T12:00:00`);
  if (mode === "day") {
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (mode === "week") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return String(d.getDate());
}

function monthTitle(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function weekTitle(startIso: string): string {
  const start = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${addDays(startIso, 6)}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: start.getFullYear() !== end.getFullYear() ? "numeric" : undefined,
  });
  return `${startStr} – ${endStr}`;
}

function CalendarTaskChip({
  task,
  onClick,
}: {
  task: TaskItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition hover:opacity-90",
        priorityClasses(task.priority),
        task.completed && "line-through opacity-60",
      )}
    >
      {task.dueTime ? `${task.dueTime} ` : ""}
      {task.title}
    </button>
  );
}

function DropCell({
  iso,
  children,
  onMoveTask,
  className,
  isToday,
  muted,
}: {
  iso: string;
  children: ReactNode;
  onMoveTask: (taskId: string, dueDate: string) => void;
  className?: string;
  isToday?: boolean;
  muted?: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/task-id");
        if (id) onMoveTask(id, iso);
      }}
      className={cn(
        "min-h-[4.5rem] rounded-lg border p-1.5 transition",
        isToday
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-[var(--app-border)] bg-[var(--app-bg)]/40",
        muted && "opacity-50",
        over && "border-[var(--app-text)]/30 bg-[var(--app-surface)] ring-2 ring-[var(--app-text)]/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TasksCalendar({
  tasks,
  onTaskClick,
  onMoveTask,
}: {
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
  onMoveTask: (taskId: string, dueDate: string) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = useState(todayIso());
  const today = todayIso();

  const scheduled = useMemo(
    () => tasks.filter((task) => Boolean(task.dueDate)),
    [tasks],
  );

  const navigate = (delta: number) => {
    if (mode === "month") {
      const d = new Date(`${anchor}T12:00:00`);
      d.setMonth(d.getMonth() + delta);
      setAnchor(d.toISOString().slice(0, 10));
    } else if (mode === "week") {
      setAnchor(addDays(anchor, delta * 7));
    } else {
      setAnchor(addDays(anchor, delta));
    }
  };

  const header =
    mode === "month"
      ? monthTitle(anchor)
      : mode === "week"
        ? weekTitle(weekDays(anchor)[0]!)
        : dateLabel(anchor, "day");

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text)]">
            {t("tasks.calendar")}
          </h3>
          <p className="text-xs text-[var(--app-muted)]">{t("tasks.calendarHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--app-border)] p-0.5">
            {(["month", "week", "day"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                  mode === m
                    ? "bg-[var(--app-text)] text-[var(--app-bg)]"
                    : "text-[var(--app-muted)] hover:text-[var(--app-text)]",
                )}
              >
                {t(`tasks.view${m.charAt(0).toUpperCase()}${m.slice(1)}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-[var(--app-border)] p-1.5 text-[var(--app-muted)] hover:text-[var(--app-text)]"
              aria-label={t("tasks.prevPeriod")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchor(today)}
              className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text)]"
            >
              {t("tasks.today")}
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="rounded-lg border border-[var(--app-border)] p-1.5 text-[var(--app-muted)] hover:text-[var(--app-text)]"
              aria-label={t("tasks.nextPeriod")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--app-border)] px-4 py-2">
        <p className="text-sm font-medium text-[var(--app-text)]">{header}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {mode === "month" && (
          <div className="grid grid-cols-7 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]"
              >
                {d}
              </div>
            ))}
            {monthGridDays(anchor).map((iso) => {
              const inMonth =
                new Date(`${iso}T12:00:00`).getMonth() ===
                new Date(`${anchor}T12:00:00`).getMonth();
              const dayTasks = tasksForDate(scheduled, iso);
              return (
                <DropCell
                  key={iso}
                  iso={iso}
                  isToday={iso === today}
                  muted={!inMonth}
                  onMoveTask={onMoveTask}
                  className="min-h-[5.5rem]"
                >
                  <p
                    className={cn(
                      "mb-1 text-[11px] font-medium",
                      iso === today
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-[var(--app-muted)]",
                    )}
                  >
                    {dateLabel(iso, "month")}
                  </p>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <CalendarTaskChip
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(task)}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="px-1 text-[10px] text-[var(--app-muted)]">
                        +{dayTasks.length - 3} {t("tasks.more")}
                      </p>
                    )}
                  </div>
                </DropCell>
              );
            })}
          </div>
        )}

        {mode === "week" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
            {weekDays(anchor).map((iso) => {
              const dayTasks = tasksForDate(scheduled, iso);
              return (
                <div key={iso} className="min-w-0">
                  <p
                    className={cn(
                      "mb-2 text-xs font-semibold",
                      iso === today
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-[var(--app-text)]",
                    )}
                  >
                    {dateLabel(iso, "week")}
                  </p>
                  <DropCell
                    iso={iso}
                    isToday={iso === today}
                    onMoveTask={onMoveTask}
                    className="min-h-[12rem]"
                  >
                    {dayTasks.length === 0 ? (
                      <p className="py-4 text-center text-[10px] text-[var(--app-muted)]">
                        {t("tasks.noTasksDay")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayTasks.map((task) => (
                          <CalendarTaskChip
                            key={task.id}
                            task={task}
                            onClick={() => onTaskClick(task)}
                          />
                        ))}
                      </div>
                    )}
                  </DropCell>
                </div>
              );
            })}
          </div>
        )}

        {mode === "day" && (
          <DropCell
            iso={anchor}
            isToday={anchor === today}
            onMoveTask={onMoveTask}
            className="min-h-[20rem]"
          >
            {tasksForDate(scheduled, anchor).length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--app-muted)]">
                {t("tasks.noTasksDay")}
              </p>
            ) : (
              <div className="space-y-2">
                {tasksForDate(scheduled, anchor).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3"
                  >
                    <CalendarTaskChip task={task} onClick={() => onTaskClick(task)} />
                    {task.description && (
                      <p className="mt-2 text-xs text-[var(--app-muted)]">{task.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DropCell>
        )}
      </div>
    </div>
  );
}
