"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  CalendarCheck2,
  Wallet,
  Store,
  ChevronRight,
  CloudSun,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ClientGate } from "@/components/client-gate";
import { Fab } from "@/components/fab";
import { usePlannerStore } from "@/stores/planner";
import { useFinanceStore, monthTotals } from "@/stores/finance";
import { useBusinessStore } from "@/stores/business";
import { useCollectionStore } from "@/stores/collection";
import { useSettingsStore } from "@/stores/settings";
import { fetchWeather, type WeatherNow } from "@/lib/weather";
import { fmtMoney, todayStr, monthStr } from "@/lib/utils";

function useTodayInsight() {
  const [text, setText] = React.useState<string>("");
  const [source, setSource] = React.useState<"ai" | "local" | "">("");
  const [loading, setLoading] = React.useState(false);
  const [weather, setWeather] = React.useState<WeatherNow | null>(null);

  const generate = React.useCallback(async (force = false) => {
    const cacheKey = `qiqi-insight-${todayStr()}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const c = JSON.parse(cached);
          setText(c.text);
          setSource(c.source);
          setWeather(c.weather ?? null);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    try {
      const { nickname, city } = useSettingsStore.getState();
      const w = await fetchWeather(city);
      setWeather(w);

      const todos = usePlannerStore.getState().todos.filter((t) => t.date === todayStr());
      const records = useFinanceStore.getState().records;
      const gourds = useBusinessStore.getState().gourds;
      const collection = useCollectionStore.getState().items;

      const payload = {
        nickname,
        city,
        weather: w,
        todosToday: todos.slice(0, 6).map((t) => t.title),
        doneCount: todos.filter((t) => t.done).length,
        totalCount: todos.length,
        monthExpense: monthTotals(records, monthStr()).expense,
        collectionAlerts: collection.filter((c) => c.humidityCare).slice(0, 3).map((c) => c.name),
        stockCount: gourds.filter((g) => g.status === "in_stock").length,
      };

      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setText(data.text);
      setSource(data.source);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ ...data, weather: w }));
      } catch {
        /* ignore */
      }
    } catch {
      setText("网络暂不可用，本地待办与账本依然随时可用。");
      setSource("local");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void generate();
  }, [generate]);

  return { text, source, loading, weather, refresh: () => generate(true) };
}

function InsightCard() {
  const { text, source, loading, weather, refresh } = useTodayInsight();
  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-lg">
      <CardContent className="p-5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest opacity-90">
            <Sparkles className="h-3.5 w-3.5" />
            Today&apos;s Insight · AI 晨报
          </div>
          <button
            aria-label="重新生成"
            onClick={refresh}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 active:scale-90 disabled:opacity-60"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </button>
        </div>
        <p className="min-h-[3.5rem] text-[15px] font-medium leading-relaxed">
          {loading && !text ? "正在为你准备今日晨报…" : text || "…"}
        </p>
        <div className="mt-3 flex items-center justify-between text-[11px] opacity-85">
          <span className="flex items-center gap-1">
            <CloudSun className="h-3.5 w-3.5" />
            {weather ? `${weather.desc} ${Math.round(weather.tempC)}°C · 湿度 ${weather.humidity}%` : "天气获取中…"}
          </span>
          <span>{source === "ai" ? "DeepSeek 生成" : source === "local" ? "离线模式" : ""}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewCards() {
  const todos = usePlannerStore((s) => s.todos);
  const records = useFinanceStore((s) => s.records);
  const gourds = useBusinessStore((s) => s.gourds);

  const today = todayStr();
  const todayTodos = todos.filter((t) => t.date === today);
  const done = todayTodos.filter((t) => t.done).length;
  const rate = todayTodos.length ? Math.round((done / todayTodos.length) * 100) : 0;
  const { expense } = monthTotals(records, monthStr());
  const inStock = gourds.filter((g) => g.status === "in_stock").length;
  const reserved = gourds.filter((g) => g.status === "reserved").length;
  const lowStock = inStock <= 2;

  const items = [
    {
      href: "/planner",
      icon: CalendarCheck2,
      label: "今日待办",
      value: todayTodos.length ? `${done}/${todayTodos.length}` : "无安排",
      sub: todayTodos.length ? `完成率 ${rate}%` : "点击添加",
      tone: "text-accent",
      bar: rate,
    },
    {
      href: "/finance",
      icon: Wallet,
      label: "本月支出",
      value: fmtMoney(expense),
      sub: "收支账本",
      tone: "text-primary",
    },
    {
      href: "/business",
      icon: Store,
      label: "葫芦库存",
      value: `${inStock} 只在库`,
      sub: lowStock ? "库存偏低，该补货了" : `另有 ${reserved} 只已预定`,
      tone: lowStock ? "text-destructive" : "text-success",
      warn: lowStock,
    },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="block">
          <Card className="transition-transform active:scale-[0.98]">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="truncate text-lg font-bold leading-tight">{item.value}</p>
                <p className={`text-xs ${item.warn ? "text-destructive" : "text-muted-foreground"}`}>
                  {item.sub}
                </p>
                {typeof item.bar === "number" && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${item.bar}%` }}
                    />
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4">
      <ClientGate>
        <InsightCard />
        <OverviewCards />
        <Fab />
      </ClientGate>
    </div>
  );
}
