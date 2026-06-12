import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  glassModalContentPositionWideClasses,
  glassModalOverlayClasses,
  glassModalPanelClasses,
} from "../../lib/appCanvasGlass";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { parseTagsInput, tagsToInput } from "../../lib/tasksUtils";
import type { TaskFormValues, TaskItem, TaskPriority } from "../../types/tasks";

const EMPTY_FORM: TaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
  dueTime: "",
  tags: "",
};

function taskToForm(task: TaskItem): TaskFormValues {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    dueTime: task.dueTime ?? "",
    tags: tagsToInput(task.tags),
  };
}

export function TaskFormModal({
  open,
  onOpenChange,
  task,
  defaultDueDate,
  onSubmit,
  onDelete,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskItem | null;
  defaultDueDate?: string;
  onSubmit: (values: TaskFormValues) => void | Promise<void>;
  onDelete?: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<TaskFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm(taskToForm(task));
    } else {
      setForm({
        ...EMPTY_FORM,
        dueDate: defaultDueDate ?? "",
      });
    }
  }, [open, task, defaultDueDate]);

  const submit = () => {
    if (!form.title.trim()) return;
    void onSubmit(form);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={glassModalOverlayClasses} />
        <Dialog.Content
          className={cn(glassModalContentPositionWideClasses, "w-[min(92vw,480px)]")}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className={cn(glassModalPanelClasses, "overflow-hidden px-5 pb-5 pt-6")}>
            <Dialog.Title className="text-center text-[1.05rem] font-medium tracking-[-0.02em] text-[var(--app-text)]">
              {task ? t("tasks.editTask") : t("tasks.newTask")}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-center text-[12px] leading-relaxed text-[var(--app-muted)]">
              {t("tasks.formHint")}
            </Dialog.Description>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  {t("tasks.fieldTitle")}
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={cn(
                    "w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[14px] text-[var(--app-text)] outline-none transition",
                    "border-[var(--app-text)]/10 placeholder:text-[var(--app-muted)]/70 focus:border-[var(--app-text)]/25",
                  )}
                  placeholder={t("tasks.titlePlaceholder")}
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  {t("tasks.fieldDescription")}
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={cn(
                    "w-full resize-none rounded-xl border bg-transparent px-3.5 py-2.5 text-[14px] text-[var(--app-text)] outline-none transition",
                    "border-[var(--app-text)]/10 placeholder:text-[var(--app-muted)]/70 focus:border-[var(--app-text)]/25",
                  )}
                  placeholder={t("tasks.descriptionPlaceholder")}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    {t("tasks.fieldPriority")}
                  </span>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priority: e.target.value as TaskPriority,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--app-text)]/10 bg-transparent px-3 py-2.5 text-[14px] text-[var(--app-text)] outline-none"
                  >
                    <option value="low">{t("tasks.priorityLow")}</option>
                    <option value="medium">{t("tasks.priorityMedium")}</option>
                    <option value="high">{t("tasks.priorityHigh")}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    {t("tasks.fieldDueDate")}
                  </span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--app-text)]/10 bg-transparent px-3 py-2.5 text-[14px] text-[var(--app-text)] outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    {t("tasks.fieldDueTime")}
                  </span>
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--app-text)]/10 bg-transparent px-3 py-2.5 text-[14px] text-[var(--app-text)] outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  {t("tasks.fieldTags")}
                </span>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  className={cn(
                    "w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[14px] text-[var(--app-text)] outline-none transition",
                    "border-[var(--app-text)]/10 placeholder:text-[var(--app-muted)]/70 focus:border-[var(--app-text)]/25",
                  )}
                  placeholder={t("tasks.tagsPlaceholder")}
                />
                {parseTagsInput(form.tags).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {parseTagsInput(form.tags).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--app-bg)] px-2 py-0.5 text-[11px] text-[var(--app-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              {onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("tasks.deleteTask")}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl px-4 py-2 text-sm text-[var(--app-muted)] transition hover:text-[var(--app-text)]"
                >
                  {t("tasks.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!form.title.trim() || submitting}
                  onClick={submit}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    "bg-[var(--app-text)] text-[var(--app-bg)] disabled:opacity-50",
                  )}
                >
                  {submitting ? t("tasks.saving") : task ? t("tasks.save") : t("tasks.create")}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { parseTagsInput };
