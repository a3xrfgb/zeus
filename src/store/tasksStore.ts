import { create } from "zustand";
import { api } from "../lib/tauri";
import type {
  CreateTaskInput,
  ListTasksFilter,
  TaskItem,
  TaskStats,
  UpdateTaskInput,
} from "../types/tasks";

interface TasksState {
  tasks: TaskItem[];
  stats: TaskStats | null;
  loading: boolean;
  error: string | null;
  loadTasks: (filter?: ListTasksFilter) => Promise<void>;
  loadStats: () => Promise<void>;
  refresh: (filter?: ListTasksFilter) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<TaskItem | null>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<TaskItem | null>;
  deleteTask: (id: string) => Promise<boolean>;
  deleteManyTasks: (ids: string[]) => Promise<boolean>;
  toggleCompleted: (id: string) => Promise<TaskItem | null>;
  moveDueDate: (id: string, dueDate: string | null) => Promise<TaskItem | null>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  stats: null,
  loading: false,
  error: null,

  loadTasks: async (filter) => {
    set({ loading: true, error: null });
    try {
      const tasks = await api.listTasks(filter);
      set({ tasks, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  loadStats: async () => {
    try {
      const stats = await api.getTaskStats();
      set({ stats });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refresh: async (filter) => {
    await Promise.all([get().loadTasks(filter), get().loadStats()]);
  },

  createTask: async (input) => {
    set({ error: null });
    try {
      const task = await api.createTask(input);
      await get().refresh();
      return task;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  updateTask: async (id, input) => {
    set({ error: null });
    try {
      const task = await api.updateTask(id, input);
      await get().refresh();
      return task;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  deleteTask: async (id) => {
    set({ error: null });
    try {
      await api.deleteTask(id);
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: String(e) });
      return false;
    }
  },

  deleteManyTasks: async (ids) => {
    if (ids.length === 0) return true;
    set({ error: null });
    try {
      for (const id of ids) {
        await api.deleteTask(id);
      }
      await get().refresh();
      return true;
    } catch (e) {
      set({ error: String(e) });
      return false;
    }
  },

  toggleCompleted: async (id) => {
    set({ error: null });
    try {
      const task = await api.toggleTaskCompleted(id);
      await get().refresh();
      return task;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  moveDueDate: async (id, dueDate) => {
    set({ error: null });
    try {
      const task = await api.moveTaskDueDate(id, dueDate);
      await get().refresh();
      return task;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },
}));
