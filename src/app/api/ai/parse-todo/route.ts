import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai";
import { parseTodoLocal } from "@/lib/todo-parser";

export const runtime = "nodejs";
export const maxDuration = 20;

/** 待办语音解析："明天下午三点提醒我给妈妈打电话" → 结构化待办 */
export async function POST(req: Request) {
  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").slice(0, 200);
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: "内容为空" }, { status: 400 });

  const local = parseTodoLocal(text);
  const model = getAIModel();
  if (!model) return NextResponse.json({ parsed: local, source: "local" });

  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  try {
    const { text: out } = await generateText({
      model,
      system:
        "你是待办事项解析器。把中文口语转成 JSON，仅输出 JSON。" +
        `格式：{"title":"事项内容","date":"YYYY-MM-DD","time":"HH:mm"或null,"remind":布尔}。` +
        "title 要去掉时间词和「提醒我」等词，保留核心事项；说了具体时间则 remind 为 true。" +
        `今天是 ${now.toISOString().slice(0, 10)} ${weekdays[now.getDay()]}。` +
        '示例："明天下午三点提醒我给妈妈打电话" → {"title":"给妈妈打电话","date":"明天的日期","time":"15:00","remind":true}',
      prompt: text,
      maxTokens: 120,
      temperature: 0,
    });
    const match = out.match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]) as { title?: string; date?: string; time?: string | null; remind?: boolean };
      if (p.title && p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
        return NextResponse.json({
          parsed: {
            title: String(p.title).slice(0, 40),
            date: p.date,
            time: p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : undefined,
            remind: Boolean(p.remind && p.time),
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
