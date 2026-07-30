import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock, AlertTriangle, Flame,
  Download, ShieldCheck, Crown, Zap, Gauge, Building2, Activity, LineChart,
  Ban, RotateCcw, ArrowUpRight, Sparkles, Package, Boxes, UserPlus, Plus,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestRow } from "@/components/RequestRow";
import { RequestDetail } from "@/components/RequestDetail";
import { PeopleInsights } from "@/components/insights/PeopleInsights";
import { typeLabels, typeCategory, type RequestItem, type RequestStatus, type RequestType } from "@/components/models";
import { companies } from "@/components/company";
import { fmtINR, typeIcon } from "@/components/requestMeta";
import { useInventory, isLow, type InventoryItem } from "@/components/liveInventory";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { getRequests, request } from "@/lib/api";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — RequestHub · Vision India" },
      { name: "description", content: "Group-wide executive console — insights, advanced analytics, override center and anomaly signals for Vision India Group." },
    ],
  }),
  component: SuperAdmin,
});

const SA = { id: "SA-001", name: "Vikram Rathore", role: "Chief Operating Officer" };
const actorTag = () => `${SA.name} (${SA.id})`;
const autoNote = (verb: string, userNote: string) => {
  const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const head = `${verb} by ${actorTag()} · ${ts} IST · Super Admin override`;
  return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
};

// ---------- Synthetic 12-month history ----------
const MONTHS = ["Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul"];
const CATS: RequestType[] = ["travel","courier","stationery","visiting_card","id_card","meeting_room","fooding"];
const seeded = (i: number, j: number) => { const x = Math.sin(i*928.37 + j*17.13)*10000; return x - Math.floor(x); };
const baseSpend: Record<RequestType, number> = {
  travel: 90000, courier: 6000, stationery: 12000,
  visiting_card: 4000, id_card: 3000, meeting_room: 0, fooding: 15000,
};
const heat = MONTHS.map((_, mi) => CATS.map((c, ci) => {
  const base = baseSpend[c];
  const variance = 0.4 + seeded(mi + 3, ci + 7) * 1.5;
  const seasonal = c === "travel" && (mi === 3 || mi === 11) ? 1.8 : 1;
  return Math.round(base * variance * seasonal);
}));
const monthTotals = heat.map(row => row.reduce((a,b) => a+b, 0));
const catTotals = CATS.map((_, ci) => heat.reduce((a, row) => a + row[ci], 0));
const grandTotal = monthTotals.reduce((a,b) => a+b, 0);
const maxCell = Math.max(...heat.flat());
const thisMonth = monthTotals.at(-1)!;
const lastMonth = monthTotals.at(-2)!;
const monthDelta = ((thisMonth - lastMonth) / lastMonth) * 100;

// Simple linear forecast: next 3 months based on last-6-month slope
const last6 = monthTotals.slice(-6);
const avg6 = last6.reduce((a,b)=>a+b,0)/6;
const slope = (last6.at(-1)! - last6[0]) / 5;
const forecast = [1,2,3].map(i => Math.max(0, Math.round(avg6 + slope * (2.5 + i))));

const heatColor = (v: number) => {
  const t = v / maxCell;
  if (t < 0.15) return "bg-slate-50 text-slate-400";
  if (t < 0.3) return "bg-sky-50 text-sky-700";
  if (t < 0.5) return "bg-sky-100 text-sky-800";
  if (t < 0.7) return "bg-indigo-200 text-indigo-900";
  if (t < 0.85) return "bg-indigo-400 text-white";
  return "bg-indigo-600 text-white";
};

function buildHistory(requests: RequestItem[]) {
  const dates = Array.from({ length: 12 }, (_, offset) => new Date(new Date().getFullYear(), new Date().getMonth() - 11 + offset, 1));
  const labels = dates.map(date => date.toLocaleString('en-IN', { month: 'short' }));
  const values = dates.map(() => CATS.map(() => 0));
  requests.forEach(row => { const date = new Date(row.createdAt); const month = dates.findIndex(value => value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth()); const category = CATS.indexOf(row.type); if (month >= 0 && category >= 0 && row.status !== 'rejected') values[month][category] += row.amount ?? 0; });
  const totals = values.map(row => row.reduce((sum, value) => sum + value, 0)); const average = totals.slice(-6).reduce((sum, value) => sum + value, 0) / 6; const slope = (totals.at(-1)! - totals.at(-6)!) / 5;
  return { MONTHS: labels, heat: values, monthTotals: totals, grandTotal: totals.reduce((sum, value) => sum + value, 0), thisMonth: totals.at(-1) ?? 0, lastMonth: totals.at(-2) ?? 0, forecast: [1, 2, 3].map(step => Math.max(0, Math.round(average + slope * (2.5 + step)))), avg6: average };
}

type Tab = "overview" | "analytics" | "inventory" | "override" | "anomalies" | "team";

function SuperAdmin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const refresh = useCallback(async () => { try { setRequests(await getRequests('/api/requests')); } catch (error) { console.error(error); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const history = useMemo(() => buildHistory(requests), [requests]);

  const kpis = useMemo(() => {
    const approved = requests.filter(r => r.status === "approved").length;
    const rejected = requests.filter(r => r.status === "rejected").length;
    const closed = requests.filter(r => r.status === "approved" || r.status === "rejected");
    const avgTat = closed.length ? Math.round(
      closed.reduce((a, r) => a + (+new Date(r.updatedAt) - +new Date(r.createdAt))/3_600_000, 0) / closed.length
    ) : 0;
    const rate = approved + rejected > 0 ? Math.round((approved/(approved+rejected))*100) : 0;
    return { approved, rejected, avgTat, rate, total: requests.length };
  }, [requests]);

  const overrideList = useMemo(() => requests
    .filter(r => companyFilter === "all" || r.company === companyFilter)
    .filter(r => statusFilter === "all" || r.status === statusFilter)
    .sort((a,b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [requests, companyFilter, statusFilter]);
  const selected = requests.find(r => r.id === selectedId) ?? overrideList[0];

  const override = useCallback(async (id: string, next: RequestStatus, verb: string, note: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      const at = new Date().toISOString();
      const action = next === "approved" ? "approved" : next === "rejected" ? "rejected" : next === "queued" ? "queued" : "commented";
      return {
        ...r, status: next, updatedAt: at,
        audit: [...r.audit, { at, actor: actorTag(), action, note: autoNote(verb, note) }],
      };
    }));
    const target = requests.find(r => r.id === id);
    if (target?.dbId) { await request(`/api/super-admin/requests/${target.dbId}/override`, { method: 'POST', body: { next_status: next, note } }); await refresh(); }
  }, [refresh, requests]);

  const onDetailAction = useCallback((id: string, action: string, note: string) => {
    if (action === "approve") void override(id, "approved", "Force-approved", note);
    else if (action === "reject") void override(id, "rejected", "Force-rejected", note);
    else if (action === "queue") void override(id, "queued", "Held for review", note);
    else if (action === "verify") void override(id, "approved", "Force-closed", note);
    else if (action === "send_back") void override(id, "pending", "Sent back to Admin", note);
  }, [override]);

  const tabs: { id: Tab; label: string; icon: typeof Gauge }[] = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "analytics", label: "Advance Analytics", icon: LineChart },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "override", label: "Override Center", icon: ShieldCheck },
    { id: "anomalies", label: "Anomalies & Signals", icon: AlertTriangle },
    { id: "team", label: "Team & Roles", icon: UserPlus },
  ];

  return (
    <DashboardLayout workspace="Executive Console" role="Super Admin · Group COO" currentUser={`${SA.name} · ${SA.id}`}>
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Vision India Group · Executive</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" /> Super Admin Console
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded border border-indigo-100 bg-indigo-50 text-indigo-700">
                <ShieldCheck className="w-3 h-3" /> Signed in as {SA.name}
                <span className="font-mono text-indigo-600/80">· {SA.id}</span>
              </span>
              <span className="text-[11px] text-slate-500">Full override authority · every action signed.</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip icon={Wallet} label="Group spend YTD" value={fmtINR(grandTotal)} />
            <StatChip icon={monthDelta >= 0 ? TrendingUp : TrendingDown} label="This month"
              value={fmtINR(thisMonth)} sub={`${monthDelta>=0?"▲":"▼"} ${Math.abs(monthDelta).toFixed(1)}%`}
              tone={monthDelta >= 0 ? "rose" : "emerald"} />
            <StatChip icon={CheckCircle2} label="Approval rate" value={`${kpis.rate}%`} sub={`${kpis.approved}/${kpis.total}`} />
            <StatChip icon={Clock} label="Avg TAT" value={`${kpis.avgTat}h`} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 mt-5 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}>
              <t.icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-50">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-10">
        {tab === "overview" && <OverviewTab requests={requests} history={history} />}
        {tab === "analytics" && <AnalyticsTab requests={requests} />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "override" && (
          <OverrideTab
            list={overrideList} selected={selected}
            companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            onSelect={setSelectedId} onAction={onDetailAction}
          />
        )}
        {tab === "anomalies" && <AnomaliesTab requests={requests} />}
        {tab === "team" && <TeamTab />}
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// OVERVIEW — heatmap + depts + category mix + people insights
// ============================================================================
function OverviewTab({ requests, history }: { requests: RequestItem[]; history: ReturnType<typeof buildHistory> }) {
  const { MONTHS, heat, monthTotals } = history;
  const maxCell = Math.max(...heat.flat(), 1);
  const heatColor = (value: number) => value / maxCell < .15 ? 'bg-slate-50 text-slate-400' : value / maxCell < .3 ? 'bg-sky-50 text-sky-700' : value / maxCell < .5 ? 'bg-sky-100 text-sky-800' : value / maxCell < .7 ? 'bg-indigo-200 text-indigo-900' : value / maxCell < .85 ? 'bg-indigo-400 text-white' : 'bg-indigo-600 text-white';
  const companySpend = useMemo(() => requests.reduce<Record<string, { spend: number; count: number }>>((result, row) => {
    if (row.status !== 'rejected') { const value = result[row.company] ?? { spend: 0, count: 0 }; value.spend += row.amount ?? 0; value.count++; result[row.company] = value; } return result;
  }, {}), [requests]);
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Company spend across Vision India entities */}
      <div className="bg-white rounded-lg border border-slate-200/70 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" /> Group spend by sub-entity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Approved + pending outflow YTD across Vision India Group</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {companies.map(c => {
            const s = companySpend[c.code] ?? { spend: 0, count: 0 };
            const max = Math.max(...Object.values(companySpend).map(x => x.spend), 1);
            const pct = (s.spend / max) * 100;
            return (
              <div key={c.code} className="border border-slate-200/70 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">{c.code}</span>
                  <span className="text-[10px] text-slate-400">{c.teams.length} teams</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate mt-1">{c.name}</p>
                <p className="font-display text-lg font-semibold text-slate-900 mt-1 tabular-nums">{fmtINR(s.spend)}</p>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-lg border border-slate-200/70 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-slate-900">Spend heatmap</h2>
            <p className="text-xs text-slate-500 mt-0.5">12 months × 8 categories · darker = higher outflow</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-20"></th>
                {CATS.map(c => {
                  const Icon = typeIcon[c];
                  return (
                    <th key={c} className="text-[10px] font-medium text-slate-500 pb-1">
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span className="truncate max-w-[70px]">{typeLabels[c].split(" ")[0]}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="text-[10px] font-semibold text-slate-600 pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, mi) => (
                <tr key={m}>
                  <td className="text-[11px] font-medium text-slate-600 pr-2 text-right tabular-nums">{m}</td>
                  {heat[mi].map((v, ci) => (
                    <td key={ci}
                      className={`h-8 rounded-sm text-center text-[10px] font-mono tabular-nums ${heatColor(v)}`}
                      title={`${typeLabels[CATS[ci]]} · ${m} · ${fmtINR(v)}`}>
                      {v > maxCell * 0.5 ? `${Math.round(v/1000)}k` : ""}
                    </td>
                  ))}
                  <td className="text-[11px] font-semibold text-slate-800 pl-2 tabular-nums text-right">{fmtINR(monthTotals[mi])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category mix */}
      <div className="bg-white rounded-lg border border-slate-200/70 p-5">
        <h2 className="font-display font-semibold text-slate-900 mb-4">Category mix</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {CATS.map((c, ci) => {
            const v = catTotals[ci];
            const pct = (v / grandTotal) * 100;
            const Icon = typeIcon[c];
            const color: Record<string, string> = {
              finance: "bg-rose-500", logistics: "bg-indigo-500",
              supplies: "bg-amber-500", identity: "bg-sky-500", facility: "bg-emerald-500",
            };
            return (
              <div key={c} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
                <span className="text-xs text-slate-700 w-28 truncate">{typeLabels[c]}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color[typeCategory[c]]}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-mono tabular-nums text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <PeopleInsights requests={requests} />
    </div>
  );
}

// ============================================================================
// ADVANCE ANALYTICS — forecast, MoM trend, TAT, funnel
// ============================================================================
function AnalyticsTab({ requests }: { requests: RequestItem[] }) {
  const trend = [...monthTotals, ...forecast];
  const trendMax = Math.max(...trend);
  const forecastStart = monthTotals.length;

  // TAT by category (hours, closed only)
  const tatByCat = CATS.map(c => {
    const closed = requests.filter(r => r.type === c && (r.status === "approved" || r.status === "rejected"));
    if (!closed.length) return { c, h: 0 };
    const h = closed.reduce((a,r) => a + (+new Date(r.updatedAt)-+new Date(r.createdAt))/3_600_000, 0) / closed.length;
    return { c, h: Math.round(h) };
  }).filter(x => x.h > 0);
  const maxTat = Math.max(...tatByCat.map(x => x.h), 1);

  // Status funnel
  const funnel = [
    { s: "Created", n: requests.length, tone: "bg-slate-500" },
    { s: "Pending admin", n: requests.filter(r => r.status === "pending" || r.status === "info_requested").length, tone: "bg-amber-500" },
    { s: "Awaiting verification", n: requests.filter(r => r.status === "awaiting_verification").length, tone: "bg-violet-500" },
    { s: "Approved & closed", n: requests.filter(r => r.status === "approved").length, tone: "bg-emerald-500" },
    { s: "Rejected", n: requests.filter(r => r.status === "rejected").length, tone: "bg-rose-500" },
  ];
  const funnelMax = funnel[0].n;

  const projected3M = forecast.reduce((a,b) => a+b, 0);
  const projDelta = ((projected3M/3 - avg6) / avg6) * 100;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Forecast card */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <p className="text-[10px] uppercase tracking-widest text-slate-300">3-month spend forecast</p>
            </div>
            <p className="font-display text-3xl font-semibold mt-2 tabular-nums">{fmtINR(projected3M)}</p>
            <p className={`text-xs mt-1 ${projDelta >= 0 ? "text-amber-300" : "text-emerald-300"}`}>
              {projDelta >= 0 ? "▲" : "▼"} {Math.abs(projDelta).toFixed(1)}% vs 6-month avg
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-300">
            <p>Model · linear trend on last 6 months</p>
            <p className="mt-1">Confidence · <span className="text-white">medium</span></p>
          </div>
        </div>

        {/* Sparkline / bar trend */}
        <div className="mt-4">
          <div className="flex items-end gap-1 h-32">
            {trend.map((v, i) => {
              const h = (v / trendMax) * 100;
              const isForecast = i >= forecastStart;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                    <div
                      className={`w-full rounded-t transition-all ${isForecast ? "bg-amber-400/70 border-t border-x border-amber-300 border-dashed" : "bg-white/80"}`}
                      style={{ height: `${h}%` }}
                      title={`${fmtINR(v)}${isForecast ? " (projected)" : ""}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-1.5 text-[9px] text-slate-400 font-mono">
            {[...MONTHS, "+1M","+2M","+3M"].map((m, i) => (
              <span key={i} className={`flex-1 text-center ${i >= forecastStart ? "text-amber-300" : ""}`}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TAT by category */}
        <div className="bg-white rounded-lg border border-slate-200/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Turnaround by category
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Avg hours from create → decision</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {tatByCat.map(({ c, h }) => {
              const Icon = typeIcon[c];
              const pct = (h / maxTat) * 100;
              const slow = h > 100;
              return (
                <div key={c} className="grid grid-cols-[130px_1fr_60px] items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
                    <span className="text-xs text-slate-700 truncate">{typeLabels[c]}</span>
                  </div>
                  <div className="h-5 bg-slate-50 rounded overflow-hidden">
                    <div className={`h-full ${slow ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-700 text-right">{h}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status funnel */}
        <div className="bg-white rounded-lg border border-slate-200/70 p-5">
          <div className="mb-4">
            <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Request funnel
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Where volume sits right now</p>
          </div>
          <div className="space-y-2">
            {funnel.map(f => {
              const pct = funnelMax > 0 ? (f.n / funnelMax) * 100 : 0;
              return (
                <div key={f.s} className="grid grid-cols-[140px_1fr_40px] items-center gap-3">
                  <span className="text-xs text-slate-700 truncate">{f.s}</span>
                  <div className="h-6 bg-slate-50 rounded overflow-hidden relative">
                    <div className={`h-full ${f.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold font-mono tabular-nums text-slate-800 text-right">{f.n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category velocity — is each category accelerating? */}
      <div className="bg-white rounded-lg border border-slate-200/70 p-5">
        <div className="mb-4">
          <h2 className="font-display font-semibold text-slate-900 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-slate-500" /> Category momentum
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Last 3 months vs previous 3 months</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATS.map((c, ci) => {
            const recent = heat.slice(-3).reduce((a, row) => a + row[ci], 0);
            const prior = heat.slice(-6, -3).reduce((a, row) => a + row[ci], 0);
            const delta = prior > 0 ? ((recent - prior) / prior) * 100 : 0;
            const up = delta >= 0;
            const Icon = typeIcon[c];
            return (
              <div key={c} className="border border-slate-200/70 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
                  <span className="text-xs font-medium text-slate-700 truncate">{typeLabels[c]}</span>
                </div>
                <p className="font-display text-lg font-semibold text-slate-900 mt-1 tabular-nums">{fmtINR(recent)}</p>
                <p className={`text-[11px] tabular-nums mt-0.5 ${up ? "text-rose-600" : "text-emerald-600"}`}>
                  {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs prior 3M
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OVERRIDE CENTER — force any status change
// ============================================================================
function OverrideTab({
  list, selected, companyFilter, setCompanyFilter,
  statusFilter, setStatusFilter, onSelect, onAction,
}: {
  list: RequestItem[]; selected: RequestItem | undefined;
  companyFilter: string; setCompanyFilter: (v: string) => void;
  statusFilter: RequestStatus | "all"; setStatusFilter: (v: RequestStatus | "all") => void;
  onSelect: (id: string) => void;
  onAction: (id: string, action: "approve"|"reject"|"queue"|"info"|"verify"|"send_back", note: string) => void;
}) {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-md flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900">
          <b>Override authority.</b> You can force any request into any state — force-approve, force-reject, close, or send back to Admin. Every action is signed as <span className="font-mono">SA-001</span> and appears in the audit trail.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 h-[calc(100vh-20rem)] min-h-[560px]">
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">All companies</option>
              {companies.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as RequestStatus | "all")}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">Any status</option>
              <option value="pending">Pending</option>
              <option value="queued">Queued</option>
              <option value="awaiting_verification">Awaiting verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="info_requested">Info requested</option>
            </select>
            <span className="text-[11px] text-slate-400 tabular-nums ml-auto">{list.length} requests</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {list.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">No requests match.</div>
            ) : list.map(r => (
              <RequestRow key={r.id} request={r} selected={selected?.id === r.id}
                checked={false} onToggleCheck={() => {}} onSelect={onSelect} />
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-[11px] text-amber-900">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span><b>Super Admin override</b> — you can act on this request regardless of its current stage.</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <RequestDetail request={selected} onAction={onAction} />
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 bg-slate-50">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 mr-1">Quick override:</span>
                <button onClick={() => onAction(selected.id, "approve", "")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  <CheckCircle2 className="w-3 h-3" /> Force approve
                </button>
                <button onClick={() => onAction(selected.id, "reject", "Overridden by Super Admin")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-rose-600 text-white rounded hover:bg-rose-700">
                  <Ban className="w-3 h-3" /> Force reject
                </button>
                <button onClick={() => onAction(selected.id, "send_back", "Returned to Admin queue")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100">
                  <RotateCcw className="w-3 h-3" /> Send back to Admin
                </button>
              </div>
            </>
          ) : (
            <div className="h-full grid place-items-center text-sm text-slate-400">Select a request to override.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ANOMALIES
// ============================================================================
function AnomaliesTab({ requests }: { requests: RequestItem[] }) {
  const travelDelta = Math.round(((heat[11][0] - heat[10][0]) / heat[10][0]) * 100);
  const foodPeak = heat[4][6];
  const rejectionsByEmp = requests.reduce<Record<string, number>>((acc, r) => {
    if (r.status === "rejected") acc[r.employeeName] = (acc[r.employeeName] ?? 0) + 1;
    return acc;
  }, {});
  const highRejector = Object.entries(rejectionsByEmp).sort((a,b) => b[1]-a[1])[0];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnomalyCard tone="rose" icon={AlertTriangle} title="Travel spike"
          body={`July travel outflow is ${Math.abs(travelDelta)}% ${travelDelta>=0?"higher":"lower"} than June. Q3 offsites likely driver.`}
          action="Investigate top travelers" />
        <AnomalyCard tone="amber" icon={Flame} title="Catering spend peak"
          body={`Food & catering peaked at ${fmtINR(foodPeak)} in Dec — festive events cycle. Plan Q4 budget accordingly.`}
          action="Review Q4 capex plan" />
        <AnomalyCard tone="rose" icon={Ban} title="Rejection outlier"
          body={highRejector ? `${highRejector[0]} has ${highRejector[1]} rejected requests — highest in group. Review approval clarity.` : "No employee has crossed the rejection threshold."}
          action="Open employee passport" />
        <AnomalyCard tone="emerald" icon={TrendingDown} title="Stationery declining"
          body="Stationery ordering down 32% YoY — hybrid work reducing consumption. Consider vendor renegotiation."
          action="Renegotiate contract" />
        <AnomalyCard tone="indigo" icon={Clock} title="TAT breach"
          body="Travel requests averaging >120h to close — SLA is 72h. Bottleneck at Verifier stage."
          action="Escalate to Verifier" />
        <AnomalyCard tone="amber" icon={Sparkles} title="Concentration risk"
          body="Top 3 employees drive 41% of approved outflow YTD. Review authorization limits."
          action="Set per-user caps" />
      </div>
    </div>
  );
}

function AnomalyCard({ tone, icon: Icon, title, body, action }: {
  tone: "rose"|"amber"|"emerald"|"indigo"; icon: typeof AlertTriangle;
  title: string; body: string; action: string;
}) {
  const tones = {
    rose: "border-rose-100 bg-rose-50/50 text-rose-700",
    amber: "border-amber-100 bg-amber-50/50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-700",
    indigo: "border-indigo-100 bg-indigo-50/50 text-indigo-700",
  };
  return (
    <div className={`border rounded-md p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <p className="text-xs text-slate-800 mt-2 leading-relaxed">{body}</p>
      <button className="text-[11px] font-medium mt-3 hover:underline">{action} →</button>
    </div>
  );
}

// ---------- small UI bits ----------
function StatChip({ icon: Icon, label, value, sub, tone = "slate" }: {
  icon: typeof Wallet; label: string; value: string; sub?: string;
  tone?: "slate"|"emerald"|"rose";
}) {
  const subTone = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-slate-500";
  return (
    <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-md min-w-[130px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
        <Icon className="w-3 h-3 text-slate-400" />
      </div>
      <p className="font-display text-base font-semibold text-slate-900 mt-1 tabular-nums">{value}</p>
      {sub && <p className={`text-[10px] tabular-nums ${subTone}`}>{sub}</p>}
    </div>
  );
}

// ============================================================================
// INVENTORY TAB — read-only, executive view of group stationery stock
// ============================================================================
function InventoryTab() {
  const items = useInventory();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<InventoryItem["category"] | "all">("all");
  const [historySku, setHistorySku] = useState<string | undefined>(undefined);


  const stats = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.qty * i.price, 0);
    const totalUnits = items.reduce((s, i) => s + i.qty, 0);
    const low = items.filter(isLow);
    const out = items.filter((i) => i.qty === 0);
    return { totalValue, totalUnits, low, out, skus: items.length };
  }, [items]);

  const byCat = useMemo(() => {
    const m = new Map<string, { qty: number; value: number; count: number }>();
    items.forEach((i) => {
      const c = m.get(i.category) ?? { qty: 0, value: 0, count: 0 };
      c.qty += i.qty; c.value += i.qty * i.price; c.count += 1;
      m.set(i.category, c);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [items]);
  const maxCatValue = Math.max(1, ...byCat.map(([, v]) => v.value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => cat === "all" || i.category === cat)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.qty / a.threshold - b.qty / b.threshold);
  }, [items, query, cat]);

  const cats: InventoryItem["category"][] = ["Writing", "Paper", "Printing", "Filing", "Desk", "Misc"];

  return (
    <div className="space-y-5 mt-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Boxes} label="Total SKUs" value={String(stats.skus)} tone="slate" />
        <KpiCard icon={Package} label="Units on-hand" value={stats.totalUnits.toLocaleString("en-IN")} tone="slate" />
        <KpiCard icon={Wallet} label="Inventory value" value={fmtINR(stats.totalValue)} tone="indigo" />
        <KpiCard icon={AlertTriangle} label="Low-stock items" value={String(stats.low.length)} tone={stats.low.length ? "amber" : "slate"} />
        <KpiCard icon={Ban} label="Out of stock" value={String(stats.out.length)} tone={stats.out.length ? "rose" : "slate"} />
      </div>

      {/* Category mix + low-stock panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Boxes className="w-4 h-4 text-slate-500" /> Stock value by category</p>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Group-wide</span>
          </div>
          <div className="space-y-2.5">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-700 font-medium">{c} <span className="text-slate-400">· {v.count} SKUs · {v.qty} units</span></span>
                  <span className="font-mono tabular-nums text-slate-800">{fmtINR(v.value)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${(v.value / maxCatValue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Reorder watchlist</p>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{stats.low.length}</span>
          </div>
          {stats.low.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">All items above threshold.</p>
          ) : (
            <ul className="space-y-2">
              {stats.low.slice(0, 8).map((i) => (
                <li key={i.sku} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{i.name}</p>
                    <p className="font-mono text-[10px] text-slate-400">{i.sku} · {i.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-semibold tabular-nums ${i.qty === 0 ? "text-rose-700" : "text-amber-700"}`}>{i.qty}<span className="text-slate-400 font-normal"> / {i.threshold}</span></p>
                    <p className="text-[10px] text-slate-400">{i.unit}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Full stock table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Package className="w-4 h-4 text-slate-500" /> Stock register</p>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Read-only · executive view</span>
          <div className="ml-auto flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item or SKU…"
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <select value={cat} onChange={(e) => setCat(e.target.value as InventoryItem["category"] | "all")}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium">SKU</th>
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-left px-4 py-2 font-medium">Unit</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">On-hand</th>
                <th className="text-right px-4 py-2 font-medium">Threshold</th>
                <th className="text-right px-4 py-2 font-medium">Value</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((i) => {
                const low = isLow(i);
                const outOf = i.qty === 0;
                return (
                  <tr key={i.sku} onClick={() => setHistorySku(i.sku)}
                    className={`cursor-pointer ${historySku === i.sku ? "bg-indigo-50/60 outline outline-1 outline-indigo-200" : outOf ? "bg-rose-50/60" : low ? "bg-amber-50/40" : "hover:bg-slate-50/50"}`}>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{i.sku}</td>

                    <td className="px-4 py-2 text-slate-800 font-medium">{i.name}</td>
                    <td className="px-4 py-2 text-slate-500">{i.category}</td>
                    <td className="px-4 py-2 text-slate-500">{i.unit}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtINR(i.price)}</td>
                    <td className={`px-4 py-2 text-right font-mono tabular-nums font-semibold ${outOf ? "text-rose-700" : low ? "text-amber-700" : "text-slate-800"}`}>{i.qty}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-500">{i.threshold}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtINR(i.qty * i.price)}</td>
                    <td className="px-4 py-2">
                      {outOf ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-100 text-rose-700 border border-rose-200">Out of stock</span>
                      ) : low ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200"><AlertTriangle className="w-3 h-3" /> Low</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> Healthy</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-sm text-slate-400">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement history */}
      <div className="space-y-2">
        {historySku && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Filtered to</span>
            <span className="font-mono font-semibold text-slate-800">{historySku}</span>
            <button onClick={() => setHistorySku(undefined)} className="text-indigo-600 hover:underline">clear</button>
            <span className="text-slate-400">· click any stock row above to focus its history</span>
          </div>
        )}
        <StockMovementHistory key={historySku ?? "all"} initialSku={historySku} />
      </div>
    </div>
  );
}


function KpiCard({ icon: Icon, label, value, tone }: {
  icon: typeof Wallet; label: string; value: string; tone: "slate" | "indigo" | "amber" | "rose";
}) {
  const tones = {
    slate:  { bg: "bg-white",     ring: "border-slate-200",  ic: "text-slate-400",  val: "text-slate-900" },
    indigo: { bg: "bg-indigo-50/60", ring: "border-indigo-100", ic: "text-indigo-500", val: "text-indigo-900" },
    amber:  { bg: "bg-amber-50/70", ring: "border-amber-100",  ic: "text-amber-600",  val: "text-amber-900" },
    rose:   { bg: "bg-rose-50/70",  ring: "border-rose-100",   ic: "text-rose-600",   val: "text-rose-900" },
  }[tone];
  return (
    <div className={`px-3.5 py-3 border rounded-lg ${tones.bg} ${tones.ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${tones.ic}`} />
      </div>
      <p className={`font-display text-xl font-semibold mt-1 tabular-nums ${tones.val}`}>{value}</p>
    </div>
  );
}

function TeamTab() {
  const [users, setUsers] = useState<Array<{ id: number; email: string; name: string; role: string; company: string; dept: string; is_active: boolean; created_at: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; company: string }>>([]);
  const [loading, setLoading] = useState(true);

  // User form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'employee' | 'admin' | 'finance' | 'verifier' | 'super_admin'>('finance');
  const [company, setCompany] = useState('VT');
  const [dept, setDept] = useState('Engineering');
  const [password, setPassword] = useState('pass123');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Dynamic Team Creation state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCompany, setNewTeamCompany] = useState('VT');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');

  const fetchUsersAndTeams = useCallback(async () => {
    try {
      setLoading(true);
      const [uData, tData] = await Promise.all([
        request<Array<{ id: number; email: string; name: string; role: string; company: string; dept: string; is_active: boolean; created_at: string }>>('/api/super-admin/users'),
        request<Array<{ id: number; name: string; company: string }>>('/api/teams'),
      ]);
      setUsers(uData);
      setTeams(tData);
      if (tData.length > 0 && !tData.some(t => t.name === dept)) {
        setDept(tData[0].name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsersAndTeams(); }, [fetchUsersAndTeams]);

  // Create Team handler
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setTeamError('Please enter team name'); return;
    }
    setTeamError(''); setTeamSuccess(''); setCreatingTeam(true);
    try {
      const res = await request<{ name: string; company: string }>('/api/teams/create', {
        method: 'POST',
        body: { name: newTeamName.trim(), company: newTeamCompany },
      });
      setTeamSuccess(`Team "${res.name}" created for ${res.company} & saved to SQL Server!`);
      setDept(res.name);
      setNewTeamName('');
      await fetchUsersAndTeams();
    } catch (cause) {
      setTeamError(cause instanceof Error ? cause.message : 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  // Create User handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setUserError('Please fill in Name, Email, and Password.'); return;
    }
    setUserError(''); setUserSuccess(''); setCreatingUser(true);
    try {
      const newUser = await request<{ name: string; email: string }>('/api/super-admin/users', {
        method: 'POST',
        body: { name, email, role, company, dept, password },
      });
      setUserSuccess(`User ${newUser.name} (${newUser.email}) created & saved to SQL Server!`);
      setName(''); setEmail(''); setPassword('pass123');
      await fetchUsersAndTeams();
    } catch (cause) {
      setUserError(cause instanceof Error ? cause.message : 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const roleBadges: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
    admin: 'bg-slate-100 text-slate-800 border-slate-200',
    finance: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    verifier: 'bg-violet-100 text-violet-800 border-violet-200',
    employee: 'bg-sky-100 text-sky-800 border-sky-200',
  };

  return (
    <div className="space-y-6 pt-2">
      {/* 1. DYNAMIC TEAM CREATION SECTION */}
      <div className="bg-gradient-to-r from-indigo-900/5 via-purple-900/5 to-transparent border border-indigo-200/60 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-display font-semibold text-slate-900 text-base">Create New Team / Department</h2>
            <p className="text-xs text-slate-500">Add custom team names (e.g. Product, QA, Legal, Mobile App) to SQL Server `teams` table</p>
          </div>
        </div>

        <form onSubmit={handleCreateTeam} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">New Team Name</label>
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g. Product, QA, Legal"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              required
            />
          </div>

          <div className="w-40">
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Assigned Company</label>
            <select
              value={newTeamCompany}
              onChange={(e) => setNewTeamCompany(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              <option value="VT">VT — Vision Tech</option>
              <option value="VR">VR — Vision Retail</option>
              <option value="VM">VM — Vision Media</option>
              <option value="VL">VL — Vision Logistics</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={creatingTeam}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {creatingTeam ? 'Creating...' : 'Create Team'}
          </button>
        </form>

        {teamError && <div className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg">{teamError}</div>}
        {teamSuccess && <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg font-medium">{teamSuccess}</div>}
      </div>

      {/* 2. CREATE TEAM MEMBER / ROLE ACCOUNT FORM */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-display font-semibold text-slate-900 text-base">Create User / Team Member Account</h2>
            <p className="text-xs text-slate-500">Select team from dynamic dropdown or enter custom details. Saves directly to SQL Server database</p>
          </div>
        </div>

        <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anjali Mehta" className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" required />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Work Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. finance2@company.com" className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" required />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Assigned Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white">
              <option value="employee">Employee (Requestor)</option>
              <option value="admin">Admin (Stage-1 Gatekeeper)</option>
              <option value="finance">Finance (Fund Release / Treasury)</option>
              <option value="verifier">Verifier (Stage-2 Claim Verification)</option>
              <option value="super_admin">Super Admin (Executive Overseer)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Sub-Company</label>
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white">
              <option value="VT">VT — Vision Tech</option>
              <option value="VR">VR — Vision Retail</option>
              <option value="VM">VM — Vision Media</option>
              <option value="VL">VL — Vision Logistics</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Select Team / Department</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium">
              {teams.map((t) => (
                <option key={t.id} value={t.name}>{t.name} ({t.company})</option>
              ))}
              <option value="Other">Custom / Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Initial Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" required />
          </div>

          {userError && <div className="sm:col-span-2 lg:col-span-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">{userError}</div>}
          {userSuccess && <div className="sm:col-span-2 lg:col-span-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg font-medium">{userSuccess}</div>}

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button type="submit" disabled={creatingUser} className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50">
              <UserPlus className="w-4 h-4" /> {creatingUser ? 'Saving to Database...' : 'Save & Create Account'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. USERS ROSTER TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-display text-xs font-semibold text-slate-800 uppercase tracking-wider">Group Team Roster ({users.length} Total Users in SQL Server)</h3>
          <span className="text-[10px] text-slate-500 font-mono">Live DB table `users`</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading user roster from database...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5">Team / Dept</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">#{u.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded border capitalize ${roleBadges[u.role] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">{u.company}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{u.dept || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        ● Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
