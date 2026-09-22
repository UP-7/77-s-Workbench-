"use client";

import type { InvoiceRecord } from "@/lib/types";
import { reimburserOf } from "@/lib/invoice/parse";

const HEADERS = ["日期", "事项", "金额", "发票金额", "报销人", "发票号", "备注"];
const WIDTHS = [14, 14, 12, 12, 12, 26, 16];

const THIN = { style: "thin" as const, color: { argb: "FFE8D9CC" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/**
 * 生成报销汇总 Excel：
 * 主表列：日期、事项、金额、发票金额、报销人、发票号、备注
 * 附表：未识别（原文件名 + 原因）
 */
export async function buildInvoiceExcel(
  records: InvoiceRecord[],
  personOf: (r: InvoiceRecord) => string = (r) => reimburserOf(r.fields)
): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "工作台 · 发票管家";
  wb.created = new Date();

  const success = records.filter((r) => r.status === "success");
  const failed = records.filter((r) => r.status !== "success");

  /* ---------- 主表 ---------- */
  const ws = wb.addWorksheet("发票汇总", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = WIDTHS.map((w) => ({ width: w }));

  const headerRow = ws.getRow(1);
  headerRow.values = HEADERS;
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B5E3C" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = BORDER;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  success.forEach((r, i) => {
    const row = ws.getRow(i + 2);
    row.values = [
      r.fields.date || "",
      r.fields.item || "",
      r.fields.amount ?? "",
      r.fields.amount ?? "",
      personOf(r),
      r.fields.invoiceNumber || "",
      r.fields.remark || "",
    ];
    row.eachCell((cell, col) => {
      cell.border = BORDER;
      cell.alignment = { vertical: "middle", horizontal: col === 3 || col === 4 ? "right" : "left" };
      if ((i + 1) % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F2" } };
      }
    });
    row.getCell(3).numFmt = "#,##0.00";
    row.getCell(4).numFmt = "#,##0.00";
  });

  /* ---------- 未识别表 ---------- */
  if (failed.length > 0) {
    const wsFail = wb.addWorksheet("未识别");
    wsFail.columns = [{ width: 36 }, { width: 40 }];
    const fh = wsFail.getRow(1);
    fh.values = ["原文件名", "失败原因"];
    fh.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9A8478" } };
      cell.border = BORDER;
    });
    failed.forEach((r, i) => {
      const row = wsFail.getRow(i + 2);
      row.values = [r.originalName, r.error || "待识别"];
      row.eachCell((cell) => {
        cell.border = BORDER;
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      });
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
