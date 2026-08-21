"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from "react";

type View = "overview" | "videos" | "video" | "alerts" | "experiences" | "settings";
type ApiState = { account: Record<string, unknown>; user: Record<string, string>; health: Record<string, number | boolean | null>; accountMetrics: Record<string, number | string | null> | null; accountTrend: Array<Record<string, unknown>>; videos: Array<Record<string, unknown>>; jobs: Array<Record<string, unknown>>; alerts: Array<Record<string, unknown>> };

const STAGES: Record<string, { label: string; color: string; hint: string }> = {
  exposure: { label: "曝光", color: "var(--red)", hint: "初始分发与选题匹配" },
  click: { label: "点击", color: "var(--amber)", hint: "标题与封面表达" },
  retention: { label: "留存", color: "var(--blue)", hint: "开头承接与内容节奏" },
  engagement: { label: "互动", color: "var(--mint)", hint: "价值感与行动引导" },
  unlocated: { label: "暂无法定位", color: "var(--ink-3)", hint: "等待更多完整数据" },
};

function Icon({ name }: { name: string }) {
  return <svg aria-hidden="true"><use href={`/icons.svg#i-${name}`} /></svg>;
}

function number(value: unknown, digits = 0) {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits, notation: num >= 100000 ? "compact" : "standard" }).format(num);
}

function percent(value: unknown, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "不可用";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function dateTime(value: unknown) {
  if (!value) return "尚未采集";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export default function ShushuApp({ shareToken }: { shareToken?: string }) {
  const readOnly = Boolean(shareToken);
  const shareBase = shareToken ? `/api/share/${encodeURIComponent(shareToken)}` : "";
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<ApiState | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [experiences, setExperiences] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(readOnly ? `${shareBase}/dashboard` : "/api/dashboard", { cache: "no-store" });
      const body = await response.json() as { error?: string; data: ApiState };
      if (!response.ok) throw new Error(body.error || "数据加载失败");
      setData(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "数据加载失败");
    } finally { setLoading(false); }
  }, [readOnly, shareBase]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (readOnly || !data) return;
    if (window.localStorage.getItem("shushu.collector.onboarding.v2") !== "done") setOnboardingOpen(true);
  }, [data, readOnly]);

  const openVideo = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(readOnly ? `${shareBase}/videos/${id}` : `/api/videos/${id}`, { cache: "no-store" });
      const body = await response.json() as { error?: string; data: Record<string, unknown> };
      if (!response.ok) throw new Error(body.error || "视频加载失败");
      setDetail(body.data); setView("video");
    } catch (cause) { setToast(cause instanceof Error ? cause.message : "视频加载失败"); }
    finally { setLoading(false); }
  }, [readOnly, shareBase]);

  const openExperiences = useCallback(async () => {
    setView("experiences");
    const response = await fetch(readOnly ? `${shareBase}/experiences` : "/api/experiences", { cache: "no-store" });
    const body = await response.json() as { data: Array<Record<string, unknown>> };
    if (response.ok) setExperiences(body.data);
  }, [readOnly, shareBase]);

  const updateExperience = useCallback(async (id: string, status: string) => {
    const response = await fetch(`/api/experiences/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) { setToast(body.error || "经验状态更新失败"); return; }
    setToast(status === "confirmed" ? "经验已确认" : status === "rejected" ? "经验已驳回" : "经验状态已更新");
    await openExperiences();
  }, [openExperiences]);

  const navigate = (target: View) => {
    if (target === "experiences") void openExperiences(); else setView(target);
  };
  const openAccountPanel = () => {
    if (readOnly) return;
    const needsCollectorSetup = !data || data.account.connectionStatus !== "connected" || data.videos.length === 0;
    if (needsCollectorSetup) {
      setOnboardingOpen(true);
      return;
    }
    navigate("settings");
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  };

  const filteredVideos = useMemo(() => (data?.videos ?? []).filter((video) => String(video.title ?? "").toLowerCase().includes(query.toLowerCase())), [data?.videos, query]);
  const account = data?.account ?? {};
  const activeNav = view === "video" ? "videos" : view;

  return <div className="app">
    <aside className="side">
      <div className="logo"><span className="logo-mark"><Icon name="logo" /></span><span className="txt"><span className="logo-name">薯数</span><span className="logo-sub">内容数据复盘</span></span></div>
      <div className="nav-label txt">工作台</div>
      <NavButton icon="grid" label="数据总览" active={activeNav === "overview"} onClick={() => navigate("overview")} />
      <NavButton icon="play" label="视频" active={activeNav === "videos"} onClick={() => navigate("videos")} />
      <NavButton icon="alert" label="异常与复盘" active={activeNav === "alerts"} badge={data?.alerts?.length || undefined} onClick={() => navigate("alerts")} />
      <NavButton icon="bulb" label="经验库" active={activeNav === "experiences"} onClick={() => navigate("experiences")} />
      {!readOnly && <><div className="nav-label txt">系统</div><NavButton icon="settings" label="采集设置" active={activeNav === "settings"} onClick={() => navigate("settings")} /></>}
      <div className="side-foot">{readOnly
        ? <button type="button" className="acct" disabled><span className="av">{String(account.nickname ?? "薯").slice(0, 1)}</span><span className="txt"><span className="nm">{String(account.nickname ?? "待连接账号")}</span><span className={`st ${account.connectionStatus !== "connected" ? "pending" : ""}`}><i className="dot-live" />{account.connectionStatus === "connected" ? "采集已连接" : "等待连接"}</span></span></button>
        : <details className="account-menu"><summary className="acct acct-action" aria-label="打开账号菜单"><span className="av">{String(account.nickname ?? "薯").slice(0, 1)}</span><span className="txt"><span className="nm">{String(account.nickname ?? "待连接账号")}</span><span className={`st ${account.connectionStatus !== "connected" ? "pending" : ""}`}><i className="dot-live" />{account.connectionStatus === "connected" ? "采集已连接" : "等待连接"}</span></span><span className="account-chevron">⌃</span></summary><div className="account-popover"><button type="button" onClick={openAccountPanel}><Icon name="settings" />采集设置</button><button type="button" className="logout-option" onClick={logout}><Icon name="history" />退出登录</button></div></details>}
      </div>
    </aside>

    <main className="main"><div className="wrap">
      <TopBar view={view} query={query} setQuery={setQuery} lastUpdate={account.lastSuccessfulCollectionAt} onRefresh={refresh} readOnly={readOnly} onShare={() => setShareOpen(true)} />
      {error ? <ErrorState message={error} onRetry={refresh} /> : loading && !data ? <LoadingState /> : null}
      {!error && data && view === "overview" && <Overview data={data} openVideo={openVideo} navigate={navigate} />}
      {!error && data && view === "videos" && <Videos videos={filteredVideos} openVideo={openVideo} />}
      {!error && data && view === "alerts" && <Alerts alerts={data.alerts} openVideo={openVideo} />}
      {!error && view === "experiences" && <Experiences items={experiences} update={readOnly ? undefined : updateExperience} />}
      {!error && view === "settings" && <Settings data={data} openGuide={() => setOnboardingOpen(true)} />}
      {!error && view === "video" && detail && <VideoDetail detail={detail} onBack={() => setView("videos")} onChange={readOnly ? undefined : () => setChangeOpen(true)} onReview={readOnly ? undefined : () => setReviewOpen(true)} />}
    </div></main>
    {changeOpen && detail && <ChangeModal detail={detail} close={() => setChangeOpen(false)} saved={async (message) => { setChangeOpen(false); setToast(message); const video = detail.video as Record<string, unknown>; await openVideo(String(video.id)); await refresh(); }} />}
    {reviewOpen && detail && <ReviewModal detail={detail} close={() => setReviewOpen(false)} saved={async () => { setReviewOpen(false); setToast("复盘已确认，经验草稿已保存"); const video = detail.video as Record<string, unknown>; await openVideo(String(video.id)); }} />}
    {shareOpen && <ShareModal close={() => setShareOpen(false)} />}
    {onboardingOpen && data && <CollectorOnboarding connected={data.account.connectionStatus === "connected"} videoCount={data.videos.length} refresh={refresh} close={() => { window.localStorage.setItem("shushu.collector.onboarding.v2", "done"); setOnboardingOpen(false); }} />}
    <div className={`toast ${toast ? "on" : ""}`}><Icon name="check" />{toast}</div>
  </div>;
}

function NavButton({ icon, label, active, badge, onClick }: { icon: string; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick}><Icon name={icon} /><span className="txt">{label}</span>{badge ? <span className="bdg">{badge}</span> : null}</button>;
}

const TITLES: Record<View, [string, string, string]> = {
  overview: ["OVERVIEW", "数据总览", "连续采集、生命周期与异常诊断都在这里"],
  videos: ["CONTENT", "视频", "查看每篇内容的 2 / 6 / 24 / 72 小时反馈"],
  video: ["VIDEO REVIEW", "视频复盘", "数据、修改事件和诊断位于同一时间轴"],
  alerts: ["DIAGNOSIS", "异常与复盘", "先看证据，再决定下一次单变量实验"],
  experiences: ["PLAYBOOK", "经验库", "只沉淀经过人工确认、可复用的内容经验"],
  settings: ["COLLECTOR", "采集设置", "连接本机已登录的小红书创作者账号"],
};

function TopBar({ view, query, setQuery, lastUpdate, onRefresh, readOnly, onShare }: { view: View; query: string; setQuery: (value: string) => void; lastUpdate: unknown; onRefresh: () => void; readOnly: boolean; onShare: () => void }) {
  const [eyebrow, title, subtitle] = TITLES[view];
  return <header className="top"><div><div className="eyebrow"><b>●</b> {eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-sub">{subtitle}</p></div>
    {view === "videos" && <label className="search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题" /></label>}
    {readOnly ? <span className="chip blue readonly-chip"><Icon name="eye" />只读分享</span> : <button className="btn btn-share" onClick={onShare}><Icon name="users" />分享</button>}
    <button className="upd-chip" onClick={onRefresh}><Icon name="history" /><span>更新于 <b>{dateTime(lastUpdate)}</b></span></button>
  </header>;
}

function Overview({ data, openVideo, navigate }: { data: ApiState; openVideo: (id: string) => void; navigate: (view: View) => void }) {
  const metric = data.accountMetrics ?? {};
  const rate = data.health.successRate;
  const connectionLabel = data.account.connectionStatus === "connected" ? "账号已连接" : "等待连接";
  const monitoringVideos = data.videos.slice(0, 5);
  const monitoringDemo = monitoringVideos.length > 0 && monitoringVideos.every((video) => {
    const snapshot = (video.latestSnapshot ?? {}) as Record<string, unknown>;
    return snapshot.exposures == null;
  });
  return <div className="grid-ov">
    <section className="card col-12 collection-strip reveal">
      <div className="collector-account"><span className="collector-avatar">{String(data.account.nickname ?? "薯").slice(0, 1)}</span><span><b>{String(data.account.nickname ?? "待连接账号")}</b><small className={data.account.connectionStatus === "connected" ? "ok" : ""}><i />{connectionLabel}</small></span></div>
      <CollectionStat label="最近同步" value={dateTime(data.account.lastSuccessfulCollectionAt)} />
      <CollectionStat label="24h 成功率" value={rate == null ? "暂无任务" : percent(rate, 0)} />
      <CollectionStat label="待执行" value={`${number(data.health.pending)} 个`} />
      <CollectionStat label="重试中" value={`${number(data.health.retrying)} 个`} tone="amber" />
      <CollectionStat label="失败" value={`${number(data.health.failed)} 个`} tone="red" />
      <span className={`chip collection-state ${data.health.hasGap ? "red" : "mint"}`}>{data.health.hasGap ? "存在数据缺口" : "采集正常"}</span>
    </section>

    <section className="card col-12 core-metrics reveal">
      <AccountMetric eyebrow="FOLLOWERS" label="粉丝数" value={metric.followers} tone="red" />
      <AccountMetric eyebrow="VIEWS · 7D" label="近 7 日观看" value={metric.views7d} tone="blue" />
      <AccountMetric eyebrow="ENGAGE · 7D" label="近 7 日互动" value={metric.interactions7d} tone="violet" />
      <AccountMetric eyebrow="FANS · 7D" label="近 7 日涨粉" value={metric.followersGained7d} tone="mint" />
    </section>

    <AccountTrend rows={data.accountTrend ?? []} />

    <section className="card col-8 reveal"><div className="card-h row-between"><h2 className="card-t monitoring-title"><i className="live-monitor-dot"/>正在监测 <span className="sub">{data.videos.filter((video) => video.status === "monitoring").length} 篇</span>{monitoringDemo && <span className="chip amber">前端演示</span>}</h2><button className="text-btn" onClick={() => navigate("videos")}>查看全部 →</button></div><div className="card-b"><div className="v-grid">{monitoringVideos.map((video, index) => <VideoCard key={String(video.id)} video={video} index={index} openVideo={openVideo} demo={monitoringDemo} />)}{!data.videos.length && <Empty title="还没有视频数据" description="连接 OpenCLI 后，系统会自动发现已发布内容并建立节点任务。" />}</div>{monitoringDemo && <p className="demo-disclaimer">曝光、观看、点赞和涨粉为虚拟账号演示数据，仅用于确认前端呈现。</p>}</div></section>
    <section className="card col-4 reveal"><div className="card-h"><h2 className="card-t">最新异常</h2><span className="chip amber">{data.alerts.length} 条</span></div><div className="card-b compact-list">{data.alerts.slice(0, 4).map((alert) => <AlertRow key={String(alert.id)} alert={alert} openVideo={openVideo} />)}{!data.alerts.length && <Empty title="暂无异常" description="完成 6 小时节点后开始稳定诊断。" />}</div></section>
  </div>;
}

function CollectionStat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="collection-stat"><span>{label}</span><b className={tone}>{value}</b></div>;
}

function AccountMetric({ eyebrow, label, value, tone }: { eyebrow: string; label: string; value: unknown; tone: string }) {
  return <div className="account-metric"><small>{eyebrow}</small><span>{label}</span><strong className={tone}>{number(value)}</strong><em>最近一次有效采集</em></div>;
}

const TREND_METRICS = {
  exposure: { label: "曝光", color: "var(--red)", field: "exposures" },
  views: { label: "观看", color: "var(--blue)", field: "views" },
  engagement: { label: "互动", color: "var(--violet)", field: "interactions" },
  followers: { label: "涨粉", color: "var(--mint)", field: "followersGained" },
} as const;

type TrendKey = keyof typeof TREND_METRICS;

function AccountTrend({ rows }: { rows: Array<Record<string, unknown>> }) {
  const [active, setActive] = useState<TrendKey>("views");
  const [hovered, setHovered] = useState<number | null>(null);
  const trend = TREND_METRICS[active];
  const field = trend.field;
  const hasRealValues = rows.length > 0 && rows.some((row) => row[field] != null);
  const isExposureDemo = active === "exposure" && !hasRealValues;
  const available = hasRealValues || isExposureDemo;
  const values = isExposureDemo ? [7200, 8100, 7950, 9400, 10200, 9800, 11300] : rows.map((row) => Number(row[field] ?? 0));
  const dates = isExposureDemo ? ["08/09", "08/10", "08/11", "08/12", "08/13", "08/14", "08/15"] : rows.map((row) => String(row.metricDate ?? "").slice(5).replace("-", "/"));
  const width = 1180; const height = 260; const left = 52; const right = 24; const top = 22; const bottom = 34;
  const max = Math.max(...values, 1); const magnitude = Math.pow(10, Math.max(0, String(Math.round(max)).length - 1)); const ceiling = Math.max(10, Math.ceil(max / magnitude) * magnitude);
  const step = values.length > 1 ? (width - left - right) / (values.length - 1) : 0;
  const coords = values.map((value, index) => [left + index * step, top + (1 - value / ceiling) * (height - top - bottom)] as const);
  const path = coords.reduce((result, [x, y], index) => index === 0 ? `M${x},${y}` : `${result} L${x},${y}`, "");
  const area = coords.length ? `${path} L${coords.at(-1)?.[0]},${height - bottom} L${coords[0][0]},${height - bottom}Z` : "";
  const total = values.reduce((sum, value) => sum + value, 0);
  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!coords.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (width / rect.width);
    const index = step ? Math.round((x - left) / step) : 0;
    setHovered(Math.max(0, Math.min(coords.length - 1, index)));
  };
  const hoverPoint = hovered == null ? null : coords[hovered];
  const tooltipX = hoverPoint ? Math.min(width - right - 132, Math.max(left + 8, hoverPoint[0] + 12)) : 0;
  const tooltipY = hoverPoint ? Math.max(top + 8, hoverPoint[1] - 58) : 0;
  return <section className="card col-12 trend-card reveal">
    <div className="trend-head"><div><small>7-DAY TREND</small><h2>近 7 天核心指标趋势 <span className={`chip ${isExposureDemo ? "amber" : available ? "mint" : "gray"}`}>{isExposureDemo ? "演示数据" : available ? "真实数据" : "暂不可用"}</span></h2>{available && <div className="trend-total"><strong>{number(total)}</strong></div>}</div><div className="trend-tabs" role="tablist" aria-label="趋势指标">{(Object.keys(TREND_METRICS) as TrendKey[]).map((key) => <button role="tab" aria-selected={active === key} className={active === key ? "on" : ""} key={key} onClick={() => { setActive(key); setHovered(null); }}>{TREND_METRICS[key].label}</button>)}</div></div>
    {available ? <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} aria-label={`近 7 天${trend.label}趋势图`} onMouseMove={onMove} onMouseLeave={() => setHovered(null)}>
      {[0, .25, .5, .75, 1].map((ratio) => { const y = top + ratio * (height - top - bottom); const label = Math.round(ceiling * (1 - ratio)); return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} /><text x={left - 12} y={y + 4} textAnchor="end">{number(label)}</text></g>; })}
      <rect className="trend-hit" x={left} y={top} width={width - left - right} height={height - top - bottom} fill="transparent" />
      <path d={area} fill={trend.color} opacity=".07" stroke="none"/><path d={path} fill="none" stroke={trend.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
      {coords.map(([x, y], index) => <g key={dates[index]} pointerEvents="none"><circle cx={x} cy={y} r="4" fill="#fff" stroke={trend.color} strokeWidth="2.5"/><text x={x} y={height - 10} textAnchor="middle">{dates[index]}</text></g>)}
      {hoverPoint && hovered != null && <g className="trend-hover" pointerEvents="none"><line className="trend-cross" x1={hoverPoint[0]} x2={hoverPoint[0]} y1={top} y2={height - bottom}/><line className="trend-cross" x1={left} x2={width - right} y1={hoverPoint[1]} y2={hoverPoint[1]}/><circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="6" fill="#fff" stroke={trend.color} strokeWidth="3"/><g className="trend-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}><rect width="124" height="48" rx="9"/><text x="12" y="18">{dates[hovered]}</text><text className="tooltip-value" x="12" y="37">{trend.label} {number(values[hovered])}</text></g></g>}
    </svg>{isExposureDemo && <p className="demo-note">创作者中心可采集单篇曝光；账号级逐日曝光接入后，将自动替换这里的演示数据。</p>}</div> : <div className="trend-unavailable"><b>等待逐日数据</b><p>完成一次有效采集后，这里会显示真实趋势。</p></div>}
  </section>;
}

function HealthRing({ value }: { value: number }) { const pct = Math.max(0, Math.min(1, value)); return <div className="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="49" fill="none" stroke="#fff" strokeWidth="10"/><circle cx="60" cy="60" r="49" fill="none" stroke="var(--mint)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * 308} 308`} /></svg><div className="c-val"><b>{Math.round(pct * 100)}%</b><span>任务成功率</span></div></div>; }
function Task({ value, label, kind = "" }: { value: unknown; label: string; kind?: string }) { return <div className={`task-chip ${kind}`}><b>{number(value)}</b><span>{label}</span></div>; }
function MetricCard({ label, value, icon, color }: { label: string; value: unknown; icon: string; color: string }) { return <section className="card col-3 m-card reveal"><div className="m-top"><span className={`m-ico ${color}`}><Icon name={icon} /></span><span className="m-lab">{label}</span></div><strong className="m-val num">{number(value)}</strong><p className="m-footnote">来自最近一次有效采集</p></section>; }

const MONITORING_DEMO = [
  { exposures: 12480, views: 3280, likes: 246, followersGained: 42 },
  { exposures: 8260, views: 1890, likes: 112, followersGained: 21 },
  { exposures: 21300, views: 6420, likes: 518, followersGained: 96 },
];

function VideoCard({ video, index, openVideo, demo = false }: { video: Record<string, unknown>; index: number; openVideo: (id: string) => void; demo?: boolean }) {
  const snapshot = (video.latestSnapshot ?? {}) as Record<string, unknown>;
  const metrics = demo ? MONITORING_DEMO[index % MONITORING_DEMO.length] : snapshot;
  return <button className={`card v-card cover-${index % 6}`} onClick={() => openVideo(String(video.id))}><div className="v-cover"><i className="ring-deco r1"/><i className="ring-deco r2"/><span className="cov-play"><Icon name="tri" /></span><span className="cat">{String(video.category ?? "未分类")}</span></div><div className="v-body"><h3 className="v-title">{String(video.title)}</h3><Life nodeCount={Number(video.nodeCount ?? 0)} /><div className="v-stats"><span className="stat-red"><small>曝光</small><b>{number(metrics.exposures)}</b></span><span className="stat-blue"><small>观看</small><b>{number(metrics.views)}</b></span><span className="stat-violet"><small>点赞</small><b>{number(metrics.likes)}</b></span><span className="stat-mint"><small>涨粉</small><b>{number(metrics.followersGained)}</b></span></div></div></button>;
}

function Life({ nodeCount }: { nodeCount: number }) { return <div className="life">{[2, 6, 24, 72].map((node, index) => <span className={`life-node ${index < nodeCount ? "done" : index === nodeCount ? "cur" : ""}`} key={node}><i className="life-dot"/><small>{node}h</small>{index < 3 && <em />}</span>)}</div>; }

function Videos({ videos, openVideo }: { videos: Array<Record<string, unknown>>; openVideo: (id: string) => void }) {
  return <section className="card list-card"><div className="vlist-head"><span>内容</span><span>状态</span><span>生命周期</span><span>曝光</span><span>观看</span><span>诊断</span><span /></div>{videos.map((video, index) => { const snapshot = (video.latestSnapshot ?? {}) as Record<string, unknown>; const diagnosis = (video.diagnosis ?? {}) as Record<string, unknown>; const isHistorical = video.status === "historical"; return <button className="vlist-row" key={String(video.id)} onClick={() => openVideo(String(video.id))}><span className="vlist-content"><span className={`vl-cover cover-${index % 6}`}><Icon name="tri" /></span><span className="vl-main"><b>{String(video.title)}</b><small>{dateTime(video.publishedAt)} · {String(video.category ?? "未分类")}</small></span></span><span className="vl-status"><span className={`chip ${video.status === "completed" ? "mint" : video.status === "incomplete" || isHistorical ? "gray" : "blue"}`}>{video.status === "completed" ? "已完成" : video.status === "incomplete" ? "数据不完整" : isHistorical ? "历史参考" : "监测中"}</span></span><Life nodeCount={Number(video.nodeCount ?? 0)} /><span className="vl-num">{number(snapshot.exposures)}</span><span className="vl-num">{number(snapshot.views)}</span><span className={`chip vl-diagnosis ${diagnosis.primaryStage && diagnosis.primaryStage !== "unlocated" ? "red" : "gray"}`}>{STAGES[String(diagnosis.primaryStage)]?.label ?? "待诊断"}</span><span className="vl-detail">详情</span></button>; })}{!videos.length && <Empty title="没有匹配的视频" description="采集后的视频会显示在这里。" />}</section>;
}

function Alerts({ alerts, openVideo }: { alerts: Array<Record<string, unknown>>; openVideo: (id: string) => void }) {
  return <div className="alert-page"><div className="filter-bar"><button className="f-chip on">全部异常</button><button className="f-chip">曝光</button><button className="f-chip">点击</button><button className="f-chip">留存</button><button className="f-chip">互动</button></div><section className="card alert-list">{alerts.map((alert) => <AlertRow key={String(alert.id)} alert={alert} openVideo={openVideo} />)}{!alerts.length && <Empty title="还没有可处理的异常" description="系统会在 6 / 24 / 72 小时节点给出有证据的诊断。" />}</section></div>;
}

function AlertRow({ alert, openVideo }: { alert: Record<string, unknown>; openVideo: (id: string) => void }) { const video = (alert.video ?? {}) as Record<string, unknown>; const evidence = (alert.evidence ?? []) as Array<Record<string, unknown>>; const primary = String(alert.primaryStage); const item = evidence.find((row) => row.stage === primary); return <button className="a-item" onClick={() => openVideo(String(alert.videoId))}><i className={`sev ${alert.confidence === "high" ? "s3" : alert.confidence === "medium" ? "s2" : "s1"}`} /><span className="a-main"><b>{String(video.title ?? "视频异常")}</b><small>{String(alert.nodeHours)}h 节点 · {STAGES[primary]?.hint}</small></span><span className="chip red">{STAGES[primary]?.label ?? primary}</span><strong className="a-dev">{item?.deviation == null ? "—" : percent(item.deviation)}</strong></button>; }

function originalPostUrl(video: Record<string, unknown>) {
  const platformVideoId = String(video.platformVideoId ?? "").trim();
  return platformVideoId ? `https://www.xiaohongshu.com/explore/${encodeURIComponent(platformVideoId)}` : null;
}

function VideoDetail({ detail, onBack, onChange, onReview }: { detail: Record<string, unknown>; onBack: () => void; onChange?: () => void; onReview?: () => void }) {
  const video = detail.video as Record<string, unknown>; const snapshots = detail.snapshots as Array<Record<string, unknown>>; const changes = detail.changes as Array<Record<string, unknown>>; const diagnoses = detail.diagnoses as Array<Record<string, unknown>>; const diagnosis = diagnoses[0];
  const latestSnapshot = snapshots.at(-1);
  const hasCurrentFunnel = Boolean(latestSnapshot && ["exposures", "coverClickRate", "avgWatchSeconds", "likes", "comments", "collects", "shares"].some((field) => latestSnapshot[field] != null));
  const postUrl = originalPostUrl(video);
  return <div className="detail-page"><div className="back-row"><button className="text-btn" onClick={onBack}>← 返回视频列表</button></div><section className="card vd-head"><div className="vd-cover cover-0"><i className="ring-deco r1"/><i className="ring-deco r2"/><span className="cov-play"><Icon name="tri" /></span></div><div className="vd-info"><div className="vd-title-line"><h2>{String(video.title)}</h2>{postUrl && <a className="post-inline-link" href={postUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`在新标签页查看${String(video.title)}原帖`}>查看原帖 ↗</a>}</div><p>{dateTime(video.publishedAt)} · {video.durationSeconds ? `${video.durationSeconds}s` : "时长待补录"} · {String(video.category ?? "未分类")}</p><div className="vd-tags"><span className={`chip ${video.status === "historical" ? "gray" : "blue"}`}>{video.status === "monitoring" ? "监测中" : video.status === "historical" ? "历史参考" : "观察完成"}</span>{((video.tags ?? []) as string[]).map((tag) => <span className="chip gray" key={tag}>{tag}</span>)}</div></div>{onChange && onReview && <div className="vd-actions"><button className="btn btn-pri" onClick={onChange}><Icon name="edit" />登记修改</button><button className="btn btn-ghost" onClick={onReview}><Icon name="doc" />确认复盘</button></div>}</section>
    <section className="card sec-gap"><div className="card-h row-between"><h3 className="card-t">生命周期曲线 <span className="sub">2 / 6 / 24 / 72 小时累计反馈</span></h3><div className="legend"><span><i style={{background:"var(--red)"}}/>实际值</span><span className="dash"><i/>账号基线</span></div></div><div className="card-b"><LifeChart snapshots={snapshots} changes={changes} publishedAt={video.publishedAt} /></div></section>
    <section className="detail-grid sec-gap"><section className="card"><div className="card-h"><h3 className="card-t">四环节诊断</h3><span className={`chip ${diagnosis?.primaryStage && diagnosis.primaryStage !== "unlocated" ? "red" : hasCurrentFunnel ? "mint" : "gray"}`}>{diagnosis ? `${STAGES[String(diagnosis.primaryStage)]?.label} · ${diagnosis.confidence === "low" ? "低" : diagnosis.confidence === "medium" ? "中" : "高"}置信度` : hasCurrentFunnel ? "当前采集数据" : "等待采集"}</span></div><div className="card-b"><Funnel diagnosis={diagnosis} snapshot={latestSnapshot} durationSeconds={video.durationSeconds == null ? null : Number(video.durationSeconds)} /></div></section><section className="card"><div className="card-h"><h3 className="card-t">修改时间轴</h3></div><div className="card-b"><Timeline changes={changes} publishedAt={video.publishedAt} /></div></section></section>
    {diagnosis && <section className="diag sec-gap"><div className="diag-head"><span className="chip red">主问题</span><h3>{STAGES[String(diagnosis.primaryStage)]?.label}</h3></div><div className="diag-columns"><div><h5>证据与可能原因</h5><ul>{((diagnosis.possibleReasons ?? []) as string[]).map((reason) => <li key={reason}>{reason}</li>)}</ul></div><div><h5>数据限制</h5><ul>{((diagnosis.limitations ?? []) as string[]).map((item) => <li key={item}>{item}</li>)}</ul></div></div>{Boolean(diagnosis.recommendation) && <div className="suggest"><b>下一步建议</b><p>{String((diagnosis.recommendation as Record<string, unknown>).action)}；主要观察 {String((diagnosis.recommendation as Record<string, unknown>).targetMetric)}，{String((diagnosis.recommendation as Record<string, unknown>).verificationMethod)}。</p></div>}</section>}
  </div>;
}

const LIFE_METRICS = {
  exposures: { label: "曝光", color: "var(--red)", kind: "count", baseline: [1600, 5200, 13000, 22000] },
  coverClickRate: { label: "封面点击率", color: "var(--amber)", kind: "rate", baseline: [.12, .15, .17, .18] },
  views: { label: "观看", color: "var(--blue)", kind: "count", baseline: [380, 1320, 3650, 6200] },
  avgWatchSeconds: { label: "人均观看时长", color: "var(--violet)", kind: "seconds", baseline: [8, 10, 12, 13] },
  interactions: { label: "互动", color: "var(--mint)", kind: "count", baseline: [38, 145, 480, 860] },
  followersGained: { label: "涨粉", color: "#20B889", kind: "count", baseline: [5, 18, 52, 94] },
} as const;
type LifeMetricKey = keyof typeof LIFE_METRICS;

const LIFE_DEMO = [
  { ageHours: 2, targetNodeHours: 2, exposures: 1200, coverClickRate: .142, views: 260, avgWatchSeconds: 7.8, likes: 18, comments: 3, collects: 9, shares: 2, followersGained: 3 },
  { ageHours: 6, targetNodeHours: 6, exposures: 4600, coverClickRate: .168, views: 1050, avgWatchSeconds: 10.6, likes: 76, comments: 11, collects: 34, shares: 9, followersGained: 15 },
  { ageHours: 24, targetNodeHours: 24, exposures: 11800, coverClickRate: .184, views: 3200, avgWatchSeconds: 13.2, likes: 245, comments: 38, collects: 126, shares: 31, followersGained: 46 },
  { ageHours: 72, targetNodeHours: 72, exposures: 18600, coverClickRate: .191, views: 5400, avgWatchSeconds: 14.1, likes: 430, comments: 68, collects: 245, shares: 57, followersGained: 82 },
];

function lifeMetricValue(row: Record<string, unknown>, key: LifeMetricKey) {
  if (key !== "interactions") return nullableMetric(row[key]);
  const parts = [row.likes, row.comments, row.collects, row.shares].map(nullableMetric);
  return parts.some((value) => value != null) ? parts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
}

function formatLifeValue(value: number, kind: "count" | "rate" | "seconds") {
  if (kind === "rate") return percent(value, 1);
  if (kind === "seconds") return `${value.toFixed(value % 1 ? 1 : 0)}s`;
  return number(value);
}

function LifeChart({ snapshots, changes, publishedAt }: { snapshots: Array<Record<string, unknown>>; changes: Array<Record<string, unknown>>; publishedAt: unknown }) {
  const [active, setActive] = useState<LifeMetricKey>("exposures");
  const [hovered, setHovered] = useState<number | null>(null);
  const lifecycleSnapshots = snapshots.filter((row) => [2, 6, 24, 72].includes(Number(row.targetNodeHours)));
  const isDemo = lifecycleSnapshots.length === 0;
  const source: Array<Record<string, unknown>> = isDemo ? LIFE_DEMO : lifecycleSnapshots;
  const metric = LIFE_METRICS[active];
  const points = source.map((row) => ({ x: Number(row.ageHours ?? row.targetNodeHours ?? 0), y: lifeMetricValue(row, active), node: Number(row.targetNodeHours ?? row.ageHours ?? 0), at: row.collectedAt, row })).filter((point): point is typeof point & { y: number } => point.y != null);
  if (!points.length) return <Empty title={`等待${metric.label}生命周期数据`} description="采集到对应指标后，会按 2 / 6 / 24 / 72 小时节点展开。" />;
  const baselineValues: readonly number[] = isDemo ? metric.baseline : [];
  const width = 900, height = 292, left = 62, right = 24, top = 42, bottom = 42;
  const max = Math.max(...points.map((point) => point.y), ...baselineValues, 1);
  const magnitude = metric.kind === "rate" ? .05 : metric.kind === "seconds" ? 5 : Math.pow(10, Math.max(0, String(Math.round(max)).length - 1));
  const ceiling = Math.max(magnitude, Math.ceil(max / magnitude) * magnitude);
  const xFor = (hours: number) => left + Math.sqrt(Math.max(0, Math.min(hours, 72)) / 72) * (width - left - right);
  const yFor = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const coords = points.map((point) => [xFor(point.x), yFor(point.y)] as [number, number]);
  const baselineCoords = baselineValues.map((value, index) => [xFor(points[index]?.x ?? 0), yFor(value)] as [number, number]);
  const path = smoothPath(coords);
  const baselinePath = smoothPath(baselineCoords);
  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) * (width / rect.width); let nearest = 0; coords.forEach(([pointX], index) => { if (Math.abs(pointX - x) < Math.abs(coords[nearest][0] - x)) nearest = index; }); setHovered(nearest); };
  const hoverPoint = hovered == null ? null : coords[hovered];
  const hoverRow = hovered == null ? null : points[hovered]?.row;
  const tooltipWidth = active === "interactions" ? 190 : 154;
  const tooltipHeight = active === "interactions" ? 118 : 58;
  const tooltipX = hoverPoint ? Math.min(width - right - tooltipWidth, Math.max(left + 6, hoverPoint[0] + 12)) : 0;
  const tooltipY = hoverPoint ? (hoverPoint[1] < 150 ? hoverPoint[1] + 12 : hoverPoint[1] - tooltipHeight - 12) : 0;
  const cumulative = metric.kind === "count" ? "累计" : "当前";
  return <div className="life-chart-block"><div className="life-chart-tools"><p><b>怎么看：</b>横轴是发布后的时间，纵轴是{cumulative}{metric.label}；移动鼠标可查看每个节点的具体数据。</p><div className="life-tabs" role="tablist" aria-label="生命周期指标">{(Object.keys(LIFE_METRICS) as LifeMetricKey[]).map((key) => <button key={key} role="tab" aria-selected={active === key} className={active === key ? "on" : ""} onClick={() => { setActive(key); setHovered(null); }}>{LIFE_METRICS[key].label}</button>)}</div></div>{isDemo && <div className="life-demo-banner"><span className="chip amber">虚拟账号演示</span><span>当前快照不属于生命周期节点；采集到 2 / 6 / 24 / 72 小时数据后自动替换。</span></div>}<div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} className="life-chart" aria-label={`${metric.label}生命周期曲线`} onMouseMove={onMove} onMouseLeave={() => setHovered(null)}>{[0,.25,.5,.75,1].map((tick) => { const value = ceiling * (1 - tick); const y = top + tick * (height - top - bottom); return <g key={tick}><line x1={left} x2={width-right} y1={y} y2={y} stroke="var(--line-soft)"/><text x={left - 12} y={y + 4} textAnchor="end">{formatLifeValue(value, metric.kind)}</text></g>; })}{baselinePath && <path d={baselinePath} fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeDasharray="6 7"/>}<path d={`${path} L${coords.at(-1)?.[0]},${height-bottom} L${coords[0][0]},${height-bottom}Z`} fill={metric.color} opacity=".07"/><path d={path} fill="none" stroke={metric.color} strokeWidth="3" strokeLinecap="round"/>{coords.map(([x,y], index) => <g key={`${points[index].node}-${active}`}><circle cx={x} cy={y} r="5" fill="#fff" stroke={metric.color} strokeWidth="3"/><text x={x} y={height-13} textAnchor="middle">{points[index].node}h</text></g>)}{!isDemo && changes.map((change, index) => { const publishedMs = new Date(String(publishedAt)).getTime(); if (!Number.isFinite(publishedMs)) return null; const hours=(new Date(String(change.effectiveAt)).getTime()-publishedMs)/3_600_000; if (hours < 0 || hours > 72) return null; const x=xFor(hours); return <g key={String(change.id)}><line x1={x} x2={x} y1={top} y2={height-bottom} stroke="var(--violet)" strokeDasharray="4 5"/><text x={x+5} y={top+13+index*14} fill="var(--violet)">{(change.changeTypes as string[]).join("+")}</text></g>; })}{hoverPoint && hovered != null && hoverRow && <g className="life-hover" pointerEvents="none"><line x1={hoverPoint[0]} x2={hoverPoint[0]} y1={top} y2={height-bottom}/><circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="6" fill="#fff" stroke={metric.color} strokeWidth="3"/><g className="life-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}><rect width={tooltipWidth} height={tooltipHeight} rx="10"/><text x="12" y="19">发布后 {points[hovered].node} 小时</text><text className="tooltip-main" x="12" y="40">{metric.label} {formatLifeValue(points[hovered].y, metric.kind)}</text>{active === "interactions" && <g className="tooltip-parts"><text x="12" y="62">点赞 {number(hoverRow.likes)}</text><text x="100" y="62">评论 {number(hoverRow.comments)}</text><text x="12" y="83">收藏 {number(hoverRow.collects)}</text><text x="100" y="83">分享 {number(hoverRow.shares)}</text><text x="12" y="105">互动合计 {number(points[hovered].y)}</text></g>}</g></g>}</svg></div></div>;
}

function smoothPath(points: Array<[number, number]>) { if (points.length < 3) return points.map((point,index)=>`${index?"L":"M"}${point[0]},${point[1]}`).join(" "); let d=`M${points[0][0]},${points[0][1]}`; for(let i=0;i<points.length-1;i++){const p0=points[i-1]??points[i],p1=points[i],p2=points[i+1],p3=points[i+2]??p2; d+=` C${p1[0]+(p2[0]-p0[0])/6},${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6},${p2[1]-(p3[1]-p1[1])/6} ${p2[0]},${p2[1]}`;} return d; }

function currentFunnelEvidence(snapshot: Record<string, unknown> | undefined, durationSeconds: number | null) {
  if (!snapshot) return [];
  const exposures = nullableMetric(snapshot.exposures);
  const views = nullableMetric(snapshot.views);
  const avgWatchSeconds = nullableMetric(snapshot.avgWatchSeconds);
  const interactionParts = [snapshot.likes, snapshot.comments, snapshot.collects, snapshot.shares].map(nullableMetric);
  const interactionTotal = interactionParts.some((value) => value != null) ? interactionParts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  return [
    { stage: "exposure", actual: exposures, displayKind: "count" },
    { stage: "click", actual: nullableMetric(snapshot.coverClickRate) ?? safeRatio(views, exposures), displayKind: "rate" },
    { stage: "retention", actual: durationSeconds && durationSeconds >= 1 ? safeRatio(avgWatchSeconds, durationSeconds) : avgWatchSeconds, displayKind: durationSeconds && durationSeconds >= 1 ? "rate" : "seconds" },
    { stage: "engagement", actual: safeRatio(interactionTotal, views), displayKind: "rate" },
  ];
}

function nullableMetric(value: unknown) { const parsed = Number(value); return value == null || !Number.isFinite(parsed) ? null : parsed; }
function safeRatio(numerator: number | null, denominator: number | null) { return numerator == null || denominator == null || denominator <= 0 ? null : numerator / denominator; }

function Funnel({ diagnosis, snapshot, durationSeconds }: { diagnosis: Record<string, unknown> | undefined; snapshot: Record<string, unknown> | undefined; durationSeconds: number | null }) {
  const diagnosed = (diagnosis?.evidence ?? []) as Array<Record<string, unknown>>;
  const current = currentFunnelEvidence(snapshot, durationSeconds);
  const hasBaseline = diagnosed.some((item) => item.baseline != null);
  return <div className={hasBaseline ? "funnel-comparison" : "funnel-current"}>{hasBaseline ? <div className="fun-legend"><span><i className="lgf"/>当前正常</span><span><i className="lgf r"/>当前偏低</span><span><i className="lgm"/>账号基线</span></div> : <p className="fun-current-note">当前一次采集结果；积累同节点历史样本后，再显示账号基线对比。</p>}{["exposure","click","retention","engagement"].map((stage) => { const diagnosedItem=diagnosed.find((row)=>row.stage===stage); const currentItem=current.find((row)=>row.stage===stage); const actual=currentItem?.actual ?? nullableMetric(diagnosedItem?.actual); const deviation=nullableMetric(diagnosedItem?.deviation); const width=actual==null?0:Math.max(8,Math.min(100,62.5*(1+(deviation ?? 0)))); const status=String(diagnosedItem?.status ?? "current"); return <div className="fun-row" key={stage}><span className="fun-stage"><i style={{background:STAGES[stage].color}}/><span>{STAGES[stage].label}<small>{STAGES[stage].hint}</small></span></span><b>{formatEvidence(actual, stage, currentItem?.displayKind)}</b>{hasBaseline ? <><span className="fun-track"><i className="fun-fill" style={{width:`${width}%`,background:status==="low"?"var(--red)":"var(--mint)"}}/><i className="fun-mark"/></span><span className={status==="low"?"down":"muted"}>{actual == null ? "待采集" : deviation == null ? "暂无对比" : percent(deviation)}</span></> : <span className="fun-snapshot-label">{actual == null ? "待采集" : "最新采集"}</span>}</div>; })}</div>;
}
function formatEvidence(actual: number | null, stage: string, displayKind?: string) { if (actual == null) return "—"; if (displayKind === "seconds") return `${actual.toFixed(1)}s`; return stage === "exposure" ? number(actual) : percent(actual); }

function Timeline({ changes, publishedAt }: { changes: Array<Record<string, unknown>>; publishedAt: unknown }) { return <div className="tl"><div className="tl-item"><i className="tl-dot mint"/><b>发布版本</b><small>{dateTime(publishedAt)}</small></div>{changes.map((change) => <div className="tl-item" key={String(change.id)}><i className="tl-dot violet"/><b>{(change.changeTypes as string[]).join("、")}</b><small>{dateTime(change.effectiveAt)}</small><p>{String(change.summary)}</p><span className="chip violet">目标：{String(change.targetMetric ?? "待补充")}</span></div>)}</div>; }

function Experiences({ items, update }: { items: Array<Record<string, unknown>>; update?: (id: string, status: string) => void }) {
  const [filter, setFilter] = useState("all");
  const visible = filter === "all" ? items : items.filter((item) => item.status === filter);
  return <div><div className="filter-bar"><button className={`f-chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>全部</button><button className={`f-chip ${filter === "draft" ? "on" : ""}`} onClick={() => setFilter("draft")}>待验证</button><button className={`f-chip ${filter === "confirmed" ? "on" : ""}`} onClick={() => setFilter("confirmed")}>已确认</button></div><div className="e-grid">{visible.map((item) => <article className="card e-card" key={String(item.id)}><div className="e-top"><h3>{String(item.title)}</h3><span className={`chip ${item.status === "confirmed" ? "mint" : item.status === "rejected" ? "gray" : "amber"}`}>{item.status === "confirmed" ? "已确认" : item.status === "rejected" ? "已驳回" : "草稿"}</span></div><p className="e-law">{String(item.observation)}</p><p className="e-action"><b>建议动作</b>{String(item.action)}</p><div className="e-meta"><span>{String(item.scope)}</span><span>·</span><span>{item.confidence === "high" ? "高" : item.confidence === "medium" ? "中" : "低"}置信度</span><span>· v{String(item.version)}</span></div>{item.status === "draft" && update && <div className="e-actions"><button className="btn btn-ghost" onClick={() => update(String(item.id), "rejected")}>驳回</button><button className="btn btn-pri" onClick={() => update(String(item.id), "confirmed")}>确认经验</button></div>}</article>)}{!visible.length && <Empty title="当前筛选下没有经验" description="72 小时复盘经人工确认后，经验草稿会出现在这里。" />}</div></div>;
}

type ShareRecord = { id: string; label: string | null; createdAt: string; expiresAt: string | null };

function ShareModal({ close }: { close: () => void }) {
  const [items, setItems] = useState<ShareRecord[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/shares", { cache: "no-store" });
    const body = await response.json() as { error?: string; data?: ShareRecord[] };
    if (response.ok) setItems(body.data ?? []); else setError(body.error || "分享链接加载失败");
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setCopied(false);
    const form = new FormData(event.currentTarget);
    const expires = String(form.get("expiresInDays") || "");
    const response = await fetch("/api/shares", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: form.get("label"), expiresInDays: expires ? Number(expires) : null }),
    });
    const body = await response.json() as { error?: string; data?: { url: string } };
    setBusy(false);
    if (!response.ok || !body.data) { setError(body.error || "分享链接创建失败"); return; }
    setUrl(body.data.url);
    await load();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setError("复制失败，请手动选择链接复制"); }
  };

  const revoke = async (id: string) => {
    const response = await fetch(`/api/shares/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("撤销失败，请稍后重试"); return; }
    await load();
  };

  return <div className="mask on" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className="modal share-modal">
    <div className="m-h"><div><h2>分享账号数据</h2><p className="page-sub">持有链接的人无需登录，只能查看，不能修改或复盘。</p></div><button type="button" className="ico-btn" onClick={close}>×</button></div>
    <form onSubmit={create}><label className="f-lab">链接名称</label><input className="f-in" name="label" defaultValue="小红书运营团队" maxLength={80}/><label className="f-lab">有效期</label><select className="f-se" name="expiresInDays" defaultValue=""><option value="">长期有效</option><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option></select><button className="btn btn-pri share-create" disabled={busy}><Icon name="users" />{busy ? "生成中…" : "生成只读链接"}</button></form>
    {url && <div className="share-result"><span>新链接仅在这里完整显示一次</span><div><input className="f-in" readOnly value={url} onFocus={(event) => event.currentTarget.select()}/><button className="btn btn-ghost" onClick={copy}>{copied ? "已复制" : "复制"}</button></div></div>}
    {error && <div className="form-error">{error}</div>}
    <div className="share-list"><h3>有效链接</h3>{items.map((item) => <div key={item.id}><span><b>{item.label || "团队只读链接"}</b><small>{item.expiresAt ? `有效至 ${dateTime(item.expiresAt)}` : `创建于 ${dateTime(item.createdAt)} · 长期有效`}</small></span><button className="text-btn" onClick={() => void revoke(item.id)}>撤销</button></div>)}{!items.length && <p>还没有有效的分享链接。</p>}</div>
  </div></div>;
}

function Settings({ data, openGuide }: { data: ApiState | null; openGuide: () => void }) { return <div className="settings-grid"><section className="card setup-card"><div className="card-h"><h2 className="card-t">OpenCLI 采集器</h2><span className={`chip ${data?.account.connectionStatus === "connected" ? "mint" : "amber"}`}>{data?.account.connectionStatus === "connected" ? "已连接" : "需要浏览器桥接"}</span><button type="button" className="text-btn setup-guide-btn" onClick={openGuide}>查看新手引导</button></div><div className="card-b setup-steps"><div><b>01</b><span><strong>连接 Chrome</strong><small>安装 OpenCLI Browser Bridge，并在 Chrome 登录 creator.xiaohongshu.com。</small><a className="setup-link" href="https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk" target="_blank" rel="noreferrer">安装官方扩展 →</a></span></div><div><b>02</b><span><strong>执行连接体检</strong><code>npm run collector:doctor</code></span></div><div><b>03</b><span><strong>首次只读采集</strong><code>npm run collector:cloud:once</code><small>默认读取最近 5 篇内容；确认数据正确后，再启动连续采集。</small></span></div></div></section><section className="card setup-card"><div className="card-h"><h2 className="card-t">采集原则</h2></div><div className="card-b principles"><p><Icon name="eye" />仅使用创作者后台只读命令</p><p><Icon name="history" />原始响应与指标快照只追加，不覆盖</p><p><Icon name="alert" />登录失效不写入错误零值</p><p><Icon name="target" />失败自动按 5 / 15 / 30 分钟重试</p></div></section></div>; }

function CollectorOnboarding({ connected, videoCount, refresh, close }: { connected: boolean; videoCount: number; refresh: () => Promise<void>; close: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const command = "npm run collector:cloud:once";
  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const checkData = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };
  return <div className="mask on onboarding-mask"><div className="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="collector-onboarding-title">
    <div className="onboarding-kicker"><i className="live-monitor-dot" />首次使用 · 约 3 分钟</div>
    <div className="m-h"><div><h2 id="collector-onboarding-title">连接你已登录的小红书账号</h2><p className="page-sub">薯数只读取创作者中心数据，不会发布、评论或修改内容。</p></div><button type="button" className="ico-btn" onClick={close} aria-label="关闭引导">×</button></div>
    <div className="onboarding-status"><span className={connected ? "done" : "current"}><i />{connected ? "账号已经连接" : "等待连接本机 Chrome"}</span><b>{videoCount >= 5 ? "最近 5 篇已同步" : videoCount ? `已有 ${videoCount} 篇，首次采集将补齐最近 5 篇` : "首次将读取最近 5 篇"}</b></div>
    <div className="onboarding-steps">
      <section><b>01</b><div><h3>在 Chrome 登录创作者中心</h3><p>使用需要监测的小红书账号登录，并保持页面处于登录状态。</p><a className="btn btn-ghost" href="https://creator.xiaohongshu.com" target="_blank" rel="noreferrer">打开创作者中心 ↗</a></div></section>
      <section><b>02</b><div><h3>确认 OpenCLI 浏览器扩展已连接</h3><p>扩展负责在本机读取当前登录账号；账号密码和 Cookie 不会上传到薯数。</p><a className="setup-link" href="https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk" target="_blank" rel="noreferrer">检查或安装扩展 →</a></div></section>
      <section><b>03</b><div><h3>运行首次只读采集</h3><p>在安装薯数项目的电脑终端中运行。完成后回到这里检查结果。</p><div className="onboarding-command"><code>{command}</code><button type="button" onClick={() => void copyCommand()}>{copied ? "已复制" : "复制命令"}</button></div></div></section>
    </div>
    <p className="onboarding-note">当前内部验证版需要本机采集器保持运行；网页版无法绕过 Chrome 权限直接读取登录数据。</p>
    <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={close}>稍后设置</button><button type="button" className="btn btn-pri" disabled={checking} onClick={() => void checkData()}>{checking ? "正在检查…" : connected ? "刷新最新数据" : "我已采集，检查数据"}</button></div>
  </div></div>;
}

async function uploadAsset(file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/assets", { method: "POST", body: form });
  const body = await response.json() as { error?: string; data?: { key: string; url: string } };
  if (!response.ok || !body.data) throw new Error(body.error || "素材上传失败");
  return body.data;
}

function ChangeModal({ detail, close, saved }: { detail: Record<string, unknown>; close: () => void; saved: (message: string) => Promise<void> }) {
  const video = detail.video as Record<string, unknown>;
  const [types, setTypes] = useState<string[]>(["标题"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [effectiveAt] = useState(() => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 16));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const coverFile = form.get("coverFile");
      const videoFile = form.get("videoFile");
      const coverAsset = coverFile instanceof File && coverFile.size ? await uploadAsset(coverFile) : null;
      const videoAsset = videoFile instanceof File && videoFile.size ? await uploadAsset(videoFile) : null;
      const duration = Number(form.get("durationSeconds"));
      const response = await fetch(`/api/videos/${video.id}/changes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changeTypes: types,
          title: form.get("title"),
          effectiveAt: form.get("effectiveAt"),
          summary: form.get("summary"),
          hypothesis: form.get("hypothesis"),
          targetMetric: form.get("targetMetric"),
          body: form.get("body") || null,
          topics: String(form.get("topics") || "").split(/[，,\s]+/).filter(Boolean),
          durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
          coverUrl: coverAsset?.url ?? null,
          coverObjectKey: coverAsset?.key ?? null,
          videoUrl: videoAsset?.url ?? null,
          videoObjectKey: videoAsset?.key ?? null,
        }),
      });
      const body = await response.json() as { error?: string; warning?: string };
      if (!response.ok) throw new Error(body.error || "修改记录保存失败");
      await saved(body.warning || "修改记录已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally { setBusy(false); }
  };

  return <div className="mask on" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal" onSubmit={submit}>
    <div className="m-h"><h2>登记内容修改</h2><button type="button" className="ico-btn" onClick={close}>×</button></div>
    <p className="page-sub">修改事件会叠加到生命周期曲线上，系统只描述时间关联。</p>
    <label className="f-lab">修改类型</label><div className="type-set">{["标题", "封面", "视频", "正文/话题", "发布时间策略", "其他"].map((type) => <button type="button" key={type} className={`f-chip ${types.includes(type) ? "on" : ""}`} onClick={() => setTypes(types.includes(type) ? types.filter((item) => item !== type) : [...types, type])}>{type}</button>)}</div>
    {types.length > 1 && <div className="warn-note"><Icon name="alert" />同时修改多个变量会降低后续归因可信度。</div>}
    <label className="f-lab">新标题</label><input className="f-in" name="title" defaultValue={String(video.title)} required />
    {types.includes("封面") && <><label className="f-lab">新封面文件</label><input className="f-in" name="coverFile" type="file" accept="image/*" /></>}
    {types.includes("视频") && <><label className="f-lab">新视频文件</label><input className="f-in" name="videoFile" type="file" accept="video/*" /><label className="f-lab">视频时长（秒）</label><input className="f-in" name="durationSeconds" type="number" min="0.1" step="0.1" defaultValue={String(video.durationSeconds ?? "")} /></>}
    {types.includes("正文/话题") && <><label className="f-lab">正文</label><textarea className="f-ta" name="body" /><label className="f-lab">话题（逗号分隔）</label><input className="f-in" name="topics" /></>}
    <label className="f-lab">实际生效时间</label><input className="f-in" name="effectiveAt" type="datetime-local" defaultValue={effectiveAt} required />
    <label className="f-lab">具体修改说明</label><textarea className="f-ta" name="summary" placeholder="例如：封面主文案从三行压缩为一句话" required />
    <label className="f-lab">修改原因 / 假设</label><textarea className="f-ta" name="hypothesis" placeholder="例如：信息层级过多导致核心利益点不突出" />
    <label className="f-lab">希望改善的指标</label><select className="f-se" name="targetMetric"><option>封面点击率</option><option>曝光量</option><option>平均观看占比</option><option>总互动率</option></select>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={close}>取消</button><button className="btn btn-pri" disabled={busy}>{busy ? "保存中…" : "保存修改记录"}</button></div>
  </form></div>;
}

function ReviewModal({ detail, close, saved }: { detail: Record<string, unknown>; close: () => void; saved: () => Promise<void> }) {
  const video = detail.video as Record<string, unknown>;
  const diagnoses = detail.diagnoses as Array<Record<string, unknown>>;
  const diagnosis = diagnoses[0];
  const stage = STAGES[String(diagnosis?.primaryStage)]?.label ?? "暂无法定位";
  const recommendation = (diagnosis?.recommendation ?? {}) as Record<string, unknown>;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/videos/${video.id}/review`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "confirmed",
          systemSummary: form.get("systemSummary"),
          humanSummary: form.get("humanSummary"),
          experience: { title: form.get("experienceTitle"), scope: form.get("scope"), observation: form.get("observation"), action: form.get("action"), evidence: [{ videoId: video.id, nodeHours: diagnosis?.nodeHours, primaryStage: diagnosis?.primaryStage }] },
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "复盘保存失败");
      await saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(false); }
  };
  return <div className="mask on" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal" onSubmit={submit}>
    <div className="m-h"><h2>确认 72 小时复盘</h2><button type="button" className="ico-btn" onClick={close}>×</button></div>
    <p className="page-sub">系统结论与人工判断会同时保留，确认后生成低置信度经验草稿。</p>
    <label className="f-lab">系统结论</label><textarea className="f-ta" name="systemSummary" defaultValue={`当前主要问题：${stage}。${String(recommendation.action ?? "建议继续补齐数据并观察下一节点。")} `} required />
    <label className="f-lab">人工复盘结论</label><textarea className="f-ta" name="humanSummary" placeholder="哪里做对了、哪里需要调整？" />
    <label className="f-lab">经验标题</label><input className="f-in" name="experienceTitle" defaultValue={`${String(video.category ?? "同类内容")}的${stage}检查经验`} required />
    <label className="f-lab">适用范围</label><input className="f-in" name="scope" defaultValue={String(video.category ?? "同类视频")} required />
    <label className="f-lab">观察到的规律</label><textarea className="f-ta" name="observation" defaultValue={`${String(video.title)}在 ${String(diagnosis?.nodeHours ?? 72)} 小时节点的${stage}指标偏离账号自身基线；该结论目前只代表时间关联。`} required />
    <label className="f-lab">建议动作</label><textarea className="f-ta" name="action" defaultValue={String(recommendation.action ?? "下一篇保持其他变量不变，进行单变量验证。")} required />
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={close}>取消</button><button className="btn btn-pri" disabled={busy}>{busy ? "保存中…" : "确认并生成经验草稿"}</button></div>
  </form></div>;
}

function Empty({ title, description }: { title: string; description: string }) { return <div className="empty"><span><Icon name="activity" /></span><b>{title}</b><p>{description}</p></div>; }
function LoadingState() { return <div className="loading"><i/><span>正在读取数据…</span></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className="card error-state"><span><Icon name="alert"/></span><h2>暂时无法读取数据</h2><p>{message}</p><button className="btn btn-pri" onClick={onRetry}>重新加载</button></section>; }
