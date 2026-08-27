"use client";

import type { InvoiceRecord } from "@/lib/types";
import { getFile } from "@/lib/idb";
import { downloadBlob } from "@/lib/utils";

const FILE_EXT_RE = /\.(png|jpe?g|webp|bmp|pdf|ofd)$/i;

/** 递归解压 ZIP（含嵌套 ZIP），返回发票候选文件 */
export async function extractZipFiles(
  blob: Blob,
  depth = 0
): Promise<Array<{ name: string; blob: Blob }>> {
  if (depth > 3) return [];
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(blob);
  const out: Array<{ name: string; blob: Blob }> = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.includes("__MACOSX")) continue;
    const name = path.split("/").pop() || path;
    if (name.startsWith(".")) continue;

    if (/\.zip$/i.test(name)) {
      const inner = await entry.async("blob");
      out.push(...(await extractZipFiles(inner, depth + 1)));
    } else if (FILE_EXT_RE.test(name)) {
      out.push({ name, blob: await entry.async("blob") });
    }
  }
  return out;
}

/**
 * 打包导出：
 * {baseName}/重命名发票/{newName}
 * {baseName}/未识别/{originalName}
 * {baseName}/发票汇总表.xlsx
 */
export async function exportInvoiceZip(
  records: InvoiceRecord[],
  excelBlob: Blob,
  baseName: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const root = zip.folder(baseName)!;
  const renamed = root.folder("重命名发票")!;
  const failed = root.folder("未识别")!;

  const usedFailNames = new Map<string, number>();
  for (const r of records) {
    const blob = await getFile(r.fileKey);
    if (!blob) continue;
    if (r.status === "success" && r.newName) {
      renamed.file(r.newName, blob);
    } else {
      let name = r.originalName;
      const n = (usedFailNames.get(name) ?? 0) + 1;
      usedFailNames.set(name, n);
      if (n > 1) {
        const dot = name.lastIndexOf(".");
        name = dot > 0 ? `${name.slice(0, dot)}_${n}${name.slice(dot)}` : `${name}_${n}`;
      }
      failed.file(name, blob);
    }
  }
  root.file("发票汇总表.xlsx", excelBlob);

  const out = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (meta) => onProgress?.(Math.round(meta.percent))
  );
  downloadBlob(out, `${baseName}.zip`);
}
