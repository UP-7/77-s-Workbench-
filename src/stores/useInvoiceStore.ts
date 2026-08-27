"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { InvoiceBatch, InvoiceRecord } from "@/lib/types";
import { formatStamp, uid, downloadBlob } from "@/lib/utils";
import {
  deleteBatchDB,
  deleteInvoiceFiles,
  getBatches,
  putFile,
  saveBatch,
} from "@/lib/idb";
import { extractZipFiles, exportInvoiceZip } from "@/lib/invoice/zip";
import { ensureThumb, recognizeOne } from "@/lib/invoice/ocr";
import { buildNewNames } from "@/lib/invoice/rename";
import { buildInvoiceExcel } from "@/lib/invoice/excel";
import { DEFAULT_REIMBURSER, reimburserOf } from "@/lib/invoice/parse";
import { toast } from "@/stores/useToastStore";

const SUPPORTED = ["png", "jpg", "jpeg", "webp", "bmp", "pdf"];

interface InvoiceState {
  records: InvoiceRecord[];
  batches: InvoiceBatch[];
  batchesLoaded: boolean;
  processing: boolean;
  progress: { done: number; total: number };
  exporting: boolean;
  aiClean: boolean;
  reimburser: string;

  setAiClean: (v: boolean) => void;
  setReimburser: (v: string) => void;
  addFiles: (files: File[] | FileList) => Promise<void>;
  updateRecord: (id: string, patch: Partial<InvoiceRecord>) => void;
  removeRecord: (id: string) => Promise<void>;
  clearRecords: () => Promise<void>;
  startOcr: (ids?: string[]) => Promise<void>;
  downloadExcel: () => Promise<void>;
  finishAndExport: () => Promise<void>;
  loadBatches: () => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  exportBatches: (ids: string[]) => Promise<void>;
}

let thumbQueueRunning = false;

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set, get) => {
      const update = (id: string, patch: Partial<InvoiceRecord>) =>
        set({
          records: get().records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        });

      const personOf = () => (get().reimburser || "").trim() || DEFAULT_REIMBURSER;

      const runThumbQueue = async () => {
        if (thumbQueueRunning) return;
        thumbQueueRunning = true;
        try {
          for (;;) {
            const next = get().records.find((r) => !r.thumbAt);
            if (!next) break;
            const thumb = await ensureThumb(next).catch(() => undefined);
            update(next.id, {
              thumbAt: Date.now(),
              ...(thumb ? {} : {}),
            });
          }
        } finally {
          thumbQueueRunning = false;
        }
      };

      return {
        records: [],
        batches: [],
        batchesLoaded: false,
        processing: false,
        progress: { done: 0, total: 0 },
        exporting: false,
        aiClean: true,
        reimburser: DEFAULT_REIMBURSER,

        setAiClean: (v) => set({ aiClean: v }),
        setReimburser: (v) => set({ reimburser: v }),

        addFiles: async (input) => {
          const list = Array.from(input);
          const candidates: Array<{ name: string; blob: Blob }> = [];
          for (const f of list) {
            try {
              if (/\.zip$/i.test(f.name)) {
                const inner = await extractZipFiles(f);
                candidates.push(...inner);
              } else {
                candidates.push({ name: f.name, blob: f });
              }
            } catch {
              toast(`解压 ${f.name} 失败`, "error");
            }
          }

          const newRecords: InvoiceRecord[] = [];
          let skipped = 0;
          for (const { name, blob } of candidates) {
            const ext = (name.split(".").pop() || "").toLowerCase();
            if (!SUPPORTED.includes(ext)) {
              skipped++;
              continue;
            }
            if (blob.size > 30_000_000) {
              skipped++;
              continue;
            }
            const id = uid();
            await putFile(id, blob);
            newRecords.push({
              id,
              fileKey: id,
              originalName: name,
              ext,
              mime: blob.type || (ext === "pdf" ? "application/pdf" : `image/${ext}`),
              size: blob.size,
              status: "pending",
              fields: {},
              createdAt: Date.now(),
            });
          }

          if (newRecords.length) {
            set({ records: [...get().records, ...newRecords] });
            toast(`已添加 ${newRecords.length} 张发票${skipped ? `，跳过 ${skipped} 个不支持的文件` : ""}`);
            void runThumbQueue();
          } else if (skipped) {
            toast(`跳过 ${skipped} 个不支持的文件（仅支持图片/PDF/ZIP）`, "error");
          }
        },

        updateRecord: update,

        removeRecord: async (id) => {
          set({ records: get().records.filter((r) => r.id !== id) });
          const inBatch = get().batches.some((b) => b.records.some((r) => r.id === id));
          if (!inBatch) await deleteInvoiceFiles(id).catch(() => undefined);
        },

        clearRecords: async () => {
          const { records, batches } = get();
          const savedIds = new Set(batches.flatMap((b) => b.records.map((r) => r.id)));
          set({ records: [] });
          for (const r of records) {
            if (!savedIds.has(r.id)) await deleteInvoiceFiles(r.id).catch(() => undefined);
          }
          toast("已清空本次处理");
        },

        startOcr: async (ids) => {
          const { records, aiClean, processing } = get();
          if (processing) return;
          const targets = records.filter(
            (r) =>
              (ids ? ids.includes(r.id) : true) &&
              (r.status === "pending" || r.status === "failed")
          );
          if (targets.length === 0) {
            toast("没有待识别的发票", "info");
            return;
          }
          set({ processing: true, progress: { done: 0, total: targets.length } });
          let localNotified = false;
          const queue = [...targets];

          const worker = async () => {
            for (;;) {
              const rec = queue.shift();
              if (!rec) return;
              update(rec.id, { status: "processing", error: undefined });
              try {
                const { fields, source } = await recognizeOne(rec, {
                  aiClean,
                  onLocalFallback: () => {
                    if (!localNotified) {
                      localNotified = true;
                      toast("云端 OCR 不可用，已切换本地识别（首次需下载模型）", "info");
                    }
                  },
                });
                const ok = !!(fields.invoiceNumber || fields.amount !== undefined || fields.buyerName);
                update(rec.id, {
                  status: ok ? "success" : "failed",
                  fields: { ...rec.fields, ...fields },
                  ocrSource: source,
                  error: ok ? undefined : "未识别到关键字段（姓名/发票号/金额）",
                });
              } catch (e) {
                update(rec.id, {
                  status: "failed",
                  error: e instanceof Error ? e.message : "识别失败",
                });
              }
              set({ progress: { ...get().progress, done: get().progress.done + 1 } });
            }
          };

          await Promise.all([worker(), worker()]);

          const all = [...get().records];
          buildNewNames(all, () => personOf());
          set({ records: all, processing: false });
          const okCount = all.filter((r) => r.status === "success").length;
          toast(`识别完成：成功 ${okCount} / ${all.length} 张`, okCount ? "success" : "error");
        },

        downloadExcel: async () => {
          const { records } = get();
          if (records.length === 0) {
            toast("请先上传发票", "info");
            return;
          }
          set({ exporting: true });
          try {
            const all = [...records];
            buildNewNames(all, () => personOf());
            set({ records: all });
            const excel = await buildInvoiceExcel(all, () => personOf());
            downloadBlob(excel, `发票汇总表_${formatStamp()}.xlsx`);
            toast("Excel 已下载");
          } catch (e) {
            toast(e instanceof Error ? e.message : "导出失败", "error");
          } finally {
            set({ exporting: false });
          }
        },

        finishAndExport: async () => {
          const { records } = get();
          const success = records.filter((r) => r.status === "success");
          if (success.length === 0) {
            toast("暂无识别成功的发票，请先识别或人工补录", "info");
            return;
          }
          set({ exporting: true });
          try {
            const all = [...records];
            buildNewNames(all, () => personOf());
            const batchId = uid();
            all.forEach((r) => (r.batchId = batchId));
            set({ records: all });

            const name = `发票整理_${formatStamp()}`;
            const excel = await buildInvoiceExcel(all, () => personOf());
            await exportInvoiceZip(all, excel, name);

            const batch: InvoiceBatch = {
              id: batchId,
              name,
              createdAt: Date.now(),
              records: all,
              total: all.length,
              success: success.length,
              failed: all.length - success.length,
              reimburser: personOf(),
            };
            await saveBatch(batch);
            set({ batches: [batch, ...get().batches] });
            toast("已打包下载，并保存到历史记录");
          } catch (e) {
            toast(e instanceof Error ? e.message : "打包失败", "error");
          } finally {
            set({ exporting: false });
          }
        },

        loadBatches: async () => {
          if (get().batchesLoaded) return;
          const batches = await getBatches().catch(() => []);
          set({ batches, batchesLoaded: true });
        },

        deleteBatch: async (id) => {
          const batch = get().batches.find((b) => b.id === id);
          if (!batch) return;
          set({
            batches: get().batches.filter((b) => b.id !== id),
            records: get().records.filter((r) => r.batchId !== id),
          });
          await deleteBatchDB(id).catch(() => undefined);
          for (const r of batch.records) {
            await deleteInvoiceFiles(r.id).catch(() => undefined);
          }
          toast("批次已删除");
        },

        exportBatches: async (ids) => {
          const batches = get().batches.filter((b) => ids.includes(b.id));
          if (batches.length === 0) return;
          set({ exporting: true });
          try {
            const personMap = new Map<string, string>();
            for (const b of batches) {
              for (const r of b.records) {
                personMap.set(r.id, (b.reimburser || "").trim() || reimburserOf(r.fields));
              }
            }
            const personFor = (r: InvoiceRecord) => personMap.get(r.id) || DEFAULT_REIMBURSER;

            const merged: InvoiceRecord[] = batches.flatMap((b) =>
              b.records.map((r) => ({ ...r }))
            );
            buildNewNames(merged, personFor);
            const name =
              batches.length === 1
                ? batches[0].name
                : `发票合并导出_${formatStamp()}`;
            const excel = await buildInvoiceExcel(merged, personFor);
            await exportInvoiceZip(merged, excel, name);
            toast(`已导出 ${batches.length} 个批次`);
          } catch (e) {
            toast(e instanceof Error ? e.message : "导出失败", "error");
          } finally {
            set({ exporting: false });
          }
        },
      };
    },
    {
      name: "qiqi-invoice-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ records: s.records, aiClean: s.aiClean, reimburser: s.reimburser }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.records = state.records.map((r) =>
          r.status === "processing" ? { ...r, status: "pending" } : r
        );
      },
    }
  )
);
