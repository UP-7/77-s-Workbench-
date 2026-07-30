import { todayStr } from "./utils";

export interface ParsedTodo {
  title: string;
  date: string; // yyyy-MM-dd
  time?: string; // HH:mm
  remind: boolean;
}

const CN_DIGIT: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12,
};

function cnHour(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (CN_DIGIT[s] !== undefined) return CN_DIGIT[s];
  return null;
}

const WEEK_MAP: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

/**
 * 本地待办语音解析（AI 不可用时的降级方案）。
 * 例："明天下午三点提醒我给妈妈打电话"
 *  → { title: 给妈妈打电话, date: 明天, time: 15:00, remind: true }
 */
export function parseTodoLocal(raw: string, now = new Date()): ParsedTodo | null {
  let text = raw.trim().replace(/[，。,.！!？?]/g, "");
  if (!text) return null;

  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dateFound = false;

  // 相对日期
  const rel: Array<[RegExp, number]> = [
    [/大后天/, 3],
    [/后天/, 2],
    [/明天|明儿/, 1],
    [/今天|今晚|今儿/, 0],
  ];
  for (const [re, offset] of rel) {
    if (re.test(text)) {
      target.setDate(target.getDate() + offset);
      text = text.replace(re, "");
      dateFound = true;
      break;
    }
  }

  // 周 X / 下周 X
  if (!dateFound) {
    const wm = text.match(/(下+)?(?:周|星期|礼拜)([一二三四五六日天])/);
    if (wm) {
      const wd = WEEK_MAP[wm[2]];
      const cur = target.getDay();
      let diff = (wd - cur + 7) % 7;
      if (wm[1]) diff += 7 * wm[1].length; // "下"每出现一次 +7
      else if (diff === 0) diff = 7; // 本周已过 → 下周
      target.setDate(target.getDate() + diff);
      text = text.replace(wm[0], "");
      dateFound = true;
    }
  }

  // N月N号 / N号
  if (!dateFound) {
    const md = text.match(/(\d{1,2})月(\d{1,2})[号日]/);
    if (md) {
      target.setMonth(parseInt(md[1], 10) - 1, parseInt(md[2], 10));
      if (target < now) target.setFullYear(target.getFullYear() + 1);
      text = text.replace(md[0], "");
      dateFound = true;
    } else {
      const d = text.match(/(\d{1,2})[号日]/);
      if (d) {
        target.setDate(parseInt(d[1], 10));
        if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          target.setMonth(target.getMonth() + 1);
        }
        text = text.replace(d[0], "");
        dateFound = true;
      }
    }
  }

  // 时间：H点 / H点半 / H点N分 / HH:mm，配合 上午/下午/晚上/中午
  let time: string | undefined;
  const isPM = /下午|晚上|傍晚|夜里|晚/.test(text);
  const isNoon = /中午/.test(text);
  text = text.replace(/上午|早上|早晨|下午|晚上|傍晚|夜里|中午/g, "");

  const colon = text.match(/(\d{1,2})[:：](\d{2})/);
  if (colon) {
    let h = parseInt(colon[1], 10);
    if (isPM && h < 12) h += 12;
    time = `${String(h).padStart(2, "0")}:${colon[2]}`;
    text = text.replace(colon[0], "");
  } else {
    const dot = text.match(/([\d一二两三四五六七八九十]{1,3})点(半|一刻|三刻|(\d{1,2})分?)?/);
    if (dot) {
      let h = cnHour(dot[1]) ?? NaN;
      if (!Number.isNaN(h)) {
        if (isNoon && h <= 2) h += 12;
        if (isPM && h < 12) h += 12;
        let m = 0;
        if (dot[2] === "半") m = 30;
        else if (dot[2] === "一刻") m = 15;
        else if (dot[2] === "三刻") m = 45;
        else if (dot[3]) m = parseInt(dot[3], 10);
        time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        text = text.replace(dot[0], "");
      }
    }
  }

  // 剥离提醒/助词
  const remindWord = /提醒我|提醒|别忘了|记得|叫我/.test(text);
  text = text
    .replace(/提醒我|提醒|别忘了|记得|叫我/g, "")
    .replace(/^(我要|我得|要|去|帮我)/, "")
    .trim();

  const title = text || "待办事项";
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");

  return {
    title: title.slice(0, 40),
    date: dateFound ? `${y}-${m}-${d}` : todayStr(now),
    time,
    remind: Boolean(time && (remindWord || true)), // 说了时间默认开提醒
  };
}
