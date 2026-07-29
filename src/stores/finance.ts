"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceRecord } from "@/lib/types";
import { uid, todayStr } from "@/lib/utils";

interface FinanceState {
  records: FinanceRecord[];
  addRecord: (input: Omit<FinanceRecord, "id" | "createdAt" | "date"> & { date?: string }) => void;
  removeRecord: (id: string) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (input) =>
        set((s) => ({
          records: [
            {
              ...input,
              date: input.date ?? todayStr(),
              id: uid(),
              createdAt: Date.now(),
            },
            ...s.records,
          ],
        })),
      removeRecord: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
    }),
    { name: "qiqi-finance" }
  )
);

export function monthTotals(records: FinanceRecord[], month: string) {
  let expense = 0;
  let income = 0;
  for (const r of records) {
    if (!r.date.startsWith(month)) continue;
    if (r.type === "expense") expense += r.amount;
    else income += r.amount;
  }
  return { expense, income };
}

export function categorySummary(records: FinanceRecord[], month: string) {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.type !== "expense" || !r.date.startsWith(month)) continue;
    map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
