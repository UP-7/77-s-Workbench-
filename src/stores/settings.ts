"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  nickname: string;
  city: string;
  setNickname: (v: string) => void;
  setCity: (v: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      nickname: "77",
      city: "北京",
      setNickname: (v) => set({ nickname: v.trim() || "77" }),
      setCity: (v) => set({ city: v.trim() || "北京" }),
    }),
    { name: "qiqi-settings" }
  )
);
