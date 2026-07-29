"use client";

import * as React from "react";
import { RefreshCw, Star, ExternalLink, Rss, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, Segmented, Empty } from "@/components/ui/misc";
import { ClientGate } from "@/components/client-gate";
import { useFeedStore } from "@/stores/feed";
import { cn, relativeTime, vibrate } from "@/lib/utils";
import type { FeedItem } from "@/lib/types";

const SOURCE_TONE: Record<string, string> = {
  "Hacker News": "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  "InfoQ 中文": "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  V2EX: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
};

function FeedCard({ item }: { item: FeedItem }) {
  const toggleFavorite = useFeedStore((s) => s.toggleFavorite);
  const fav = useFeedStore((s) => s.favorites.some((f) => f.id === item.id));

  return (
    <Card className="animate-fade-up">
      <CardContent className="p-4">
        <a href={item.link} target="_blank" rel="noopener noreferrer" className="block active:opacity-70">
          <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          )}
        </a>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={SOURCE_TONE[item.source] ?? "bg-muted text-muted-foreground"}>
              {item.source}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{relativeTime(item.publishedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label={fav ? "取消收藏" : "收藏"}
              onClick={() => {
                vibrate(15);
                toggleFavorite(item);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg active:scale-90"
            >
              <Star className={cn("h-5 w-5", fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/60")} />
            </button>
            <a
              aria-label="打开原文"
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 active:scale-90"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const [tab, setTab] = React.useState<"latest" | "fav">("latest");
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [offline, setOffline] = React.useState(false);
  const favorites = useFeedStore((s) => s.favorites);

  // 下拉刷新手势
  const [pull, setPull] = React.useState(0);
  const pulling = React.useRef(false);
  const startY = React.useRef(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feed");
      const data = await res.json();
      setItems(data.items ?? []);
      setOffline(Boolean(data.fallback));
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
      setPull(0);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0 && tab === "latest") {
      pulling.current = true;
      startY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 0) {
      setPull(Math.min(90, dy * 0.5));
    }
  };
  const onTouchEnd = () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull > 55) {
      vibrate(20);
      void load();
    } else {
      setPull(0);
    }
  };

  const list = tab === "latest" ? items : favorites;

  return (
    <div
      className="min-h-[calc(100dvh-3.5rem)] p-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <ClientGate>
        {/* 下拉指示器 */}
        <div
          className="flex items-center justify-center overflow-hidden transition-[height]"
          style={{ height: pull > 0 ? pull : loading && items.length > 0 ? 44 : 0 }}
        >
          <RefreshCw
            className={cn("h-5 w-5 text-primary", (loading || pull > 55) && "animate-spin")}
            style={{ transform: `rotate(${pull * 3}deg)` }}
          />
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Segmented
            className="flex-1"
            value={tab}
            onChange={setTab}
            options={[
              { label: "最新资讯", value: "latest" },
              { label: `收藏 ${favorites.length ? `(${favorites.length})` : ""}`, value: "fav" },
            ]}
          />
          <button
            aria-label="刷新"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground active:scale-90 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {offline && tab === "latest" && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <WifiOff className="h-4 w-4 shrink-0" />
            资讯源暂不可达，展示离线内容。下拉可重试。
          </div>
        )}

        {loading && items.length === 0 && tab === "latest" ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse-soft rounded-2xl bg-muted" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={tab === "fav" ? <Star className="h-10 w-10" /> : <Rss className="h-10 w-10" />}
            title={tab === "fav" ? "还没有收藏" : "暂无资讯"}
            hint={tab === "fav" ? "点击卡片上的星标收藏好文" : "下拉刷新试试"}
          />
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </ClientGate>
    </div>
  );
}
