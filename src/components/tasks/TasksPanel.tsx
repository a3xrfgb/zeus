import { AlertCircle, CalendarDays, CheckCircle2, Clock, ListTodo, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  allTagsFromTasks,
  isOverdue,
  isToday,
  isUpcoming,
  sortCompletedTasks,
  taskMatchesFilter,
} from "../../lib/tasksUtils";
import { cn } from "../../lib/utils";
import { useTasksStore } from "../../store/tasksStore";
import { useUiStore } from "../../store/uiStore";
import type { TaskFormValues, TaskItem, TaskPriority } from "../../types/tasks";
import { parseTagsInput, TaskFormModal } from "./TaskFormModal";
import { TasksCalendar } from "./TasksCalendar";
import { TasksEmptyState, TasksListSection } from "./TasksListSection";
import { TasksSearchFilter } from "./TasksSearchFilter";
import { TasksSummaryCard } from "./TasksSummaryCards";

export function TasksPanel() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const tasks = useTasksStore((s) => s.tasks);
  const stats = useTasksStore((s) => s.stats);
  const loading = useTasksStore((s) => s.loading);
  const error = useTasksStore((s) => s.error);
  const refresh = useTasksStore((s) => s.refresh);
  const createTask = useTasksStore((s) => s.createTask);
  const updateTask = useTasksStore((s) => s.updateTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const deleteManyTasks = useTasksStore((s) => s.deleteManyTasks);
  const toggleCompleted = useTasksStore((s) => s.toggleCompleted);
  const moveDueDate = useTasksStore((s) => s.moveDueDate);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const [status, setStatus] = useState<"all" | "pending" | "completed">("all");
  const [tag, setTag] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [defaultDueDate, setDefaultDueDate] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => taskMatchesFilter(task, search, priority, status, tag)),
    [tasks, search, priority, status, tag],
  );

  const overdueTasks = useMemo(
    () => filteredTasks.filter((task) => isOverdue(task)),
    [filteredTasks],
  );
  const todayTasks = useMemo(
    () => filteredTasks.filter((task) => isToday(task) && !task.completed),
    [filteredTasks],
  );
  const upcomingTasks = useMemo(
    () => filteredTasks.filter((task) => isUpcoming(task)),
    [filteredTasks],
  );
  const completedTasks = useMemo(
    () => sortCompletedTasks(filteredTasks),
    [filteredTasks],
  );

  const showActiveSections = status !== "completed";
  const showCompletedSection = status !== "pending";

  const allTags = useMemo(() => allTagsFromTasks(tasks), [tasks]);

  const openCreate = useCallback((dueDate?: string) => {
    setEditingTask(null);
    setDefaultDueDate(dueDate);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((task: TaskItem) => {
    setEditingTask(task);
    setDefaultDueDate(undefined);
    setModalOpen(true);
  }, []);

  const handleSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      priority: values.priority,
      dueDate: values.dueDate || null,
      dueTime: values.dueTime || null,
      tags: parseTagsInput(values.tags),
    };
    const result = editingTask
      ? await updateTask(editingTask.id, {
          ...payload,
          completed: editingTask.completed,
        })
      : await createTask(payload);
    setSubmitting(false);
    if (result) {
      setModalOpen(false);
      pushToast(editingTask ? t("tasks.updatedToast") : t("tasks.createdToast"), "success");
    } else {
      pushToast(t("tasks.errorToast"), "error");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteTask(id);
    if (ok) {
      if (editingTask?.id === id) {
        setModalOpen(false);
        setEditingTask(null);
      }
      pushToast(t("tasks.deletedToast"), "success");
    } else {
      pushToast(t("tasks.errorToast"), "error");
    }
  };

  const handleClearCompleted = async () => {
    const ids = completedTasks.map((task) => task.id);
    const ok = await deleteManyTasks(ids);
    if (ok) pushToast(t("tasks.clearedCompletedToast"), "success");
    else pushToast(t("tasks.errorToast"), "error");
  };

  const handleMove = async (taskId: string, dueDate: string) => {
    const result = await moveDueDate(taskId, dueDate);
    if (result) pushToast(t("tasks.movedToast"), "success");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">
                {t("tasks.title")}
              </h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">{t("tasks.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-text)] transition hover:bg-[var(--app-bg)] disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                {t("tasks.refresh")}
              </button>
              <button
                type="button"
                onClick={() => openCreate()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-text)] px-4 py-2 text-sm font-medium text-[var(--app-bg)] transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {t("tasks.newTask")}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TasksSummaryCard
              title={t("tasks.statsTotal")}
              value={stats?.total ?? (loading ? "—" : 0)}
              hint={t("tasks.statsTotalHint")}
              icon={<ListTodo className="h-4 w-4" />}
              accent="blue"
            />
            <TasksSummaryCard
              title={t("tasks.statsCompleted")}
              value={stats?.completed ?? (loading ? "—" : 0)}
              hint={t("tasks.statsCompletedHint")}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="green"
            />
            <TasksSummaryCard
              title={t("tasks.statsPending")}
              value={stats?.pending ?? (loading ? "—" : 0)}
              hint={t("tasks.statsPendingHint")}
              icon={<Clock className="h-4 w-4" />}
              accent="amber"
            />
            <TasksSummaryCard
              title={t("tasks.statsOverdue")}
              value={stats?.overdue ?? (loading ? "—" : 0)}
              hint={t("tasks.statsOverdueHint")}
              icon={<CalendarDays className="h-4 w-4" />}
              accent="rose"
            />
          </div>

          <TasksSearchFilter
            search={search}
            onSearchChange={setSearch}
            priority={priority}
            onPriorityChange={setPriority}
            status={status}
            onStatusChange={setStatus}
            tag={tag}
            onTagChange={setTag}
            tags={allTags}
          />

          {loading && tasks.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-[var(--app-muted)]">
              {t("tasks.loading")}
            </div>
          ) : tasks.length === 0 ? (
            <TasksEmptyState message={t("tasks.emptyMessage")} />
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-6">
                {showActiveSections && (
                  <>
                    <TasksListSection
                      title={t("tasks.sectionOverdue")}
                      tasks={overdueTasks}
                      emptyMessage={t("tasks.emptyOverdue")}
                      tone="danger"
                      onToggle={(id) => void toggleCompleted(id)}
                      onEdit={openEdit}
                      onDelete={(id) => void handleDelete(id)}
                    />
                    <TasksListSection
                      title={t("tasks.sectionToday")}
                      tasks={todayTasks}
                      emptyMessage={t("tasks.emptyToday")}
                      tone="accent"
                      onToggle={(id) => void toggleCompleted(id)}
                      onEdit={openEdit}
                      onDelete={(id) => void handleDelete(id)}
                    />
                    <TasksListSection
                      title={t("tasks.sectionUpcoming")}
                      tasks={upcomingTasks}
                      emptyMessage={t("tasks.emptyUpcoming")}
                      onToggle={(id) => void toggleCompleted(id)}
                      onEdit={openEdit}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  </>
                )}
                {showCompletedSection && (
                  <TasksListSection
                    title={t("tasks.sectionCompleted")}
                    tasks={completedTasks}
                    emptyMessage={t("tasks.emptyCompleted")}
                    tone="muted"
                    headerAction={
                      completedTasks.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleClearCompleted()}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--app-muted)] transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          {t("tasks.clearCompleted")}
                        </button>
                      ) : undefined
                    }
                    onToggle={(id) => void toggleCompleted(id)}
                    onEdit={openEdit}
                    onDelete={(id) => void handleDelete(id)}
                  />
                )}
              </div>
              <TasksCalendar
                tasks={filteredTasks}
                onTaskClick={openEdit}
                onMoveTask={(id, date) => void handleMove(id, date)}
              />
            </div>
          )}
        </div>
      </div>

      <TaskFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        defaultDueDate={defaultDueDate}
        onSubmit={handleSubmit}
        onDelete={
          editingTask?.completed
            ? () => void handleDelete(editingTask.id)
            : undefined
        }
        submitting={submitting}
      />
    </div>
  );
}
