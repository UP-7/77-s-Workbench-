"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  ScanSearch,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import UploadZone from "@/components/invoices/UploadZone";
import InvoiceCard from "@/components/invoices/InvoiceCard";
import EditModal from "@/components/invoices/EditModal";
import HistoryPanel from "@/components/invoices/HistoryPanel";
import { useInvoiceStore } from "@/stores/useInvoiceStore";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

export default function InvoicesPage() {
  const mounted = useMounted();
  const {
    records,
    processing,
    progress,
    exporting,
    aiClean,
    setAiClean,
    reimburser,
    setReimburser,
    addFiles,
    startOcr,
    downloadExcel,
    finishAndExport,
    clearRecords,
    loadBatches,
  } = useInvoiceStore();

  const [tab, setTab] = useState<"current" | "history">("current");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  /* 粘贴图片直接入库 */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const stats = useMemo(
    () => ({
      pending: records.filter((r) => r.status === "pending").length,
      success: records.filter((r) => r.status === "success").length,
      failed: records.filter((r) => r.status === "failed").length,
    }),
    [records]
  );

  const editing = records.find((r) => r.id === editingId) || null;

  if (!mounted) {
    return <div className="p-4"><div className="h-64 rounded-3xl bg-muted animate-pulse-soft" /></div>;
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">发票管家</h1>
        <div className="flex rounded-full bg-card p-1 shadow-sm">
          {(
            [
              ["current", "本次处理"],
              ["history", "历史记录"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                tab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "history" ? (
        <HistoryPanel />
      ) : (
        <div className="space-y-3.5">
          <UploadZone onFiles={(f) => void addFiles(f)} compact={records.length > 0} />

          {/* 批次报销人 */}
          <div className="flex items-center gap-2 rounded-2xl bg-card px-3.5 py-2.5 shadow-sm">
            <UserRound size={15} className="shrink-0 text-primary" />
            <span className="shrink-0 text-xs font-bold text-foreground">报销人</span>
            <input
              value={reimburser}
              onChange={(e) => setReimburser(e.target.value)}
              placeholder="冯欣茹"
              maxLength={20}
              className="min-w-0 flex-1 rounded-xl bg-muted/30 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="shrink-0 text-[10px] text-muted-foreground">整批命名 + Excel 都用 TA</span>
          </div>

          {records.length > 0 && (
            <>
              {/* 状态与设置 */}
              <div className="flex items-center justify-between rounded-2xl bg-card px-3.5 py-2.5 shadow-sm">
                <div className="flex items-center gap-2.5 text-[11px]">
                  <span className="text-muted-foreground">共 {records.length}</span>
                  <span className="text-muted-foreground/80">待 {stats.pending}</span>
                  <span className="text-success">成 {stats.success}</span>
                  <span className="text-destructive">败 {stats.failed}</span>
                </div>
                <button
                  onClick={() => setAiClean(!aiClean)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                    aiClean ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Sparkles size={11} />
                  AI 清洗{aiClean ? "开" : "关"}
                </button>
              </div>

              {/* 进度条 */}
              {processing && (
                <div className="rounded-2xl bg-card p-3.5 shadow-sm">
                  <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>正在识别（云端优先，失败自动本地兜底）…</span>
                    <span>
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 网格 */}
              <div className="grid grid-cols-3 gap-2">
                {records.map((r) => (
                  <InvoiceCard key={r.id} record={r} onClick={() => setEditingId(r.id)} />
                ))}
              </div>

              {/* 操作区 */}
              <div className="sticky bottom-4 space-y-2 rounded-3xl bg-card/95 p-3 shadow-sm backdrop-blur">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={processing || exporting}
                    onClick={() => void startOcr()}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-60"
                  >
                    {processing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ScanSearch size={16} />
                    )}
                    {processing ? "识别中…" : `开始识别（${stats.pending + stats.failed}）`}
                  </button>
                  <button
                    disabled={processing || exporting}
                    onClick={() => void downloadExcel()}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-success py-3 text-sm font-bold text-success-foreground shadow-sm disabled:opacity-60"
                  >
                    <FileSpreadsheet size={16} />
                    下载 Excel
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={processing || exporting}
                    onClick={() => void finishAndExport()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-foreground py-3 text-sm font-bold text-background disabled:opacity-60"
                  >
                    {exporting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <PackageCheck size={16} />
                    )}
                    处理完成 · 打包 ZIP + Excel
                  </button>
                  <button
                    aria-label="清空"
                    disabled={processing}
                    onClick={() => void clearRecords()}
                    className="rounded-2xl bg-destructive/10 px-4 text-destructive disabled:opacity-50"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <p className="text-center text-[10px] text-muted-foreground">
                  命名规则：姓名(默认冯欣茹)_发票号.后缀 · 重名自动加 _2 _3 · 点卡片可补录事项/备注
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <EditModal record={editing} onClose={() => setEditingId(null)} />
    </div>
  );
}
