import { AlertTriangle, Banknote, CheckCircle2, Clock3, Landmark, TrendingUp } from 'lucide-react';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { MetricCard } from '@/components/dashboard/MetricCard';
import type { FinanceHeadData } from './types';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function FinanceHeadOverview({ data }: { data: FinanceHeadData }) {
  const maxMonth = Math.max(1, ...data.monthly.map((row) => Number(row.amount)));
  const maxCenter = Math.max(1, ...data.centers.map((row) => Number(row.amount)));
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={Clock3} label="Awaiting cost update" value={data.metrics.awaiting_update || 0} hint="Operations must submit final cost" tone="amber" />
      <MetricCard icon={CheckCircle2} label="Awaiting verification" value={data.metrics.awaiting_verification || 0} hint={`${data.metrics.overdue || 0} overdue payments`} tone={data.metrics.overdue ? 'rose' : 'emerald'} />
      <MetricCard icon={Banknote} label="Open financial value" value={money(data.metrics.open_value)} hint={`${data.metrics.total_payments || 0} lifetime payments`} tone="indigo" />
      <MetricCard icon={TrendingUp} label="Paid this month" value={money(data.metrics.paid_this_month)} hint={`${Number(data.metrics.avg_verify_hrs || 0).toFixed(1)}h average verification`} tone="emerald" />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><TrendingUp className="h-4 w-4 text-indigo-600" /> Six-month paid trend</h2><p className="mt-1 text-[11px] text-slate-500">Verified payment value by month</p></div>
        <div className="mt-6 space-y-4">{data.monthly.map((row) => <div key={row.month_key} className="grid grid-cols-[65px_1fr_100px] items-center gap-3">
          <span className="font-mono text-[10px] text-slate-500">{row.month_key}</span><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, Number(row.amount) / maxMonth * 100)}%` }} /></div>
          <span className="text-right font-mono text-[10px] font-semibold text-slate-700">{money(row.amount)}</span>
        </div>)}{!data.monthly.length && <div className="py-16 text-center text-xs text-slate-400">No paid history is available yet.</div>}</div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Landmark className="h-4 w-4 text-emerald-600" /> Highest-spend centers</h2><p className="mt-1 text-[11px] text-slate-500">Top centers across estimated and final payments</p></div>
        <div className="mt-5 space-y-3">{data.centers.map((row, index) => <div key={`${row.center_code}-${index}`}>
          <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-700">{row.center_code || 'Unassigned'} <span className="font-normal text-slate-400">· {row.payment_count} payments</span></span><span className="font-mono font-semibold">{money(row.amount)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, Number(row.amount) / maxCenter * 100)}%` }} /></div>
        </div>)}{!data.centers.length && <div className="py-16 text-center text-xs text-slate-400">No center spend is available yet.</div>}</div>
      </section>
    </div>
    {data.metrics.overdue > 0 && <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"><AlertTriangle className="h-4 w-4" /><b>{data.metrics.overdue} overdue payment actions</b><span className="text-rose-600">Review the verification queue and follow up with the owning center.</span></div>}
    <ActivityFeed rows={data.activity} limit={7} title="Latest finance controls" subtitle="Payment updates and verification actions across all centers" />
  </div>;
}
