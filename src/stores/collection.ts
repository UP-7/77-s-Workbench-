"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CollectionItem } from "@/lib/types";
import { uid, todayStr } from "@/lib/utils";

interface CollectionState {
  items: CollectionItem[];
  addItem: (input: {
    name: string;
    category: string;
    price?: number;
    acquiredAt?: string;
    patina?: string;
    notes?: string;
    humidityCare?: boolean;
  }) => string;
  updateItem: (id: string, patch: Partial<CollectionItem>) => void;
  removeItem: (id: string) => void;
  /** 开始盘玩计时（记录起点时间戳，后台运行安全） */
  startPlaying: (id: string) => void;
  /** 停止计时并累加时长 */
  stopPlaying: (id: string) => number;
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (input) => {
        const id = uid();
        set((s) => ({
          items: [
            {
              id,
              name: input.name.trim(),
              category: input.category,
              price: input.price,
              acquiredAt: input.acquiredAt ?? todayStr(),
              patina: input.patina ?? "",
              notes: input.notes ?? "",
              humidityCare: input.humidityCare ?? true,
              playSeconds: 0,
              playingSince: null,
              createdAt: Date.now(),
            },
            ...s.items,
          ],
        }));
        return id;
      },
      updateItem: (id, patch) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      startPlaying: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, playingSince: Date.now() } : i)),
        })),
      stopPlaying: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item || !item.playingSince) return 0;
        const gained = Math.max(0, Math.round((Date.now() - item.playingSince) / 1000));
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, playSeconds: i.playSeconds + gained, playingSince: null }
              : i
          ),
        }));
        return gained;
      },
    }),
    { name: "qiqi-collection" }
  )
);
