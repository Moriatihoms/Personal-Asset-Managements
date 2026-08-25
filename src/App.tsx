import type React from "react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

type View = "dashboard" | "allocation" | "transactions" | "etf" | "rebalance" | "plan";
type TxType = "매수" | "매도" | "배당";
type Allocation = { id: string; name: string; target: number; color: string };
type Transaction = { id: string; date: string; type: TxType; asset: string; name: string; ticker: string; account: string; price: number; qty: number; currentPrice: number; memo: string };
type Etf = { id: string; name: string; ticker: string; asset: string; country: string; issuer: string; fee: number; style: string; watch: boolean; memo: string };
type AppState = {
  settings: { monthlyBudget: number; targetReturn: number; startDate: string; threshold: number; goalName: string; goalAmount: number; periodYears: number };
  allocations: Allocation[];
  transactions: Transaction[];
  etfs: Etf[];
  principles: string[];
};

const STORAGE_KEY = "college_portfolio_web_v2";
const LEGACY_KEY = "college_portfolio_web_v1";
const palette = ["#3856e8", "#22a06b", "#f59e0b", "#8b5cf6", "#ef6a67", "#0891b2", "#64748b", "#84cc16"];
const today = new Date().toISOString().slice(0, 10);
const id = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const defaultState: AppState = {
  settings: { monthlyBudget: 200000, targetReturn: 7, startDate: "2026-03-01", threshold: 5, goalName: "졸업 후 종잣돈", goalAmount: 30000000, periodYears: 10 },
  allocations: [
    { id: "a1", name: "국내 주식", target: 20, color: palette[0] },
    { id: "a2", name: "해외 주식", target: 40, color: palette[1] },
    { id: "a3", name: "채권", target: 20, color: palette[2] },
    { id: "a4", name: "현금성 자산", target: 15, color: palette[3] },
    { id: "a5", name: "대체 자산", target: 5, color: palette[4] },
  ],
  transactions: [
    { id: "t1", date: "2026-05-10", type: "매수", asset: "해외 주식", name: "미국 S&P500 ETF", ticker: "S&P500", account: "ISA", price: 18450, qty: 8, currentPrice: 19280, memo: "정기 매수" },
    { id: "t2", date: "2026-06-10", type: "매수", asset: "국내 주식", name: "국내 대표지수 ETF", ticker: "KOSPI", account: "ISA", price: 36200, qty: 3, currentPrice: 37150, memo: "목표 비중 보완" },
    { id: "t3", date: "2026-07-10", type: "매수", asset: "채권", name: "국고채 ETF", ticker: "BOND", account: "일반 증권계좌", price: 104200, qty: 1, currentPrice: 104760, memo: "변동성 완충" },
    { id: "t4", date: "2026-08-10", type: "매수", asset: "해외 주식", name: "미국 S&P500 ETF", ticker: "S&P500", account: "ISA", price: 19010, qty: 5, currentPrice: 19280, memo: "정기 매수" },
  ],
  etfs: [
    { id: "e1", name: "미국 S&P500 ETF", ticker: "S&P500", asset: "해외 주식", country: "미국", issuer: "비교 후보 A", fee: 0.07, style: "패시브", watch: true, memo: "장기 핵심 자산 후보" },
    { id: "e2", name: "국내 대표지수 ETF", ticker: "KOSPI", asset: "국내 주식", country: "한국", issuer: "비교 후보 B", fee: 0.15, style: "패시브", watch: false, memo: "분산용" },
  ],
  principles: ["몰빵하지 않는다", "매월 정해진 금액을 투자한다", "단기 뉴스만 보고 매매하지 않는다", "목표 비중 이탈 시 먼저 신규 투자금으로 조정한다"],
};

const won = (value: number) => new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const pct = (value: number, digits = 1) => `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;
const safeNumber = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

function migrateLegacy(raw: unknown): AppState {
  const old = (raw ?? {}) as Record<string, any>;
  const settings = old.settings ?? {};
  const allocations = Array.isArray(old.allocs)
    ? old.allocs.map((a: any, index: number) => ({ id: a.id ?? id(), name: a.name || "자산군", target: safeNumber(a.target), color: palette[index % palette.length] }))
    : Array.isArray(old.allocations) ? old.allocations : defaultState.allocations;
  const transactions = Array.isArray(old.records)
    ? old.records.map((r: any) => ({ id: r.id ?? id(), date: r.date || today, type: "매수" as TxType, asset: r.asset || allocations[0]?.name || "기타", name: r.name || "", ticker: r.ticker || r.name || "", account: r.account || "일반 증권계좌", price: safeNumber(r.buy), qty: safeNumber(r.qty), currentPrice: safeNumber(r.current), memo: r.memo || "" }))
    : Array.isArray(old.transactions) ? old.transactions : [];
  return {
    settings: {
      monthlyBudget: safeNumber(settings.monthlyBudget ?? settings.budget) || defaultState.settings.monthlyBudget,
      targetReturn: safeNumber(settings.targetReturn) || defaultState.settings.targetReturn,
      startDate: settings.startDate || defaultState.settings.startDate,
      threshold: safeNumber(settings.threshold) || defaultState.settings.threshold,
      goalName: settings.goalName || settings.goal || defaultState.settings.goalName,
      goalAmount: safeNumber(settings.goalAmount) || defaultState.settings.goalAmount,
      periodYears: safeNumber(settings.periodYears ?? settings.years) || defaultState.settings.periodYears,
    },
    allocations,
    transactions,
    etfs: Array.isArray(old.etfs) ? old.etfs.map((e: any) => ({ id: e.id ?? id(), name: e.name || "", ticker: e.ticker || "", asset: e.asset || allocations[0]?.name || "기타", country: e.country || "", issuer: e.issuer || "", fee: safeNumber(e.fee), style: e.style || "패시브", watch: Boolean(e.watch), memo: e.memo || "" })) : [],
    principles: Array.isArray(old.principles) ? old.principles : defaultState.principles,
  };
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    allocation: <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M15 3.5A8.5 8.5 0 0 1 20.5 9H15V3.5Z"/></>,
    transactions: <><path d="M3 6h18M7 3v6M17 3v6M5 11h14v10H5z"/><path d="M8 15h3M8 18h7"/></>,
    etf: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    rebalance: <><path d="M20 7h-9a4 4 0 0 0-4 4v1"/><path d="m17 4 3 3-3 3M4 17h9a4 4 0 0 0 4-4v-1"/><path d="m7 20-3-3 3-3"/></>,
    plan: <><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    moon: <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></>,
    edit: <><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.5 6.5 3 3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Metric({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return <article className="metric-card"><span>{label}</span><strong className={tone}>{value}</strong><small>{note}</small></article>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty"><span>＋</span><p>{children}</p></div>; }

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [view, setView] = useState<View>("dashboard");
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [etfFilter, setEtfFilter] = useState("전체");
  const [mobileNav, setMobileNav] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (saved) setState(migrateLegacy(JSON.parse(saved)));
      else if (legacy) {
        const migrated = migrateLegacy(JSON.parse(legacy));
        setState(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        setToast("기존 데이터를 새 형식으로 옮겼어요.");
      }
      setDark(localStorage.getItem("portfolio_theme") === "dark");
    } catch { setToast("저장 데이터를 읽지 못해 기본값으로 시작했어요."); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state, ready]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; if (ready) localStorage.setItem("portfolio_theme", dark ? "dark" : "light"); }, [dark, ready]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2600); return () => clearTimeout(timer); }, [toast]);

  const analytics = useMemo(() => {
    const rows = state.transactions.filter((t) => t.type === "매수");
    const invested = rows.reduce((sum, t) => sum + safeNumber(t.price) * safeNumber(t.qty), 0);
    const value = rows.reduce((sum, t) => sum + safeNumber(t.currentPrice) * safeNumber(t.qty), 0);
    const byAsset: Record<string, number> = {};
    rows.forEach((t) => { byAsset[t.asset] = (byAsset[t.asset] || 0) + safeNumber(t.currentPrice) * safeNumber(t.qty); });
    const profit = value - invested;
    const returnRate = invested ? (profit / invested) * 100 : 0;
    const months = new Set(rows.map((t) => t.date.slice(0, 7))).size || 1;
    return { invested, value, profit, returnRate, byAsset, avgMonthly: invested / months };
  }, [state.transactions]);

  const allocationTotal = state.allocations.reduce((sum, a) => sum + safeNumber(a.target), 0);
  const goalProgress = state.settings.goalAmount ? Math.min(100, analytics.value / state.settings.goalAmount * 100) : 0;
  const elapsedMonths = Math.max(0, Math.floor((Date.now() - new Date(state.settings.startDate).getTime()) / 2629800000));
  const chartPoints = useMemo(() => {
    const rows = [...state.transactions].filter((t) => t.type === "매수").sort((a, b) => a.date.localeCompare(b.date));
    let invested = 0;
    const values = rows.map((t) => { invested += t.price * t.qty; return invested; });
    if (!values.length) return "0,82 100,82";
    const max = Math.max(...values, 1);
    return values.map((v, i) => `${values.length === 1 ? 50 : i / (values.length - 1) * 100},${82 - v / max * 66}`).join(" ");
  }, [state.transactions]);

  const patchSettings = (key: keyof AppState["settings"], value: string | number) => setState((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  const download = (filename: string, content: string, type: string) => {
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 400);
  };
  const exportJson = () => download(`portfolio-backup-${today}.json`, JSON.stringify(state, null, 2), "application/json");
  const exportCsv = () => {
    const head = ["날짜", "유형", "자산군", "종목명", "티커", "계좌", "가격", "수량", "현재가", "메모"];
    const rows = state.transactions.map((t) => [t.date, t.type, t.asset, t.name, t.ticker, t.account, t.price, t.qty, t.currentPrice, t.memo]);
    const csv = "\ufeff" + [head, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`investment-records-${today}.csv`, csv, "text/csv;charset=utf-8");
  };
  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { setState(migrateLegacy(JSON.parse(String(reader.result)))); setToast("백업 데이터를 안전하게 복원했어요."); } catch { setToast("올바른 JSON 백업 파일인지 확인해 주세요."); } };
    reader.readAsText(file); event.target.value = "";
  };

  const nav: { key: View; label: string; icon: string }[] = [
    { key: "dashboard", label: "대시보드", icon: "dashboard" }, { key: "allocation", label: "자산 배분", icon: "allocation" },
    { key: "transactions", label: "투자 기록", icon: "transactions" }, { key: "etf", label: "ETF 후보", icon: "etf" },
    { key: "rebalance", label: "리밸런싱", icon: "rebalance" }, { key: "plan", label: "목표 · 원칙", icon: "plan" },
  ];
  const pageTitle = nav.find((n) => n.key === view)?.label;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark">P</span><div><b>Portfoli<span>o</span></b><small>STUDENT INVESTING</small></div></div>
        <nav aria-label="주 메뉴">
          {nav.map((item) => <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => { setView(item.key); setMobileNav(false); }}><Icon name={item.icon}/><span>{item.label}</span>{item.key === "rebalance" && <i>{state.allocations.filter((a) => Math.abs((analytics.byAsset[a.name] || 0) / (analytics.value || 1) * 100 - a.target) >= state.settings.threshold).length}</i>}</button>)}
        </nav>
        <div className="sidebar-quote"><span>이번 달 원칙</span><p>시장보다 계획을<br/>먼저 확인하세요.</p><small>소액 · 분산 · 장기</small></div>
        <div className="sidebar-footer"><button onClick={() => setDark((v) => !v)} aria-label="색상 모드 전환"><Icon name="moon"/><span>{dark ? "라이트 모드" : "다크 모드"}</span></button><span className="local-badge"><i/> 이 기기에 자동 저장</span></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="title-wrap"><button className="menu-button" onClick={() => setMobileNav((v) => !v)} aria-label="메뉴 열기">☰</button><div><p>MY PORTFOLIO</p><h1>{pageTitle}</h1></div></div>
          <div className="header-actions">
            <span className="header-save"><i/>변경사항 자동 저장</span>
            <button className="secondary" onClick={exportJson}><Icon name="download"/> JSON 백업</button>
            <button className="secondary compact" onClick={() => fileRef.current?.click()}>복원</button>
            <button className="primary" onClick={() => setView("transactions")}><Icon name="plus"/> 투자 기록</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson}/>
          </div>
        </header>

        <div className="content">
          {view === "dashboard" && <>
            <section className="welcome-row"><div><h2>좋은 투자 습관을 쌓고 있어요 <span>↗</span></h2><p>수익률보다 먼저, 이번 달 계획과 자산 비중을 확인해 보세요.</p></div><div className="period-pill"><span>투자 시작 후</span><b>{elapsedMonths}개월째</b></div></section>
            <section className="metrics-grid">
              <Metric label="총 투자원금" value={won(analytics.invested)} note={`월 평균 ${won(analytics.avgMonthly)}`}/>
              <Metric label="현재 평가금액" value={won(analytics.value)} note={`${state.transactions.filter((t) => t.type === "매수").length}건의 매수 기록`}/>
              <Metric label="총 평가손익" value={`${analytics.profit >= 0 ? "+" : ""}${won(analytics.profit)}`} note={`${analytics.returnRate >= 0 ? "▲" : "▼"} ${pct(Math.abs(analytics.returnRate), 2)} 누적`} tone={analytics.profit >= 0 ? "positive" : "negative"}/>
              <Metric label="이번 달 투자예산" value={won(state.settings.monthlyBudget)} note={`목표 수익률 ${pct(state.settings.targetReturn)}`}/>
            </section>
            <section className="dashboard-grid">
              <article className="panel allocation-panel">
                <div className="panel-head"><div><span className="eyebrow">ASSET MIX</span><h3>현재 자산 구성</h3></div><button className="text-button" onClick={() => setView("allocation")}>자세히 보기 →</button></div>
                <div className="donut-wrap">
                  <div className="donut" style={{ background: analytics.value ? `conic-gradient(${state.allocations.map((a, i) => { const before = state.allocations.slice(0, i).reduce((sum, x) => sum + (analytics.byAsset[x.name] || 0) / analytics.value * 100, 0); const current = (analytics.byAsset[a.name] || 0) / analytics.value * 100; return `${a.color} ${before}% ${before + current}%`; }).join(",")})` : "var(--soft)" }}><div><span>총 평가금액</span><strong>{won(analytics.value)}</strong></div></div>
                  <div className="legend-list">{state.allocations.map((a) => { const current = analytics.value ? (analytics.byAsset[a.name] || 0) / analytics.value * 100 : 0; return <div key={a.id}><span className="color-dot" style={{ background: a.color }}/><b>{a.name}</b><em>{pct(current)}</em><small>목표 {pct(a.target, 0)}</small></div>; })}</div>
                </div>
              </article>
              <article className="panel trend-panel">
                <div className="panel-head"><div><span className="eyebrow">GROWTH</span><h3>누적 투자 흐름</h3></div><span className="quiet-pill">최근 기록</span></div>
                <div className="chart-value"><strong>{won(analytics.invested)}</strong><span>계획을 지킨 만큼 쌓였어요</span></div>
                <svg className="line-chart" viewBox="0 0 100 92" preserveAspectRatio="none" role="img" aria-label="누적 투자금 추이"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3856e8" stopOpacity=".24"/><stop offset="1" stopColor="#3856e8" stopOpacity="0"/></linearGradient></defs><path d={`M ${chartPoints} L 100 92 L 0 92 Z`} fill="url(#area)"/><polyline points={chartPoints} fill="none" stroke="#3856e8" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg>
                <div className="chart-labels"><span>첫 기록</span><span>현재</span></div>
              </article>
              <article className="panel goal-panel">
                <div className="panel-head"><div><span className="eyebrow">GOAL</span><h3>{state.settings.goalName}</h3></div><span className="goal-rate">{pct(goalProgress, 0)}</span></div>
                <div className="goal-copy"><strong>{won(analytics.value)}</strong><span>/ {won(state.settings.goalAmount)}</span></div><div className="progress"><i style={{ width: `${goalProgress}%` }}/></div><p>작은 금액이라도 계획대로 쌓으면 목표가 가까워집니다.</p>
              </article>
              <article className="panel principle-panel"><div className="principle-icon">“</div><span>오늘의 투자 원칙</span><blockquote>{state.principles[1] || "매월 정해진 금액을 투자한다"}.</blockquote><button className="text-button" onClick={() => setView("plan")}>내 원칙 점검하기 →</button></article>
            </section>
            <section className="disclaimer">이 서비스는 개인의 투자 기록과 학습을 돕는 도구이며, 특정 상품의 매수·매도 또는 수익을 보장하지 않습니다.</section>
          </>}

          {view === "allocation" && <AllocationView state={state} setState={setState} analytics={analytics} total={allocationTotal}/>}
          {view === "transactions" && <TransactionsView state={state} setState={setState} exportCsv={exportCsv}/>}
          {view === "etf" && <EtfView state={state} setState={setState} filter={etfFilter} setFilter={setEtfFilter}/>}
          {view === "rebalance" && <RebalanceView state={state} analytics={analytics}/>}
          {view === "plan" && <PlanView state={state} setState={setState} patchSettings={patchSettings} goalProgress={goalProgress}/>}
        </div>
      </main>
      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기"/>}
      {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
    </div>
  );
}

function AllocationView({ state, setState, analytics, total }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; analytics: any; total: number }) {
  const add = () => setState((s) => ({ ...s, allocations: [...s.allocations, { id: id(), name: "새 자산군", target: 0, color: palette[s.allocations.length % palette.length] }] }));
  const update = (itemId: string, key: "name" | "target", value: string | number) => setState((s) => ({ ...s, allocations: s.allocations.map((a) => a.id === itemId ? { ...a, [key]: value } : a) }));
  const remove = (itemId: string) => { if (state.allocations.length > 1 && confirm("이 자산군을 삭제할까요? 연결된 기록은 삭제되지 않습니다.")) setState((s) => ({ ...s, allocations: s.allocations.filter((a) => a.id !== itemId) })); };
  return <section className="page-stack"><div className="page-intro"><div><h2>목표 자산배분</h2><p>먼저 비중을 정하고, 매월 투자금이 계획대로 흘러가게 만드세요.</p></div><button className="primary" onClick={add}><Icon name="plus"/> 자산군 추가</button></div>
    <div className={`allocation-alert ${Math.abs(total - 100) < .01 ? "ok" : "warn"}`}><div><Icon name={Math.abs(total - 100) < .01 ? "check" : "allocation"}/><span>목표 비중 합계</span></div><strong>{pct(total)}</strong><p>{Math.abs(total - 100) < .01 ? "좋아요. 목표 비중이 정확히 100%예요." : `${pct(Math.abs(100 - total))}를 ${total < 100 ? "더 배분" : "줄여"}야 합니다.`}</p></div>
    <div className="allocation-cards">{state.allocations.map((a) => { const currentValue = analytics.byAsset[a.name] || 0; const current = analytics.value ? currentValue / analytics.value * 100 : 0; const delta = current - a.target; return <article key={a.id} className="allocation-card" style={{ "--asset-color": a.color } as React.CSSProperties}><div className="asset-card-head"><span className="asset-symbol">{a.name.slice(0, 1)}</span><input value={a.name} aria-label="자산군 이름" onChange={(e) => update(a.id, "name", e.target.value)}/><button onClick={() => remove(a.id)} aria-label={`${a.name} 삭제`}><Icon name="trash"/></button></div><div className="asset-stats"><label>목표 비중<div><input type="number" min="0" max="100" step=".5" value={a.target} onChange={(e) => update(a.id, "target", safeNumber(e.target.value))}/><span>%</span></div></label><dl><div><dt>월 배정금액</dt><dd>{won(state.settings.monthlyBudget * a.target / 100)}</dd></div><div><dt>현재 평가금액</dt><dd>{won(currentValue)}</dd></div><div><dt>현재 비중</dt><dd>{pct(current)}</dd></div></dl></div><div className="mini-progress"><i style={{ width: `${Math.min(100, current)}%` }}/><span style={{ left: `${Math.min(100, a.target)}%` }}/></div><p className={Math.abs(delta) >= state.settings.threshold ? "attention" : ""}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%p · {Math.abs(delta) >= state.settings.threshold ? "조정 검토" : "허용 범위"}</p></article>; })}</div>
  </section>;
}

function TransactionsView({ state, setState, exportCsv }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; exportCsv: () => void }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: today, type: "매수" as TxType, asset: state.allocations[0]?.name || "기타", name: "", ticker: "", account: "ISA", price: 0, qty: 0, currentPrice: 0, memo: "" });
  const emptyForm = () => ({ date: today, type: "매수" as TxType, asset: state.allocations[0]?.name || "기타", name: "", ticker: "", account: "ISA", price: 0, qty: 0, currentPrice: 0, memo: "" });
  const startAdd = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setForm({ date: transaction.date, type: transaction.type, asset: transaction.asset, name: transaction.name, ticker: transaction.ticker, account: transaction.account, price: transaction.price, qty: transaction.qty, currentPrice: transaction.currentPrice, memo: transaction.memo });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeForm = () => { setOpen(false); setEditingId(null); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.qty) return;
    setState((s) => ({
      ...s,
      transactions: editingId
        ? s.transactions.map((t) => t.id === editingId ? { ...form, id: editingId } : t)
        : [{ ...form, id: id() }, ...s.transactions],
    }));
    closeForm();
    setForm(emptyForm());
  };
  const remove = (txId: string) => { if (confirm("이 투자 기록을 삭제할까요?")) setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== txId) })); };
  return <section className="page-stack"><div className="page-intro"><div><h2>투자 기록</h2><p>기존 기록의 연필 버튼을 누르면 내용을 수정할 수 있습니다.</p></div><div className="action-row"><button className="secondary" onClick={exportCsv}><Icon name="download"/> CSV</button><button className="primary" onClick={startAdd}><Icon name="plus"/> 기록 추가</button></div></div>
    {open && <form className="entry-form" onSubmit={submit}><div className="form-head"><h3>{editingId ? "투자 기록 수정" : "새 투자 기록"}</h3><button type="button" onClick={closeForm}>닫기</button></div><div className="form-grid"><label>날짜<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label><label>유형<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TxType })}><option>매수</option><option>매도</option><option>배당</option></select></label><label>자산군<select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>{state.allocations.map((a) => <option key={a.id}>{a.name}</option>)}</select></label><label>계좌<select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}><option>ISA</option><option>일반 증권계좌</option><option>연금저축</option><option>IRP</option><option>기타</option></select></label><label>상품명<input required placeholder="예: 미국 대표지수 ETF" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>티커<input placeholder="예: 123456" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })}/></label><label>거래 가격<input required type="number" min="0" value={form.price || ""} onChange={(e) => setForm({ ...form, price: safeNumber(e.target.value) })}/></label><label>수량<input required type="number" min="0" step=".0001" value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: safeNumber(e.target.value) })}/></label><label>현재 가격<input type="number" min="0" value={form.currentPrice || ""} onChange={(e) => setForm({ ...form, currentPrice: safeNumber(e.target.value) })}/></label><label className="wide">메모<input placeholder="투자 이유 또는 당시 판단" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}/></label></div><div className="form-total"><span>예상 거래금액</span><strong>{won(form.price * form.qty)}</strong><button className="primary" type="submit">{editingId ? "수정 내용 저장" : "기록 저장"}</button></div></form>}
    <div className="records-mobile">{state.transactions.map((t) => <article key={t.id}><div><span className={`tx-type ${t.type}`}>{t.type}</span><small>{t.date}</small><span className="mobile-row-actions"><button onClick={() => startEdit(t)} aria-label="기록 수정"><Icon name="edit"/></button><button onClick={() => remove(t.id)} aria-label="기록 삭제"><Icon name="trash"/></button></span></div><h3>{t.name}<em>{t.ticker}</em></h3><dl><div><dt>거래금액</dt><dd>{won(t.price * t.qty)}</dd></div><div><dt>현재가치</dt><dd>{won(t.currentPrice * t.qty)}</dd></div><div><dt>수익률</dt><dd className={t.currentPrice >= t.price ? "positive" : "negative"}>{pct(t.price ? (t.currentPrice - t.price) / t.price * 100 : 0, 2)}</dd></div></dl><p>{t.account} · {t.asset}{t.memo ? ` · ${t.memo}` : ""}</p></article>)}</div>
    <div className="data-table"><table><thead><tr><th>날짜</th><th>유형</th><th>상품 / 자산군</th><th>계좌</th><th className="right">매수가 × 수량</th><th className="right">현재 평가액</th><th className="right">수익률</th><th>관리</th></tr></thead><tbody>{state.transactions.map((t) => { const rate = t.price ? (t.currentPrice - t.price) / t.price * 100 : 0; return <tr key={t.id}><td>{t.date}</td><td><span className={`tx-type ${t.type}`}>{t.type}</span></td><td><b>{t.name}</b><small>{t.ticker} · {t.asset}</small></td><td>{t.account}</td><td className="right">{won(t.price * t.qty)}<small>{won(t.price)} × {t.qty}</small></td><td className="right"><b>{won(t.currentPrice * t.qty)}</b></td><td className={`right ${rate >= 0 ? "positive" : "negative"}`}>{rate >= 0 ? "+" : ""}{pct(rate, 2)}</td><td><span className="row-actions"><button className="icon-button edit" onClick={() => startEdit(t)} aria-label="기록 수정"><Icon name="edit"/></button><button className="icon-button" onClick={() => remove(t.id)} aria-label="기록 삭제"><Icon name="trash"/></button></span></td></tr>; })}</tbody></table>{!state.transactions.length && <Empty>첫 투자 기록을 추가해 보세요.</Empty>}</div>
  </section>;
}

function EtfView({ state, setState, filter, setFilter }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; filter: string; setFilter: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", ticker: "", asset: state.allocations[0]?.name || "기타", country: "한국", issuer: "", fee: 0, style: "패시브", watch: true, memo: "" });
  const visible = state.etfs.filter((e) => filter === "전체" || (filter === "관심" ? e.watch : e.asset === filter));
  const emptyForm = () => ({ name: "", ticker: "", asset: state.allocations[0]?.name || "기타", country: "한국", issuer: "", fee: 0, style: "패시브", watch: true, memo: "" });
  const startAdd = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const startEdit = (etf: Etf) => {
    setEditingId(etf.id);
    setForm({ name: etf.name, ticker: etf.ticker, asset: etf.asset, country: etf.country, issuer: etf.issuer, fee: etf.fee, style: etf.style, watch: etf.watch, memo: etf.memo });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeForm = () => { setOpen(false); setEditingId(null); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setState((s) => ({ ...s, etfs: editingId ? s.etfs.map((item) => item.id === editingId ? { ...form, id: editingId } : item) : [...s.etfs, { ...form, id: id() }] }));
    closeForm();
  };
  return <section className="page-stack"><div className="page-intro"><div><h2>ETF 후보 비교</h2><p>후보 카드의 수정 버튼을 눌러 조사 내용을 다시 편집할 수 있습니다.</p></div><button className="primary" onClick={startAdd}><Icon name="plus"/> 후보 추가</button></div>
    <div className="filter-row"><button className={filter === "전체" ? "active" : ""} onClick={() => setFilter("전체")}>전체 {state.etfs.length}</button><button className={filter === "관심" ? "active" : ""} onClick={() => setFilter("관심")}>★ 관심</button>{state.allocations.map((a) => <button key={a.id} className={filter === a.name ? "active" : ""} onClick={() => setFilter(a.name)}>{a.name}</button>)}</div>
    {open && <form className="entry-form" onSubmit={submit}><div className="form-head"><h3>{editingId ? "ETF 후보 수정" : "새 ETF 후보"}</h3><button type="button" onClick={closeForm}>닫기</button></div><div className="form-grid"><label>ETF 이름<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>티커<input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })}/></label><label>자산군<select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>{state.allocations.map((a) => <option key={a.id}>{a.name}</option>)}</select></label><label>국가<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}/></label><label>운용사<input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })}/></label><label>총보수 (%)<input type="number" step=".001" min="0" value={form.fee || ""} onChange={(e) => setForm({ ...form, fee: safeNumber(e.target.value) })}/></label><label>운용 방식<select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option>패시브</option><option>액티브</option><option>테마</option></select></label><label>메모<input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}/></label></div><div className="form-total"><span>직접 조사한 정보인지 확인하세요.</span><button className="primary" type="submit">{editingId ? "수정 내용 저장" : "후보 저장"}</button></div></form>}
    <div className="etf-grid">{visible.map((e) => <article key={e.id} className="etf-card"><div className="etf-head"><span>{e.ticker?.slice(0, 3) || "ETF"}</span><button className={e.watch ? "watched" : ""} onClick={() => setState((s) => ({ ...s, etfs: s.etfs.map((x) => x.id === e.id ? { ...x, watch: !x.watch } : x) }))} aria-label="관심 ETF 전환">★</button></div><small>{e.asset} · {e.country}</small><h3>{e.name}</h3><dl><div><dt>총보수</dt><dd>{pct(e.fee, 3)}</dd></div><div><dt>운용방식</dt><dd>{e.style}</dd></div><div><dt>운용사</dt><dd>{e.issuer || "미입력"}</dd></div></dl><p>{e.memo || "아직 메모가 없습니다."}</p><div className="etf-card-actions"><button className="edit-link" onClick={() => startEdit(e)}><Icon name="edit"/> 수정</button><button className="delete-link" onClick={() => { if (confirm("이 ETF 후보를 삭제할까요?")) setState((s) => ({ ...s, etfs: s.etfs.filter((x) => x.id !== e.id) })); }}>삭제</button></div></article>)}</div>{!visible.length && <Empty>조건에 맞는 ETF 후보가 없습니다.</Empty>}
  </section>;
}

function RebalanceView({ state, analytics }: { state: AppState; analytics: any }) {
  const suggestions = state.allocations.map((a) => { const currentValue = analytics.byAsset[a.name] || 0; const current = analytics.value ? currentValue / analytics.value * 100 : 0; const delta = current - a.target; const targetValue = analytics.value * a.target / 100; const gap = targetValue - currentValue; const status = Math.abs(delta) < state.settings.threshold ? "비중 정상" : delta < 0 ? "목표 비중 미달" : "목표 비중 초과"; return { ...a, current, delta, gap, status }; });
  return <section className="page-stack"><div className="page-intro"><div><h2>리밸런싱 점검</h2><p>자동 매매 대신, 목표와 현재의 차이를 차분하게 확인합니다.</p></div><span className="threshold-pill">허용 편차 ±{state.settings.threshold}%p</span></div><div className="rebalance-summary"><div><span>점검이 필요한 자산군</span><strong>{suggestions.filter((s) => Math.abs(s.delta) >= state.settings.threshold).length}개</strong></div><p>우선 신규 투자금으로 부족한 자산군을 채우는 방법을 검토하세요. 이 결과는 매매 지시가 아닙니다.</p></div><div className="rebalance-list">{suggestions.map((s) => <article key={s.id}><div className="rebalance-name"><span style={{ background: s.color }}>{s.name.slice(0, 1)}</span><div><h3>{s.name}</h3><small className={Math.abs(s.delta) >= state.settings.threshold ? "attention" : "stable"}>{s.status}</small></div></div><div className="compare-bar"><div><i style={{ width: `${Math.min(100, s.target)}%` }}/><span style={{ left: `${Math.min(100, s.current)}%` }}/></div><small><b>목표 {pct(s.target)}</b><em>현재 {pct(s.current)}</em></small></div><div className="rebalance-action"><strong className={s.delta > 0 ? "negative" : "positive"}>{s.delta >= 0 ? "+" : ""}{s.delta.toFixed(1)}%p</strong><span>{Math.abs(s.delta) < state.settings.threshold ? "현재 비중 유지" : s.gap > 0 ? `${won(Math.abs(s.gap))} 추가 배분 검토` : "추가 매수 중단 검토"}</span></div></article>)}</div></section>;
}

function PlanView({ state, setState, patchSettings, goalProgress }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; patchSettings: (key: keyof AppState["settings"], value: string | number) => void; goalProgress: number }) {
  const future = useMemo(() => { const monthly = state.settings.monthlyBudget; const months = state.settings.periodYears * 12; const r = state.settings.targetReturn / 100 / 12; const value = r ? monthly * ((Math.pow(1 + r, months) - 1) / r) : monthly * months; const paid = monthly * months; return { value, paid, gain: value - paid }; }, [state.settings]);
  return <section className="page-stack"><div className="page-intro"><div><h2>목표와 투자 원칙</h2><p>시장 상황이 흔들려도 돌아올 수 있는 기준을 직접 적어두세요.</p></div></div><div className="plan-grid"><article className="panel settings-panel"><div className="panel-head"><div><span className="eyebrow">MY GOAL</span><h3>투자 목표</h3></div><b>{pct(goalProgress, 0)}</b></div><div className="stack-form"><label>목표 이름<input value={state.settings.goalName} onChange={(e) => patchSettings("goalName", e.target.value)}/></label><label>목표 금액<input type="number" min="0" step="100000" value={state.settings.goalAmount} onChange={(e) => patchSettings("goalAmount", safeNumber(e.target.value))}/></label><div className="two-fields"><label>월 투자예산<input type="number" min="0" step="10000" value={state.settings.monthlyBudget} onChange={(e) => patchSettings("monthlyBudget", safeNumber(e.target.value))}/></label><label>투자기간 (년)<input type="number" min="1" max="60" value={state.settings.periodYears} onChange={(e) => patchSettings("periodYears", safeNumber(e.target.value))}/></label></div><div className="two-fields"><label>예상 연 수익률 (%)<input type="number" min="0" max="50" step=".1" value={state.settings.targetReturn} onChange={(e) => patchSettings("targetReturn", safeNumber(e.target.value))}/></label><label>리밸런싱 허용편차<input type="number" min="0" max="30" step=".5" value={state.settings.threshold} onChange={(e) => patchSettings("threshold", safeNumber(e.target.value))}/></label></div></div><div className="progress large"><i style={{ width: `${goalProgress}%` }}/></div></article><article className="panel compound-panel"><span className="eyebrow">COMPOUND ESTIMATE</span><h3>복리 예상 계산</h3><div className="future-value"><span>{state.settings.periodYears}년 후 예상 자산</span><strong>{won(future.value)}</strong></div><dl><div><dt>예상 총 납입금</dt><dd>{won(future.paid)}</dd></div><div><dt>예상 투자수익</dt><dd>{won(future.gain)}</dd></div><div><dt>72법칙 예상</dt><dd>{state.settings.targetReturn ? `${(72 / state.settings.targetReturn).toFixed(1)}년` : "-"}</dd></div></dl><p>예상 수익률이 매년 동일하다는 단순 가정이며 실제 수익을 보장하지 않습니다.</p></article></div><article className="panel principles-panel"><div className="panel-head"><div><span className="eyebrow">MY RULES</span><h3>나의 투자 원칙</h3></div><button className="secondary" onClick={() => setState((s) => ({ ...s, principles: [...s.principles, "새로운 투자 원칙"] }))}><Icon name="plus"/> 원칙 추가</button></div><div className="principle-list">{state.principles.map((rule, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={rule} onChange={(e) => setState((s) => ({ ...s, principles: s.principles.map((r, i) => i === index ? e.target.value : r) }))}/><button onClick={() => { if (confirm("이 원칙을 삭제할까요?")) setState((s) => ({ ...s, principles: s.principles.filter((_, i) => i !== index) })); }}><Icon name="trash"/></button></div>)}</div></article></section>;
}
