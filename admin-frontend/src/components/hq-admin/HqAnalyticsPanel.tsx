import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, CheckCircle2, Clock3, IndianRupee } from "lucide-react";
import { AnalyticsTab } from "@/components/super-admin/AnalyticsTab";
import { buildHistory, fmtINR } from "@/components/super-admin/shared";
import type { RequestItem } from "@/components/models";
import { request } from "@/lib/api";
import { TableLoadingSkeleton } from "@/components/LoadingSkeletons";
import { TablePagination } from "@/components/TablePagination";

interface CenterPerformance {
  code: string;
  name: string;
  city: string;
  total_requests: number;
  approved: number;
  rejected: number;
  pending: number;
  avg_response_hrs: number;
  total_spent: number;
}

export function HqAnalyticsPanel({ requests, centerCode }: { requests: RequestItem[]; centerCode: string }) {
  const [centers, setCenters] = useState<CenterPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const history = useMemo(() => buildHistory(requests), [requests]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void request<CenterPerformance[]>("/api/dashboard/peer-comparison")
      .then((rows) => { if (active) setCenters(rows); })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const rows = centerCode ? centers.filter((center) => center.code === centerCode) : centers;
    return [...rows].sort((a, b) => {
      const aRate = a.total_requests ? a.approved / a.total_requests : 0;
      const bRate = b.total_requests ? b.approved / b.total_requests : 0;
      return bRate - aRate || a.avg_response_hrs - b.avg_response_hrs;
    });
  }, [centerCode, centers]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const paged = useMemo(() => visible.slice((page - 1) * pageSize, page * pageSize), [page, pageSize, visible]);
  useEffect(() => setPage(1), [centerCode, pageSize]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);

  const totals = useMemo(() => {
    const volume = visible.reduce((sum, row) => sum + Number(row.total_requests || 0), 0);
    const approved = visible.reduce((sum, row) => sum + Number(row.approved || 0), 0);
    const weightedTat = visible.reduce((sum, row) => sum + Number(row.avg_response_hrs || 0) * Number(row.total_requests || 0), 0);
    return {
      volume,
      approvalRate: volume ? Math.round((approved / volume) * 100) : 0,
      avgTat: volume ? Math.round(weightedTat / volume) : 0,
      spend: visible.reduce((sum, row) => sum + Number(row.total_spent || 0), 0),
    };
  }, [visible]);

  const maxVolume = Math.max(...visible.map((center) => Number(center.total_requests || 0)), 1);
  const scopeName = centerCode ? visible[0]?.name || centerCode : "All Centers";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500">HQ operational intelligence</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Building2 className="h-5 w-5" /> {scopeName} Performance
            </h2>
            <p className="mt-1 text-xs text-slate-500">Live center comparison from requests, approvals and response time.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={Activity} label="Request volume" value={totals.volume.toLocaleString("en-IN")} />
          <Metric icon={CheckCircle2} label="Approval rate" value={`${totals.approvalRate}%`} />
          <Metric icon={Clock3} label="Average response" value={`${totals.avgTat}h`} />
          <Metric icon={IndianRupee} label="Recorded spend" value={fmtINR(totals.spend)} />
        </div>

        {loading ? <div className="mt-5"><TableLoadingSkeleton rows={5} columns={5} /></div> : <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-2.5">Rank / Center</th><th className="px-4 py-2.5">Volume</th><th className="px-4 py-2.5">Approval</th><th className="px-4 py-2.5">Avg response</th><th className="px-4 py-2.5 text-right">Spend</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((center, index) => {
                const approval = center.total_requests ? Math.round((center.approved / center.total_requests) * 100) : 0;
                return (
                  <tr key={center.code} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3"><span className="mr-3 font-mono text-slate-400">#{(page - 1) * pageSize + index + 1}</span><span className="font-semibold text-slate-900">{center.name}</span><span className="ml-2 font-mono text-[10px] text-slate-400">{center.code} · {center.city}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-indigo-500" style={{ width: `${(center.total_requests / maxVolume) * 100}%` }} /></div><span className="font-mono">{center.total_requests}</span></div></td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{approval}%</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${center.avg_response_hrs > 24 ? "text-rose-600" : center.avg_response_hrs > 12 ? "text-amber-600" : "text-emerald-700"}`}>{Math.round(center.avg_response_hrs || 0)}h</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmtINR(Number(center.total_spent || 0))}</td>
                  </tr>
                );
              })}
              {!loading && visible.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No performance data for this center yet.</td></tr>}
            </tbody>
          </table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={visible.length} onPage={setPage} onPageSize={setPageSize} />
        </div>}
      </div>

      <AnalyticsTab requests={requests} history={history} centerCode={centerCode} />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"><Icon className="h-4 w-4 text-indigo-500" /><p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</p></div>;
}
