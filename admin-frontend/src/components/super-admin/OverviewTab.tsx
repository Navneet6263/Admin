import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { PeopleInsights } from "@/components/insights/PeopleInsights";
import { typeLabels, typeCategory, type RequestItem } from "@/components/models";
import { useCompanies } from "@/lib/directory";
import { typeIcon } from "@/components/requestMeta";
import { CATS, heatColor, fmtINR, buildHistory } from "./shared";

export function OverviewTab({ requests, history }: {
  requests: RequestItem[];
  history: ReturnType<typeof buildHistory>;
}) {
  const companies = useCompanies();
  const { MONTHS: labels, heat: h, monthTotals: mt, catTotals, grandTotal } = history;
  const maxCell = Math.max(...h.flat(), 1);

  const companySpend = useMemo(() =>
    requests.reduce<Record<string, { spend: number; count: number }>>((acc, row) => {
      if (row.status !== 'rejected') {
        const v = acc[row.company] ?? { spend: 0, count: 0 };
        v.spend += row.amount ?? 0; v.count++;
        acc[row.company] = v;
      }
      return acc;
    }, {})
  , [requests]);

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
                  <span className="text-[10px] text-slate-400">Database entity</span>
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
                <th className="w-20" />
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
              {labels.map((m, mi) => (
                <tr key={m}>
                  <td className="text-[11px] font-medium text-slate-600 pr-2 text-right tabular-nums">{m}</td>
                  {h[mi].map((v, ci) => (
                    <td key={ci}
                      className={`h-8 rounded-sm text-center text-[10px] font-mono tabular-nums ${heatColor(v, maxCell)}`}
                      title={`${typeLabels[CATS[ci]]} · ${m} · ${fmtINR(v)}`}>
                      {v > maxCell * 0.5 ? `${Math.round(v/1000)}k` : ""}
                    </td>
                  ))}
                  <td className="text-[11px] font-semibold text-slate-800 pl-2 tabular-nums text-right">{fmtINR(mt[mi])}</td>
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
            const pct = grandTotal > 0 ? (v / grandTotal) * 100 : 0;
            const Icon = typeIcon[c];
            const colorMap: Record<string, string> = {
              finance: "bg-rose-500", logistics: "bg-indigo-500",
              supplies: "bg-amber-500", identity: "bg-sky-500", facility: "bg-emerald-500",
            };
            return (
              <div key={c} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
                <span className="text-xs text-slate-700 w-28 truncate">{typeLabels[c]}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${colorMap[typeCategory[c]]}`} style={{ width: `${pct}%` }} />
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
