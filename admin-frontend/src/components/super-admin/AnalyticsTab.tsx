import { Zap, Activity, ArrowUpRight, Sparkles } from "lucide-react";
import { typeLabels, type RequestItem } from "@/components/models";
import { typeIcon } from "@/components/requestMeta";
import { CATS, buildHistory, fmtINR } from "./shared";
import { ExpenseAnalytics } from "@/components/analytics/ExpenseAnalytics";

export function AnalyticsTab({ requests, history }: { requests: RequestItem[]; history: ReturnType<typeof buildHistory> }) {
  const { MONTHS, heat, monthTotals, forecast, avg6 } = history;
  const trend = [...monthTotals, ...forecast];
  const trendMax = Math.max(...trend, 1);
  const forecastStart = monthTotals.length;

  const tatByCat = CATS.map(c => {
    const closed = requests.filter(r => r.type === c && (r.status === "approved" || r.status === "rejected"));
    if (!closed.length) return { c, h: 0 };
    const h = closed.reduce((a,r) => a + (+new Date(r.updatedAt)-+new Date(r.createdAt))/3_600_000, 0) / closed.length;
    return { c, h: Math.round(h) };
  }).filter(x => x.h > 0);
  const maxTat = Math.max(...tatByCat.map(x => x.h), 1);

  const funnel = [
    { s: "Created",               n: requests.length,                                                                           tone: "bg-slate-500" },
    { s: "Pending admin",         n: requests.filter(r => r.status === "pending" || r.status === "info_requested").length,      tone: "bg-amber-500" },
    { s: "Awaiting verification", n: requests.filter(r => r.status === "awaiting_verification").length,                         tone: "bg-violet-500" },
    { s: "Approved & closed",     n: requests.filter(r => r.status === "approved").length,                                      tone: "bg-emerald-500" },
    { s: "Rejected",              n: requests.filter(r => r.status === "rejected").length,                                      tone: "bg-rose-500" },
  ];
  const funnelMax = funnel[0].n;
  const projected3M = forecast.reduce((a,b) => a+b, 0);
  const projDelta = avg6 > 0 ? ((projected3M/3 - avg6) / avg6) * 100 : 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <ExpenseAnalytics />
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
            <p>Projection · calculated from database spend</p>
            <p className="mt-1">Confidence · <span className="text-white">medium</span></p>
          </div>
        </div>
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

      {/* Category momentum */}
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
            const prior  = heat.slice(-6,-3).reduce((a, row) => a + row[ci], 0);
            const delta  = prior > 0 ? ((recent - prior) / prior) * 100 : 0;
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
