"use client";

import { create } from "zustand";
import { uid } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "heart";

interface ToastItem {
  id: string;
  text: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  push: (text: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, type = "success") => {
    const id = uid();
    set({ toasts: [...get().toasts, { id, text, type }].slice(-3) });
    setTimeout(() => get().remove(id), type === "error" ? 3500 : 2400);
  },
  remove: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function toast(text: string, type: ToastType = "success") {
  useToastStore.getState().push(text, type);
}
