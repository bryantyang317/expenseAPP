const BOT_RATE_URL = "https://rate.bot.com.tw/xrt/flcsv/0/day";
const TARGET_CODES = new Set(["USD", "JPY", "EUR", "CNY", "KRW"]);

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
    if (!TARGET_CODES.has(code)) continue;

    // 臺銀 flcsv 欄位通常為：幣別、現金買入、現金賣出、即期買入、即期賣出...
    const cashSell = parseNumber(cells[2]);
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
    const rates = parseRates(csv);

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
