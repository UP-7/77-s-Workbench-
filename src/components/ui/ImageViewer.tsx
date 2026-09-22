"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * 全屏图片查看器：双指捏合缩放、双击放大/还原、拖拽平移、滚轮缩放。
 */
export default function ImageViewer({
  url,
  alt = "预览",
  onClose,
}: {
  url: string | null;
  alt?: string;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const state = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number; cx: number; cy: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const moved = useRef(false);

  const apply = () => {
    const { scale, tx, ty } = state.current;
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
  };

  const reset = () => {
    state.current = { scale: 1, tx: 0, ty: 0 };
    apply();
  };

  const zoomAt = (next: number, cx: number, cy: number) => {
    const s = state.current;
    const clamped = Math.min(6, Math.max(1, next));
    const k = clamped / s.scale;
    s.tx = cx - (cx - s.tx) * k;
    s.ty = cy - (cy - s.ty) * k;
    s.scale = clamped;
    if (clamped <= 1.01) {
      s.scale = 1;
      s.tx = 0;
      s.ty = 0;
    }
    apply();
  };

  const rel = (clientX: number, clientY: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !url) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = rel(e.clientX, e.clientY);
      zoomAt(state.current.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), x, y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [url]);

  if (!url) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const s = state.current;
      const c = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: s.scale,
        cx: c.x,
        cy: c.y,
        tx: s.tx,
        ty: s.ty,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 4) moved.current = true;

    if (pointers.current.size === 2 && pinch.current) {
      pointers.current.set(e.pointerId, cur);
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const center = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
      const p = pinch.current;
      state.current.scale = p.scale;
      state.current.tx = p.tx + (center.x - p.cx);
      state.current.ty = p.ty + (center.y - p.cy);
      zoomAt(p.scale * (dist / p.dist), center.x, center.y);
      return;
    }

    if (pointers.current.size === 1 && state.current.scale > 1) {
      state.current.tx += cur.x - prev.x;
      state.current.ty += cur.y - prev.y;
      apply();
    }
    pointers.current.set(e.pointerId, cur);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    if (!moved.current && e.pointerType !== "mouse") {
      const now = Date.now();
      const lt = lastTap.current;
      if (now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 40) {
        const { x, y } = rel(e.clientX, e.clientY);
        zoomAt(state.current.scale > 1.3 ? 1 : 2.6, x, y);
        lastTap.current = { t: 0, x: 0, y: 0 };
        return;
      }
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onDoubleClick={(e) => {
          const { x, y } = rel(e.clientX, e.clientY);
          zoomAt(state.current.scale > 1.3 ? 1 : 2.6, x, y);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain will-change-transform"
          style={{ transform: "translate(0px, 0px) scale(1)" }}
        />
      </div>
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-foreground/15 p-2.5 text-white backdrop-blur active:scale-90"
      >
        <X size={20} />
      </button>
      <p className="pointer-events-none absolute bottom-6 left-0 right-0 text-center text-[11px] text-white/60">
        双指捏合 / 双击缩放 · 拖动查看 · 点空白处关闭
      </p>
    </div>
  );
}
