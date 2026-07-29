"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FeedItem } from "@/lib/types";

interface FeedState {
  favorites: FeedItem[];
  toggleFavorite: (item: FeedItem) => void;
  isFavorite: (id: string) => boolean;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (item) =>
        set((s) => {
          const exists = s.favorites.some((f) => f.id === item.id);
          return {
            favorites: exists
              ? s.favorites.filter((f) => f.id !== item.id)
              : [item, ...s.favorites],
          };
        }),
      isFavorite: (id) => get().favorites.some((f) => f.id === id),
    }),
    { name: "qiqi-feed-favorites" }
  )
);
