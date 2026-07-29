"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Todo } from "@/lib/types";
import { uid } from "@/lib/utils";

interface PlannerState {
  todos: Todo[];
  addTodo: (input: { title: string; date: string; time?: string; remind?: boolean }) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  updateTodo: (id: string, patch: Partial<Todo>) => void;
  markNotified: (id: string) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      todos: [],
      addTodo: ({ title, date, time, remind }) =>
        set((s) => ({
          todos: [
            {
              id: uid(),
              title: title.trim(),
              date,
              time,
              remind: Boolean(remind && time),
              notified: false,
              done: false,
              createdAt: Date.now(),
            },
            ...s.todos,
          ],
        })),
      toggleTodo: (id) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id
              ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined }
              : t
          ),
        })),
      removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
      updateTodo: (id, patch) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      markNotified: (id) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, notified: true } : t)) })),
    }),
    { name: "qiqi-planner" }
  )
);
