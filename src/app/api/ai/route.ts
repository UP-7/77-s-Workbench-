import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getAIModel } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function GET() {
  const model = getAIModel();
  return NextResponse.json({ configured: !!model });
}

export async function POST(req: NextRequest) {
  const model = getAIModel();
  if (!model) {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 501 });
  }
  try {
    const body = (await req.json()) as { messages?: unknown; json?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) {
      return NextResponse.json({ error: "messages 非法" }, { status: 400 });
    }
    const messages: ChatMessage[] = body.messages.map((m) => {
      const mm = m as { role?: unknown; content?: unknown };
      const role = ["system", "user", "assistant"].includes(mm.role as string)
        ? (mm.role as "system" | "user" | "assistant")
        : "user";
      const content = typeof mm.content === "string" ? mm.content.slice(0, 12_000) : "";
      return { role, content };
    });

    try {
      const { text } = await generateText({
        model,
        messages,
        maxTokens: 1500,
        temperature: 0.4,
      });
      if (!text) {
        return NextResponse.json({ error: "AI 服务暂不可用" }, { status: 502 });
      }
      return NextResponse.json({ content: text });
    } catch {
      return NextResponse.json({ error: "AI 服务暂不可用" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "请求处理失败" }, { status: 400 });
  }
}
