"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2, ZoomIn } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet";
import ImageViewer from "@/components/ui/ImageViewer";
import type { InvoiceRecord } from "@/lib/types";
import { useInvoiceStore } from "@/stores/useInvoiceStore";
import { getFile } from "@/lib/idb";
import { normalizeAmount, normalizeDate } from "@/lib/invoice/parse";
import { toast } from "@/stores/useToastStore";

const INVOICE_TYPES = [
  "电子发票（普通发票）",
  "增值税电子普通发票",
  "增值税电子专用发票",
  "增值税普通发票",
  "增值税专用发票",
  "其他",
];

const ITEM_OPTIONS = ["酒店", "火车票", "机票", "打车", "餐费", "办公用品"];
const REMARK_OPTIONS = ["出差", "走访", "日常"];

/** 发票详情/人工补录弹层 */
export default function EditModal({
  record,
  onClose,
}: {
  record: InvoiceRecord | null;
  onClose: () => void;
}) {
  const { updateRecord, removeRecord, startOcr, processing } = useInvoiceStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [form, setForm] = useState({
    buyerName: "",
    invoiceNumber: "",
    amount: "",
    date: "",
    invoiceType: "",
    buyer: "",
    seller: "",
    item: "",
    remark: "",
  });

  useEffect(() => {
    if (!record) return;
    setForm({
      buyerName: record.fields.buyerName || "",
      invoiceNumber: record.fields.invoiceNumber || "",
      amount: record.fields.amount !== undefined ? String(record.fields.amount) : "",
      date: record.fields.date || "",
      invoiceType: record.fields.invoiceType || "",
      buyer: record.fields.buyer || "",
      seller: record.fields.seller || "",
      item: record.fields.item || "",
      remark: record.fields.remark || "",
    });

    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const blob =
        (await getFile(`${record.id}_page`)) ||
        (record.ext !== "pdf" ? await getFile(record.fileKey) : undefined) ||
        (await getFile(`${record.id}_thumb`));
      if (blob && !cancelled) {
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [record]);

  if (!record) return null;

  const save = () => {
    const amount = normalizeAmount(form.amount);
    const fields = {
      buyerName: form.buyerName.trim() || undefined,
      invoiceNumber: form.invoiceNumber.replace(/\D/g, "") || undefined,
      amount,
      date: normalizeDate(form.date) || (form.date.trim() || undefined),
      invoiceType: form.invoiceType.trim() || undefined,
      buyer: form.buyer.trim() || undefined,
      seller: form.seller.trim() || undefined,
      item: form.item.trim() || undefined,
      remark: form.remark.trim() || undefined,
    };
    const ok = !!(fields.buyerName || fields.invoiceNumber || amount !== undefined);
    updateRecord(record.id, {
      fields,
      status: ok ? "success" : record.status,
      ocrSource: ok ? "manual" : record.ocrSource,
      error: ok ? undefined : record.error,
    });
    toast(ok ? "已保存补录信息" : "至少填写姓名/发票号/金额其一", ok ? "success" : "info");
    if (ok) onClose();
  };

  const field = (
    label: string,
    key: keyof typeof form,
    placeholder: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      />
    </label>
  );

  return (
    <BottomSheet open={!!record} onClose={onClose} title="发票详情 / 补录">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {previewUrl ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="relative block w-full"
              aria-label="放大查看发票"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="发票预览" className="max-h-56 w-full object-contain" />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                <ZoomIn size={11} /> 点击放大
              </span>
            </button>
          ) : (
            <div className="flex h-40 items-center justify-center text-4xl">
              {record.ext === "pdf" ? "📄" : "🖼️"}
            </div>
          )}
        </div>
        {zoomed && (
          <ImageViewer url={previewUrl} alt="发票大图" onClose={() => setZoomed(false)} />
        )}
        <p className="truncate text-[11px] text-muted-foreground">
          原文件：{record.originalName}
          {record.newName && (
            <>
              <br />
              新名称：<span className="text-primary">{record.newName}</span>
            </>
          )}
        </p>
        {record.error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{record.error}</p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {field("票面姓名（命名以批次报销人为准）", "buyerName", "OCR 识别结果")}
          {field("发票号码", "invoiceNumber", "纯数字", { inputMode: "numeric" })}
          {field("金额（价税合计）", "amount", "如：263.00", { inputMode: "decimal" })}
          {field("开票日期", "date", "YYYY-MM-DD")}
          {field("事项", "item", "酒店 / 火车票 / 餐费…", { list: "qiqi-item-options" })}
          {field("备注", "remark", "走访 / 出差…", { list: "qiqi-remark-options" })}
        </div>
        <datalist id="qiqi-item-options">
          {ITEM_OPTIONS.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <datalist id="qiqi-remark-options">
          {REMARK_OPTIONS.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">发票类型</span>
          <select
            value={form.invoiceType}
            onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">未知</option>
            {INVOICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-2.5">
          {field("购买方", "buyer", "购买方全称")}
          {field("销售方", "seller", "销售方全称")}
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            disabled={processing}
            onClick={() => {
              void startOcr([record.id]);
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary/10 py-3 text-sm font-bold text-primary disabled:opacity-50"
          >
            {processing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            重新识别
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm"
          >
            保存
          </button>
          <button
            aria-label="删除"
            onClick={() => {
              if (window.confirm("删除这张发票？")) {
                void removeRecord(record.id);
                onClose();
              }
            }}
            className="rounded-2xl bg-card px-4 text-destructive shadow-sm"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
