"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Camera, Images, Gem, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch, Badge, Empty } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/sheet";
import { ClientGate } from "@/components/client-gate";
import { MediaThumb } from "@/components/collection/media";
import { useCollectionStore } from "@/stores/collection";
import { saveMedia } from "@/lib/db";
import { COLLECTION_CATEGORIES } from "@/lib/types";
import { cn, fmtDuration, todayStr, vibrate } from "@/lib/utils";

function AddSheet({
  open,
  onClose,
  autoCapture,
}: {
  open: boolean;
  onClose: () => void;
  autoCapture?: boolean;
}) {
  const addItem = useCollectionStore((s) => s.addItem);
  const updateItem = useCollectionStore((s) => s.updateItem);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<string>(COLLECTION_CATEGORIES[0]);
  const [price, setPrice] = React.useState("");
  const [acquiredAt, setAcquiredAt] = React.useState(todayStr());
  const [patina, setPatina] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [humidityCare, setHumidityCare] = React.useState(true);
  const [files, setFiles] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open && autoCapture) {
      setTimeout(() => cameraRef.current?.click(), 350);
    }
  }, [open, autoCapture]);

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const id = addItem({
        name,
        category,
        price: price ? Number(price) : undefined,
        acquiredAt,
        patina,
        notes,
        humidityCare,
      });
      let coverId: string | undefined;
      for (const f of files) {
        const meta = await saveMedia(id, f);
        if (!coverId && meta.type === "image") coverId = meta.id;
      }
      if (coverId) updateItem(id, { coverMediaId: coverId });
      vibrate(25);
      onClose();
      setName(""); setPrice(""); setPatina(""); setNotes(""); setFiles([]);
      setAcquiredAt(todayStr());
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="新藏品入阁">
      <div className="space-y-4">
        {/* 媒体选择 */}
        <div className="flex gap-2.5">
          <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFiles(e.target.files)} />
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground active:bg-muted"
          >
            <Camera className="h-5 w-5" /> 拍摄
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground active:bg-muted"
          >
            <Images className="h-5 w-5" /> 相册多选
          </button>
        </div>
        {files.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {files.map((f, i) => (
              <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {f.type.startsWith("image") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">视频</span>
                )}
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <Label htmlFor="c-name">名称</Label>
          <Input id="c-name" placeholder="如：3号葫芦 · 蚂蚁肚" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>类别</Label>
          <div className="flex flex-wrap gap-2">
            {COLLECTION_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm transition-colors",
                  category === c ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-price">入手价格 ¥</Label>
            <Input id="c-price" type="number" inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-date">入手日期</Label>
            <Input id="c-date" type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="c-patina">皮质评价</Label>
          <Input id="c-patina" placeholder="如：皮色金黄，密度上乘" value={patina} onChange={(e) => setPatina(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-notes">盘玩心得</Label>
          <Textarea id="c-notes" placeholder="记录今天的盘玩感受…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted p-3.5">
          <div>
            <p className="text-sm font-medium">干燥养护提醒</p>
            <p className="text-xs text-muted-foreground">干燥天气时晨报会提醒加湿</p>
          </div>
          <Switch checked={humidityCare} onChange={setHumidityCare} />
        </div>
        <Button className="w-full" size="lg" disabled={!name.trim() || saving} onClick={() => void submit()}>
          {saving ? "保存中…" : "入阁"}
        </Button>
      </div>
    </BottomSheet>
  );
}

function CollectionGrid() {
  const items = useCollectionStore((s) => s.items);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const autoCapture = searchParams.get("capture") === "1";

  React.useEffect(() => {
    if (autoCapture) setSheetOpen(true);
  }, [autoCapture]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} 件藏品</p>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4" /> 入阁
        </Button>
      </div>

      {items.length === 0 ? (
        <button className="w-full" onClick={() => setSheetOpen(true)}>
          <Empty icon={<Gem className="h-10 w-10" />} title="文玩阁空空如也" hint="拍下你的第一件心头好" />
        </button>
      ) : (
        <div className="masonry">
          {items.map((item, idx) => (
            <button
              key={item.id}
              className="block w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-transform active:scale-[0.97] animate-fade-up"
              onClick={() => router.push(`/collection/${item.id}`)}
            >
              <MediaThumb
                mediaId={item.coverMediaId}
                className={cn("w-full", idx % 3 === 0 ? "aspect-[3/4]" : idx % 3 === 1 ? "aspect-square" : "aspect-[4/5]")}
              />
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <Badge className="bg-primary/10 text-primary">{item.category}</Badge>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    {fmtDuration(item.playSeconds)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <AddSheet open={sheetOpen} onClose={() => setSheetOpen(false)} autoCapture={autoCapture} />
    </>
  );
}

export default function CollectionPage() {
  return (
    <div className="p-4">
      <ClientGate>
        <React.Suspense fallback={null}>
          <CollectionGrid />
        </React.Suspense>
      </ClientGate>
    </div>
  );
}
