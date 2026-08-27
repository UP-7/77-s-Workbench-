import type { InvoiceRecord } from "@/lib/types";
import { reimburserOf } from "@/lib/invoice/parse";

function sanitizeFilePart(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|\r\n\t]/g, "")
      .replace(/\s+/g, "")
      .slice(0, 40) || "未知"
  );
}

/**
 * 按规则生成新文件名：{报销人}_{发票号}.{ext}
 * 同名冲突自动追加 _2、_3…（原地修改 record.newName）
 */
export function buildNewNames(
  records: InvoiceRecord[],
  personOf: (r: InvoiceRecord) => string = (r) => reimburserOf(r.fields)
): void {
  const used = new Map<string, number>();
  for (const r of records) {
    if (r.status !== "success") {
      r.newName = undefined;
      continue;
    }
    const person = sanitizeFilePart(personOf(r));
    const number = sanitizeFilePart(r.fields.invoiceNumber || "无号码");
    const base = `${person}_${number}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    r.newName = count === 1 ? `${base}.${r.ext}` : `${base}_${count}.${r.ext}`;
  }
}
