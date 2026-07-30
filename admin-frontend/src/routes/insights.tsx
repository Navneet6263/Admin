import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock, AlertTriangle,
  Flame, Download,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { typeLabels, typeCategory, type RequestItem, type RequestType } from "@/components/models";
import { typeIcon, fmtINR } from "@/components/requestMeta";
import { PeopleInsights } from "@/components/insights/PeopleInsights";
import { getRequests } from "@/lib/api";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — RequestHub" },
      { name: "description", content: "Executive analytics for spend, categories, departments and approval velocity." },
    ],
  }),
  component: Insights,
});

// ---------- Synthetic 12-month history (deterministic) ----------
const MONTHS = ["Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul"];
const CATS: RequestType[] = ["travel","courier","stationery","visiting_card","id_card","meeting_room","fooding"];

// pseudo-random but stable
const seeded = (i: number, j: number) => {
  const x = Math.sin(i * 928.37 + j * 17.13) * 10000;
  return x - Math.floor(x);
};

const baseSpend: Record<RequestType, number> = {
  travel: 90000,
  courier: 6000, stationery: 12000, visiting_card: 4000, id_card: 3000, meeting_room: 0, fooding: 15000,
};

// heatmap: month x category = ₹
const heat: number[][] = MONTHS.map((_, mi) =>
  CATS.map((c, ci) => {
    const base = baseSpend[c];
    const variance = 0.4 + seeded(mi + 3, ci + 7) * 1.5; // 0.4x - 1.9x
    const seasonal = c === "travel" && (mi === 3 || mi === 11) ? 1.8 : 1; // Nov & Jul spike
      return Math.round(base * variance * seasonal);
  })
);

const monthTotals = heat.map(row => row.reduce((a, b) => a + b, 0));
const catTotals = CATS.map((_, ci) => heat.reduce((a, row) => a + row[ci], 0));
const grandTotal = monthTotals.reduce((a, b) => a + b, 0);
const maxCell = Math.max(...heat.flat());

const thisMonth = monthTotals[monthTotals.length - 1];
const lastMonth = monthTotals[monthTotals.length - 2];
const monthDelta = ((thisMonth - lastMonth) / lastMonth) * 100;

const heatColor = (v: number) => {
  const t = v / maxCell;
  if (t < 0.15) return "bg-slate-50 text-slate-400";
  if (t < 0.3) return "bg-sky-50 text-sky-700";
  if (t < 0.5) return "bg-sky-100 text-sky-800";
  if (t < 0.7) return "bg-indigo-200 text-indigo-900";
  if (t < 0.85) return "bg-indigo-400 text-white";
  return "bg-indigo-600 text-white";
};

function Insights() {
  const [hover, setHover] = useState<{ m: number; c: number } | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const refresh = useCallback(async () => { try { setRequests(await getRequests('/api/requests')); } catch (error) { console.error(error); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const live = useMemo(() => {
    const dates = Array.from({ length: 12 }, (_, offset) => new Date(new Date().getFullYear(), new Date().getMonth() - 11 + offset, 1));
    const labels = dates.map(date => date.toLocaleString('en-IN', { month: 'short' }));
    const matrix = dates.map(() => CATS.map(() => 0));
    requests.forEach(row => { const date = new Date(row.createdAt); const index = dates.findIndex(month => month.getFullYear() === date.getFullYear() && month.getMonth() === date.getMonth()); const column = CATS.indexOf(row.type); if (index >= 0 && column >= 0 && row.status !== 'rejected') matrix[index][column] += row.amount ?? 0; });
    const totals = matrix.map(row => row.reduce((sum, value) => sum + value, 0)); const categories = CATS.map((_, index) => matrix.reduce((sum, row) => sum + row[index], 0));
    return { MONTHS: labels, heat: matrix, monthTotals: totals, catTotals: categories, grandTotal: totals.reduce((sum, value) => sum + value, 0), maxCell: Math.max(...matrix.flat(), 1), thisMonth: totals.at(-1) ?? 0, lastMonth: totals.at(-2) ?? 0 };
  }, [requests]);
  const { MONTHS, heat, monthTotals, catTotals, grandTotal, maxCell, thisMonth, lastMonth } = live;
  const monthDelta = lastMonth ? (thisMonth - lastMonth) / lastMonth * 100 : 0;
  const heatColor = (value: number) => value / maxCell < .15 ? 'bg-slate-50 text-slate-400' : value / maxCell < .3 ? 'bg-sky-50 text-sky-700' : value / maxCell < .5 ? 'bg-sky-100 text-sky-800' : value / maxCell < .7 ? 'bg-indigo-200 text-indigo-900' : value / maxCell < .85 ? 'bg-indigo-400 text-white' : 'bg-indigo-600 text-white';
  const { depts, maxDept, approved, total, approvalRate, avgTat } = useMemo(() => {
    const spend = requests.reduce<Record<string, number>>((result, row) => { if (row.amount && row.status !== 'rejected') result[row.employeeDept] = (result[row.employeeDept] ?? 0) + row.amount; return result; }, {});
    const departments = Object.entries(spend).sort((a, b) => b[1] - a[1]);
    const closed = requests.filter(row => row.status === 'approved' || row.status === 'rejected');
    const ok = requests.filter(row => row.status === 'approved').length;
    return { depts: departments, maxDept: departments[0]?.[1] ?? 1, approved: ok, total: requests.length, approvalRate: closed.length ? Math.round(ok / closed.length * 100) : 0, avgTat: closed.length ? Math.round(closed.reduce((sum, row) => sum + (new Date(row.updatedAt).getTime() - new Date(row.createdAt).getTime()) / 3_600_000, 0) / closed.length) : 0 };
  }, [requests]);

  const kpis = useMemo(() => [
    { label: "Spend · YTD", value: fmtINR(grandTotal), icon: Wallet, tone: "text-slate-900" },
    { label: "This month", value: fmtINR(thisMonth), delta: monthDelta, icon: monthDelta >= 0 ? TrendingUp : TrendingDown },
    { label: "Approval rate", value: `${approvalRate}%`, sub: `${approved}/${total} closed`, icon: CheckCircle2 },
    { label: "Avg turnaround", value: `${avgTat}h`, sub: "created → decided", icon: Clock },
  ], [approved, approvalRate, avgTat, total]);

  const peakCell = useMemo(() => {
    let best = { v: 0, m: 0, c: 0 };
    heat.forEach((row, mi) => row.forEach((v, ci) => { if (v > best.v) best = { v, m: mi, c: ci }; }));
    return best;
  }, []);

  return (
    <DashboardLayout workspace="Executive Insights" currentUser="Vikram Rathore" role="Super Admin · Executive Insights">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Analytics</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900 mt-1">Spend & Approval Insights</h1>
            <p className="text-xs text-slate-500 mt-1">Rolling 12 months · {MONTHS[0]} 2025 – {MONTHS[11]} 2026</p>
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(({ label, value, icon: Icon, delta, sub, tone }) => (
            <div key={label} className="bg-white rounded-lg border border-slate-200/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
                <Icon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className={`font-display text-2xl font-semibold mt-2 tabular-nums ${tone || "text-slate-900"}`}>{value}</p>
              {delta !== undefined && (
                <p className={`text-[11px] mt-1 tabular-nums ${delta >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs {MONTHS[MONTHS.length - 2]}
                </p>
              )}
              {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div className="bg-white rounded-lg border border-slate-200/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-slate-900">Spend heatmap</h2>
              <p className="text-xs text-slate-500 mt-0.5">12 months × 7 categories · darker = higher outflow</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                {["bg-slate-100","bg-sky-100","bg-sky-200","bg-indigo-300","bg-indigo-500","bg-indigo-700"].map(c =>
                  <span key={c} className={`w-4 h-3 rounded-sm ${c}`} />
                )}
              </div>
              <span>High</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-24"></th>
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
                      <td
                        key={ci}
                        onMouseEnter={() => setHover({ m: mi, c: ci })}
                        onMouseLeave={() => setHover(null)}
                        className={`h-9 rounded-sm text-center text-[10px] font-mono tabular-nums cursor-pointer transition-all ${heatColor(v)} ${hover?.m === mi && hover?.c === ci ? "ring-2 ring-slate-900" : ""}`}
                        title={`${typeLabels[CATS[ci]]} · ${m} · ${fmtINR(v)}`}
                      >
                        {v > maxCell * 0.5 ? `${Math.round(v / 1000)}k` : ""}
                      </td>
                    ))}
                    <td className="text-[11px] font-semibold text-slate-800 pl-2 tabular-nums text-right">
                      {fmtINR(monthTotals[mi])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-md">
            <Flame className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">Peak outflow:</span> {typeLabels[CATS[peakCell.c]]} in {MONTHS[peakCell.m]} — {fmtINR(peakCell.v)}.
              {hover && (
                <span className="ml-2 text-amber-800">
                  · Hover: <b>{typeLabels[CATS[hover.c]]}</b> · {MONTHS[hover.m]} · <span className="font-mono">{fmtINR(heat[hover.m][hover.c])}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two-column: Departments + Category mix */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/70 p-5">
            <div className="mb-4">
              <h2 className="font-display font-semibold text-slate-900">Department spend</h2>
              <p className="text-xs text-slate-500 mt-0.5">YTD approved + released outflow</p>
            </div>
            <div className="space-y-2.5">
              {depts.map(([d, v]) => {
                const pct = (v / maxDept) * 100;
                const share = (v / depts.reduce((a, [, x]) => a + x, 0)) * 100;
                return (
                  <div key={d} className="grid grid-cols-[110px_1fr_90px] items-center gap-3">
                    <span className="text-xs text-slate-700 truncate">{d}</span>
                    <div className="relative h-6 bg-slate-50 rounded overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-800 to-slate-600 rounded"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-white/90 tabular-nums">
                        {share.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-700 text-right">{fmtINR(v)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/70 p-5">
            <div className="mb-4">
              <h2 className="font-display font-semibold text-slate-900">Category mix</h2>
              <p className="text-xs text-slate-500 mt-0.5">Share of total YTD spend</p>
            </div>
            <div className="space-y-2">
              {CATS.map((c, ci) => {
                const v = catTotals[ci];
                const pct = (v / grandTotal) * 100;
                const Icon = typeIcon[c];
                const catColor: Record<string, string> = {
                  finance: "bg-rose-500", logistics: "bg-indigo-500",
                  supplies: "bg-amber-500", identity: "bg-sky-500", facility: "bg-emerald-500",
                };
                return (
                  <div key={c} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
                    <span className="text-xs text-slate-700 w-24 truncate">{typeLabels[c]}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${catColor[typeCategory[c]]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* People analytics — smart per-employee drill-down */}
        <PeopleInsights requests={requests} />

        {/* Alerts */}
        <div className="bg-white rounded-lg border border-slate-200/70 p-5">
          <h2 className="font-display font-semibold text-slate-900 mb-3">Anomalies & signals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border border-rose-100 bg-rose-50/50 rounded-md">
              <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Travel spike
              </div>
              <p className="text-xs text-slate-700 mt-1.5">
                {MONTHS[11]} travel is <b>{Math.round(((heat[11][0] - heat[10][0]) / heat[10][0]) * 100)}%</b> higher than last month. Q3 offsites likely driver.
              </p>
            </div>
            <div className="p-3 border border-amber-100 bg-amber-50/50 rounded-md">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                <Flame className="w-3.5 h-3.5" /> Catering peak
              </div>
              <p className="text-xs text-slate-700 mt-1.5">
                Food & catering peaked at <b>{fmtINR(heat[4][6])}</b> in Dec — festive events cycle. Plan Q4 accordingly.
              </p>
            </div>
            <div className="p-3 border border-emerald-100 bg-emerald-50/50 rounded-md">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                <TrendingDown className="w-3.5 h-3.5" /> Stationery down
              </div>
              <p className="text-xs text-slate-700 mt-1.5">
                Stationery ordering down <b>32%</b> YoY — hybrid work reducing office consumption.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
