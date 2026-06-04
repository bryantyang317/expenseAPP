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
const CASH_CURRENCIES = ["台幣TWD", "日圓JPY", "美金USD", "歐元EUR", "人民幣CNY", "韓元KRW"];
const CURRENCY_OPTIONS = CASH_CURRENCIES.map(label => ({ label, code: label.slice(-3) }));
const CURRENCY_LABELS = new Set(CASH_CURRENCIES);
const BUILTIN_CURRENCY_CODES = new Set(CURRENCY_OPTIONS.map(c => c.code));

const fmt = n => Number(n).toLocaleString("zh-TW");
const currencyOrder = (code, options = CURRENCY_OPTIONS) => {
  const idx = options.findIndex(c => c.code === code);
  return idx === -1 ? options.length : idx;
};
const orderedCurrencyEntries = (totals, options = CURRENCY_OPTIONS) => Object.entries(totals)
  .filter(([, amt]) => amt > 0)
  .sort(([a], [b]) => currencyOrder(a, options) - currencyOrder(b, options) || a.localeCompare(b));
const normalizeCurrencyCode = code => code === "JYP" ? "JPY" : code;
const currencyCodeOf = e => normalizeCurrencyCode(e.currency || (e.subpayment || "").match(/[A-Z]{3}$/)?.[0] || "TWD");
const sumByCurrency = list => list.reduce((acc, e) => {
  const code = currencyCodeOf(e);
  acc[code] = (acc[code] || 0) + Number(e.amount || 0);
  return acc;
}, {});
const formatCurrencyTotals = (totals, options = CURRENCY_OPTIONS) => {
  const entries = orderedCurrencyEntries(totals, options);
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
const cellText = cell => (cell?.textContent || "").trim().replace(/^'/, "");
const parseMoney = value => {
  const n = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};
const normalizeDateText = value => {
  const text = String(value || "").trim().replace(/[./]/g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
};
const normalizeTimeText = value => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "00:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};
const BACKUP_SECTIONS = new Set(["消費類別設定", "付款方式設定", "幣別設定", "專案設定", "消費明細"]);
const makeTable = (title, headers, rows) => `<h2>${safeCell(title)}</h2><table>
  <tr><td colspan="${headers.length}">${safeCell(title)}</td></tr>
  <tr>${headers.map(header => `<th>${safeCell(header)}</th>`).join("")}</tr>
  ${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${safeCell(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">無資料</td></tr>`}
</table>`;
const findHeaderIndex = (rows, sectionTitle, requiredHeaders) => {
  const titleIndex = rows.findIndex(row => row.length === 1 && row[0] === sectionTitle);
  const start = titleIndex === -1 ? 0 : titleIndex + 1;
  return rows.findIndex((row, idx) => idx >= start && requiredHeaders.every(header => row.includes(header)));
};
const sectionDataRows = (rows, headerIndex) => {
  if (headerIndex === -1) return [];
  const data = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (row.length === 1 && BACKUP_SECTIONS.has(row[0])) break;
    if (!row.length || row.every(value => !value) || row.join("") === "無資料") continue;
    data.push(row);
  }
  return data;
};
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
  const [customCurrencies, setCustomCurrencies] = useState([]);
  const [currencyOrderCodes, setCurrencyOrderCodes] = useState(CURRENCY_OPTIONS.map(c => c.code));
  const [newCurrency, setNewCurrency] = useState({ name: "", code: "" });
  const currencyOptions = [...CURRENCY_OPTIONS, ...customCurrencies].sort((a, b) => {
    const ai = currencyOrderCodes.indexOf(a.code);
    const bi = currencyOrderCodes.indexOf(b.code);
    return (ai === -1 ? currencyOrderCodes.length : ai) - (bi === -1 ? currencyOrderCodes.length : bi);
  });

  const now = new Date();
  const [statsFrom, setStatsFrom] = useState(monthStart(now.getFullYear(), now.getMonth()));
  const [statsTo, setStatsTo] = useState(todayStr());
  const [statsCategory, setStatsCategory] = useState("");
  const [statsSubcategory, setStatsSubcategory] = useState("");
  const [statsPayment, setStatsPayment] = useState("");
  const [statsSubpayment, setStatsSubpayment] = useState("");
  const [statsProject, setStatsProject] = useState("");
  const [showStatsFilter, setShowStatsFilter] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await load("proj_v1") || [];
      const e = await load("exp_v1") || [];
      const c = await load("cat_v2") || DEFAULT_CATEGORIES;
      const ci = { ...DEFAULT_CAT_ICONS, ...await load("cat_icons_v1") };
      const pm = normalizePayments(await load("pay_v2"));
      const cc = await load("currency_v1") || [];
      const co = await load("currency_order_v1") || CURRENCY_OPTIONS.map(item => item.code);
      setProjects(p);
      setExpenses(e);
      setCategories(c);
      setCatIcons(ci);
      setPayments(pm);
      setCustomCurrencies(cc);
      setCurrencyOrderCodes(co);
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
  const saveCustomCurrencies = async currencies => {
    setCustomCurrencies(currencies);
    await save("currency_v1", currencies);
  };
  const saveCurrencyOrder = async codes => {
    setCurrencyOrderCodes(codes);
    await save("currency_order_v1", codes);
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
    if (!window.confirm(`確定要刪除「${key}」嗎？`)) return;
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
    const child = getMap()[parent]?.[idx] || "";
    if (!window.confirm(`確定要刪除「${child}」嗎？`)) return;
    const m = { ...getMap() };
    m[parent] = m[parent].filter((_, i) => i !== idx);
    await setMap(m);
    showToast("已刪除");
  };
  const moveParent = async (key, direction) => {
    const entries = Object.entries(getMap());
    const idx = entries.findIndex(([name]) => name === key);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= entries.length) return;
    [entries[idx], entries[nextIdx]] = [entries[nextIdx], entries[idx]];
    await setMap(Object.fromEntries(entries));
  };
  const moveChild = async (parent, idx, direction) => {
    const children = [...(getMap()[parent] || [])];
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= children.length) return;
    [children[idx], children[nextIdx]] = [children[nextIdx], children[idx]];
    await setMap({ ...getMap(), [parent]: children });
  };
  const addCurrency = async () => {
    const name = newCurrency.name.trim();
    const code = newCurrency.code.trim().toUpperCase();
    if (!name) return showToast("請輸入幣別名稱");
    if (!/^[A-Z]{3}$/.test(code)) return showToast("請輸入三碼英文幣別代碼");
    if (currencyOptions.some(c => c.code === code)) return showToast("此幣別代碼已存在");
    await saveCustomCurrencies([...customCurrencies, { label: `${name}${code}`, code }]);
    await saveCurrencyOrder([...currencyOrderCodes, code]);
    setNewCurrency({ name: "", code: "" });
    showToast("✅ 已新增幣別");
  };
  const deleteCurrency = async code => {
    const currency = customCurrencies.find(c => c.code === code);
    if (!window.confirm(`確定要刪除「${currency?.label || code}」嗎？`)) return;
    await saveCustomCurrencies(customCurrencies.filter(c => c.code !== code));
    await saveCurrencyOrder(currencyOrderCodes.filter(item => item !== code));
    showToast("已刪除幣別");
  };
  const moveCurrency = async (code, direction) => {
    const codes = currencyOptions.map(c => c.code);
    const idx = codes.indexOf(code);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= codes.length) return;
    [codes[idx], codes[nextIdx]] = [codes[nextIdx], codes[idx]];
    await saveCurrencyOrder(codes);
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
    const categoryRows = Object.entries(categories).flatMap(([parent, children], parentIdx) => {
      const rows = children.length ? children : [""];
      return rows.map((child, childIdx) => [parent, child, catIcons[parent] || "📌", parentIdx + 1, child ? childIdx + 1 : ""]);
    });
    const paymentRows = Object.entries(payments).flatMap(([parent, children], parentIdx) => {
      const rows = children.length ? children : [""];
      return rows.map((child, childIdx) => [parent, child, parentIdx + 1, child ? childIdx + 1 : ""]);
    });
    const currencyRows = currencyOptions.map((currency, idx) => [
      currency.label,
      currency.code,
      BUILTIN_CURRENCY_CODES.has(currency.code) ? "內建" : "自訂",
      idx + 1
    ]);
    const projectRows = projects.map(project => [
      project.id,
      project.name,
      project.desc || "",
      project.budget ?? "",
      normalizeCurrencyCode(project.currency || "TWD"),
      project.exchangeRate || 1,
      project.createdAt || "",
      project.updatedAt || ""
    ]);
    const detailRows = sorted.map((e, idx) => {
      const project = projects.find(p => p.id === e.project);
      const code = currencyCodeOf(e);
      const exchangeRate = code !== "TWD" && normalizeCurrencyCode(project?.currency) === code ? Number(project.exchangeRate || 0) : "";
      const twdValue = exchangeRate ? Number(e.amount || 0) * exchangeRate : "";
      return [
        idx + 1,
        getExpDateStr(e),
        e.datetime?.slice(11, 16) || "",
        e.store,
        e.amount,
        code,
        e.category,
        e.subcategory || "",
        e.payment,
        e.subpayment && !CURRENCY_LABELS.has(e.subpayment) ? e.subpayment : "",
        project?.name || "",
        e.project || "",
        e.note,
        exchangeRate || "",
        twdValue || ""
      ];
    });
    const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
      body{font-family:Arial,"Microsoft JhengHei",sans-serif}
      h1{font-size:20px}
      h2{font-size:15px;margin-top:18px}
      table{border-collapse:collapse;margin-bottom:14px}
      th,td{border:1px solid #d9d9d9;padding:6px 8px;font-size:12px;mso-number-format:"\\@"}
      th{background:#eef5ff;font-weight:700}
      .num{text-align:right;mso-number-format:"#,##0.00"}
    </style></head><body>
      <h1>記帳 App 完整備份</h1>
      <table>
        <tr><td>備份版本</td><td>2</td></tr>
        <tr><td>匯出時間</td><td>${safeCell(new Date().toISOString())}</td></tr>
        <tr><td>消費明細日期區間</td><td>${safeCell(dateRange)}</td></tr>
      </table>
      ${makeTable("消費類別設定", ["類別", "子類別", "圖示", "類別排序", "子類別排序"], categoryRows)}
      ${makeTable("付款方式設定", ["付款方式", "付款子項目", "付款方式排序", "子項目排序"], paymentRows)}
      ${makeTable("幣別設定", ["幣別名稱", "幣別代碼", "類型", "排序"], currencyRows)}
      ${makeTable("專案設定", ["專案ID", "專案名稱", "說明", "預算", "主要幣別", "匯率", "建立時間", "更新時間"], projectRows)}
      ${makeTable("消費明細", ["序號", "日期", "時間", "商店", "金額", "幣別", "類別", "子類別", "付款方式", "付款子項目", "專案", "專案ID", "備註", "匯率", "等值台幣"], detailRows)}
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
  const importStatsReport = async file => {
    if (!file) return;
    setImportingExcel(true);
    try {
      const html = await file.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const rows = [...doc.querySelectorAll("tr")].map(row => [...row.cells].map(cellText));
      const headerIndex = findHeaderIndex(rows, "消費明細", ["日期", "商店", "金額"]);
      if (headerIndex === -1) {
        showToast("找不到可匯入的消費明細，請選擇本 App 匯出的 .xls");
        return;
      }

      const headers = rows[headerIndex];
      const col = name => headers.indexOf(name);
      const required = ["日期", "商店", "金額", "幣別", "類別", "付款方式"];
      if (required.some(name => col(name) === -1)) {
        showToast("Excel 欄位不完整，無法匯入");
        return;
      }

      const categoryHeaderIndex = findHeaderIndex(rows, "消費類別設定", ["類別", "子類別"]);
      const paymentHeaderIndex = findHeaderIndex(rows, "付款方式設定", ["付款方式", "付款子項目"]);
      const currencyHeaderIndex = findHeaderIndex(rows, "幣別設定", ["幣別名稱", "幣別代碼"]);
      const projectHeaderIndex = findHeaderIndex(rows, "專案設定", ["專案名稱"]);

      let nextCategories = { ...categories };
      let nextCatIcons = { ...catIcons };
      if (categoryHeaderIndex !== -1) {
        const categoryHeaders = rows[categoryHeaderIndex];
        const ccol = name => categoryHeaders.indexOf(name);
        const importedCategoryRows = sectionDataRows(rows, categoryHeaderIndex).sort((a, b) => {
          const ap = Number(a[ccol("類別排序")] || 0);
          const bp = Number(b[ccol("類別排序")] || 0);
          const ac = Number(a[ccol("子類別排序")] || 0);
          const bc = Number(b[ccol("子類別排序")] || 0);
          return ap - bp || ac - bc;
        });
        nextCategories = {};
        nextCatIcons = {};
        importedCategoryRows.forEach(row => {
          const parent = row[ccol("類別")];
          const child = row[ccol("子類別")];
          if (!parent) return;
          if (!nextCategories[parent]) nextCategories[parent] = [];
          if (child && !nextCategories[parent].includes(child)) nextCategories[parent].push(child);
          nextCatIcons[parent] = row[ccol("圖示")] || nextCatIcons[parent] || "📌";
        });
      }

      let nextPayments = { ...payments };
      if (paymentHeaderIndex !== -1) {
        const paymentHeaders = rows[paymentHeaderIndex];
        const pcol = name => paymentHeaders.indexOf(name);
        const importedPaymentRows = sectionDataRows(rows, paymentHeaderIndex).sort((a, b) => {
          const ap = Number(a[pcol("付款方式排序")] || 0);
          const bp = Number(b[pcol("付款方式排序")] || 0);
          const ac = Number(a[pcol("子項目排序")] || 0);
          const bc = Number(b[pcol("子項目排序")] || 0);
          return ap - bp || ac - bc;
        });
        nextPayments = {};
        importedPaymentRows.forEach(row => {
          const parent = row[pcol("付款方式")];
          const child = row[pcol("付款子項目")];
          if (!parent) return;
          if (!nextPayments[parent]) nextPayments[parent] = [];
          if (child && !nextPayments[parent].includes(child)) nextPayments[parent].push(child);
        });
      }

      let nextCustomCurrencies = [...customCurrencies];
      let nextCurrencyCodes = [...currencyOrderCodes];
      if (currencyHeaderIndex !== -1) {
        const currencyHeaders = rows[currencyHeaderIndex];
        const curCol = name => currencyHeaders.indexOf(name);
        const importedCurrencyRows = sectionDataRows(rows, currencyHeaderIndex).sort((a, b) => Number(a[curCol("排序")] || 0) - Number(b[curCol("排序")] || 0));
        nextCustomCurrencies = [];
        nextCurrencyCodes = [];
        importedCurrencyRows.forEach(row => {
          const code = normalizeCurrencyCode((row[curCol("幣別代碼")] || "").toUpperCase());
          const label = row[curCol("幣別名稱")] || code;
          if (!/^[A-Z]{3}$/.test(code)) return;
          if (!nextCurrencyCodes.includes(code)) nextCurrencyCodes.push(code);
          if (!BUILTIN_CURRENCY_CODES.has(code) && !nextCustomCurrencies.some(c => c.code === code)) nextCustomCurrencies.push({ label, code });
        });
      }

      const nextProjects = [...projects];
      const projectById = new Map(nextProjects.map(p => [p.id, p]));
      const projectByName = new Map(nextProjects.map(p => [p.name, p]));
      const projectIdMap = new Map();
      if (projectHeaderIndex !== -1) {
        const projectHeaders = rows[projectHeaderIndex];
        const projCol = name => projectHeaders.indexOf(name);
        sectionDataRows(rows, projectHeaderIndex).forEach((row, idx) => {
          const oldId = projCol("專案ID") >= 0 ? row[projCol("專案ID")] : "";
          const name = row[projCol("專案名稱")];
          if (!name) return;
          const imported = {
            id: oldId || `import_project_${Date.now()}_${idx}`,
            name,
            desc: projCol("說明") >= 0 ? row[projCol("說明")] : "",
            budget: projCol("預算") >= 0 && row[projCol("預算")] ? parseMoney(row[projCol("預算")]) : null,
            currency: normalizeCurrencyCode((projCol("主要幣別") >= 0 ? row[projCol("主要幣別")] : "TWD") || "TWD"),
            exchangeRate: projCol("匯率") >= 0 && parseMoney(row[projCol("匯率")]) ? parseMoney(row[projCol("匯率")]) : 1,
            createdAt: projCol("建立時間") >= 0 ? row[projCol("建立時間")] : new Date().toISOString(),
            updatedAt: projCol("更新時間") >= 0 ? row[projCol("更新時間")] : ""
          };
          const existing = (oldId && projectById.get(oldId)) || projectByName.get(name);
          if (existing) {
            Object.assign(existing, imported, { id: existing.id });
            if (oldId) projectIdMap.set(oldId, existing.id);
            projectByName.set(existing.name, existing);
          } else {
            const uniqueId = projectById.has(imported.id) ? `import_project_${Date.now()}_${idx}` : imported.id;
            const project = { ...imported, id: uniqueId };
            nextProjects.push(project);
            projectById.set(project.id, project);
            projectByName.set(project.name, project);
            if (oldId) projectIdMap.set(oldId, project.id);
          }
        });
      }

      const seenExpenseKeys = new Set(expenses.map(e => [
        e.datetime || "",
        e.store || "",
        Number(e.amount || 0),
        currencyCodeOf(e),
        e.category || "",
        e.subcategory || "",
        e.payment || "",
        e.subpayment || "",
        e.project ? projects.find(p => p.id === e.project)?.name || "" : "",
        e.note || ""
      ].join("|")));

      const importedExpenses = [];
      for (const row of sectionDataRows(rows, headerIndex)) {
        if (!row.length || row.every(value => !value) || row.join("").includes("此篩選條件無消費紀錄")) continue;
        const date = normalizeDateText(row[col("日期")]);
        const amount = parseMoney(row[col("金額")]);
        const store = row[col("商店")] || "";
        const currency = normalizeCurrencyCode((row[col("幣別")] || "TWD").toUpperCase());
        const category = row[col("類別")] || "其他";
        const subcategory = col("子類別") >= 0 ? row[col("子類別")] : "";
        const payment = row[col("付款方式")] || "其他";
        const subpayment = col("付款子項目") >= 0 ? row[col("付款子項目")] : "";
        const projectName = col("專案") >= 0 ? row[col("專案")] : "";
        const oldProjectId = col("專案ID") >= 0 ? row[col("專案ID")] : "";
        const note = col("備註") >= 0 ? row[col("備註")] : "";
        if (!date || amount === null || !store) continue;

        if (!nextCategories[category]) {
          nextCategories[category] = [];
          nextCatIcons[category] = "📌";
        }
        if (subcategory && !nextCategories[category].includes(subcategory)) nextCategories[category] = [...nextCategories[category], subcategory];
        if (!nextPayments[payment]) nextPayments[payment] = [];
        if (subpayment && !nextPayments[payment].includes(subpayment)) nextPayments[payment] = [...nextPayments[payment], subpayment];
        if (/^[A-Z]{3}$/.test(currency) && !BUILTIN_CURRENCY_CODES.has(currency) && !nextCustomCurrencies.some(c => c.code === currency)) {
          nextCustomCurrencies.push({ label: currency, code: currency });
          if (!nextCurrencyCodes.includes(currency)) nextCurrencyCodes.push(currency);
        }

        let projectId = "";
        if (oldProjectId || projectName) {
          let project = (oldProjectId && projectById.get(projectIdMap.get(oldProjectId) || oldProjectId)) || projectByName.get(projectName);
          if (!project) {
            project = { id: `import_project_${Date.now()}_${nextProjects.length}`, name: projectName || "匯入專案", desc: "由 Excel 匯入", budget: null, currency: "TWD", exchangeRate: 1, createdAt: new Date().toISOString() };
            projectByName.set(projectName, project);
            projectById.set(project.id, project);
            nextProjects.push(project);
            if (oldProjectId) projectIdMap.set(oldProjectId, project.id);
          }
          projectId = project.id;
        }

        const datetime = `${date}T${normalizeTimeText(col("時間") >= 0 ? row[col("時間")] : "")}`;
        const dedupeKey = [datetime, store, amount, currency, category, subcategory, payment, subpayment, projectName, note].join("|");
        if (seenExpenseKeys.has(dedupeKey)) continue;
        seenExpenseKeys.add(dedupeKey);
        importedExpenses.push({
          id: `import_expense_${Date.now()}_${importedExpenses.length}`,
          amount,
          store,
          category,
          subcategory,
          payment,
          subpayment,
          currency,
          note,
          datetime,
          project: projectId,
          createdAt: new Date().toISOString()
        });
      }

      await saveProjects(nextProjects);
      await saveCategories(nextCategories);
      await saveCatIcons(nextCatIcons);
      await savePayments(normalizePayments(nextPayments));
      await saveCustomCurrencies(nextCustomCurrencies);
      await saveCurrencyOrder(nextCurrencyCodes);
      if (importedExpenses.length > 0) await saveExpenses([...importedExpenses, ...expenses]);
      showToast(`✅ 已匯入 ${importedExpenses.length} 筆消費，設定與專案已同步`);
    } catch (error) {
      console.error(error);
      showToast("匯入失敗，請確認是本 App 匯出的 .xls");
    } finally {
      setImportingExcel(false);
    }
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
            <CurrencyTotals options={currencyOptions} totals={monthTotals} size={26} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, opacity: 0.5 }}>選取日期</div>
            <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>{selDateLabel}</div>
            <CurrencyTotals options={currencyOptions} totals={selectedTotals} size={15} color="#30d158" align="right" />
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
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: "right" }}>{formatCurrencyTotals(selectedTotals, currencyOptions)}</div>
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
                  <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: 19 }}>{formatCurrencyTotals(totals, currencyOptions)}</div><div style={{ fontSize: 14, color: "#8e8e93" }}>{cnt} 筆 · 約 TWD {fmt(twdTotal)}</div></div>
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
          currencyOptions={currencyOptions}
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
          onImportStats={importStatsReport}
          importingExcel={importingExcel}
          getExpenseTwdLabel={expenseTwdLabel}
        />}

        {tab === "settings" && <div style={{ padding: "14px 12px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>項目設定</div>
          <div style={{ display: "flex", background: "#e5e5ea", borderRadius: 10, padding: 3, marginBottom: 18 }}>
            {[["category", "🍜 消費類別"], ["payment", "💳 付款方式"], ["currency", "💱 幣別"]].map(([k, l]) => (
              <button key={k} onClick={() => { setSettingsType(k); setExpandedParent(null); setNewParentIcon("📌"); }} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, background: settingsType === k ? "#fff" : "transparent", color: settingsType === k ? "#1c1c1e" : "#8e8e93", cursor: "pointer", boxShadow: settingsType === k ? "0 1px 4px rgba(0,0,0,.1)" : "none" }}>{l}</button>
            ))}
          </div>
          {settingsType !== "currency" && <><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {settingsType === "category" && <IconSelect value={newParentIcon} onChange={setNewParentIcon} />}
            <input value={newParent} onChange={e => setNewParent(e.target.value)} placeholder={settingsType === "category" ? "新增類別（如：健身）" : "新增付款方式（如：數位帳戶）"} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 16, outline: "none" }} onKeyDown={e => e.key === "Enter" && addParent()} />
            <button onClick={addParent} style={{ padding: "10px 14px", background: "#007aff", color: "#fff", border: "none", borderRadius: 10, fontSize: 22, cursor: "pointer" }}>＋</button>
          </div>
          {Object.entries(getMap()).map(([parent, children], parentIdx, parentEntries) => (
            <div key={parent} style={{ background: "#fff", borderRadius: 14, marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div onClick={() => setExpandedParent(expandedParent === parent ? null : parent)} style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 17 }}>{settingsType === "category" ? (catIcons[parent] || "📌") + " " : ""}{parent}</div>
                <div style={{ fontSize: 14, color: "#8e8e93", marginRight: 8 }}>{children.length} 個子項目</div>
                <MoveButtons onUp={e => { e.stopPropagation(); moveParent(parent, -1); }} onDown={e => { e.stopPropagation(); moveParent(parent, 1); }} disableUp={parentIdx === 0} disableDown={parentIdx === parentEntries.length - 1} />
                <button onClick={e => { e.stopPropagation(); deleteParent(parent); }} style={{ background: "none", border: "none", color: "#ff3b30", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>🗑</button>
                <div style={{ fontSize: 14, color: "#8e8e93", marginLeft: 4 }}>{expandedParent === parent ? "▲" : "▼"}</div>
              </div>
              {expandedParent === parent && <div style={{ borderTop: "1px solid #f0f0f5", padding: "12px 16px" }}>
                {children.length === 0 && <div style={{ color: "#aaa", fontSize: 15, marginBottom: 10 }}>尚無子項目</div>}
                {children.map((child, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5f5f7" }}>
                    <div style={{ flex: 1, fontSize: 16 }}>{child}</div>
                    <MoveButtons onUp={() => moveChild(parent, idx, -1)} onDown={() => moveChild(parent, idx, 1)} disableUp={idx === 0} disableDown={idx === children.length - 1} compact />
                    <button onClick={() => deleteChild(parent, idx)} style={{ background: "none", border: "none", color: "#ff3b30", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input value={newChild[parent] || ""} onChange={e => setNewChild({ ...newChild, [parent]: e.target.value })} placeholder="新增子項目…" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e5ea", fontSize: 15, outline: "none" }} onKeyDown={e => e.key === "Enter" && addChild(parent)} />
                  <button onClick={() => addChild(parent)} style={{ padding: "8px 14px", background: "#34c759", color: "#fff", border: "none", borderRadius: 8, fontSize: 18, cursor: "pointer" }}>＋</button>
                </div>
              </div>}
            </div>
          ))}</>}
          {settingsType === "currency" && <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={newCurrency.name} onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })} placeholder="幣別名稱（如：英鎊）" style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 16, outline: "none" }} />
              <input value={newCurrency.code} onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase().slice(0, 3) })} placeholder="GBP" maxLength={3} style={{ width: 76, padding: "10px 8px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 16, outline: "none", textTransform: "uppercase" }} onKeyDown={e => e.key === "Enter" && addCurrency()} />
              <button onClick={addCurrency} style={{ padding: "10px 14px", background: "#007aff", color: "#fff", border: "none", borderRadius: 10, fontSize: 22, cursor: "pointer" }}>＋</button>
            </div>
            {currencyOptions.map((currency, idx) => {
              const isBuiltin = BUILTIN_CURRENCY_CODES.has(currency.code);
              return <div key={currency.code} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 17 }}>{currency.label}</div>
                <div style={{ fontSize: 14, color: "#8e8e93", marginRight: 8 }}>{isBuiltin ? "內建" : "自訂"}</div>
                <MoveButtons onUp={() => moveCurrency(currency.code, -1)} onDown={() => moveCurrency(currency.code, 1)} disableUp={idx === 0} disableDown={idx === currencyOptions.length - 1} />
                {!isBuiltin && <button onClick={() => deleteCurrency(currency.code)} style={{ background: "none", border: "none", color: "#ff3b30", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>🗑</button>}
              </div>;
            })}
          </>}
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
        <Label>付款幣別</Label><CurrencySelect options={currencyOptions} value={form.currency} onChange={v => setForm({ ...form, currency: v })} />
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
        <Label>付款幣別</Label><CurrencySelect options={currencyOptions} value={form.currency} onChange={v => setForm({ ...form, currency: v })} />
        <Label>日期時間</Label><Input type="datetime-local" value={form.datetime} onChange={v => setForm({ ...form, datetime: v })} />
        {projects.length > 0 && <><Label>專案（選填）</Label>
          <select value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
            <option value="">不指定</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></>}
        <Label>備註（選填）</Label><Input placeholder="備註…" value={form.note} onChange={v => setForm({ ...form, note: v })} />
        <Btn onClick={updateExpense}>儲存變更</Btn>
      </Modal>}

      {modal === "add_project" && <Modal title="新增專案" onClose={() => setModal(null)}>
        <ProjectForm currencyOptions={currencyOptions} project={newProj} setProject={setNewProj} onFetchRate={() => fetchBotRateForProject()} rateLoading={rateLoading} />
        <Btn onClick={addProject}>確認新增</Btn>
      </Modal>}

      {modal === "edit_project" && activeProject && <Modal title="編輯專案" onClose={() => setModal("project_detail")}>
        <ProjectForm currencyOptions={currencyOptions} project={newProj} setProject={setNewProj} onFetchRate={() => fetchBotRateForProject()} rateLoading={rateLoading} />
        <Btn onClick={updateProject}>儲存變更</Btn>
      </Modal>}

      {modal === "project_detail" && activeProject && <Modal title={`📁 ${activeProject.name}`} onClose={() => setModal(null)}>
        {activeProject.desc && <div style={{ fontSize: 15, color: "#8e8e93", marginBottom: 12 }}>{activeProject.desc}</div>}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatBox label="總消費" value={formatCurrencyTotals(projTotals(activeProject.id), currencyOptions)} />
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
    activeFilterCount, categories, catIcons, currencyOptions, payments, projects, setQuickRange, showStatsFilter,
    statsByCategory, statsByPayment, statsCategory, statsFiltered, statsFrom,
    statsPayment, statsProject, statsSubcategory, statsSubpayment, statsTo,
    statsTotals, setShowStatsFilter, setStatsCategory, setStatsFrom, setStatsPayment,
    setStatsProject, setStatsSubcategory, setStatsSubpayment, setStatsTo, getExpDateStr,
    onEditExpense, onExportStats, onImportStats, importingExcel, getExpenseTwdLabel
  } = props;
  const now = new Date();

  return <div style={{ padding: "14px 12px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>統計分析</div>
      <div style={{ display: "flex", gap: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, background: importingExcel ? "#c7c7cc" : "#ff9500", color: "#fff", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 15, cursor: importingExcel ? "default" : "pointer", fontWeight: 600 }}>
          ⬆ 匯入
          <input type="file" accept=".xls,.html,text/html,application/vnd.ms-excel" disabled={importingExcel} onChange={e => { onImportStats(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
        </label>
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
      <CurrencyTotals options={currencyOptions} totals={statsTotals} size={28} />
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

function CurrencySelect({ options, value, onChange }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
    {options.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
  </select>;
}

function ProjectForm({ currencyOptions, project, setProject, onFetchRate, rateLoading }) {
  return <>
    <Label>專案名稱</Label><Input placeholder="2026 東京旅遊" value={project.name} onChange={v => setProject({ ...project, name: v })} />
    <Label>說明（選填）</Label><Input placeholder="春季賞花之旅…" value={project.desc} onChange={v => setProject({ ...project, desc: v })} />
    <Label>主要統計幣別</Label>
    <select value={project.currency} onChange={e => setProject({ ...project, currency: e.target.value, exchangeRate: e.target.value === "TWD" ? "1" : project.exchangeRate })} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e5ea", fontSize: 17, background: "#fff", boxSizing: "border-box" }}>
      {currencyOptions.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
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

function MoveButtons({ onUp, onDown, disableUp, disableDown, compact = false }) {
  const style = { background: "none", border: "none", color: "#007aff", fontSize: compact ? 16 : 18, cursor: "pointer", padding: compact ? "0 3px" : "0 4px", opacity: 1 };
  return <div style={{ display: "flex", marginRight: compact ? 2 : 4 }}>
    <button aria-label="上移" title="上移" onClick={onUp} disabled={disableUp} style={{ ...style, opacity: disableUp ? 0.25 : 1 }}>↑</button>
    <button aria-label="下移" title="下移" onClick={onDown} disabled={disableDown} style={{ ...style, opacity: disableDown ? 0.25 : 1 }}>↓</button>
  </div>;
}

function CurrencyTotals({ options = CURRENCY_OPTIONS, totals, size = 18, color = "inherit", align = "left" }) {
  const entries = orderedCurrencyEntries(totals, options);
  if (entries.length === 0) entries.push(["TWD", 0]);
  return <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
    {entries.map(([code, amt]) => <div key={code} style={{ fontSize: size, fontWeight: 700, color, lineHeight: 1.15 }}>{code} {fmt(amt)}</div>)}
  </div>;
}

function StatBox({ label, value }) {
  return <div style={{ flex: 1, background: "#f5f5f7", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}><div style={{ fontSize: 13, color: "#8e8e93" }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{value}</div></div>;
}
