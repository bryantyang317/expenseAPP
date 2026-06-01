import { useState, useEffect } from "react";

const DEFAULT_CATEGORIES = {
  "餐飲": ["早餐", "午餐", "晚餐", "飲料", "宵夜"],
  "交通": ["捷運", "公車", "計程車", "油費", "停車"],
  "住宿": ["旅館", "民宿", "租金"],
  "購物": ["服飾", "3C", "超市", "藥妝"],
  "娛樂": ["電影", "KTV", "遊樂園"],
  "醫療": ["門診", "藥品", "保健品"],
  "日用品": ["清潔", "文具", "家居"],
  "旅遊": ["機票", "景點", "行程"],
  "其他": ["雜項"]
};
const DEFAULT_PAYMENTS = {
  "現金": [],
  "信用卡": ["台新信用卡", "富邦信用卡", "國泰信用卡"],
  "金融卡": ["玉山金融卡", "中信金融卡"],
  "行動支付": ["LINE Pay", "街口支付", "Apple Pay"],
  "其他": ["轉帳", "禮券"]
};
const DEFAULT_CAT_ICONS = { "餐飲": "🍜", "交通": "🚌", "住宿": "🏨", "購物": "🛍️", "娛樂": "🎭", "醫療": "💊", "日用品": "🧴", "旅遊": "✈️", "其他": "📌" };
const CATEGORY_ICON_OPTIONS = ["📌", "🍜", "☕", "🍱", "🚌", "🚕", "🏨", "🏠", "🛍️", "🛒", "🎭", "🎬", "🎮", "💊", "🏥", "🧴", "🧹", "✈️", "🎒", "🏋️", "📚", "💼", "🎁", "💡", "📱", "🐾"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const CASH_CURRENCIES = ["台幣TWD", "日幣JPY", "美金USD", "歐元EUR", "人民幣CNY", "韓圜KRW"];
const CURRENCY_OPTIONS = CASH_CURRENCIES.map(label => ({ label, code: label.slice(-3) }));
const CURRENCY_LABELS = new Set(CASH_CURRENCIES);

const fmt = n => Number(n).toLocaleString("zh-TW");
const currencyOrder = code => {
  const idx = CURRENCY_OPTIONS.findIndex(c => c.code === code);
  return idx === -1 ? CURRENCY_OPTIONS.length : idx;
};
const orderedCurrencyEntries = totals => Object.entries(totals)
  .filter(([, amt]) => amt > 0)
  .sort(([a], [b]) => currencyOrder(a) - currencyOrder(b) || a.localeCompare(b));
const normalizeCurrencyCode = code => code === "JYP" ? "JPY" : code;
const currencyCodeOf = e => normalizeCurrencyCode(e.currency || (e.subpayment || "").match(/[A-Z]{3}$/)?.[0] || "TWD");
const sumByCurrency = list => list.reduce((acc, e) => {
  const code = currencyCodeOf(e);
  acc[code] = (acc[code] || 0) + Number(e.amount || 0);
  return acc;
}, {});
const formatCurrencyTotals = totals => {
  const entries = orderedCurrencyEntries(totals);
  return entries.length ? entries.map(([code, amt]) => `${code} ${fmt(amt)}`).join(" · ") : "TWD 0";
};
const safeCell = value => {
  const text = String(value ?? "");
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return protectedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};
const filenameDate = value => value || "all";
const normalizePayments = pm => ({ ...DEFAULT_PAYMENTS, ...(pm || {}), "現金": (pm?.["現金"] || []).filter(item => !CURRENCY_LABELS.has(item)) });
const toDateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => toDateStr(new Date());
const nowDT = () => new Date().toISOString().slice(0, 16);
const monthStart = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}-01`;
const monthEnd = (y, m) => toDateStr(new Date(y, m + 1, 0));

async function load(key) {
  try {
    if (window.storage?.get) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function save(key, val) {
  try {
    if (window.storage?.set) {
      await window.storage.set(key, JSON.stringify(val));
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(e);
  }
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [catIcons, setCatIcons] = useState(DEFAULT_CAT_ICONS);
  const [payments, setPayments] = useState(DEFAULT_PAYMENTS);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [toast, setToast] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [calMonth, setCalMonth] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const [form, setForm] = useState({ amount: "", store: "", category: "", subcategory: "", payment: "", subpayment: "", currency: "TWD", note: "", datetime: nowDT(), project: "" });
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [newProj, setNewProj] = useState({ name: "", desc: "", budget: "", currency: "TWD", exchangeRate: "1" });
  const [rateLoading, setRateLoading] = useState(false);
  const [settingsType, setSettingsType] = useState("category");
  const [expandedParent, setExpandedParent] = useState(null);
  const [newParent, setNewParent] = useState("");
  const [newParentIcon, setNewParentIcon] = useState("📌");
  const [newChild, setNewChild] = useState({});

  const now = new Date();
  const [statsFrom, setStatsFrom] = useState(monthStart(now.getFullYear(), now.getMonth()));
  const [statsTo, setStatsTo] = useState(todayStr());
  const [statsCategory, setStatsCategory] = useState("");
  const [statsSubcategory, setStatsSubcategory] = useState("");
  const [statsPayment, setStatsPayment] = useState("");
  const [statsSubpayment, setStatsSubpayment] = useState("");
  const [statsProject, setStatsProject] = useState("");
  const [showStatsFilter, setShowStatsFilter] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await load("proj_v1") || [];
      const e = await load("exp_v1") || [];
      const c = await load("cat_v2") || DEFAULT_CATEGORIES;
      const ci = { ...DEFAULT_CAT_ICONS, ...await load("cat_icons_v1") };
      const pm = normalizePayments(await load("pay_v2"));
      setProjects(p);
      setExpenses(e);
      setCategories(c);
      setCatIcons(ci);
      setPayments(pm);
      await save("pay_v2", pm);
      setReady(true);
    })();
  }, []);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };
  const saveProjects = async p => {
    setProjects(p);
    await save("proj_v1", p);
  };
  const saveExpenses = async e => {
    setExpenses(e);
    await save("exp_v1", e);
  };
  const saveCategories = async c => {
    setCategories(c);
    await save("cat_v2", c);
  };
  const saveCatIcons = async icons => {
    setCatIcons(icons);
    await save("cat_icons_v1", icons);
  };
  const savePayments = async p => {
    setPayments(p);
    await save("pay_v2", p);
  };

  const getExpDateStr = e => (e.datetime || e.createdAt || "").slice(0, 10);

  const addExpense = async () => {
    if (!form.amount || isNaN(form.amount)) return showToast("請輸入有效金額");
    if (!form.store.trim()) return showToast("請輸入商店名稱");
    if (!form.category) return showToast("請選擇消費類別");
    if (!form.payment) return showToast("請選擇付款方式");
    if (!form.currency) return showToast("請選擇付款幣別");
    const exp = { id: Date.now().toString(), ...form, amount: parseFloat(form.amount), createdAt: new Date().toISOString() };
    await saveExpenses([exp, ...expenses]);
    setModal(null);
    setForm({ amount: "", store: "", category: "", subcategory: "", payment: "", subpayment: "", currency: "TWD", note: "", datetime: nowDT(), project: "" });
    showToast("✅ 已新增消費");
  };
  const openExpenseEditor = exp => {
    setEditingExpenseId(exp.id);
    setForm({
      amount: String(exp.amount ?? ""),
      store: exp.store || "",
      category: exp.category || "",
      subcategory: exp.subcategory || "",
      payment: exp.payment || "",
      subpayment: CURRENCY_LABELS.has(exp.subpayment) ? "" : exp.subpayment || "",
      currency: currencyCodeOf(exp),
      note: exp.note || "",
      datetime: exp.datetime || nowDT(),
      project: exp.project || ""
    });
    setModal("edit_expense");
  };
  const updateExpense = async () => {
    if (!form.amount || isNaN(form.amount)) return showToast("請輸入有效金額");
    if (!form.store.trim()) return showToast("請輸入商店名稱");
    if (!form.category) return showToast("請選擇消費類別");
    if (!form.payment) return showToast("請選擇付款方式");
    if (!form.currency) return showToast("請選擇付款幣別");
    const next = expenses.map(e => e.id === editingExpenseId ? {
      ...e,
      ...form,
      amount: parseFloat(form.amount),
      updatedAt: new Date().toISOString()
    } : e);
    await saveExpenses(next);
    setEditingExpenseId(null);
    setModal(null);
    showToast("✅ 已更新消費");
  };
  const addProject = async () => {
    if (!newProj.name.trim()) return showToast("請輸入專案名稱");
    if (!newProj.exchangeRate || isNaN(newProj.exchangeRate) || Number(newProj.exchangeRate) <= 0) return showToast("請輸入有效匯率");
    const p = {
      id: Date.now().toString(),
      ...newProj,
      budget: newProj.budget ? parseFloat(newProj.budget) : null,
      exchangeRate: parseFloat(newProj.exchangeRate),
      createdAt: new Date().toISOString()
    };
    await saveProjects([...projects, p]);
    setNewProj({ name: "", desc: "", budget: "", currency: "TWD", exchangeRate: "1" });
    setModal(null);
    showToast("✅ 已新增專案");
  };
  const openProjectEditor = project => {
    setActiveProject(project);
    setNewProj({
      name: project.name || "",
      desc: project.desc || "",
      budget: project.budget ?? "",
      currency: normalizeCurrencyCode(project.currency || "TWD"),
      exchangeRate: String(project.exchangeRate || 1)
    });
    setModal("edit_project");
  };
  const updateProject = async () => {
    if (!activeProject) return;
    if (!newProj.name.trim()) return showToast("請輸入專案名稱");
    if (!newProj.exchangeRate || isNaN(newProj.exchangeRate) || Number(newProj.exchangeRate) <= 0) return showToast("請輸入有效匯率");
    const updated = {
      ...activeProject,
      ...newProj,
      budget: newProj.budget ? parseFloat(newProj.budget) : null,
      exchangeRate: parseFloat(newProj.exchangeRate),
      updatedAt: new Date().toISOString()
    };
    await saveProjects(projects.map(p => p.id === activeProject.id ? updated : p));
    setActiveProject(updated);
    setNewProj({ name: "", desc: "", budget: "", currency: "TWD", exchangeRate: "1" });
    setModal("project_detail");
    showToast("✅ 已更新專案");
  };
  const deleteExpense = async id => {
    await saveExpenses(expenses.filter(e => e.id !== id));
    showToast("已刪除");
  };
  const deleteProject = async id => {
    await saveProjects(projects.filter(p => p.id !== id));
    await saveExpenses(expenses.filter(e => e.project !== id));
    setModal(null);
    showToast("已刪除專案");
  };

  const getMap = () => settingsType === "category" ? categories : payments;
  const setMap = async m => settingsType === "category" ? await saveCategories(m) : await savePayments(m);
  const addParent = async () => {
    if (!newParent.trim()) return;
    const parentName = newParent.trim();
    await setMap({ ...getMap(), [parentName]: [] });
    if (settingsType === "category") await saveCatIcons({ ...catIcons, [parentName]: newParentIcon });
    setNewParent("");
    setNewParentIcon("📌");
    showToast("✅ 已新增");
  };
  const deleteParent = async key => {
    const m = { ...getMap() };
    delete m[key];
    await setMap(m);
    if (settingsType === "category") {
      const icons = { ...catIcons };
      delete icons[key];
      await saveCatIcons(icons);
    }
    if (expandedParent === key) setExpandedParent(null);
    showToast("已刪除");
  };
  const addChild = async parent => {
    const val = (newChild[parent] || "").trim();
    if (!val) return;
    await setMap({ ...getMap(), [parent]: [...(getMap()[parent] || []), val] });
    setNewChild({ ...newChild, [parent]: "" });
    showToast("✅ 已新增子項目");
  };
  const deleteChild = async (parent, idx) => {
    const m = { ...getMap() };
    m[parent] = m[parent].filter((_, i) => i !== idx);
    await setMap(m);
    showToast("已刪除");
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDayOfWeek = (y, m) => new Date(y, m, 1).getDay();
  const expByDate = {};
  expenses.forEach(e => {
    const ds = getExpDateStr(e);
    if (!expByDate[ds]) expByDate[ds] = [];
    expByDate[ds].push(e);
  });
  const dailyTotals = ds => sumByCurrency(expByDate[ds] || []);
  const selectedExps = (expByDate[selectedDate] || []).sort((a, b) => a.datetime > b.datetime ? 1 : -1);
  const selectedTotals = sumByCurrency(selectedExps);
  const monthTotals = (() => {
    const totals = {};
    const { y, m } = calMonth;
    Object.entries(expByDate).forEach(([ds, exps]) => {
      if (ds.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)) {
        Object.entries(sumByCurrency(exps)).forEach(([code, amt]) => {
          totals[code] = (totals[code] || 0) + amt;
        });
      }
    });
    return totals;
  })();
  const monthExps = (() => {
    const { y, m } = calMonth;
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    return expenses.filter(e => getExpDateStr(e).startsWith(monthKey));
  })();
  const projExpenses = pid => expenses.filter(e => e.project === pid);
  const projTotals = pid => sumByCurrency(projExpenses(pid));
  const expenseTwdValue = exp => {
    const amount = Number(exp.amount || 0);
    const code = currencyCodeOf(exp);
    if (code === "TWD") return amount;
    const project = projects.find(p => p.id === exp.project);
    if (!project || normalizeCurrencyCode(project.currency) !== code) return 0;
    return amount * Number(project.exchangeRate || 0);
  };
  const expenseTwdLabel = exp => {
    const code = currencyCodeOf(exp);
    if (code === "TWD") return "";
    const twd = expenseTwdValue(exp);
    return twd > 0 ? `約 TWD ${fmt(twd)}` : "";
  };
  const monthTwdTotal = monthExps.reduce((sum, exp) => sum + expenseTwdValue(exp), 0);
  const projectTwdTotal = project => {
    return projExpenses(project.id).reduce((sum, exp) => sum + expenseTwdValue(exp), 0);
  };
  const selDateObj = new Date(selectedDate + "T00:00:00");
  const selDateLabel = selDateObj.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  const statsFiltered = expenses.filter(e => {
    const ds = getExpDateStr(e);
    if (statsFrom && ds < statsFrom) return false;
    if (statsTo && ds > statsTo) return false;
    if (statsCategory && e.category !== statsCategory) return false;
    if (statsSubcategory && e.subcategory !== statsSubcategory) return false;
    if (statsPayment && e.payment !== statsPayment) return false;
    if (statsSubpayment && e.subpayment !== statsSubpayment) return false;
    if (statsProject === "__none__" && e.project) return false;
    if (statsProject && statsProject !== "__none__" && e.project !== statsProject) return false;
    return true;
  });
  const statsTotals = sumByCurrency(statsFiltered);
  const statsByCategory = {};
  statsFiltered.forEach(e => {
    const key = `${e.subcategory ? `${e.category} › ${e.subcategory}` : e.category} · ${currencyCodeOf(e)}`;
    statsByCategory[key] = (statsByCategory[key] || 0) + e.amount;
  });
  const statsByPayment = {};
  statsFiltered.forEach(e => {
    const paymentDetail = e.subpayment && !CURRENCY_LABELS.has(e.subpayment) ? `${e.payment} › ${e.subpayment}` : e.payment;
    const key = `${paymentDetail} · ${currencyCodeOf(e)}`;
    statsByPayment[key] = (statsByPayment[key] || 0) + e.amount;
  });
  const activeFilterCount = [statsCategory, statsSubcategory, statsPayment, statsSubpayment, statsProject].filter(Boolean).length + (statsFrom !== monthStart(now.getFullYear(), now.getMonth()) || statsTo !== todayStr() ? 1 : 0);

  const setQuickRange = type => {
    const n = new Date();
    if (type === "thisMonth") {
      setStatsFrom(monthStart(n.getFullYear(), n.getMonth()));
      setStatsTo(todayStr());
    } else if (type === "lastMonth") {
      const lm = n.getMonth() === 0 ? { y: n.getFullYear() - 1, m: 11 } : { y: n.getFullYear(), m: n.getMonth() - 1 };
      setStatsFrom(monthStart(lm.y, lm.m));
      setStatsTo(monthEnd(lm.y, lm.m));
    } else if (type === "thisYear") {
      setStatsFrom(`${n.getFullYear()}-01-01`);
      setStatsTo(todayStr());
    } else if (type === "all") {
      setStatsFrom("");
      setStatsTo("");
    }
  };
  const fetchBotRateForProject = async (target = newProj, setTarget = setNewProj) => {
    if (target.currency === "TWD") {
      setTarget({ ...target, exchangeRate: "1" });
      return;
    }

    setRateLoading(true);
    try {
      const response = await fetch("/api/bot-rates");
      if (!response.ok) throw new Error("rate fetch failed");
      const data = await response.json();
      const rate = data.rates?.[target.currency];
      if (!rate) {
        showToast("找不到此幣別的臺銀現金賣出匯率");
        return;
      }
      setTarget({ ...target, exchangeRate: String(rate) });
      showToast(`已帶入臺銀現金賣出 ${target.currency}`);
    } catch {
      showToast("無法取得臺銀匯率，請手動輸入");
    } finally {
      setRateLoading(false);
    }
  };
  const exportStatsReport = () => {
    const sorted = [...statsFiltered].sort((a, b) => (a.datetime || "") > (b.datetime || "") ? 1 : -1);
    const dateRange = `${statsFrom || "最早"} ～ ${statsTo || "今天"}`;
    const detailRows = sorted.map((e, idx) => {
      const project = projects.find(p => p.id === e.project);
      const code = currencyCodeOf(e);
      const exchangeRate = code !== "TWD" && normalizeCurrencyCode(project?.currency) === code ? Number(project.exchangeRate || 0) : "";
      const twdValue = exchangeRate ? Number(e.amount || 0) * exchangeRate : "";
      return `<tr>
        <td class="num">${idx + 1}</td>
        <td>${safeCell(getExpDateStr(e))}</td>
        <td>${safeCell(e.datetime?.slice(11, 16) || "")}</td>
        <td>${safeCell(e.store)}</td>
        <td class="num">${fmt(e.amount)}</td>
        <td>${safeCell(code)}</td>
        <td>${safeCell(e.category)}</td>
        <td>${safeCell(e.payment)}</td>
        <td>${safeCell(project?.name || "")}</td>
        <td>${safeCell(e.note)}</td>
        <td class="num">${exchangeRate ? fmt(exchangeRate) : ""}</td>
        <td class="num">${twdValue ? fmt(twdValue) : ""}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
      body{font-family:Arial,"Microsoft JhengHei",sans-serif}
      h1{font-size:20px}
      h2{font-size:15px;margin-top:18px}
      table{border-collapse:collapse;margin-bottom:14px}
      th,td{border:1px solid #d9d9d9;padding:6px 8px;font-size:12px;mso-number-format:"\\@"}
      th{background:#eef5ff;font-weight:700}
      .num{text-align:right;mso-number-format:"#,##0.00"}
    </style></head><body>
      <table>
        <tr><td colspan="12">篩選日期區間：${safeCell(dateRange)}</td></tr>
        <tr><th>序號</th><th>日期</th><th>時間</th><th>商店</th><th>金額</th><th>幣別</th><th>類別</th><th>付款方式</th><th>專案</th><th>備註</th><th>匯率</th><th>等值台幣</th></tr>
        ${detailRows || `<tr><td colspan="12">此篩選條件無消費紀錄</td></tr>`}
      </table>
    </body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `消費統計報表_${filenameDate(statsFrom)}_${filenameDate(statsTo)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!ready) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 20, color: "#888" }}>載入中…</div>;

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", fontFamily: "'Helvetica Neue',Arial,sans-serif", background: "#f5f5f7", minHeight: "100vh", position: "relative" }}>
      {toast && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 22px", borderRadius: 20, zIndex: 999, fontSize: 16, whiteSpace: "nowrap" }}>{toast}</div>}

      <div style={{ background: "linear-gradient(135deg,#1c1c1e,#2c2c2e)", color: "#fff", padding: "48px 20px 18px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 2 }}>
              <span style={{ opacity: 0.72 }}>{calMonth.y}年{calMonth.m + 1}月 · 月消費</span>
              <span style={{ color: "#64d2ff", fontWeight: 700 }}> · 約 TWD {fmt(monthTwdTotal)}</span>
            </div>
            <CurrencyTotals totals={monthTotals} size={26} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, opacity: 0.5 }}>選取日期</div>
            <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>{selDateLabel}</div>
            <CurrencyTotals totals={selectedTotals} size={15} color="#30d158" align="right" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e5e5ea", position: "sticky", top: 0, zIndex: 9 }}>
        {[["home", "💳 消費"], ["projects", "📁 專案"], ["stats", "📊 統計"], ["settings", "⚙️ 設定"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "11px 0", border: "none", background: "none", fontSize: 14, fontWeight: tab === k ? 700 : 400, color: tab === k ? "#007aff" : "#8e8e93", borderBottom: tab === k ? "2px solid #007aff" : "2px solid transparent", cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: "0 0 100px" }}>
        {tab === "home" && <>
          <div style={{ background: "#fff", margin: "12px 12px 0", borderRadius: 16, padding: "14px 12px", boxShadow: "0 1px 6px rgba(0,0,0,.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button onClick={() => setCalMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#007aff", padding: "0 6px" }}>‹</button>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{calMonth.y}年 {calMonth.m + 1}月</div>
              <button onClick={() => setCalMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#007aff", padding: "0 6px" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
              {WEEKDAYS.map((w, i) => <div key={w} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: i === 0 ? "#ff3b30" : i === 6 ? "#007aff" : "#8e8e93", padding: "2px 0" }}>{w}</div>)}
            </div>
            {(() => {
              const { y, m } = calMonth;
              const total = daysInMonth(y, m);
              const first = firstDayOfWeek(y, m);
              const cells = [];
              for (let i = 0; i < first; i++) cells.push(null);
              for (let d = 1; d <= total; d++) cells.push(d);
              const rows = [];
              for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
              return rows.map((row, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 2 }}>
                  {row.map((d, ci) => {
                    if (!d) return <div key={ci} />;
                    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const isSel = ds === selectedDate;
                    const isToday = ds === todayStr();
                    const dayTotals = dailyTotals(ds);
                    const dayCodes = Object.keys(dayTotals);
                    const hasDot = dayCodes.length > 0;
                    const realDow = new Date(y, m, d).getDay();
                    return (
                      <div key={ci} onClick={() => setSelectedDate(ds)} style={{ textAlign: "center", padding: "4px 2px", cursor: "pointer", borderRadius: 10, background: isSel ? "#007aff" : "transparent" }}>
                        <div style={{ fontSize: 16, fontWeight: isToday ? 700 : 400, color: isSel ? "#fff" : realDow === 0 ? "#ff3b30" : realDow === 6 ? "#007aff" : "#1c1c1e" }}>{d}</div>
                        {hasDot ? <div style={{ fontSize: 11, color: isSel ? "rgba(255,255,255,.8)" : "#30d158", fontWeight: 600, marginTop: -1, lineHeight: 1.2 }}>{dayCodes.length === 1 ? `${dayCodes[0]} ${fmt(dayTotals[dayCodes[0]])}` : `${dayCodes.length}幣別`}</div> : <div style={{ height: 9 }} />}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
          <div style={{ padding: "14px 12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#1c1c1e" }}>{selDateLabel}</div>
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: "right" }}>{formatCurrencyTotals(selectedTotals)}</div>
            </div>
            {selectedExps.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: "30px 0", fontSize: 16 }}>這天沒有消費紀錄</div>}
            {selectedExps.map(e => (
              <div key={e.id} onClick={() => openExpenseEditor(e)} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 9, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,.06)", cursor: "pointer" }}>
                <div style={{ fontSize: 26, width: 36, textAlign: "center" }}>{catIcons[e.category] || "📌"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.store}</div>
                  <div style={{ fontSize: 13, color: "#8e8e93", marginTop: 2 }}>{e.category}{e.subcategory ? ` › ${e.subcategory}` : ""} · {e.payment}{e.subpayment && !CURRENCY_LABELS.has(e.subpayment) ? ` › ${e.subpayment}` : ""} · {currencyCodeOf(e)}</div>
                  <div style={{ fontSize: 13, color: "#8e8e93" }}>{e.datetime?.slice(11, 16) || ""}{e.project ? ` · 📁${projects.find(p => p.id === e.project)?.name || ""}` : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{currencyCodeOf(e)} {fmt(e.amount)}</div>
                  {expenseTwdLabel(e) && <div style={{ fontSize: 13, color: "#007aff", fontWeight: 700, marginTop: 2 }}>{expenseTwdLabel(e)}</div>}
                  <button onClick={ev => { ev.stopPropagation(); deleteExpense(e.id); }} style={{ border: "none", background: "none", color: "#ff3b30", fontSize: 13, cursor: "pointer", padding: "4px 0" }}>刪除</button>
                </div>
              </div>
            ))}
          </div>
        </>}

        {tab === "projects" && <div style={{ padding: "14px 12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>我的專案</div>
            <button onClick={() => setModal("add_project")} style={{ background: "#007aff", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 15, cursor: "pointer" }}>＋ 新增</button>
          </div>
          {projects.length === 0 && <div style={{ textAlign: "center", color: "#aaa", marginTop: 60, fontSize: 17 }}>尚無專案</div>}
          {projects.map(p => {
            const totals = projTotals(p.id);
            const twdTotal = projectTwdTotal(p);
            const cnt = projExpenses(p.id).length;
            const mainTotal = totals[p.currency || "TWD"] || 0;
            const pct = p.budget ? Math.min(100, Math.round(mainTotal / p.budget * 100)) : null;
            return (
              <div key={p.id} onClick={() => { setActiveProject(p); setModal("project_detail"); }} style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,.06)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontWeight: 700, fontSize: 18 }}>📁 {p.name}</div>{p.desc && <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>{p.desc}</div>}</div>
                  <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: 19 }}>{formatCurrencyTotals(totals)}</div><div style={{ fontSize: 14, color: "#8e8e93" }}>{cnt} 筆 · 約 TWD {fmt(twdTotal)}</div></div>
                </div>
                {p.budget && <><div style={{ marginTop: 10, background: "#f0f0f5", borderRadius: 8, height: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "#ff3b30" : "#34c759", borderRadius: 8 }} /></div><div style={{ fontSize: 13, color: "#8e8e93", marginTop: 4 }}>預算 {p.currency || "TWD"} {fmt(p.budget)}（{pct}%）</div></>}
              </div>
            );
          })}
        </div>}

        {tab === "stats" && <StatsView
          activeFilterCount={activeFilterCount}
          categories={categories}
          catIcons={catIcons}
          payments={payments}
          projects={projects}
          setQuickRange={setQuickRange}
          showStatsFilter={showStatsFilter}
          statsByCategory={statsByCategory}
          statsByPayment={statsByPayment}
          statsCategory={statsCategory}
          statsFiltered={statsFiltered}
          statsFrom={statsFrom}
          statsPayment={statsPayment}
          statsProject={statsProject}
          statsSubcategory={statsSubcategory}
          statsSubpayment={statsSubpayment}
          statsTo={statsTo}
          statsTotals={statsTotals}
          setShowStatsFilter={setShowStatsFilter}
          setStatsCategory={setStatsCategory}
          setStatsFrom={setStatsFrom}
          setStatsPayment={setStatsPayment}
          setStatsProject={setStatsProject}
          setStatsSubcategory={setStatsSubcategory}
          setStatsSubpayment={setStatsSubpayment}
          setStatsTo={setStatsTo}
          getExpDateStr={getExpDateStr}
          onEditExpense={openExpenseEditor}
          onExportStats={exportStatsReport}
          getExpenseTwdLabel={expenseTwdLabel}
        />}

        {tab === "settings" && <div style={{ padding: "14px 12px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>項目設定</div>
          <div style={{ display: "flex", background: "#e5e5ea", borderRadius: 10, padding: 3, marginBottom: 18 }}>
            {[["category", "🍜 消費類別"], ["payment", "💳 付款方式"]].map(([k, l]) => (
              <button key={k} onClick={() => { setSettingsType(k); setExpandedParent(null); setNewParentIcon("📌"); }} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, background: settingsType === k ? "#fff" : "transparent", color: settingsType === k ? "#1c1c1e" : "#8e8e93", cursor: "pointer", boxShadow: settingsType === k ? "0 1px 4px rgba(0,0,0,.1)" : "none" }}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {settingsType === "category" && <IconSelect value={newParentIcon} onChange={setNewParentIcon} />}
            <input value={newParent} onChange={e => setNewParent(e.target.value)} placeholder={settingsType === "category" ? "新增類別（如：健身）" : "新增付款方式（如：數位帳戶）"} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 16, outline: "none" }} onKeyDown={e => e.key === "Enter" && addParent()} />
            <button onClick={addParent} style={{ padding: "10px 14px", background: "#007aff", color: "#fff", border: "none", borderRadius: 10, fontSize: 22, cursor: "pointer" }}>＋</button>
          </div>
          {Object.entries(getMap()).map(([parent, children]) => (
            <div key={parent} style={{ background: "#fff", borderRadius: 14, marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div onClick={() => setExpandedParent(expandedParent === parent ? null : parent)} style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 17 }}>{settingsType === "category" ? (catIcons[parent] || "📌") + " " : ""}{parent}</div>
                <div style={{ fontSize: 14, color: "#8e8e93", marginRight: 8 }}>{children.length} 個子項目</div>
                <button onClick={e => { e.stopPropagation(); deleteParent(parent); }} style={{ background: "none", border: "none", color: "#ff3b30", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>🗑</button>
                <div style={{ fontSize: 14, color: "#8e8e93", marginLeft: 4 }}>{expandedParent === parent ? "▲" : "▼"}</div>
              </div>
              {expandedParent === parent && <div style={{ borderTop: "1px solid #f0f0f5", padding: "12px 16px" }}>
                {children.length === 0 && <div style={{ color: "#aaa", fontSize: 15, marginBottom: 10 }}>尚無子項目</div>}
                {children.map((child, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5f5f7" }}>
                    <div style={{ flex: 1, fontSize: 16 }}>{child}</div>
                    <button onClick={() => deleteChild(parent, idx)} style={{ background: "none", border: "none", color: "#ff3b30", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input value={newChild[parent] || ""} onChange={e => setNewChild({ ...newChild, [parent]: e.target.value })} placeholder="新增子項目…" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e5ea", fontSize: 15, outline: "none" }} onKeyDown={e => e.key === "Enter" && addChild(parent)} />
                  <button onClick={() => addChild(parent)} style={{ padding: "8px 14px", background: "#34c759", color: "#fff", border: "none", borderRadius: 8, fontSize: 18, cursor: "pointer" }}>＋</button>
                </div>
              </div>}
            </div>
          ))}
        </div>}
      </div>

      {(tab === "home" || tab === "projects") && <button onClick={() => { setForm({ amount: "", store: "", category: "", subcategory: "", payment: "", subpayment: "", currency: "TWD", note: "", datetime: `${selectedDate}T${new Date().toTimeString().slice(0, 5)}`, project: "" }); setModal("add_expense"); }} style={{ position: "fixed", bottom: 30, right: 24, width: 56, height: 56, borderRadius: 28, background: "#007aff", color: "#fff", fontSize: 28, border: "none", boxShadow: "0 4px 16px rgba(0,122,255,.5)", cursor: "pointer", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>}

      {modal === "add_expense" && <Modal title="新增消費" onClose={() => setModal(null)}>
        <Label>金額</Label><Input type="number" placeholder="0" value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
        <Label>商店名稱</Label><Input placeholder="7-Eleven 信義店" value={form.store} onChange={v => setForm({ ...form, store: v })} />
        <Label>消費類別</Label>
        <TwoLevelSelect map={categories} parentValue={form.category} childValue={form.subcategory} onParentChange={v => setForm({ ...form, category: v, subcategory: "" })} onChildChange={v => setForm({ ...form, subcategory: v })} parentPlaceholder="選擇類別" childPlaceholder="選擇子類別（選填）" />
        <Label>付款方式</Label>
        <TwoLevelSelect map={payments} parentValue={form.payment} childValue={form.subpayment} onParentChange={v => setForm({ ...form, payment: v, subpayment: "" })} onChildChange={v => setForm({ ...form, subpayment: v })} parentPlaceholder="選擇付款方式" childPlaceholder="選擇子項目（選填）" />
        <Label>付款幣別</Label><CurrencySelect value={form.currency} onChange={v => setForm({ ...form, currency: v })} />
        <Label>日期時間</Label><Input type="datetime-local" value={form.datetime} onChange={v => setForm({ ...form, datetime: v })} />
        {projects.length > 0 && <><Label>專案（選填）</Label>
          <select value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
            <option value="">不指定</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></>}
        <Label>備註（選填）</Label><Input placeholder="備註…" value={form.note} onChange={v => setForm({ ...form, note: v })} />
        <Btn onClick={addExpense}>確認新增</Btn>
      </Modal>}

      {modal === "edit_expense" && <Modal title="編輯消費" onClose={() => { setEditingExpenseId(null); setModal(null); }}>
        <Label>金額</Label><Input type="number" placeholder="0" value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
        <Label>商店名稱</Label><Input placeholder="7-Eleven 信義店" value={form.store} onChange={v => setForm({ ...form, store: v })} />
        <Label>消費類別</Label>
        <TwoLevelSelect map={categories} parentValue={form.category} childValue={form.subcategory} onParentChange={v => setForm({ ...form, category: v, subcategory: "" })} onChildChange={v => setForm({ ...form, subcategory: v })} parentPlaceholder="選擇類別" childPlaceholder="選擇子類別（選填）" />
        <Label>付款方式</Label>
        <TwoLevelSelect map={payments} parentValue={form.payment} childValue={form.subpayment} onParentChange={v => setForm({ ...form, payment: v, subpayment: "" })} onChildChange={v => setForm({ ...form, subpayment: v })} parentPlaceholder="選擇付款方式" childPlaceholder="選擇子項目（選填）" />
        <Label>付款幣別</Label><CurrencySelect value={form.currency} onChange={v => setForm({ ...form, currency: v })} />
        <Label>日期時間</Label><Input type="datetime-local" value={form.datetime} onChange={v => setForm({ ...form, datetime: v })} />
        {projects.length > 0 && <><Label>專案（選填）</Label>
          <select value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
            <option value="">不指定</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></>}
        <Label>備註（選填）</Label><Input placeholder="備註…" value={form.note} onChange={v => setForm({ ...form, note: v })} />
        <Btn onClick={updateExpense}>儲存變更</Btn>
      </Modal>}

      {modal === "add_project" && <Modal title="新增專案" onClose={() => setModal(null)}>
        <ProjectForm project={newProj} setProject={setNewProj} onFetchRate={() => fetchBotRateForProject()} rateLoading={rateLoading} />
        <Btn onClick={addProject}>確認新增</Btn>
      </Modal>}

      {modal === "edit_project" && activeProject && <Modal title="編輯專案" onClose={() => setModal("project_detail")}>
        <ProjectForm project={newProj} setProject={setNewProj} onFetchRate={() => fetchBotRateForProject()} rateLoading={rateLoading} />
        <Btn onClick={updateProject}>儲存變更</Btn>
      </Modal>}

      {modal === "project_detail" && activeProject && <Modal title={`📁 ${activeProject.name}`} onClose={() => setModal(null)}>
        {activeProject.desc && <div style={{ fontSize: 15, color: "#8e8e93", marginBottom: 12 }}>{activeProject.desc}</div>}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatBox label="總消費" value={formatCurrencyTotals(projTotals(activeProject.id))} />
          <StatBox label="筆數" value={projExpenses(activeProject.id).length} />
          <StatBox label="約台幣" value={`TWD ${fmt(projectTwdTotal(activeProject))}`} />
          {activeProject.budget && <StatBox label="預算" value={`${activeProject.currency || "TWD"} ${fmt(activeProject.budget)}`} />}
        </div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginBottom: 12 }}>主幣別 {activeProject.currency || "TWD"} · 匯率 {(activeProject.currency || "TWD")}/TWD = {activeProject.exchangeRate || 1}</div>
        <button onClick={() => openProjectEditor(activeProject)} style={{ width: "100%", padding: "10px", background: "#007aff", border: "none", color: "#fff", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>編輯專案</button>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>消費明細</div>
        {projExpenses(activeProject.id).length === 0 && <div style={{ color: "#aaa", fontSize: 15, textAlign: "center", padding: "20px 0" }}>尚無消費紀錄</div>}
        {projExpenses(activeProject.id).sort((a, b) => a.datetime > b.datetime ? -1 : 1).map(e => (
          <div key={e.id} onClick={() => openExpenseEditor(e)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f0f0f5", cursor: "pointer" }}>
            <div style={{ fontSize: 22 }}>{catIcons[e.category] || "📌"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{e.store}</div>
              <div style={{ fontSize: 13, color: "#8e8e93" }}>{e.datetime?.slice(0, 10)} {e.datetime?.slice(11, 16)} · {e.category}{e.subcategory ? ` › ${e.subcategory}` : ""}</div>
              <div style={{ fontSize: 13, color: "#8e8e93" }}>{e.payment}{e.subpayment && !CURRENCY_LABELS.has(e.subpayment) ? ` › ${e.subpayment}` : ""} · {currencyCodeOf(e)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{currencyCodeOf(e)} {fmt(e.amount)}</div>
              {expenseTwdLabel(e) && <div style={{ fontSize: 13, color: "#007aff", fontWeight: 700, marginTop: 2 }}>{expenseTwdLabel(e)}</div>}
            </div>
          </div>
        ))}
        <button onClick={() => deleteProject(activeProject.id)} style={{ marginTop: 20, width: "100%", padding: "12px", background: "none", border: "1px solid #ff3b30", color: "#ff3b30", borderRadius: 10, fontSize: 16, cursor: "pointer" }}>刪除此專案</button>
      </Modal>}
    </div>
  );
}

const selStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 16, background: "#fff", boxSizing: "border-box", outline: "none" };

function StatsView(props) {
  const {
    activeFilterCount, categories, catIcons, payments, projects, setQuickRange, showStatsFilter,
    statsByCategory, statsByPayment, statsCategory, statsFiltered, statsFrom,
    statsPayment, statsProject, statsSubcategory, statsSubpayment, statsTo,
    statsTotals, setShowStatsFilter, setStatsCategory, setStatsFrom, setStatsPayment,
    setStatsProject, setStatsSubcategory, setStatsSubpayment, setStatsTo, getExpDateStr,
    onEditExpense, onExportStats, getExpenseTwdLabel
  } = props;
  const now = new Date();

  return <div style={{ padding: "14px 12px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>統計分析</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onExportStats} style={{ display: "flex", alignItems: "center", gap: 5, background: "#34c759", color: "#fff", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 15, cursor: "pointer", fontWeight: 600 }}>⬇ Excel</button>
        <button onClick={() => setShowStatsFilter(!showStatsFilter)} style={{ display: "flex", alignItems: "center", gap: 5, background: activeFilterCount > 0 ? "#007aff" : "#e5e5ea", color: activeFilterCount > 0 ? "#fff" : "#555", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 15, cursor: "pointer", fontWeight: 600 }}>
          ⚙ 篩選{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>
    </div>

    {showStatsFilter && <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,.07)" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#8e8e93", marginBottom: 8 }}>快速區間</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {[["thisMonth", "本月"], ["lastMonth", "上月"], ["thisYear", "今年"], ["all", "全部"]].map(([k, l]) => (
          <button key={k} onClick={() => setQuickRange(k)} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #e5e5ea", background: "#f5f5f7", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>{l}</button>
        ))}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#8e8e93", marginBottom: 6 }}>自訂日期區間</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="date" value={statsFrom} onChange={e => setStatsFrom(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: "1px solid #e5e5ea", fontSize: 15, outline: "none" }} />
        <span style={{ color: "#8e8e93", fontSize: 15 }}>至</span>
        <input type="date" value={statsTo} onChange={e => setStatsTo(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: "1px solid #e5e5ea", fontSize: 15, outline: "none" }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#8e8e93", marginBottom: 6 }}>消費類別</div>
      <div style={{ display: "flex", gap: 8, marginBottom: statsCategory ? 8 : 14 }}>
        <select value={statsCategory} onChange={e => { setStatsCategory(e.target.value); setStatsSubcategory(""); }} style={selStyle}>
          <option value="">全部類別</option>
          {Object.keys(categories).map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      {statsCategory && categories[statsCategory]?.length > 0 && <div style={{ marginBottom: 14 }}>
        <select value={statsSubcategory} onChange={e => setStatsSubcategory(e.target.value)} style={selStyle}>
          <option value="">全部子類別</option>
          {categories[statsCategory].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>}
      <div style={{ fontSize: 15, fontWeight: 600, color: "#8e8e93", marginBottom: 6 }}>付款方式</div>
      <div style={{ display: "flex", gap: 8, marginBottom: statsPayment ? 8 : 14 }}>
        <select value={statsPayment} onChange={e => { setStatsPayment(e.target.value); setStatsSubpayment(""); }} style={selStyle}>
          <option value="">全部付款方式</option>
          {Object.keys(payments).map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      {statsPayment && payments[statsPayment]?.length > 0 && <div style={{ marginBottom: 14 }}>
        <select value={statsSubpayment} onChange={e => setStatsSubpayment(e.target.value)} style={selStyle}>
          <option value="">全部子項目</option>
          {payments[statsPayment].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>}
      {projects.length > 0 && <><div style={{ fontSize: 15, fontWeight: 600, color: "#8e8e93", marginBottom: 6 }}>專案</div>
        <select value={statsProject} onChange={e => setStatsProject(e.target.value)} style={{ ...selStyle, marginBottom: 14 }}>
          <option value="">全部專案</option>
          <option value="__none__">未指定專案</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></>}
      <button onClick={() => { setStatsFrom(monthStart(now.getFullYear(), now.getMonth())); setStatsTo(todayStr()); setStatsCategory(""); setStatsSubcategory(""); setStatsPayment(""); setStatsSubpayment(""); setStatsProject(""); }} style={{ width: "100%", padding: "9px", background: "none", border: "1px solid #e5e5ea", borderRadius: 10, fontSize: 15, cursor: "pointer", color: "#8e8e93" }}>重置篩選</button>
    </div>}

    <div style={{ background: "linear-gradient(135deg,#1c1c1e,#2c2c2e)", color: "#fff", borderRadius: 14, padding: "16px", marginBottom: 14 }}>
      <div style={{ fontSize: 14, opacity: 0.55, marginBottom: 4 }}>
        {statsFrom || "最早"} ～ {statsTo || "今天"}
        {statsCategory && ` · ${statsCategory}${statsSubcategory ? ` › ${statsSubcategory}` : ""}`}
        {statsPayment && ` · ${statsPayment}${statsSubpayment ? ` › ${statsSubpayment}` : ""}`}
        {statsProject && statsProject !== "__none__" && ` · 📁${projects.find(p => p.id === statsProject)?.name || ""}`}
        {statsProject === "__none__" && " · 未指定專案"}
      </div>
      <CurrencyTotals totals={statsTotals} size={28} />
      <div style={{ fontSize: 15, opacity: 0.6, marginTop: 4 }}>{statsFiltered.length} 筆消費</div>
    </div>

    <Chart title="依類別" data={statsByCategory} totals={statsTotals} accent="#007aff" getLabelIcon={label => catIcons[label.split(" · ")[0].includes(" › ") ? label.split(" · ")[0].split(" › ")[0] : label.split(" · ")[0]] || "📌"} />
    <Chart title="依付款方式" data={statsByPayment} totals={statsTotals} accent="#5856d6" getLabelIcon={() => "💳"} />

    {statsFiltered.length > 0 && <div style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>消費明細（{statsFiltered.length} 筆）</div>
      {[...statsFiltered].sort((a, b) => a.datetime > b.datetime ? -1 : 1).map(e => (
        <div key={e.id} onClick={() => onEditExpense(e)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f5f5f7", cursor: "pointer" }}>
          <div style={{ fontSize: 20 }}>{catIcons[e.category] || "📌"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.store}</div>
            <div style={{ fontSize: 13, color: "#8e8e93" }}>{getExpDateStr(e)} · {e.category}{e.subcategory ? ` › ${e.subcategory}` : ""}</div>
            <div style={{ fontSize: 13, color: "#8e8e93" }}>{e.payment}{e.subpayment && !CURRENCY_LABELS.has(e.subpayment) ? ` › ${e.subpayment}` : ""} · {currencyCodeOf(e)}{e.project ? ` · 📁${projects.find(p => p.id === e.project)?.name || ""}` : ""}</div>
          </div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{currencyCodeOf(e)} {fmt(e.amount)}</div>
            {getExpenseTwdLabel(e) && <div style={{ fontSize: 13, color: "#007aff", fontWeight: 700, marginTop: 2 }}>{getExpenseTwdLabel(e)}</div>}
          </div>
        </div>
      ))}
    </div>}
    {statsFiltered.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0", fontSize: 16 }}>此篩選條件無消費紀錄</div>}
  </div>;
}

function Chart({ title, data, totals, accent, getLabelIcon }) {
  if (Object.keys(data).length === 0) return null;
  return <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{title}</div>
    {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([label, amt]) => {
      const code = label.match(/[A-Z]{3}$/)?.[0] || "TWD";
      const pct = totals[code] ? Math.round(amt / totals[code] * 100) : 0;
      return (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginBottom: 4 }}>
            <span>{getLabelIcon(label)} {label}</span>
            <span style={{ fontWeight: 600 }}>{code} {fmt(amt)} <span style={{ color: "#8e8e93", fontWeight: 400 }}>({pct}%)</span></span>
          </div>
          <div style={{ background: "#f0f0f5", borderRadius: 6, height: 8 }}><div style={{ height: "100%", width: `${pct}%`, background: accent, borderRadius: 6 }} /></div>
        </div>
      );
    })}
  </div>;
}

function TwoLevelSelect({ map, parentValue, childValue, onParentChange, onChildChange, parentPlaceholder, childPlaceholder }) {
  const children = parentValue ? (map[parentValue] || []) : [];
  return <>
    <select value={parentValue} onChange={e => onParentChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box", marginBottom: 8 }}>
      <option value="">{parentPlaceholder}</option>
      {Object.keys(map).map(k => <option key={k} value={k}>{k}</option>)}
    </select>
    {parentValue && children.length > 0 && <select value={childValue} onChange={e => onChildChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
      <option value="">{childPlaceholder}</option>
      {children.map(c => <option key={c} value={c}>{c}</option>)}
    </select>}
  </>;
}

function Modal({ title, onClose, children }) {
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}><div style={{ background: "#f5f5f7", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 20px 40px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><div style={{ fontSize: 20, fontWeight: 700, color: "#1c1c1e" }}>{title}</div><button onClick={onClose} style={{ background: "#e5e5ea", border: "none", borderRadius: 20, width: 30, height: 30, fontSize: 18, cursor: "pointer", color: "#555" }}>✕</button></div>{children}</div></div>;
}

function Label({ children }) {
  return <div style={{ fontSize: 15, fontWeight: 600, color: "#8e8e93", marginBottom: 4, marginTop: 14 }}>{children}</div>;
}

function Input({ onChange, ...props }) {
  return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box", outline: "none" }} />;
}

function Btn({ onClick, children }) {
  return <button onClick={onClick} style={{ marginTop: 20, width: "100%", padding: "14px", background: "#007aff", color: "#fff", border: "none", borderRadius: 12, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}

function CurrencySelect({ value, onChange }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
    {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
  </select>;
}

function ProjectForm({ project, setProject, onFetchRate, rateLoading }) {
  return <>
    <Label>專案名稱</Label><Input placeholder="2026 東京旅遊" value={project.name} onChange={v => setProject({ ...project, name: v })} />
    <Label>說明（選填）</Label><Input placeholder="春季賞花之旅…" value={project.desc} onChange={v => setProject({ ...project, desc: v })} />
    <Label>主要統計幣別</Label>
    <select value={project.currency} onChange={e => setProject({ ...project, currency: e.target.value, exchangeRate: e.target.value === "TWD" ? "1" : project.exchangeRate })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
      {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
    </select>
    <Label>{project.currency}/台幣TWD 匯率</Label>
    <div style={{ display: "flex", gap: 8 }}>
      <Input type="number" step="0.0001" placeholder="例如 0.22" value={project.exchangeRate} onChange={v => setProject({ ...project, exchangeRate: v })} />
      {project.currency !== "TWD" && <button onClick={onFetchRate} disabled={rateLoading} style={{ flex: "0 0 96px", border: "none", borderRadius: 10, background: rateLoading ? "#c7c7cc" : "#34c759", color: "#fff", fontSize: 15, fontWeight: 600, cursor: rateLoading ? "default" : "pointer" }}>{rateLoading ? "取得中" : "抓臺銀"}</button>}
    </div>
    <Label>預算（{project.currency}，選填）</Label><Input type="number" placeholder="50000" value={project.budget} onChange={v => setProject({ ...project, budget: v })} />
  </>;
}

function IconSelect({ value, onChange }) {
  return <select value={value} onChange={e => onChange(e.target.value)} aria-label="類別圖示" style={{ width: 54, flex: "0 0 54px", padding: "10px 6px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 22, background: "#fff", outline: "none", textAlign: "center" }}>
    {CATEGORY_ICON_OPTIONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
  </select>;
}

function CurrencyTotals({ totals, size = 18, color = "inherit", align = "left" }) {
  const entries = orderedCurrencyEntries(totals);
  if (entries.length === 0) entries.push(["TWD", 0]);
  return <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
    {entries.map(([code, amt]) => <div key={code} style={{ fontSize: size, fontWeight: 700, color, lineHeight: 1.15 }}>{code} {fmt(amt)}</div>)}
  </div>;
}

function StatBox({ label, value }) {
  return <div style={{ flex: 1, background: "#f5f5f7", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}><div style={{ fontSize: 13, color: "#8e8e93" }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{value}</div></div>;
}
