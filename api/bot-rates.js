const BOT_RATE_URL = "https://rate.bot.com.tw/xrt/flcsv/0/day";

const parseNumber = value => {
  const n = Number(String(value || "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseRates = csv => {
  const rates = {};
  const lines = csv.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const cells = line.split(",").map(cell => cell.replace(/^"|"$/g, "").trim());
    const code = cells[0];
    if (!/^[A-Z]{3}$/.test(code)) continue;

    // 台銀 flcsv 欄位順序：
    // [0]  幣別
    // [2]  現金買入
    // [3]  即期買入
    // [4~10] 遠期買入
    // [12] 現金賣出  ← 這才是正確的現金賣出
    // [13] 即期賣出
    const cashSell = parseNumber(cells[12]); // 修正：從 3 改為 12
    if (cashSell) rates[code] = cashSell;
  }

  return rates;
};

export default async function handler(req, res) {
  try {
    const response = await fetch(BOT_RATE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "BOT_RATE_FETCH_FAILED" });
      return;
    }

    const csv = await response.text();

    // Debug 用：印出第一行看欄位（上線後可移除）
    // console.log(csv.split(/\r?\n/)[1]);

    const rates = parseRates(csv);

    if (!Object.keys(rates).length) {
      res.status(502).json({ error: "BOT_RATE_PARSE_FAILED" });
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({
      source: "Bank of Taiwan",
      rateType: "cashSell",
      base: "TWD",
      updatedAt: new Date().toISOString(),
      rates
    });
  } catch (error) {
    res.status(500).json({ error: "BOT_RATE_PROXY_ERROR" });
  }
}
