"use client";

import type { InvoiceFields, InvoiceRecord } from "@/lib/types";
import { getFile, putFile } from "@/lib/idb";
import { blobToBase64, compressForOcr, makeThumb } from "@/lib/imageUtils";
import { pdfFirstPageToPng } from "@/lib/pdf";
import { guessItem, hasKeyFields, mergeFields, parseInvoiceText } from "@/lib/invoice/parse";
import { aiCleanInvoice } from "@/lib/ai";
import { fetchRetry } from "@/lib/fetchRetry";

/** 确保记录有可用的 OCR 图片（PDF -> 首页 PNG）与缩略图，返回 OCR 用图片 */
export async function ensureOcrImage(rec: InvoiceRecord): Promise<Blob> {
  const original = await getFile(rec.fileKey);
  if (!original) throw new Error("文件已丢失，请重新上传");

  if (rec.mime === "application/pdf" || rec.ext === "pdf") {
    let page = await getFile(`${rec.id}_page`);
    if (!page) {
      page = await pdfFirstPageToPng(original);
      await putFile(`${rec.id}_page`, page);
    }
    return page;
  }
  return original;
}

/** 确保缩略图存在（网格预览用） */
export async function ensureThumb(rec: InvoiceRecord): Promise<Blob | undefined> {
  const existing = await getFile(`${rec.id}_thumb`);
  if (existing) return existing;
  try {
    const src = await ensureOcrImage(rec);
    const thumb = await makeThumb(src, 360);
    await putFile(`${rec.id}_thumb`, thumb);
    return thumb;
  } catch {
    return undefined;
  }
}

export interface OcrOutcome {
  fields: InvoiceFields;
  source: "cloud" | "local";
  error?: string;
}

/** 识别单张发票：云端优先，失败降级本地 Tesseract；可选 AI 清洗 */
export async function recognizeOne(
  rec: InvoiceRecord,
  opts: { aiClean: boolean; onLocalFallback?: () => void }
): Promise<OcrOutcome> {
  if (!["pdf", "png", "jpg", "jpeg", "webp", "bmp"].includes(rec.ext)) {
    throw new Error(`暂不支持 .${rec.ext} 格式，请转为图片或 PDF`);
  }

  const image = await ensureOcrImage(rec);
  const jpeg = await compressForOcr(image);
  const base64 = await blobToBase64(jpeg);

  let fields: InvoiceFields = {};
  let source: "cloud" | "local" = "cloud";
  let rawText = "";

  let cloudOk = false;
  try {
    const r = await fetchRetry("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || `云端识别失败(${r.status})`);
    fields = data.fields || {};
    rawText = String(data.rawText || "");
    cloudOk = true;
  } catch {
    cloudOk = false;
  }

  if (!cloudOk || !hasKeyFields(fields)) {
    try {
      opts.onLocalFallback?.();
      const { tesseractRecognize } = await import("@/lib/tesseract");
      const text = await tesseractRecognize(jpeg);
      rawText = rawText || text;
      const local = parseInvoiceText(text);
      if (!cloudOk) {
        fields = local;
        source = "local";
      } else {
        fields = mergeFields(local, fields);
      }
    } catch (e) {
      if (!cloudOk) {
        throw new Error(
          `云端与本地识别均失败：${e instanceof Error ? e.message : "未知错误"}`
        );
      }
    }
  }

  if (opts.aiClean) {
    try {
      const cleaned = await aiCleanInvoice(fields, rawText);
      fields = mergeFields(fields, cleaned);
    } catch {
      /* AI 清洗失败不影响主流程 */
    }
  }

  if (!fields.item) {
    const item = guessItem(
      `${fields.seller || ""} ${fields.invoiceType || ""} ${rawText}`.slice(0, 3000)
    );
    if (item) fields.item = item;
  }

  return { fields, source };
}
