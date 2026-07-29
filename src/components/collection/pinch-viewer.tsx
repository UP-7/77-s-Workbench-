"use client";

import * as React from "react";
import { X } from "lucide-react";

/**
 * 全屏大图查看器：支持双指捏合缩放（0.8x~5x）、单指拖移、双击缩放复位。
 */
export function PinchViewer({
  url,
  type,
  onClose,
}: {
  url: string;
  type: "image" | "video";
  onClose: () => void;
}) {
  const [transform, setTransform] = React.useState({ scale: 1, tx: 0, ty: 0 });
  const gesture = React.useRef({
    startDist: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    mode: "none" as "none" | "pan" | "pinch",
    lastTap: 0,
  });

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (e.touches.length === 2) {
      g.mode = "pinch";
      g.startDist = dist(e.touches);
      g.startScale = transform.scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - g.lastTap < 280) {
        // 双击：复位或放大到 2.2x
        setTransform((t) =>
          t.scale > 1.05 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2.2, tx: 0, ty: 0 }
        );
        g.lastTap = 0;
        return;
      }
      g.lastTap = now;
      g.mode = "pan";
      g.startX = e.touches[0].clientX;
      g.startY = e.touches[0].clientY;
      g.startTx = transform.tx;
      g.startTy = transform.ty;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (g.mode === "pinch" && e.touches.length === 2) {
      const ratio = dist(e.touches) / g.startDist;
      const scale = Math.min(5, Math.max(0.8, g.startScale * ratio));
      setTransform((t) => ({ ...t, scale }));
    } else if (g.mode === "pan" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      setTransform((t) => ({ ...t, tx: g.startTx + dx, ty: g.startTy + dy }));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (e.touches.length === 0) {
      g.mode = "none";
      setTransform((t) => (t.scale <= 1 ? { scale: Math.max(1, t.scale), tx: 0, ty: 0 } : t));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex touch-none items-center justify-center bg-black animate-fade-in"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur active:scale-90"
        style={{ marginTop: "env(safe-area-inset-top)" }}
      >
        <X className="h-5 w-5" />
      </button>
      <div
        style={{
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          transition: gesture.current.mode === "none" ? "transform 0.2s ease-out" : "none",
        }}
        className="max-h-full max-w-full"
      >
        {type === "video" ? (
          <video src={url} controls autoPlay playsInline className="max-h-[100dvh] max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-[100dvh] max-w-full select-none" draggable={false} />
        )}
      </div>
      <p className="pointer-events-none absolute bottom-8 text-center text-[11px] text-white/50">
        双指缩放 · 双击复位
      </p>
    </div>
  );
}
