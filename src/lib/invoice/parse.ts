import type { InvoiceFields } from "@/lib/types";

/** 发票字段解析/归一化（纯函数，前后端共用） */

export function normalizeDate(s: string): string | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return undefined;
}

export function normalizeAmount(s: string): number | undefined {
  if (s == null) return undefined;
  const cleaned = String(s).replace(/[¥￥,，\s元]/g, "");
  const m = cleaned.match(/-?\d+(\.\d{1,2})?/);
  if (!m) return undefined;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && Math.abs(n) < 100_000_000 ? n : undefined;
}

const COMPANY_RE = /(公司|有限|集团|商行|商店|中心|门市|厂|店|合作社|事务所|医院|学校|大学|酒店|超市)/;

/** 默认报销人 */
export const DEFAULT_REIMBURSER = "冯欣茹";

/** 是否像个人姓名（2-4 个汉字，非单位名） */
export function isPersonName(s?: string): boolean {
  if (!s) return false;
  const t = s.trim();
  return /^[\u4e00-\u9fa5·]{2,4}$/.test(t) && !COMPANY_RE.test(t);
}

/** 报销人：识别到个人姓名用之，否则用默认 */
export function reimburserOf(f: InvoiceFields): string {
  return isPersonName(f.buyerName) ? f.buyerName!.trim() : DEFAULT_REIMBURSER;
}

const ITEM_RULES: Array<[string, RegExp]> = [
  ["火车票", /(铁路|火车|高铁|动车|12306|铁道)/],
  ["机票", /(航空|机票|民航|航班|航旅)/],
  ["酒店", /(酒店|住宿|宾馆|旅馆|民宿|客房|饭店有限)/],
  ["打车", /(出租车|客运|运输服务|滴滴|网约车|客车|出行)/],
  ["餐费", /(餐饮|餐费|饭店|美食|烧烤|火锅|快餐|小吃|饮食|茶餐厅|咖啡)/],
  ["办公用品", /(办公|文具|耗材|打印)/],
];

/** 从销售方/发票类型/OCR 原文猜测报销事项 */
export function guessItem(text: string): string | undefined {
  for (const [item, re] of ITEM_RULES) {
    if (re.test(text)) return item;
  }
  return undefined;
}

/** 从购买方名称提取"姓名" */
export function extractPersonName(buyer?: string): string | undefined {
  if (!buyer) return undefined;
  const inner = buyer.match(/[（(]([^（）()]{2,10})[）)]/);
  if (/个人/.test(buyer) && inner && inner[1] !== "个人") return inner[1];
  if (inner && /个人/.test(inner[1]) === false && buyer.replace(/[（(].*[）)]/, "") === "个人")
    return inner[1];
  if (!COMPANY_RE.test(buyer) && buyer.length <= 6) return buyer;
  return buyer;
}

const TYPE_RE =
  /(电子发票[（(]普通发票[）)]|电子发票[（(]增值税专用发票[）)]|增值税电子普通发票|增值税电子专用发票|增值税普通发票|增值税专用发票|全电发票|普通发票|专用发票)/;

/** 从 OCR 纯文本兜底解析发票字段 */
export function parseInvoiceText(raw: string): InvoiceFields {
  const text = raw.replace(/[ \t]+/g, " ");
  const fields: InvoiceFields = {};

  const num =
    text.match(/发\s*票\s*号\s*码\s*[:：]?\s*(\d{8,20})/) ||
    text.match(/号\s*码\s*[:：]\s*(\d{8,20})/) ||
    text.match(/(?:No|NO)[.:：]?\s*(\d{8,20})/) ||
    text.match(/(\d{20})/);
  if (num) fields.invoiceNumber = num[1];

  const date = text.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/);
  if (date) fields.date = normalizeDate(date[0]);

  const total =
    text.match(/价税合计[^0-9¥￥]*[（(]?小写[）)]?\s*[:：]?\s*[¥￥]?\s*([\d,]+\.\d{1,2})/) ||
    text.match(/小写\s*[:：]?\s*[¥￥]?\s*([\d,]+\.\d{1,2})/);
  if (total) {
    fields.amount = normalizeAmount(total[1]);
  } else {
    const all = Array.from(text.matchAll(/[¥￥]\s*([\d,]+\.\d{1,2})/g))
      .map((m) => normalizeAmount(m[1]))
      .filter((n): n is number => n !== undefined);
    if (all.length) fields.amount = Math.max(...all);
  }

  const names = Array.from(text.matchAll(/名\s*称\s*[:：]\s*([^\s:：]{2,30})/g)).map((m) => m[1]);
  if (names.length >= 1) fields.buyer = names[0];
  if (names.length >= 2) fields.seller = names[names.length - 1];

  const type = text.match(TYPE_RE);
  if (type) fields.invoiceType = type[1];

  fields.buyerName = extractPersonName(fields.buyer);
  return fields;
}

/** 云端 VatInvoiceOCR 键值对映射为字段 */
export function mapVatInfos(infos: Array<{ Name: string; Value: string }>): InvoiceFields {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const hit = infos.find((i) => i.Name === k) || infos.find((i) => i.Name.includes(k));
      if (hit?.Value) return hit.Value.trim();
    }
    return "";
  };
  const buyer = get("购买方名称", "购方名称");
  const fields: InvoiceFields = {
    invoiceNumber: get("发票号码").replace(/\D/g, "") || undefined,
    date: normalizeDate(get("开票日期")),
    amount: normalizeAmount(get("价税合计(小写)", "小写金额", "价税合计", "合计金额")),
    buyer: buyer || undefined,
    seller: get("销售方名称", "销方名称") || undefined,
    invoiceType: get("发票类型", "发票名称") || undefined,
  };
  fields.buyerName = extractPersonName(fields.buyer);
  return fields;
}

export function mergeFields(base: InvoiceFields, patch?: InvoiceFields | null): InvoiceFields {
  if (!patch) return base;
  const out: InvoiceFields = { ...base };
  (Object.keys(patch) as Array<keyof InvoiceFields>).forEach((k) => {
    const v = patch[k];
    if (v !== undefined && v !== null && v !== ("" as unknown)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v;
    }
  });
  return out;
}

export function hasKeyFields(f: InvoiceFields): boolean {
  return !!(f.invoiceNumber || f.amount !== undefined || f.buyerName);
}
