"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Search, Trash2 } from "lucide-react";
import { useInvoiceStore } from "@/stores/useInvoiceStore";
import { formatTimeCN, cn } from "@/lib/utils";

/** 历史批次：搜索 / 重新导出 / 删除 / 多批次合并导出 */
export default function HistoryPanel() {
  const { batches, deleteBatch, exportBatches, exporting } = useInvoiceStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Array<{ batchName: string; recordId: string; text: string; sub: string }> = [];
    for (const b of batches) {
      for (const r of b.records) {
        const hay = [
          r.fields.buyerName,
          r.fields.invoiceNumber,
          r.fields.date,
          r.fields.buyer,
          r.fields.seller,
          r.originalName,
          r.newName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (hay.includes(q)) {
          out.push({
            batchName: b.name,
            recordId: r.id,
            text: `${r.fields.buyerName || "未知"} · ${r.fields.invoiceNumber || "无号码"}${
              r.fields.amount !== undefined ? ` · ¥${r.fields.amount.toFixed(2)}` : ""
            }`,
            sub: `${r.fields.date || "无日期"} · ${b.name}`,
          });
        }
        if (out.length >= 50) return out;
      }
    }
    return out;
  }, [batches, query]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-card px-3.5 shadow-sm">
        <Search size={15} className="shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="按姓名 / 发票号 / 日期搜索历史"
          className="w-full bg-transparent py-3 text-sm outline-none"
        />
      </div>

      {query.trim() && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {results.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">没有匹配的发票记录</p>
          )}
          {results.map((r) => (
            <div key={r.recordId} className="border-b border-border px-3.5 py-2.5 last:border-0">
              <p className="truncate text-[13px] font-medium text-foreground">{r.text}</p>
              <p className="truncate text-[11px] text-muted-foreground">{r.sub}</p>
            </div>
          ))}
        </div>
      )}

      {batches.length === 0 ? (
        <div className="rounded-3xl bg-card py-14 text-center shadow-sm">
          <p className="text-4xl">🗂️</p>
          <p className="mt-3 text-sm text-muted-foreground">还没有历史批次，处理完成后自动保存</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {batches.map((b) => (
            <div key={b.id} className="rounded-2xl bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  aria-label="选择批次"
                  checked={selected.has(b.id)}
                  onChange={() => toggleSelect(b.id)}
                  className="h-4.5 w-4.5 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-foreground">{b.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatTimeCN(b.createdAt)}
                    {b.reimburser ? ` · ${b.reimburser}` : ""} · 共 {b.total} 张 · 成功{" "}
                    <span className="text-success">{b.success}</span> · 失败{" "}
                    <span className={cn(b.failed ? "text-destructive" : "")}>{b.failed}</span>
                  </p>
                </div>
                <button
                  aria-label="重新导出"
                  disabled={exporting}
                  onClick={() => void exportBatches([b.id])}
                  className="rounded-xl bg-primary/10 p-2 text-primary disabled:opacity-50"
                >
                  {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                </button>
                <button
                  aria-label="删除批次"
                  onClick={() => {
                    if (window.confirm(`删除批次「${b.name}」？关联文件将一并清除`)) {
                      void deleteBatch(b.id);
                    }
                  }}
                  className="rounded-xl bg-destructive/10 p-2 text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.size >= 2 && (
        <button
          disabled={exporting}
          onClick={() => void exportBatches(Array.from(selected))}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground shadow-sm disabled:opacity-60"
        >
          {exporting && <Loader2 size={16} className="animate-spin" />}
          合并导出 {selected.size} 个批次（ZIP + Excel）
        </button>
      )}
    </div>
  );
}
