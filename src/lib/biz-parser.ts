export type ParsedBiz =
  | { action: "purchase"; name: string; cost: number; shipping: number }
  | { action: "sale"; query: string; amount: number }
  | { action: "expense"; name: string; amount: number };

function firstAmount(text: string, exclude?: string): number | null {
  const cleaned = exclude ? text.replace(exclude, "") : text;
  const m = cleaned.match(/(\d+(?:\.\d{1,2})?)\s*(?:块钱|块|元)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 商账语音本地解析（AI 降级方案）。
 * 售出："3号卖了150" / "HL-0002 出了 200"
 * 进货："进了一只八宝葫芦 成本80 运费10"
 * 支出："买了个电烙铁 45块"
 */
export function parseBizLocal(raw: string): ParsedBiz | null {
  const text = raw.trim().replace(/[，。,.！!？?]/g, " ");
  if (!text) return null;

  const isSale = /卖|售出|出了|出手|成交/.test(text);
  const isPurchase = /进了|进货|收了|入手|拿了|批了|上新/.test(text);
  const isExpense = /买了|购置|添置|工具|损耗|耗材/.test(text);

  if (isSale) {
    // 定位词：编号（HL-0001 / hl0001）或 "3号"或名称片段
    let query = "";
    const code = text.match(/([a-zA-Z]{1,5}-?\d{1,6})/);
    const nth = text.match(/(\d{1,4})\s*号/);
    if (code) query = code[1].toUpperCase();
    else if (nth) query = nth[1];
    else {
      query = text
        .replace(/卖|售出|出了|出手|成交|了|的/g, " ")
        .replace(/(\d+(?:\.\d{1,2})?)\s*(块钱|块|元)?/g, " ")
        .trim()
        .split(/\s+/)[0] ?? "";
    }
    // 金额：优先"卖了150"里跟随动词的数字；排除 "3号" 干扰
    const saleAmt = text.match(/(?:卖|售出|出了|出手|成交)[^\d]*(\d+(?:\.\d{1,2})?)/);
    const amount = saleAmt ? parseFloat(saleAmt[1]) : firstAmount(text, nth?.[0]);
    if (!amount) return null;
    return { action: "sale", query, amount };
  }

  if (isPurchase) {
    const costM = text.match(/(?:成本|进价|花了|价格)[^\d]*(\d+(?:\.\d{1,2})?)/);
    const shipM = text.match(/(?:运费|快递|邮费)[^\d]*(\d+(?:\.\d{1,2})?)/);
    const cost = costM ? parseFloat(costM[1]) : firstAmount(text, shipM?.[0]);
    const shipping = shipM ? parseFloat(shipM[1]) : 0;
    if (!cost) return null;
    let name = text
      .replace(/进了|进货|收了|入手|拿了|批了|上新|一只|一个|一把|了/g, " ")
      .replace(/(成本|进价|花了|价格|运费|快递|邮费)[^\d]*\d+(\.\d{1,2})?(块钱|块|元)?/g, " ")
      .replace(/(\d+(?:\.\d{1,2})?)\s*(块钱|块|元)?/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) name = "新商品";
    return { action: "purchase", name: name.slice(0, 20), cost, shipping };
  }

  if (isExpense) {
    const amount = firstAmount(text);
    if (!amount) return null;
    let name = text
      .replace(/买了|购置|添置|个|了/g, " ")
      .replace(/(\d+(?:\.\d{1,2})?)\s*(块钱|块|元)?/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) name = "经营支出";
    return { action: "expense", name: name.slice(0, 20), amount };
  }

  return null;
}
