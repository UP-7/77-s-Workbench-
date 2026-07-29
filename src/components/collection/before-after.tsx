"use client";

import * as React from "react";
import { useMediaUrl } from "./media";
import { GitCompareArrows } from "lucide-react";

/**
 * 包浆 Before/After 滑块对比：两图叠加，拖动手柄改变分割位置。
 */
export function BeforeAfter({ beforeId, afterId }: { beforeId: string; afterId: string }) {
  const { url: beforeUrl } = useMediaUrl(beforeId);
  const { url: afterUrl } = useMediaUrl(afterId);
  const [percent, setPercent] = React.useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const updateFromClientX = React.useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(98, Math.max(2, p)));
  }, []);

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => dragging.current && updateFromClientX(e.clientX);
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateFromClientX]);

  if (!beforeUrl || !afterUrl) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
        <GitCompareArrows className="mr-1.5 h-4 w-4" /> 加载对比图…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] touch-none select-none overflow-hidden rounded-xl bg-black"
      onPointerDown={(e) => {
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beforeUrl} alt="Before" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${percent}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt="After" className="h-full w-full object-cover" draggable={false} />
      </div>
      {/* 分割线与手柄 */}
      <div className="absolute inset-y-0" style={{ left: `${percent}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" />
        <div className="absolute top-1/2 -ml-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <GitCompareArrows className="h-4 w-4" />
        </div>
      </div>
      <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
        Before · 早期
      </span>
      <span className="absolute right-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
        After · 现在
      </span>
    </div>
  );
}
