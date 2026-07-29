"use client";

import * as React from "react";
import { X, Crop, FlipHorizontal2, FlipVertical2, RotateCw, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { updateAsset, saveAsset, imageDimensions } from "@/lib/db";
import { cn, vibrate } from "@/lib/utils";
import type { CarvingAsset } from "@/lib/types";

type CropBox = { x: number; y: number; w: number; h: number }; // 相对比例 0~1

interface Props {
  asset: CarvingAsset & { blob: Blob };
  onClose: () => void;
  onSaved: () => void;
}

/** 素材编辑器：毫米尺寸、裁剪（拖框）、翻转、旋转 */
export function AssetEditor({ asset, onClose, onSaved }: Props) {
  const [blob, setBlob] = React.useState<Blob>(asset.blob);
  const [url, setUrl] = React.useState<string>("");
  const [widthMm, setWidthMm] = React.useState(String(asset.widthMm));
  const [heightMm, setHeightMm] = React.useState(String(asset.heightMm));
  const [lockRatio, setLockRatio] = React.useState(true);
  const [ratio, setRatio] = React.useState(asset.widthMm / asset.heightMm);
  const [cropping, setCropping] = React.useState(false);
  const [crop, setCrop] = React.useState<CropBox>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [busy, setBusy] = React.useState(false);
  const imgWrapRef = React.useRef<HTMLDivElement>(null);
  const gestureRef = React.useRef<{
    mode: "move" | "nw" | "ne" | "sw" | "se" | null;
    startX: number;
    startY: number;
    startCrop: CropBox;
  }>({ mode: null, startX: 0, startY: 0, startCrop: crop });

  React.useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  /* ---------- 尺寸联动 ---------- */
  const onWidthChange = (v: string) => {
    setWidthMm(v);
    const n = Number(v);
    if (lockRatio && n > 0) setHeightMm(String(Math.round(n / ratio)));
  };
  const onHeightChange = (v: string) => {
    setHeightMm(v);
    const n = Number(v);
    if (lockRatio && n > 0) setWidthMm(String(Math.round(n * ratio)));
  };

  /* ---------- Canvas 变换 ---------- */
  const transform = async (op: "flipH" | "flipV" | "rotate" | "crop") => {
    if (busy) return;
    setBusy(true);
    try {
      const dim = await imageDimensions(blob);
      const img = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      if (op === "crop") {
        const sx = Math.round(crop.x * dim.w);
        const sy = Math.round(crop.y * dim.h);
        const sw = Math.max(1, Math.round(crop.w * dim.w));
        const sh = Math.max(1, Math.round(crop.h * dim.h));
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        // 裁剪后毫米尺寸按比例缩小
        const newW = Math.max(5, Math.round(Number(widthMm) * crop.w));
        const newH = Math.max(5, Math.round(Number(heightMm) * crop.h));
        setWidthMm(String(newW));
        setHeightMm(String(newH));
        setRatio(newW / newH);
        setCropping(false);
      } else if (op === "rotate") {
        canvas.width = dim.h;
        canvas.height = dim.w;
        ctx.translate(dim.h / 2, dim.w / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -dim.w / 2, -dim.h / 2);
        // 宽高互换
        setWidthMm(heightMm);
        setHeightMm(widthMm);
        setRatio(1 / ratio);
      } else {
        canvas.width = dim.w;
        canvas.height = dim.h;
        if (op === "flipH") {
          ctx.translate(dim.w, 0);
          ctx.scale(-1, 1);
        } else {
          ctx.translate(0, dim.h);
          ctx.scale(1, -1);
        }
        ctx.drawImage(img, 0, 0);
      }
      const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (out) setBlob(out);
      vibrate(15);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 裁剪框手势（Pointer 事件，触摸/鼠标通用） ---------- */
  const HANDLE = 28; // 角点命中半径 px

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cropping || !imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const near = (cx: number, cy: number) =>
      Math.abs(e.clientX - rect.left - cx * rect.width) < HANDLE &&
      Math.abs(e.clientY - rect.top - cy * rect.height) < HANDLE;

    let mode: typeof gestureRef.current.mode = null;
    if (near(crop.x, crop.y)) mode = "nw";
    else if (near(crop.x + crop.w, crop.y)) mode = "ne";
    else if (near(crop.x, crop.y + crop.h)) mode = "sw";
    else if (near(crop.x + crop.w, crop.y + crop.h)) mode = "se";
    else if (px > crop.x && px < crop.x + crop.w && py > crop.y && py < crop.y + crop.h) mode = "move";

    gestureRef.current = { mode, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!cropping || !g.mode || !imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const dx = (e.clientX - g.startX) / rect.width;
    const dy = (e.clientY - g.startY) / rect.height;
    const c = { ...g.startCrop };
    const MIN = 0.08;

    if (g.mode === "move") {
      c.x = Math.min(Math.max(0, c.x + dx), 1 - c.w);
      c.y = Math.min(Math.max(0, c.y + dy), 1 - c.h);
    } else {
      if (g.mode.includes("w")) {
        const nx = Math.min(Math.max(0, c.x + dx), c.x + c.w - MIN);
        c.w = c.w + (c.x - nx);
        c.x = nx;
      }
      if (g.mode.includes("e")) {
        c.w = Math.min(Math.max(MIN, c.w + dx), 1 - c.x);
      }
      if (g.mode.includes("n")) {
        const ny = Math.min(Math.max(0, c.y + dy), c.y + c.h - MIN);
        c.h = c.h + (c.y - ny);
        c.y = ny;
      }
      if (g.mode.includes("s")) {
        c.h = Math.min(Math.max(MIN, c.h + dy), 1 - c.y);
      }
    }
    setCrop(c);
  };

  const onPointerUp = () => {
    gestureRef.current.mode = null;
  };

  /* ---------- 保存 ---------- */
  const persist = async (asCopy: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const w = Math.max(5, Math.round(Number(widthMm) || asset.widthMm));
      const h = Math.max(5, Math.round(Number(heightMm) || asset.heightMm));
      if (asCopy) {
        await saveAsset({ name: `${asset.name}·副本`, kind: asset.kind, blob, widthMm: w, heightMm: h });
      } else {
        await updateAsset(asset.id, { blob, widthMm: w, heightMm: h });
      }
      vibrate(25);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background animate-fade-in">
      {/* 顶栏 */}
      <div className="flex h-14 items-center justify-between border-b px-3 pt-safe">
        <button onClick={onClose} aria-label="关闭" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
        <p className="max-w-[50%] truncate text-sm font-semibold">{asset.name}</p>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void persist(true)}>
            <Copy className="h-3.5 w-3.5" /> 副本
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void persist(false)}>
            <Check className="h-3.5 w-3.5" /> 保存
          </Button>
        </div>
      </div>

      {/* 画布区 */}
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-muted/40 p-4">
        <div
          ref={imgWrapRef}
          className="relative inline-block max-h-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" draggable={false} className="max-h-[52dvh] max-w-full rounded-lg bg-white shadow" />
          )}
          {/* 裁剪遮罩 */}
          {cropping && (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/45" />
              <div
                className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                  backgroundImage: url ? `url(${url})` : undefined,
                  backgroundSize: `${100 / crop.w}% ${100 / crop.h}%`,
                  backgroundPosition: `${crop.w >= 1 ? 0 : (crop.x / (1 - crop.w)) * 100}% ${crop.h >= 1 ? 0 : (crop.y / (1 - crop.h)) * 100}%`,
                }}
              />
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <span
                  key={corner}
                  className="pointer-events-none absolute h-5 w-5 rounded-full border-2 border-white bg-primary shadow"
                  style={{
                    left: `calc(${(corner.includes("w") ? crop.x : crop.x + crop.w) * 100}% - 10px)`,
                    top: `calc(${(corner.includes("n") ? crop.y : crop.y + crop.h) * 100}% - 10px)`,
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* 工具区 */}
      <div className="space-y-4 border-t p-4 pb-safe">
        <div className="flex justify-center gap-2.5">
          <Button
            variant={cropping ? "default" : "secondary"}
            size="sm"
            onClick={() => setCropping((v) => !v)}
            disabled={busy}
          >
            <Crop className="h-4 w-4" /> {cropping ? "取消裁剪" : "裁剪"}
          </Button>
          {cropping ? (
            <Button size="sm" variant="success" onClick={() => void transform("crop")} disabled={busy}>
              <Check className="h-4 w-4" /> 应用裁剪
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => void transform("flipH")} disabled={busy}>
                <FlipHorizontal2 className="h-4 w-4" /> 水平
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void transform("flipV")} disabled={busy}>
                <FlipVertical2 className="h-4 w-4" /> 垂直
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void transform("rotate")} disabled={busy}>
                <RotateCw className="h-4 w-4" /> 旋转
              </Button>
            </>
          )}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="ae-w">宽（毫米）</Label>
            <Input id="ae-w" type="number" inputMode="numeric" value={widthMm} onChange={(e) => onWidthChange(e.target.value)} />
          </div>
          <span className={cn("pb-3 text-muted-foreground", lockRatio && "text-primary")}>×</span>
          <div className="flex-1">
            <Label htmlFor="ae-h">高（毫米）</Label>
            <Input id="ae-h" type="number" inputMode="numeric" value={heightMm} onChange={(e) => onHeightChange(e.target.value)} />
          </div>
          <div className="pb-1 text-center">
            <Label>锁比例</Label>
            <Switch checked={lockRatio} onChange={setLockRatio} />
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          毫米尺寸即导出 PDF/Word 时的实际打印大小，方便按实物雕刻
        </p>
      </div>
    </div>
  );
}
