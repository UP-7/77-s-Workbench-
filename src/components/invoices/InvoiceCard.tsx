"use client";

import { useEffect, useState } from "react";
import { Cloud, Loader2, Smartphone, Trash2, UserRoundPen } from "lucide-react";
import type { InvoiceRecord } from "@/lib/types";
import { getFile } from "@/lib/idb";
import { DEFAULT_REIMBURSER } from "@/lib/invoice/parse";
import { useInvoiceStore } from "@/stores/useInvoiceStore";
import { cn } from "@/lib/utils";

const STATUS_META: Record<InvoiceRecord["status"], { label: string; cls: string }> = {
  pending: { label: "待识别", cls: "bg-muted text-muted-foreground" },
  processing: { label: "识别中", cls: "bg-accent/15 text-accent" },
  success: { label: "成功", cls: "bg-success/15 text-success" },
  failed: { label: "失败", cls: "bg-destructive/15 text-destructive" },
};

export default function InvoiceCard({
  record,
  onClick,
}: {
  record: InvoiceRecord;
  onClick: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const reimburser = useInvoiceStore((s) => (s.reimburser || "").trim() || DEFAULT_REIMBURSER);
  const removeRecord = useInvoiceStore((s) => s.removeRecord);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const blob = await getFile(`${record.id}_thumb`);
      if (blob && !cancelled) {
        url = URL.createObjectURL(blob);
        setThumbUrl(url);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [record.id, record.thumbAt]);

  const meta = STATUS_META[record.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="cursor-pointer overflow-hidden rounded-2xl bg-card text-left shadow-sm active:scale-[0.97] transition-transform"
    >
      <div className="relative aspect-[4/3] bg-muted/30">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={record.originalName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            {record.ext === "pdf" ? "📄" : "🖼️"}
          </div>
        )}
        <span
          className={cn(
            "absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
            meta.cls
          )}
        >
          {record.status === "processing" && <Loader2 size={9} className="animate-spin" />}
          {meta.label}
        </span>
        {record.ocrSource && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-card/85 p-1 text-muted-foreground backdrop-blur">
            {record.ocrSource === "cloud" ? (
              <Cloud size={11} />
            ) : record.ocrSource === "local" ? (
              <Smartphone size={11} />
            ) : (
              <UserRoundPen size={11} />
            )}
          </span>
        )}
        <button
          aria-label="删除这张发票"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`删除「${record.originalName}」？`)) void removeRecord(record.id);
          }}
          className="absolute bottom-1.5 right-1.5 rounded-full bg-card/90 p-1.5 text-destructive shadow-sm backdrop-blur active:scale-90"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="p-2">
        {record.status === "success" ? (
          <>
            <p className="truncate text-[12px] font-semibold text-foreground">
              {reimburser}
              {record.fields.item && (
                <span className="ml-1 text-muted-foreground">{record.fields.item}</span>
              )}
              {record.fields.amount !== undefined && (
                <span className="ml-1 text-primary">¥{record.fields.amount.toFixed(2)}</span>
              )}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {record.newName || record.fields.invoiceNumber || record.originalName}
            </p>
          </>
        ) : (
          <>
            <p className="truncate text-[12px] text-foreground">{record.originalName}</p>
            <p className="truncate text-[10px] text-destructive">{record.error || "\u00A0"}</p>
          </>
        )}
      </div>
    </div>
  );
}
