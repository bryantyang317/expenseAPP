const BOT_RATE_URL = "https://rate.bot.com.tw/xrt/flcsv/0/day";

const parseNumber = value => {
  const n = Number(String(value || "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseRates = csv => {
  const rates = {};
  const lines = csv.split(/\r?\n/).filter(Boolean);

  // ── Debug：印出前兩行，確認 CSV 格式 ──
  console.log("=== CSV 前兩行 ===");
  console.log("第0行（標題）:", lines[0]);
  console.log("第1行（第一筆資料）:", lines[1]);

  // 印出第一筆資料的每個欄位（方便確認 index）
  if (lines[1]) {
    const debugCells = lines[1].split(",").map(c => c.replace(/^"|"$/g, "").trim());
    debugCells.forEach((cell, i) => {
      console.log(`  cells[${i}] = "${cell}"`);
    });
  }
  // ── Debug 結束 ──

  for (const line of lines) {
    const cells = line.split(",").map(cell => cell.replace(/^"|"$/g, "").trim());
    const code = cells[0];
    if (!/^[A-Z]{3}$/.test(code)) continue;

    const cashSell = parseNumber(cells[12]); // 現金賣出
    if (cashSell) rates[code] = cashSell;
  }

  return rates;
};

export default async function handler(req, res) {
  try {
    console.log("=== 開始抓取台銀匯率 ===");
    console.log("請求時間:", new Date().toISOString());

    const response = await fetch(BOT_RATE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    console.log("HTTP 狀態碼:", response.status);
    console.log("Content-Type:", response.headers.get("content-type"));

    if (!response.ok) {
      console.error("抓取失敗，狀態碼:", response.status);
      res.status(response.status).json({ error: "BOT_RATE_FETCH_FAILED" });
      return;
    }

    const csv = await response.text();
    console.log("CSV 總長度（字元數）:", csv.length);
    console.log("CSV 總行數:", csv.split(/\r?\n/).filter(Boolean).length);

    const rates = parseRates(csv);
    console.log("解析到幾種幣別:", Object.keys(rates).length);
    console.log("解析結果:", JSON.stringify(rates));

    if (!Object.keys(rates).length) {
      console.error("解析失敗，rates 是空的");
      res.status(502).json({ error: "BOT_RATE_PARSE_FAILED" });
      return;
    }

    console.log("=== 成功回傳 ===");
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({
      source: "Bank of Taiwan",
      rateType: "cashSell",
      base: "TWD",
      updatedAt: new Date().toISOString(),
      rates
    });
  } catch (error) {
    console.error("發生例外錯誤:", error.message);
    console.error("錯誤堆疊:", error.stack);
    res.status(500).json({ error: "BOT_RATE_PROXY_ERROR", message: error.message });
  }
}
