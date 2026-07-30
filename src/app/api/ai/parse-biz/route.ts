import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai";
import { parseBizLocal } from "@/lib/biz-parser";

export const runtime = "nodejs";
export const maxDuration = 20;

/** 商账语音解析：售出 / 进货 / 经营支出 */
export async function POST(req: Request) {
  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").slice(0, 200);
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: "内容为空" }, { status: 400 });

  const local = parseBizLocal(text);
  const model = getAIModel();
  if (!model) return NextResponse.json({ parsed: local, source: "local" });

  try {
    const { text: out } = await generateText({
      model,
      system:
        "你是店铺记账解析器。将中文口语转成 JSON，仅输出 JSON，不要其他文字。" +
        '格式：{"action":"purchase|sale|expense","name":"商品或名目","query":"售出时的编号或商品关键词","amount":数字,"shipping":数字}。' +
        "action 判定：进货/收货/入手=purchase（amount 为进货成本，shipping 为运费默认0）；卖出/售出/成交=sale（amount 为成交价，query 为编号如 HL-0003 或 3 或商品关键词）；买工具/耗材=expense。" +
        '示例："3号卖了150" → {"action":"sale","query":"3","amount":150,"name":"","shipping":0}；' +
        '"进了一只八宝葫芦成本80运费10" → {"action":"purchase","name":"八宝葫芦","amount":80,"shipping":10,"query":""}',
      prompt: text,
      maxTokens: 120,
      temperature: 0,
    });
    const match = out.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]) as {
        action?: string;
        name?: string;
        query?: string;
        amount?: number;
        shipping?: number;
      };
      const amount = Number(p.amount);
      if (Number.isFinite(amount) && amount > 0) {
        if (p.action === "sale") {
          return NextResponse.json({
            parsed: { action: "sale", query: String(p.query || p.name || "").slice(0, 20), amount },
            source: "ai",
          });
        }
        if (p.action === "purchase") {
          return NextResponse.json({
            parsed: {
              action: "purchase",
              name: String(p.name || "新商品").slice(0, 20),
              cost: amount,
              shipping: Number(p.shipping) || 0,
            },
            source: "ai",
          });
        }
        if (p.action === "expense") {
          return NextResponse.json({
            parsed: { action: "expense", name: String(p.name || "经营支出").slice(0, 20), amount },
            source: "ai",
          });
        }
      }
    }
    return NextResponse.json({ parsed: local, source: "local" });
  } catch {
    return NextResponse.json({ parsed: local, source: "local" });
  }
}
