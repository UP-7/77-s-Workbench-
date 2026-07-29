import type { ParsedExpense } from "./types";

const CATEGORY_RULES: Array<{ category: string; words: string[] }> = [
  { category: "餐饮", words: ["饭", "餐", "吃", "喝", "奶茶", "咖啡", "外卖", "早点", "午饭", "晚饭", "宵夜", "火锅", "烧烤", "面", "米线", "食"] },
  { category: "交通", words: ["车", "地铁", "公交", "打车", "滴滴", "油", "加油", "停车", "高铁", "机票", "火车"] },
  { category: "购物", words: ["买", "购", "淘宝", "京东", "拼多多", "衣服", "鞋", "包"] },
  { category: "娱乐", words: ["电影", "游戏", "唱歌", "KTV", "玩", "门票", "会员"] },
  { category: "居家", words: ["水费", "电费", "燃气", "房租", "物业", "日用", "纸巾", "洗衣"] },
  { category: "文玩", words: ["葫芦", "核桃", "手串", "菩提", "文玩", "串", "把件"] },
  { category: "医疗", words: ["药", "医院", "挂号", "体检", "看病"] },
  { category: "人情", words: ["红包", "礼", "请客", "份子"] },
];

const INCOME_WORDS = ["收入", "收到", "赚", "卖了", "卖出", "工资", "发了", "进账", "回款", "转来"];

const CN_NUM: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100, 千: 1000, 万: 10000,
};

function parseChineseNumber(s: string): number | null {
  if (!s) return null;
  let total = 0;
  let current = 0;
  let valid = false;
  for (const ch of s) {
    const v = CN_NUM[ch];
    if (v === undefined) return null;
    valid = true;
    if (v >= 10) {
      current = current === 0 ? v : current * v;
      if (v === 10000) {
        total = (total + current) * (v === 10000 ? 1 : 0);
        total = total === 0 ? current : total;
        current = 0;
      }
    } else {
      if (current >= 10) {
        total += current;
        current = v;
      } else {
        current = current * 10 + v;
      }
    }
  }
  const result = total + current;
  return valid && result > 0 ? result : null;
}

/**
 * 本地规则解析（语音/文字记账降级方案，离线可用）。
 * 例："今天午饭花了25块" → { amount: 25, category: 餐饮, note: 午饭, type: expense }
 */
export function parseExpenseLocal(raw: string): ParsedExpense | null {
  const text = raw.trim();
  if (!text) return null;

  let amount: number | null = null;
  // 阿拉伯数字：25、25.5、25块/元/毛
  const numMatch = text.match(/(\d+(?:\.\d{1,2})?)\s*(?:块钱|块|元|米|毛)?/);
  if (numMatch && numMatch[1]) {
    amount = parseFloat(numMatch[1]);
    if (numMatch[0].includes("毛")) amount = amount / 10;
  }
  // 中文数字：二十五块
  if (amount === null || Number.isNaN(amount) || amount === 0) {
    const cnMatch = text.match(/([零一二两三四五六七八九十百千万]+)\s*(?:块钱|块|元)/);
    if (cnMatch) amount = parseChineseNumber(cnMatch[1]);
  }
  if (!amount || Number.isNaN(amount) || amount <= 0) return null;

  const type = INCOME_WORDS.some((w) => text.includes(w)) ? "income" : "expense";

  let category = type === "income" ? "其他" : "其他";
  if (type === "income") {
    if (/工资|发了/.test(text)) category = "工资";
    else if (/卖|出|售/.test(text)) category = "出售";
  } else {
    for (const rule of CATEGORY_RULES) {
      if (rule.words.some((w) => text.includes(w))) {
        category = rule.category;
        break;
      }
    }
  }

  // 备注：去掉金额与常见动词后的核心短语
  let note = text
    .replace(/(\d+(?:\.\d{1,2})?)\s*(块钱|块|元|米|毛)?/g, "")
    .replace(/[零一二两三四五六七八九十百千万]+\s*(块钱|块|元)/g, "")
    .replace(/今天|昨天|刚才|花了|花|用了|支出|消费|付了|买了|收到|收入|赚了|了|的/g, "")
    .replace(/[，。,.！!？?\s]/g, "")
    .trim();
  if (!note) note = category;
  if (note.length > 20) note = note.slice(0, 20);

  return { amount, category, note, type };
}
