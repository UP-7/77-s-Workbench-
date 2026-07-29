"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BizExpense, Gourd, GourdStatus } from "@/lib/types";
import { uid, todayStr, monthStr } from "@/lib/utils";

interface BusinessState {
  gourds: Gourd[];
  expenses: BizExpense[];
  addGourd: (input: {
    name: string;
    variety: string;
    costPrice: number;
    shippingCost?: number;
    note?: string;
  }) => void;
  updateGourd: (id: string, patch: Partial<Gourd>) => void;
  removeGourd: (id: string) => void;
  cycleStatus: (id: string) => void;
  markSold: (id: string, salePrice: number) => void;
  addExpense: (input: { name: string; amount: number; kind: BizExpense["kind"] }) => void;
  removeExpense: (id: string) => void;
}

const STATUS_CYCLE: GourdStatus[] = ["in_stock", "reserved", "sold"];

function genCode(existing: Gourd[]): string {
  const n = existing.length + 1;
  return `HL-${String(n).padStart(4, "0")}`;
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      gourds: [],
      expenses: [],
      addGourd: (input) =>
        set((s) => ({
          gourds: [
            {
              id: uid(),
              code: genCode(s.gourds),
              name: input.name.trim(),
              variety: input.variety,
              status: "in_stock" as GourdStatus,
              costPrice: input.costPrice,
              shippingCost: input.shippingCost ?? 0,
              note: input.note,
              createdAt: Date.now(),
            },
            ...s.gourds,
          ],
        })),
      updateGourd: (id, patch) =>
        set((s) => ({ gourds: s.gourds.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      removeGourd: (id) => set((s) => ({ gourds: s.gourds.filter((g) => g.id !== id) })),
      cycleStatus: (id) =>
        set((s) => ({
          gourds: s.gourds.map((g) => {
            if (g.id !== id) return g;
            const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(g.status) + 1) % STATUS_CYCLE.length];
            return {
              ...g,
              status: next,
              soldAt: next === "sold" ? g.soldAt ?? todayStr() : undefined,
            };
          }),
        })),
      markSold: (id, salePrice) =>
        set((s) => ({
          gourds: s.gourds.map((g) =>
            g.id === id ? { ...g, status: "sold" as GourdStatus, salePrice, soldAt: todayStr() } : g
          ),
        })),
      addExpense: (input) =>
        set((s) => ({
          expenses: [
            { id: uid(), name: input.name, amount: input.amount, kind: input.kind, date: todayStr() },
            ...s.expenses,
          ],
        })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
    }),
    { name: "qiqi-business" }
  )
);

/** 近 N 个月的利润趋势（销售收入 - 成本 - 经营支出） */
export function profitTrend(gourds: Gourd[], expenses: BizExpense[], months = 6) {
  const list: { month: string; label: string; profit: number; revenue: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = monthStr(d);
    let revenue = 0;
    let cost = 0;
    for (const g of gourds) {
      if (g.status === "sold" && g.soldAt?.startsWith(m)) {
        revenue += g.salePrice ?? 0;
        cost += g.costPrice + g.shippingCost;
      }
    }
    for (const e of expenses) {
      if (e.date.startsWith(m)) cost += e.amount;
    }
    list.push({ month: m, label: `${d.getMonth() + 1}月`, profit: revenue - cost, revenue });
  }
  return list;
}

/** 最畅销品种统计 */
export function bestSellers(gourds: Gourd[]) {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const g of gourds) {
    if (g.status !== "sold") continue;
    const cur = map.get(g.variety) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += g.salePrice ?? 0;
    map.set(g.variety, cur);
  }
  return Array.from(map.entries())
    .map(([variety, v]) => ({ variety, ...v }))
    .sort((a, b) => b.count - a.count);
}
