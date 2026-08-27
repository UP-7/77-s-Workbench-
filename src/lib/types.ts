/* ================= 每日计划 ================= */
export interface Todo {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  time?: string; // HH:mm，用于提醒
  done: boolean;
  doneAt?: number;
  remind: boolean;
  notified: boolean;
  createdAt: number;
}

/* ================= 收支账本 ================= */
export type RecordType = "expense" | "income";

export const EXPENSE_CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "娱乐",
  "居家",
  "文玩",
  "医疗",
  "人情",
  "其他",
] as const;

export const INCOME_CATEGORIES = ["工资", "副业", "出售", "理财", "其他"] as const;

export interface FinanceRecord {
  id: string;
  type: RecordType;
  amount: number;
  category: string;
  note: string;
  date: string; // yyyy-MM-dd
  createdAt: number;
  source: "voice" | "manual" | "ai";
}

export interface ParsedExpense {
  amount: number;
  category: string;
  note: string;
  type: RecordType;
}

/* ================= 文玩阁 ================= */
export const COLLECTION_CATEGORIES = ["葫芦", "核桃", "手串", "菩提", "玉石", "其他"] as const;

export interface CollectionItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  acquiredAt: string; // yyyy-MM-dd 入手日期
  patina: string; // 皮质评价
  notes: string; // 盘玩心得
  playSeconds: number; // 累计盘玩秒数
  playingSince: number | null; // 计时开始时间戳（支持后台运行）
  coverMediaId?: string;
  humidityCare: boolean; // 是否需要加湿养护（干燥预警用）
  createdAt: number;
}

export interface MediaMeta {
  id: string;
  itemId: string;
  type: "image" | "video";
  takenAt: number;
  size: number;
}

/* ================= 葫芦商账 ================= */
export type GourdStatus = "in_stock" | "reserved" | "sold";

export const GOURD_STATUS_LABEL: Record<GourdStatus, string> = {
  in_stock: "在库",
  reserved: "预定",
  sold: "已售",
};

export interface GourdSale {
  id: string;
  qty: number; // 本次售出数量
  unitPrice: number; // 成交单价（每件）
  date: string; // yyyy-MM-dd
}

export interface Gourd {
  id: string;
  code: string; // 编号（可用于扫码）
  name: string;
  variety: string; // 品种：美国、本长、手捻、异形…
  status: GourdStatus;
  costPrice: number; // 进货总价（整批；quantity=1 时即单件价）
  shippingCost: number; // 快递费
  quantity?: number; // 进货数量（老数据缺省视为 1）
  sales?: GourdSale[]; // 售出流水（新模型；老数据由 salePrice/soldAt 归一化）
  salePrice?: number; // [旧] 售价——仅老数据存在，读取时归一化为一笔流水
  soldAt?: string; // yyyy-MM-dd（售罄日期）
  reservedBy?: string;
  note?: string;
  createdAt: number;
}

export interface BizExpense {
  id: string;
  name: string; // 如：电烙铁
  amount: number;
  date: string; // yyyy-MM-dd
  kind: "tool" | "shipping" | "other";
}

/* ================= 雕刻素材坊 ================= */
export interface CarvingAsset {
  id: string;
  name: string;
  kind: "art-text" | "sketch"; // 艺术字 / 简笔画
  widthMm: number; // 打印/雕刻目标宽度（毫米）
  heightMm: number;
  size: number;
  createdAt: number;
}

/* ================= 技术资讯 ================= */
export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: number;
}

/* ================= 发票管家 ================= */
export type InvoiceStatus = "pending" | "processing" | "success" | "failed";

export interface InvoiceFields {
  buyerName?: string;
  invoiceNumber?: string;
  amount?: number;
  /** YYYY-MM-DD */
  date?: string;
  invoiceType?: string;
  buyer?: string;
  seller?: string;
  /** 事项：酒店、火车票、餐费等 */
  item?: string;
  /** 备注：走访、出差等 */
  remark?: string;
}

export interface InvoiceRecord {
  id: string;
  batchId?: string;
  fileKey: string;
  originalName: string;
  newName?: string;
  ext: string;
  mime: string;
  size: number;
  status: InvoiceStatus;
  fields: InvoiceFields;
  error?: string;
  ocrSource?: "cloud" | "local" | "manual";
  thumbAt?: number;
  createdAt: number;
}

export interface InvoiceBatch {
  id: string;
  name: string;
  createdAt: number;
  records: InvoiceRecord[];
  total: number;
  success: number;
  failed: number;
  reimburser?: string;
}

/* ================= 备份 ================= */
export interface BackupPayload {
  version: 1;
  exportedAt: number;
  planner: unknown;
  finance: unknown;
  business: unknown;
  collection: unknown;
  feedFavorites: unknown;
  settings: unknown;
}
