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
  /** 用户本地小时（0-23）——服务器跑在海外节点（UTC），时间判断必须以客户端为准 */
  clientHour?: number;
  /** 用户本地完整时间串，供 AI 参考 */
  clientTime?: string;
  /** 客户端时段名：晨报/午报/午后报/晚报/夜报 */
  slotLabel?: string;
}

/** 问候语：与前端 daySlot 的时段边界保持一致 */
function greeting(hour: number): string {
  if (hour < 5) return "凌晨好";
  if (hour < 11) return "早安";
  if (hour < 14) return "午安";
  if (hour < 18) return "下午好";
  return "晚上好";
}

const ALL_GREETS = ["凌晨好", "早上好", "早安", "中午好", "午安", "下午好", "晚上好", "晚安"];

/** 兜底：AI 输出开头若带了错误时段的问候词，强制替换为正确问候（只检查前 14 字，避免误伤正文如"晚上好好休息"） */
function fixGreeting(text: string, correct: string): string {
  const head = text.slice(0, 14);
  for (const g of ALL_GREETS) {
    if (g === correct) continue;
    const idx = head.indexOf(g);
    if (idx !== -1) return text.slice(0, idx) + correct + text.slice(idx + g.length);
  }
  return text;
}

function localInsight(d: InsightInput): string {
  const name = d.nickname || "77";
  // 优先使用客户端上报的本地小时；缺失时才退回服务器时间（本地 localhost 场景两者一致）
  const hour = typeof d.clientHour === "number" ? d.clientHour : new Date().getHours();
  const greet = greeting(hour);
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
    const hour = typeof input.clientHour === "number" ? input.clientHour : new Date().getHours();
    const greet = greeting(hour);
    const slot = input.slotLabel || "晨报";
    const { text } = await generateText({
      model,
      system:
        `你是「77的工作台」的贴心${slot}助手。用中文生成一段 60~90 字的拟人化问候：亲切自然、口语化、不做作。` +
        `当前是用户本地时间 ${input.clientTime || `${hour} 点`}，问候语必须符合这个时段（本时段标准问候：「${greet}」），严禁使用其他时段的问候（如晚上说早安）。` +
        "结合给到的天气、待办完成情况、本月支出、文玩养护提醒等信息给出 1~2 条具体建议（如天气干燥要给葫芦加湿）。" +
        "直接输出正文，不要标题、不要列表、不要 emoji 滥用（最多 1 个）。",
      prompt: `数据：${JSON.stringify(input, null, 0)}`,
      maxTokens: 220,
      temperature: 0.8,
    });
    return NextResponse.json({ text: fixGreeting(text.trim(), greet), source: "ai" });
  } catch {
    return NextResponse.json({ text: localInsight(input), source: "local" });
  }
}
