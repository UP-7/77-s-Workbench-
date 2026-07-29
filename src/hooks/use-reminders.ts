"use client";

import { useEffect } from "react";
import { usePlannerStore } from "@/stores/planner";
import { notify } from "@/lib/notifications";
import { todayStr } from "@/lib/utils";

/**
 * 待办提醒调度：应用打开期间每 20s 轮询一次，
 * 到点（含错过的）且未通知的待办触发系统通知 + 震动。
 */
export function useReminders() {
  useEffect(() => {
    const check = () => {
      const { todos, markNotified } = usePlannerStore.getState();
      const now = new Date();
      const today = todayStr(now);
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      for (const t of todos) {
        if (t.done || !t.remind || t.notified || !t.time) continue;
        if (t.date < today || (t.date === today && t.time <= hhmm)) {
          void notify("⏰ 待办提醒", `${t.title}（${t.time}）`, `todo-${t.id}`);
          markNotified(t.id);
        }
      }
    };
    check();
    const timer = setInterval(check, 20_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
