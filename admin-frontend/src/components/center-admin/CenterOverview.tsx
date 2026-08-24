import { AlertTriangle, Boxes, CheckCircle2, Clock3, Users } from 'lucide-react';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { CenterBudgetRing } from './CenterBudgetRing';
import type { CenterActivityRow, CenterOverviewData } from './types';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function CenterOverview({ data, activity }: {
  data: CenterOverviewData;
  activity: CenterActivityRow[];
}) {
  const available = data.center.allocated - data.center.spent - data.center.committed;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Clock3} label="Awaiting approval" value={data.requests.awaiting_approval || 0}
          hint={`${data.requests.urgent_open || 0} urgent requests`} tone="amber" />
        <MetricCard icon={CheckCircle2} label="Approved in 30 days" value={data.requests.approved_30d || 0}
          hint={`${data.requests.rejected_30d || 0} rejected`} tone="emerald" />
        <MetricCard icon={Users} label="Active center users" value={data.people.active_users || 0}
          hint={`${data.requests.total || 0} lifetime requests`} tone="indigo" />
        <MetricCard icon={AlertTriangle} label="Low-stock items" value={data.inventory.low_stock || 0}
          hint={`${data.inventory.sku_count || 0} SKUs monitored`} tone={data.inventory.low_stock ? 'rose' : 'cyan'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.4fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current month</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-900">Center budget position</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600">{data.center.code}</span>
          </div>
          <div className="mt-5 grid items-center gap-5 sm:grid-cols-[150px_1fr]">
            <CenterBudgetRing allocated={data.center.allocated} spent={data.center.spent} committed={data.center.committed} />
            <div className="space-y-3">
              {[
                ['Allocated', data.center.allocated, 'text-slate-900'],
                ['Spent', data.center.spent, 'text-rose-600'],
                ['Committed', data.center.committed, 'text-amber-600'],
                ['Available', available, available < 0 ? 'text-rose-600' : 'text-emerald-600'],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className={`font-mono text-xs font-semibold ${tone}`}>{money(Number(value))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600">
            <Boxes className="h-4 w-4 text-indigo-600" />
            Inventory value {money(data.inventory.stock_value)} · {data.inventory.reserved_units || 0} units reserved
          </div>
        </section>
        <ActivityFeed rows={activity} limit={6} title="Latest center activity"
          subtitle="Approval and workflow actions recorded for this center" />
      </div>
    </div>
  );
}
