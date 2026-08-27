import { createOpenAI } from "@ai-sdk/openai";
import type { InvoiceFields } from "@/lib/types";
import { normalizeAmount, normalizeDate } from "@/lib/invoice/parse";
import { fetchRetry } from "@/lib/fetchRetry";

/**
 * Vercel AI SDK Provider：默认适配 DeepSeek（OpenAI 兼容协议）。
 * 也可通过环境变量指向任意兼容网关（如 CodeBuddy / OpenRouter）。
 * 密钥仅存于服务端环境变量，绝不下发客户端。
 */
export function getAIModel() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return null;
  const provider = createOpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
  });
  return provider(process.env.AI_MODEL || "deepseek-chat");
}

/* ================= 客户端 AI 工具函数 ================= */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

let cachedConfigured: boolean | null = null;

export async function isAiConfigured(): Promise<boolean> {
  if (cachedConfigured !== null) return cachedConfigured;
  try {
    const r = await fetchRetry("/api/ai", { method: "GET" });
    const d = await r.json();
    cachedConfigured = !!d.configured;
  } catch {
    cachedConfigured = false;
  }
  return cachedConfigured;
}

export async function aiChat(
  messages: ChatMessage[],
  opts: { json?: boolean; timeout?: number } = {}
): Promise<string | null> {
  try {
    const r = await fetchRetry("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, json: !!opts.json }),
      signal: AbortSignal.timeout(opts.timeout ?? 20_000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.content === "string" && d.content ? d.content : null;
  } catch {
    return null;
  }
}

/** 从 AI 回复中提取 JSON 对象 */
export function extractJson<T = unknown>(text: string): T | null {
  try {
    const cleaned = text.replace(/```(json)?/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** AI 清洗发票字段（失败返回 null，调用方保持原值） */
export async function aiCleanInvoice(
  fields: InvoiceFields,
  rawText: string
): Promise<InvoiceFields | null> {
  if (!(await isAiConfigured())) return null;
  const content = await aiChat(
    [
      {
        role: "system",
        content:
          '你是发票数据清洗助手。根据 OCR 原始文本与初步字段，纠正识别错误并输出严格 JSON：{"buyerName":"购买方姓名或抬头","invoiceNumber":"发票号码(纯数字)","amount":价税合计数字,"date":"YYYY-MM-DD","invoiceType":"发票类型","buyer":"购买方名称","seller":"销售方名称","item":"报销事项(酒店/火车票/机票/打车/餐费/办公用品/其他)"}。不确定的字段填 null，禁止编造。只输出 JSON。',
      },
      {
        role: "user",
        content: `初步字段：${JSON.stringify(fields)}\nOCR 原文（可能有噪声）：\n${rawText.slice(0, 1800)}`,
      },
    ],
    { json: true, timeout: 15_000 }
  );
  if (!content) return null;
  const o = extractJson<Record<string, unknown>>(content);
  if (!o) return null;
  const pick = (k: string) =>
    typeof o[k] === "string" && (o[k] as string).trim() && o[k] !== "null"
      ? (o[k] as string).trim().slice(0, 60)
      : undefined;
  const out: InvoiceFields = {
    buyerName: pick("buyerName"),
    invoiceNumber: pick("invoiceNumber")?.replace(/\D/g, "") || undefined,
    amount: normalizeAmount(String(o.amount ?? "")),
    date: normalizeDate(pick("date") || ""),
    invoiceType: pick("invoiceType"),
    buyer: pick("buyer"),
    seller: pick("seller"),
    item: pick("item"),
  };
  return out;
}
