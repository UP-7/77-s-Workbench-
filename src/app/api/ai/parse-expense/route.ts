import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai";
import { parseExpenseLocal } from "@/lib/expense-parser";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * 语音/文本记账解析。
 * 例："今天午饭花了25块" → { amount: 25, category: "餐饮", note: "午饭", type: "expense" }
 */
export async function POST(req: Request) {
  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").slice(0, 200);
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "内容为空" }, { status: 400 });
  }

  const local = parseExpenseLocal(text);
  const model = getAIModel();
  if (!model) {
    return NextResponse.json({ parsed: local, source: "local" });
  }

  try {
    const { text: out } = await generateText({
      model,
      system:
        "你是记账解析器。把用户的中文口语转成 JSON，仅输出 JSON，不要任何其他文字。" +
        `格式：{"amount":数字,"category":"分类","note":"简短备注","type":"expense|income"}。` +
        `支出分类限定：${EXPENSE_CATEGORIES.join("/")}；收入分类限定：${INCOME_CATEGORIES.join("/")}。` +
        '示例：用户说"今天午饭花了25块" → {"amount":25,"category":"餐饮","note":"午饭","type":"expense"}',
      prompt: text,
      maxTokens: 120,
      temperature: 0,
    });
    const match = out.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        amount?: number;
        category?: string;
        note?: string;
        type?: string;
      };
      const amount = Number(parsed.amount);
      if (Number.isFinite(amount) && amount > 0) {
        return NextResponse.json({
          parsed: {
            amount,
            category: String(parsed.category || "其他").slice(0, 8),
            note: String(parsed.note || "").slice(0, 30) || "记账",
            type: parsed.type === "income" ? "income" : "expense",
          },
          source: "ai",
        });
      }
    }
    return NextResponse.json({ parsed: local, source: "local" });
  } catch {
    return NextResponse.json({ parsed: local, source: "local" });
  }
}
