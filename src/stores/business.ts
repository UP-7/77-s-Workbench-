"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BizExpense, Gourd, GourdSale, GourdStatus } from "@/lib/types";
import { uid, todayStr, monthStr } from "@/lib/utils";

export interface BizConfig {
  label: string; // 商品名，如 葫芦/核桃/手串
  codePrefix: string; // 编号前缀
  varieties: string[]; // 品种/分类
}

const DEFAULT_CONFIG: BizConfig = {
  label: "葫芦",
  codePrefix: "HL",
  varieties: ["美国八宝", "本长手捻", "苹果肚", "蚂蚁肚", "异形", "大葫芦", "其他"],
};

/* ================= 批量库存派生工具 ================= */

/** 进货数量（老数据缺省 = 1） */
export function totalQty(g: Gourd): number {
  return Math.max(1, g.quantity ?? 1);
}

/** 售出流水（老数据的 status=sold + salePrice 归一化为一笔流水，读取端统一视角） */
export function salesOf(g: Gourd): GourdSale[] {
  if (g.sales && g.sales.length > 0) return g.sales;
  if (g.status === "sold" && typeof g.salePrice === "number") {
    return [{ id: `legacy-${g.id}`, qty: 1, unitPrice: g.salePrice, date: g.soldAt ?? todayStr() }];
  }
  return [];
}

/** 已售件数 */
export function soldQty(g: Gourd): number {
  return salesOf(g).reduce((s, x) => s + x.qty, 0);
}

/** 剩余件数 */
export function remainQty(g: Gourd): number {
  return Math.max(0, totalQty(g) - soldQty(g));
}

/** 单件摊薄成本（进货总价 + 运费，均摊到每件） */
export function unitCost(g: Gourd): number {
  return (g.costPrice + g.shippingCost) / totalQty(g);
}

/** 累计销售收入 */
export function revenueOf(g: Gourd): number {
  return salesOf(g).reduce((s, x) => s + x.qty * x.unitPrice, 0);
}

/** 已实现利润（只对卖出的部分计成本，未卖的不算） */
export function realizedProfit(g: Gourd): number {
  return revenueOf(g) - unitCost(g) * soldQty(g);
}

interface BusinessState {
  gourds: Gourd[];
  expenses: BizExpense[];
  config: BizConfig;
  updateConfig: (patch: Partial<BizConfig>) => void;
  addVariety: (v: string) => void;
  removeVariety: (v: string) => void;
  addGourd: (input: {
    name: string;
    variety: string;
    costPrice: number;
    shippingCost?: number;
    quantity?: number;
    note?: string;
  }) => void;
  updateGourd: (id: string, patch: Partial<Gourd>) => void;
  removeGourd: (id: string) => void;
  cycleStatus: (id: string) => void;
  /** 售出 qty 件，单价 unitPrice；卖光自动置为售罄 */
  addSale: (id: string, qty: number, unitPrice: number) => void;
  /** 删除一笔售出流水（记错时撤销），必要时恢复在库状态 */
  removeSale: (gourdId: string, saleId: string) => void;
  addExpense: (input: { name: string; amount: number; kind: BizExpense["kind"] }) => void;
  removeExpense: (id: string) => void;
}

function genCode(existing: Gourd[], prefix: string): string {
  const n = existing.length + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/** 写路径前的归一化：把老单件数据升级为流水模型（幂等） */
function normalized(g: Gourd): Gourd {
  if (g.sales && g.sales.length > 0) return g;
  const legacy = salesOf(g);
  if (legacy.length === 0) return g;
  return { ...g, sales: legacy, salePrice: undefined };
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      gourds: [],
      expenses: [],
      config: DEFAULT_CONFIG,
      updateConfig: (patch) =>
        set((s) => ({
          config: {
            ...s.config,
            ...patch,
            label: (patch.label ?? s.config.label).trim() || "商品",
            codePrefix:
              (patch.codePrefix ?? s.config.codePrefix).trim().toUpperCase().slice(0, 5) || "SP",
          },
        })),
      addVariety: (v) =>
        set((s) => {
          const name = v.trim();
          if (!name || s.config.varieties.includes(name)) return s;
          return { config: { ...s.config, varieties: [...s.config.varieties, name] } };
        }),
      removeVariety: (v) =>
        set((s) => ({
          config: { ...s.config, varieties: s.config.varieties.filter((x) => x !== v) },
        })),
      addGourd: (input) =>
        set((s) => ({
          gourds: [
            {
              id: uid(),
              code: genCode(s.gourds, s.config.codePrefix),
              name: input.name.trim(),
              variety: input.variety,
              status: "in_stock" as GourdStatus,
              costPrice: input.costPrice,
              shippingCost: input.shippingCost ?? 0,
              quantity: Math.max(1, Math.round(input.quantity ?? 1)),
              sales: [],
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
          gourds: s.gourds.map((raw) => {
            if (raw.id !== id) return raw;
            const g = normalized(raw);
            // 售罄的点击 → 恢复在库（撤销误操作，流水保留）；有剩余的在 在库↔预定 间切换
            if (g.status === "sold") return { ...g, status: "in_stock", soldAt: undefined };
            return { ...g, status: g.status === "in_stock" ? "reserved" : "in_stock" };
          }),
        })),
      addSale: (id, qty, unitPrice) =>
        set((s) => ({
          gourds: s.gourds.map((raw) => {
            if (raw.id !== id) return raw;
            const g = normalized(raw);
            const remain = remainQty(g);
            const q = Math.min(Math.max(1, Math.round(qty)), remain);
            if (q <= 0) return g;
            const sales = [
              ...(g.sales ?? []),
              { id: uid(), qty: q, unitPrice, date: todayStr() },
            ];
            const soldOut = totalQty(g) - sales.reduce((x, y) => x + y.qty, 0) <= 0;
            return {
              ...g,
              sales,
              status: soldOut ? ("sold" as GourdStatus) : ("in_stock" as GourdStatus),
              soldAt: soldOut ? todayStr() : undefined,
              reservedBy: soldOut ? undefined : g.reservedBy,
            };
          }),
        })),
      removeSale: (gourdId, saleId) =>
        set((s) => ({
          gourds: s.gourds.map((raw) => {
            if (raw.id !== gourdId) return raw;
            const g = normalized(raw);
            const sales = (g.sales ?? []).filter((x) => x.id !== saleId);
            const soldOut = totalQty(g) - sales.reduce((x, y) => x + y.qty, 0) <= 0;
            return {
              ...g,
              sales,
              status: soldOut ? ("sold" as GourdStatus) : g.status === "sold" ? "in_stock" : g.status,
              soldAt: soldOut ? g.soldAt : undefined,
            };
          }),
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

/* ================= 统计选择器 ================= */

/** 近 N 个月的利润趋势：按每笔售出流水归月，成本按件摊薄；经营支出计入当月 */
export function profitTrend(gourds: Gourd[], expenses: BizExpense[], months = 6) {
  const list: { month: string; label: string; profit: number; revenue: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = monthStr(d);
    let revenue = 0;
    let cost = 0;
    for (const g of gourds) {
      const uc = unitCost(g);
      for (const sale of salesOf(g)) {
        if (sale.date.startsWith(m)) {
          revenue += sale.qty * sale.unitPrice;
          cost += uc * sale.qty;
        }
      }
    }
    for (const e of expenses) {
      if (e.date.startsWith(m)) cost += e.amount;
    }
    list.push({
      month: m,
      label: months > 6 ? `${d.getMonth() + 1}` : `${d.getMonth() + 1}月`,
      profit: Math.round((revenue - cost) * 100) / 100,
      revenue,
    });
  }
  return list;
}

/** 年度汇总：某年销售收入、摊薄销货成本、经营支出与净利润 */
export function yearSummary(gourds: Gourd[], expenses: BizExpense[], year: number) {
  const y = String(year);
  let revenue = 0;
  let goodsCost = 0;
  let soldCount = 0;
  for (const g of gourds) {
    const uc = unitCost(g);
    for (const sale of salesOf(g)) {
      if (sale.date.startsWith(y)) {
        revenue += sale.qty * sale.unitPrice;
        goodsCost += uc * sale.qty;
        soldCount += sale.qty;
      }
    }
  }
  const expense = expenses.filter((e) => e.date.startsWith(y)).reduce((s, e) => s + e.amount, 0);
  return {
    revenue,
    cost: goodsCost + expense,
    profit: revenue - goodsCost - expense,
    soldCount,
  };
}

/** 最畅销品种统计（按售出件数） */
export function bestSellers(gourds: Gourd[]) {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const g of gourds) {
    const sales = salesOf(g);
    if (sales.length === 0) continue;
    const cur = map.get(g.variety) ?? { count: 0, revenue: 0 };
    for (const sale of sales) {
      cur.count += sale.qty;
      cur.revenue += sale.qty * sale.unitPrice;
    }
    map.set(g.variety, cur);
  }
  return Array.from(map.entries())
    .map(([variety, v]) => ({ variety, ...v }))
    .sort((a, b) => b.count - a.count);
}
