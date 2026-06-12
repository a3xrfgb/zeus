import type { TaskItem, TaskPriority } from "../types/tasks";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(task: TaskItem): boolean {
  if (task.completed || !task.dueDate) return false;
  return task.dueDate < todayIso();
}

export function isToday(task: TaskItem): boolean {
  if (!task.dueDate) return false;
  return task.dueDate === todayIso();
}

export function isUpcoming(task: TaskItem): boolean {
  if (task.completed || !task.dueDate) return false;
  return task.dueDate > todayIso();
}

export function sortCompletedTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks]
    .filter((task) => task.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

export function priorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "high":
      return "High";
    default:
      return "Medium";
  }
}

export function priorityClasses(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
    case "high":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    default:
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }
}

export function formatDueLabel(task: TaskItem): string {
  if (!task.dueDate) return "No due date";
  const date = new Date(`${task.dueDate}T12:00:00`);
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  if (task.dueTime) return `${dateStr} · ${task.dueTime}`;
  return dateStr;
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function monthGridDays(anchorIso: string): string[] {
  const anchor = new Date(`${anchorIso}T12:00:00`);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const offset = startDay === 0 ? 6 : startDay - 1;
  const start = new Date(year, month, 1 - offset);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function weekDays(anchorIso: string): string[] {
  const start = startOfWeek(anchorIso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function allTagsFromTasks(tasks: TaskItem[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    for (const tag of t.tags) set.add(tag);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function taskMatchesFilter(
  task: TaskItem,
  search: string,
  priority: TaskPriority | "all",
  status: "all" | "pending" | "completed",
  tag: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (q) {
    const hay = `${task.title} ${task.description} ${task.tags.join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (priority !== "all" && task.priority !== priority) return false;
  if (status === "pending" && task.completed) return false;
  if (status === "completed" && !task.completed) return false;
  if (tag && !task.tags.includes(tag)) return false;
  return true;
}

export function tasksForDate(tasks: TaskItem[], iso: string): TaskItem[] {
  return tasks.filter((t) => t.dueDate === iso);
}
