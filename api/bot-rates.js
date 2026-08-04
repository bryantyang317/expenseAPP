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

    // Bank of Taiwan flcsv: cells[3] is cash sell rate.
    const cashSell = parseNumber(cells[3]);
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
