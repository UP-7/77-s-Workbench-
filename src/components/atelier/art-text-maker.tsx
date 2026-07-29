"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/sheet";
import { saveAsset } from "@/lib/db";
import { CARVING_FONTS } from "@/lib/fonts";
import { cn, vibrate } from "@/lib/utils";

const SCALE = 3; // 高清渲染倍率

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ArtTextMaker({ open, onClose, onSaved }: Props) {
  const [text, setText] = React.useState("福");
  const [fontIdx, setFontIdx] = React.useState(0);
  const [fontSize, setFontSize] = React.useState(120);
  const [bold, setBold] = React.useState(true);
  const [outline, setOutline] = React.useState(true); // 空心描边（雕刻描摹）
  const [vertical, setVertical] = React.useState(false);
  const [mirror, setMirror] = React.useState(false); // 镜像（转印用）
  const [saving, setSaving] = React.useState(false);
  const [fontLoading, setFontLoading] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const renderSeq = React.useRef(0);

  const render = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const seq = ++renderSeq.current;
    const content = text || "字";
    const fs = fontSize;
    const fontDef = CARVING_FONTS[fontIdx] ?? CARVING_FONTS[0];
    const fontSpec = `${fontDef.weight ?? 400} ${fs}px ${fontDef.family}`;

    // 等待字体（含所需汉字分片）加载完成，避免回退字体渲染
    try {
      setFontLoading(true);
      await document.fonts.load(fontSpec, content);
    } catch {
      /* 加载失败则使用回退字体绘制 */
    } finally {
      if (seq === renderSeq.current) setFontLoading(false);
    }
    if (seq !== renderSeq.current) return; // 已有更新的渲染请求

    const lines = content.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) lines.push("字");
    const lineGap = Math.round(fs * 0.18);
    const pad = Math.round(fs * 0.25);

    // 计算画布尺寸
    ctx.font = fontSpec;
    let w: number;
    let h: number;
    if (vertical) {
      const colW = fs + lineGap;
      const maxChars = Math.max(...lines.map((l) => Array.from(l).length));
      w = lines.length * colW - lineGap + pad * 2;
      h = maxChars * (fs + lineGap) - lineGap + pad * 2;
    } else {
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      w = Math.ceil(maxLineW) + pad * 2;
      h = lines.length * (fs + lineGap) - lineGap + pad * 2 + Math.round(fs * 0.2);
    }

    canvas.width = w * SCALE;
    canvas.height = h * SCALE;
    canvas.style.aspectRatio = `${w} / ${h}`;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    // 白底
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // 镜像
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    ctx.font = fontSpec;
    ctx.fillStyle = "#111111";
    ctx.strokeStyle = "#111111";
    ctx.lineJoin = "round";
    ctx.textBaseline = "top";

    // 空心：纯描边；实心：填充（加粗时叠加描边增强笔画）
    const outlineWidth = Math.max(1.5, fs / (bold ? 40 : 55));
    const boldStroke = Math.max(1, fs / 60);
    const draw = (ch: string, x: number, y: number) => {
      if (outline) {
        ctx.lineWidth = outlineWidth;
        ctx.strokeText(ch, x, y);
      } else {
        ctx.fillText(ch, x, y);
        if (bold) {
          ctx.lineWidth = boldStroke;
          ctx.strokeText(ch, x, y);
        }
      }
    };

    if (vertical) {
      const colW = fs + lineGap;
      lines.forEach((line, li) => {
        const x = w - pad - (li + 1) * colW + lineGap; // 列从右向左
        Array.from(line).forEach((ch, ci) => {
          draw(ch, x, pad + ci * (fs + lineGap));
        });
      });
    } else {
      ctx.textAlign = "left";
      lines.forEach((line, li) => {
        draw(line, pad, pad + li * (fs + lineGap));
      });
    }
  }, [text, fontIdx, fontSize, bold, outline, vertical, mirror]);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => void render(), 60);
      return () => clearTimeout(t);
    }
  }, [open, render]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || saving) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (blob) {
        const name = (text || "艺术字").replace(/\n/g, "").slice(0, 12);
        await saveAsset({ name: `${name}${mirror ? "·镜像" : ""}`, kind: "art-text", blob });
        vibrate(25);
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="DIY 艺术字">
      <div className="space-y-4">
        {/* 预览 */}
        <div className="relative flex max-h-56 items-center justify-center overflow-auto rounded-xl border bg-white p-3">
          <canvas ref={canvasRef} className="max-h-48 max-w-full object-contain" />
          {fontLoading && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white">
              <Loader2 className="h-3 w-3 animate-spin" /> 字体加载中
            </span>
          )}
        </div>

        <div>
          <Label htmlFor="at-text">文字（支持多行）</Label>
          <textarea
            id="at-text"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="如：宁静致远"
          />
        </div>

        <div>
          <Label>字体（跨设备一致，首次使用需加载）</Label>
          <div className="flex flex-wrap gap-2">
            {CARVING_FONTS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setFontIdx(i)}
                style={{ fontFamily: f.family, fontWeight: f.weight ?? 400 }}
                className={cn(
                  "h-10 rounded-full border px-4 text-base",
                  fontIdx === i ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>字号 · {fontSize}px</Label>
          <input
            type="range"
            min={48}
            max={280}
            step={4}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "空心描边", desc: "适合描摹雕刻", val: outline, set: setOutline },
            { label: "加粗", desc: "笔画更饱满", val: bold, set: setBold },
            { label: "竖排", desc: "传统排版", val: vertical, set: setVertical },
            { label: "镜像", desc: "转印雕刻用", val: mirror, set: setMirror },
          ].map((o) => (
            <div key={o.label} className="flex items-center justify-between rounded-xl bg-muted p-3">
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-[10px] text-muted-foreground">{o.desc}</p>
              </div>
              <Switch checked={o.val} onChange={o.set} />
            </div>
          ))}
        </div>

        <Button className="w-full" size="lg" onClick={() => void save()} disabled={saving || !text.trim()}>
          {saving ? "保存中…" : "存入素材库"}
        </Button>
      </div>
    </BottomSheet>
  );
}
