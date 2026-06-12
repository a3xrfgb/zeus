export type TaskPriority = "low" | "medium" | "high";

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  completed: boolean;
  dueDate: string | null;
  dueTime: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: string[];
}

export interface UpdateTaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  completed: boolean;
  dueDate: string | null;
  dueTime: string | null;
  tags: string[];
}

export interface ListTasksFilter {
  search?: string;
  priority?: TaskPriority;
  completed?: boolean;
  tag?: string;
}

export type CalendarViewMode = "month" | "week" | "day";

export interface TaskFormValues {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  tags: string;
}
