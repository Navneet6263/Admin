import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock,
  Download, Flame,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { typeLabels, typeCategory, type RequestItem } from "@/components/models";
import { typeIcon, fmtINR } from "@/components/requestMeta";
import { PeopleInsights } from "@/components/insights/PeopleInsights";
import { getRequests, request } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";
import { buildHistory, buildHistoryFromAggregates, CATS, availableFinancialYears, financialYearLabel as formatFinancialYear, financialYearStartFor, type SpendHeatmapResponse } from "@/components/super-admin/shared";
import { AnomaliesTab } from "@/components/super-admin/AnomaliesTab";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — RequestHub" },
      { name: "description", content: "Executive analytics for spend, categories, departments and approval velocity." },
    ],
  }),
  component: Insights,
});

function Insights() {
  const sessionUser = useSessionUser();
  const [hover, setHover] = useState<{ m: number; c: number } | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const currentFinancialYear = financialYearStartFor(new Date());
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(currentFinancialYear);
  const [aggregate, setAggregate] = useState<SpendHeatmapResponse | null>(null);
  const financialYears = useMemo(() => availableFinancialYears(requests), [requests]);
  const refresh = useCallback(async () => { try { setRequests(await getRequests('/api/requests')); } catch (error) { console.error(error); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    setAggregate(null);
    request<SpendHeatmapResponse>(`/api/dashboard/spend-heatmap?fy_start=${selectedFinancialYear}`)
      .then((data) => { if (active) setAggregate(data); }).catch(console.error);
    return () => { active = false; };
  }, [selectedFinancialYear]);
  const live = useMemo(() => {
    const history = aggregate
      ? buildHistoryFromAggregates(aggregate.heatmap, selectedFinancialYear)
      : buildHistory(requests, selectedFinancialYear);
    return { ...history, maxCell: Math.max(...history.heat.flat(), 1) };
  }, [aggregate, requests, selectedFinancialYear]);
  const { MONTHS, heat, monthTotals, catTotals, grandTotal, maxCell, thisMonth, lastMonth, financialYearLabel } = live;
  const visibleMonths = monthTotals.map((value, index) => ({ value, index })).filter(({ value }) => value > 0);
  const visibleCategories = catTotals.map((value, index) => ({ value, index })).filter(({ value }) => value > 0);
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
    { label: "This month", value: fmtINR(thisMonth), delta: MONTHS.length > 1 ? monthDelta : undefined, icon: monthDelta >= 0 ? TrendingUp : TrendingDown },
    { label: "Approval rate", value: `${approvalRate}%`, sub: `${approved}/${total} closed`, icon: CheckCircle2 },
    { label: "Avg turnaround", value: `${avgTat}h`, sub: "created → decided", icon: Clock },
  ], [MONTHS.length, approved, approvalRate, avgTat, grandTotal, monthDelta, thisMonth, total]);

  const peakCell = useMemo(() => {
    let best = { v: 0, m: 0, c: 0 };
    heat.forEach((row, mi) => row.forEach((v, ci) => { if (v > best.v) best = { v, m: mi, c: ci }; }));
    return best;
  }, [heat]);

  return (
    <DashboardLayout workspace="Executive Insights" currentUser={sessionUser?.name ?? ""} role={sessionUser?.dept || "Executive Insights"}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Analytics</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900 mt-1">Spend & Approval Insights</h1>
            <p className="text-xs text-slate-500 mt-1">{financialYearLabel} · April–March · live database records</p>
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
              <p className="text-xs text-slate-500 mt-0.5">{financialYearLabel} · non-zero months and categories only · darker = higher outflow</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={selectedFinancialYear} onChange={(event) => setSelectedFinancialYear(Number(event.target.value))}
                aria-label="Select heatmap financial year"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                {financialYears.map((year) => <option key={year} value={year}>{formatFinancialYear(year)}{year === currentFinancialYear ? ' · Current' : year === currentFinancialYear - 1 ? ' · Previous' : ''}</option>)}
              </select>
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
          </div>

          {visibleMonths.length && visibleCategories.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-24"></th>
                  {visibleCategories.map(({ index: ci }) => {
                    const c = CATS[ci];
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
                {visibleMonths.map(({ index: mi }) => {
                  const m = MONTHS[mi];
                  return (
                  <tr key={m}>
                    <td className="text-[11px] font-medium text-slate-600 pr-2 text-right tabular-nums">{m}</td>
                    {visibleCategories.map(({ index: ci }) => {
                      const v = heat[mi][ci];
                      return (
                      <td
                        key={ci}
                        onMouseEnter={() => { if (v > 0) setHover({ m: mi, c: ci }); }}
                        onMouseLeave={() => setHover(null)}
                        className={`h-9 rounded-sm text-center text-[10px] font-mono tabular-nums transition-all ${v ? `cursor-pointer ${heatColor(v)}` : "bg-transparent"} ${hover?.m === mi && hover?.c === ci ? "ring-2 ring-slate-900" : ""}`}
                        title={v > 0 ? `${typeLabels[CATS[ci]]} · ${m} · ${fmtINR(v)}` : undefined}
                      >
                        {v > maxCell * 0.5 ? `${Math.round(v / 1000)}k` : ""}
                      </td>
                      );
                    })}
                    <td className="text-[11px] font-semibold text-slate-800 pl-2 tabular-nums text-right">
                      {fmtINR(monthTotals[mi])}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div> : <div className="grid min-h-36 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">No spend recorded in {financialYearLabel} yet.</div>}

          {grandTotal > 0 && <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-md">
            <Flame className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">Peak outflow:</span> {typeLabels[CATS[peakCell.c]]} in {MONTHS[peakCell.m]} — {fmtINR(peakCell.v)}.
              {hover && (
                <span className="ml-2 text-amber-800">
                  · Hover: <b>{typeLabels[CATS[hover.c]]}</b> · {MONTHS[hover.m]} · <span className="font-mono">{fmtINR(heat[hover.m][hover.c])}</span>
                </span>
              )}
            </div>
          </div>}
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

        <AnomaliesTab requests={requests} />
      </div>
    </DashboardLayout>
  );
}
