"use client";

import * as React from "react";
import {
  Type,
  ImagePlus,
  CheckSquare,
  Square,
  FileText,
  FileDown,
  Trash2,
  PenTool,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Empty } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/sheet";
import { ClientGate } from "@/components/client-gate";
import { ArtTextMaker } from "@/components/atelier/art-text-maker";
import { AssetEditor } from "@/components/atelier/asset-editor";
import { listAssets, saveAsset, deleteAsset } from "@/lib/db";
import { exportAssetsToPdf, exportAssetsToWord } from "@/lib/export-assets";
import { cn, vibrate } from "@/lib/utils";
import type { CarvingAsset } from "@/lib/types";

type AssetFull = CarvingAsset & { blob: Blob };

function AssetCard({
  asset,
  url,
  selectMode,
  selected,
  onTap,
}: {
  asset: AssetFull;
  url: string;
  selectMode: boolean;
  selected: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className={cn(
        "relative block w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all active:scale-[0.97]",
        selected && "ring-2 ring-primary"
      )}
    >
      <div className="flex aspect-square items-center justify-center bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={asset.name} className="max-h-full max-w-full object-contain" loading="lazy" />
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold">{asset.name}</p>
        <div className="mt-1 flex items-center justify-between">
          <Badge className={asset.kind === "art-text" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}>
            {asset.kind === "art-text" ? "艺术字" : "简笔画"}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {asset.widthMm}×{asset.heightMm}mm
          </span>
        </div>
      </div>
      {selectMode && (
        <span className="absolute left-2 top-2 rounded-md bg-card/90 p-0.5 text-primary shadow">
          {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted-foreground/50" />}
        </span>
      )}
    </button>
  );
}

export default function AtelierPage() {
  const [assets, setAssets] = React.useState<AssetFull[]>([]);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [makerOpen, setMakerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AssetFull | null>(null);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [exporting, setExporting] = React.useState<"" | "pdf" | "word">("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAssets();
      setAssets(list);
      setUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        const next: Record<string, string> = {};
        for (const a of list) next[a.id] = URL.createObjectURL(a.blob);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    return () => {
      setUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [reload]);

  const uploadSketches = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image")) continue;
      await saveAsset({ name: f.name.replace(/\.[^.]+$/, "").slice(0, 16) || "简笔画", kind: "sketch", blob: f });
    }
    vibrate(20);
    await reload();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedAssets = assets.filter((a) => selected.has(a.id));

  const doExport = async (fmt: "pdf" | "word") => {
    if (selectedAssets.length === 0 || exporting) return;
    setExporting(fmt);
    try {
      if (fmt === "pdf") await exportAssetsToPdf(selectedAssets);
      else await exportAssetsToWord(selectedAssets);
      vibrate(25);
    } finally {
      setExporting("");
    }
  };

  const doDelete = async () => {
    for (const id of Array.from(selected)) await deleteAsset(id);
    setSelected(new Set());
    setSelectMode(false);
    await reload();
  };

  return (
    <div className="space-y-4 p-4 pb-28">
      <ClientGate>
        {/* 操作区 */}
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="h-14" onClick={() => setMakerOpen(true)}>
            <Type className="h-5 w-5" /> DIY 艺术字
          </Button>
          <Button size="lg" variant="secondary" className="h-14" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-5 w-5" /> 传简笔画
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void uploadSketches(e.target.files); e.target.value = ""; }} />

        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">{assets.length} 个素材</p>
          {assets.length > 0 && (
            <Button
              size="sm"
              variant={selectMode ? "default" : "secondary"}
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected(new Set());
              }}
            >
              {selectMode ? <XCircle className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              {selectMode ? "取消" : "选择"}
            </Button>
          )}
        </div>

        {/* 素材网格 */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse-soft rounded-2xl bg-muted" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <Empty
            icon={<PenTool className="h-10 w-10" />}
            title="素材库还是空的"
            hint="做一个艺术字，或上传简笔画开始"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {assets.map((a) => (
              <AssetCard
                key={a.id}
                asset={a}
                url={urls[a.id] ?? ""}
                selectMode={selectMode}
                selected={selected.has(a.id)}
                onTap={() => (selectMode ? toggleSelect(a.id) : setEditing(a))}
              />
            ))}
          </div>
        )}

        {/* 多选底部操作栏 */}
        {selectMode && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 pb-safe backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center gap-2">
              <span className="px-1 text-xs text-muted-foreground">已选 {selected.size}</span>
              <Button
                className="flex-1"
                size="sm"
                disabled={selected.size === 0 || Boolean(exporting)}
                onClick={() => void doExport("pdf")}
              >
                <FileDown className="h-4 w-4" /> {exporting === "pdf" ? "生成中…" : "导出 PDF"}
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="secondary"
                disabled={selected.size === 0 || Boolean(exporting)}
                onClick={() => void doExport("word")}
              >
                <FileText className="h-4 w-4" /> {exporting === "word" ? "生成中…" : "导出 Word"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={selected.size === 0}
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <ArtTextMaker open={makerOpen} onClose={() => setMakerOpen(false)} onSaved={() => void reload()} />
        {editing && (
          <AssetEditor asset={editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />
        )}
        <ConfirmDialog
          open={confirmDel}
          onClose={() => setConfirmDel(false)}
          title={`删除 ${selected.size} 个素材？`}
          description="删除后无法恢复。"
          confirmText="删除"
          danger
          onConfirm={() => void doDelete()}
        />
      </ClientGate>
    </div>
  );
}
