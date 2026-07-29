"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Timer,
  Play,
  Square,
  Trash2,
  ImagePlus,
  GitCompareArrows,
  PencilLine,
  Maximize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/sheet";
import { ClientGate } from "@/components/client-gate";
import { MediaThumb, useMediaUrl } from "@/components/collection/media";
import { PinchViewer } from "@/components/collection/pinch-viewer";
import { BeforeAfter } from "@/components/collection/before-after";
import { useCollectionStore } from "@/stores/collection";
import { listMediaByItem, saveMedia, deleteMediaByItem } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { fmtDuration, fmtMoney, vibrate } from "@/lib/utils";
import type { MediaMeta } from "@/lib/types";

function PlayTimer({ itemId }: { itemId: string }) {
  const item = useCollectionStore((s) => s.items.find((i) => i.id === itemId));
  const { startPlaying, stopPlaying } = useCollectionStore();
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const lastChunk = React.useRef(-1);

  const running = Boolean(item?.playingSince);
  const elapsed = item
    ? item.playSeconds + (item.playingSince ? Math.floor((Date.now() - item.playingSince) / 1000) : 0)
    : 0;

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      force();
      // 每满 30 分钟震动 + 通知提醒
      const chunk = Math.floor(
        ((useCollectionStore.getState().items.find((i) => i.id === itemId)?.playSeconds ?? 0) +
          Math.floor((Date.now() - (item?.playingSince ?? Date.now())) / 1000)) /
          1800
      );
      if (lastChunk.current === -1) lastChunk.current = chunk;
      else if (chunk > lastChunk.current) {
        lastChunk.current = chunk;
        vibrate([120, 60, 120]);
        void notify("🧤 盘玩提醒", `已连续盘玩 ${chunk * 30} 分钟，歇歇手，让它醒一醒。`);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [running, itemId, item?.playingSince]);

  if (!item) return null;

  return (
    <Card className="border-none bg-gradient-to-br from-accent to-accent/80 text-accent-foreground">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest opacity-90">
              <Timer className="h-3.5 w-3.5" /> 盘玩计时器
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
              {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
              {String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            <p className="mt-1 text-xs opacity-85">
              累计 {fmtDuration(item.playSeconds)}
              {running && " · 计时中（后台持续）"}
            </p>
          </div>
          <button
            aria-label={running ? "停止" : "开始盘玩"}
            onClick={() => {
              vibrate(30);
              if (running) {
                const gained = stopPlaying(item.id);
                void notify("盘玩结束", `本次盘玩 ${fmtDuration(gained)}，辛苦啦。`);
              } else {
                lastChunk.current = -1;
                startPlaying(item.id);
              }
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur transition-transform active:scale-90"
          >
            {running ? <Square className="h-6 w-6 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function Gallery({ itemId }: { itemId: string }) {
  const [medias, setMedias] = React.useState<(MediaMeta & { blob: Blob })[]>([]);
  const [viewer, setViewer] = React.useState<{ url: string; type: "image" | "video" } | null>(null);
  const [compare, setCompare] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const updateItem = useCollectionStore((s) => s.updateItem);
  const item = useCollectionStore((s) => s.items.find((i) => i.id === itemId));

  const reload = React.useCallback(async () => {
    setMedias(await listMediaByItem(itemId));
  }, [itemId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    let coverId = item?.coverMediaId;
    for (const f of Array.from(list)) {
      const meta = await saveMedia(itemId, f);
      if (!coverId && meta.type === "image") coverId = meta.id;
    }
    if (coverId && coverId !== item?.coverMediaId) updateItem(itemId, { coverMediaId: coverId });
    await reload();
    vibrate(20);
  };

  const images = medias.filter((m) => m.type === "image");
  const canCompare = images.length >= 2;

  const openViewer = (m: MediaMeta & { blob: Blob }) => {
    setViewer({ url: URL.createObjectURL(m.blob), type: m.type });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">时间轴相册（{medias.length}）</CardTitle>
        <div className="flex gap-2">
          {canCompare && (
            <Button size="sm" variant={compare ? "default" : "secondary"} onClick={() => setCompare((v) => !v)}>
              <GitCompareArrows className="h-4 w-4" /> 包浆对比
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> 添加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />

        {compare && canCompare && (
          <div className="mb-4">
            <BeforeAfter beforeId={images[0].id} afterId={images[images.length - 1].id} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              左：{new Date(images[0].takenAt).toLocaleDateString("zh-CN")} · 右：
              {new Date(images[images.length - 1].takenAt).toLocaleDateString("zh-CN")} · 拖动手柄对比包浆变化
            </p>
          </div>
        )}

        {medias.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">还没有照片，记录第一天的样子吧</p>
        ) : (
          <div className="relative space-y-4 pl-4 before:absolute before:inset-y-1 before:left-1 before:w-px before:bg-border">
            {medias.map((m) => (
              <div key={m.id} className="relative">
                <span className="absolute -left-[13.5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <p className="mb-1.5 text-[11px] text-muted-foreground">
                  {new Date(m.takenAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <div className="relative overflow-hidden rounded-xl">
                  <MediaThumb mediaId={m.id} className="aspect-[16/10] w-full" onClick={() => openViewer(m)} />
                  <button
                    aria-label="全屏查看"
                    onClick={() => openViewer(m)}
                    className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {viewer && (
        <PinchViewer
          url={viewer.url}
          type={viewer.type}
          onClose={() => {
            URL.revokeObjectURL(viewer.url);
            setViewer(null);
          }}
        />
      )}
    </Card>
  );
}

function InfoCard({ itemId }: { itemId: string }) {
  const item = useCollectionStore((s) => s.items.find((i) => i.id === itemId));
  const updateItem = useCollectionStore((s) => s.updateItem);
  const [editing, setEditing] = React.useState(false);
  const [patina, setPatina] = React.useState(item?.patina ?? "");
  const [notes, setNotes] = React.useState(item?.notes ?? "");

  if (!item) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">藏品档案</CardTitle>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (editing) {
              updateItem(item.id, { patina, notes });
              vibrate(15);
            } else {
              setPatina(item.patina);
              setNotes(item.notes);
            }
            setEditing((v) => !v);
          }}
        >
          <PencilLine className="h-4 w-4" /> {editing ? "保存" : "编辑"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-[11px] text-muted-foreground">入手价格</p>
            <p className="mt-0.5 font-semibold">{item.price ? fmtMoney(item.price) : "未记录"}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-[11px] text-muted-foreground">入手日期</p>
            <p className="mt-0.5 font-semibold">{item.acquiredAt}</p>
          </div>
        </div>
        <div>
          <Label>皮质评价</Label>
          {editing ? (
            <Input value={patina} onChange={(e) => setPatina(e.target.value)} placeholder="皮色、密度、皮质…" />
          ) : (
            <p className="text-sm leading-relaxed">{item.patina || "——"}</p>
          )}
        </div>
        <div>
          <Label>盘玩心得</Label>
          {editing ? (
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="上色、挂瓷、手感变化…" />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.notes || "——"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const item = useCollectionStore((s) => s.items.find((i) => i.id === id));
  const removeItem = useCollectionStore((s) => s.removeItem);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <div className="space-y-4 p-4">
      <ClientGate>
        {!item ? (
          <p className="py-16 text-center text-sm text-muted-foreground">藏品不存在或已删除</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{item.name}</h2>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary">{item.category}</Badge>
                  {item.humidityCare && <Badge className="bg-accent/10 text-accent">需养护</Badge>}
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="删除藏品" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-5 w-5 text-destructive" />
              </Button>
            </div>

            <PlayTimer itemId={id} />
            <Gallery itemId={id} />
            <InfoCard itemId={id} />

            <ConfirmDialog
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              title="删除这件藏品？"
              description="藏品档案与所有照片视频将一并删除，无法恢复。"
              confirmText="删除"
              danger
              onConfirm={() => {
                void deleteMediaByItem(id).then(() => {
                  removeItem(id);
                  router.replace("/collection");
                });
              }}
            />
          </>
        )}
      </ClientGate>
    </div>
  );
}
