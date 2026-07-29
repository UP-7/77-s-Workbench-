import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

interface InsightInput {
  nickname?: string;
  city?: string;
  weather?: { tempC?: number; desc?: string; humidity?: number } | null;
  todosToday?: string[];
  doneCount?: number;
  totalCount?: number;
  monthExpense?: number;
  collectionAlerts?: string[];
  stockCount?: number;
}

function localInsight(d: InsightInput): string {
  const name = d.nickname || "77";
  const hour = new Date().getHours();
  const greet = hour < 5 ? "凌晨好" : hour < 11 ? "早安" : hour < 14 ? "午安" : hour < 18 ? "下午好" : "晚上好";
  const parts: string[] = [`${name}，${greet}。`];

  if (d.weather?.desc) {
    const dry = (d.weather.humidity ?? 50) < 40;
    parts.push(
      `${d.city || ""}今日${d.weather.desc}${
        typeof d.weather.tempC === "number" ? ` ${Math.round(d.weather.tempC)}°C` : ""
      }${dry ? "，空气偏干" : ""}。`
    );
    if (dry && d.collectionAlerts?.length) {
      parts.push(`记得给${d.collectionAlerts[0]}做好保湿养护。`);
    }
  } else if (d.collectionAlerts?.length) {
    parts.push(`别忘了照看${d.collectionAlerts[0]}。`);
  }

  const total = d.totalCount ?? 0;
  const done = d.doneCount ?? 0;
  if (total > 0) {
    parts.push(done >= total ? "今日待办已全部完成，漂亮！" : `今天还有 ${total - done} 件事待办，稳步推进。`);
  } else {
    parts.push("今天还没有安排，去计划里写下第一件事吧。");
  }

  if (typeof d.monthExpense === "number" && d.monthExpense > 0) {
    parts.push(`本月已支出 ¥${Math.round(d.monthExpense)}，心里有数就好。`);
  }
  return parts.join("");
}

export async function POST(req: Request) {
  let input: InsightInput = {};
  try {
    input = (await req.json()) as InsightInput;
  } catch {
    /* 空输入也可生成 */
  }

  const model = getAIModel();
  if (!model) {
    return NextResponse.json({ text: localInsight(input), source: "local" });
  }

  try {
    const { text } = await generateText({
      model,
      system:
        "你是「77的工作台」的贴心晨报助手。用中文生成一段 60~90 字的拟人化问候：亲切自然、口语化、不做作。" +
        "结合给到的天气、待办完成情况、本月支出、文玩养护提醒等信息给出 1~2 条具体建议（如天气干燥要给葫芦加湿）。" +
        "直接输出正文，不要标题、不要列表、不要 emoji 滥用（最多 1 个）。",
      prompt: `数据：${JSON.stringify(input, null, 0)}\n当前时间：${new Date().toLocaleString("zh-CN")}`,
      maxTokens: 220,
      temperature: 0.8,
    });
    return NextResponse.json({ text: text.trim(), source: "ai" });
  } catch {
    return NextResponse.json({ text: localInsight(input), source: "local" });
  }
}
