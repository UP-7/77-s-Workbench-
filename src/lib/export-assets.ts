"use client";

import type { CarvingAsset } from "./types";

/** A4 纸张（竖版）排版参数，单位 mm */
const PAGE = { w: 210, h: 297, margin: 12, gap: 6, labelH: 5 };

interface ExportItem extends CarvingAsset {
  blob: Blob;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 批量导出 PDF：图片按各自毫米尺寸从左到右流式排版，自动换行分页。
 */
export async function exportAssetsToPdf(items: ExportItem[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const maxW = PAGE.w - PAGE.margin * 2;
  const maxH = PAGE.h - PAGE.margin * 2;
  let x = PAGE.margin;
  let y = PAGE.margin;
  let rowH = 0;

  for (const item of items) {
    // 单图不超过版心
    let w = Math.min(item.widthMm, maxW);
    let h = item.heightMm * (w / item.widthMm);
    if (h > maxH - PAGE.labelH) {
      const s = (maxH - PAGE.labelH) / h;
      h *= s;
      w *= s;
    }
    const cellH = h + PAGE.labelH;

    // 换行
    if (x + w > PAGE.margin + maxW + 0.01) {
      x = PAGE.margin;
      y += rowH + PAGE.gap;
      rowH = 0;
    }
    // 分页
    if (y + cellH > PAGE.margin + maxH + 0.01) {
      doc.addPage();
      x = PAGE.margin;
      y = PAGE.margin;
      rowH = 0;
    }

    const dataUrl = await blobToDataURL(item.blob);
    const fmt = dataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(dataUrl, fmt, x, y, w, h);
    doc.setDrawColor(200);
    doc.rect(x, y, w, h); // 裁切参考边框
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(`${item.widthMm}x${item.heightMm}mm`, x, y + h + 3.5, { maxWidth: w });

    x += w + PAGE.gap;
    rowH = Math.max(rowH, cellH);
  }

  doc.save(`雕刻素材-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * 导出 Word（.doc）：生成内嵌 base64 图片的 HTML 文档，Word/WPS 可直接打开。
 */
export async function exportAssetsToWord(items: ExportItem[]): Promise<void> {
  const parts: string[] = [];
  for (const item of items) {
    const dataUrl = await blobToDataURL(item.blob);
    parts.push(
      `<div style="display:inline-block;margin:4mm;text-align:center;">` +
        `<img src="${dataUrl}" style="width:${item.widthMm}mm;height:${item.heightMm}mm;border:0.3pt solid #ccc;" />` +
        `<p style="font-size:8pt;color:#888;margin:1mm 0 0;">${escapeHtml(item.name)} · ${item.widthMm}×${item.heightMm}mm</p>` +
        `</div>`
    );
  }
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta charset="utf-8"><title>雕刻素材</title>` +
    `<style>@page{size:A4;margin:12mm;}body{font-family:sans-serif;}</style></head>` +
    `<body>${parts.join("")}</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `雕刻素材-${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
