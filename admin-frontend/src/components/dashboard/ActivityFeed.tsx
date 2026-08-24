import { Activity, CheckCircle2, CircleDot, RotateCcw, XCircle } from 'lucide-react';

export interface ActivityRow {
  id: number;
  action: string;
  note?: string | null;
  created_at: string;
  ref_id: string;
  subject: string;
  actor_name: string;
  actor_role?: string;
  amount?: number;
}

const actionStyle: Record<string, { label: string; classes: string; icon: typeof Activity }> = {
  approved: { label: 'Approved', classes: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  payment_verified: { label: 'Payment verified', classes: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', classes: 'bg-rose-50 text-rose-700', icon: XCircle },
  sent_back: { label: 'Sent back', classes: 'bg-amber-50 text-amber-700', icon: RotateCcw },
  payment_updated: { label: 'Payment updated', classes: 'bg-indigo-50 text-indigo-700', icon: CircleDot },
};

const timeLabel = (value: string) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export function ActivityFeed({ rows, title = 'Recent activity', subtitle, limit }: {
  rows: ActivityRow[];
  title?: string;
  subtitle?: string;
  limit?: number;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Activity className="h-4 w-4 text-indigo-600" /> {title}
        </h2>
        {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="divide-y divide-slate-100">
        {visible.map((row) => {
          const style = actionStyle[row.action] || {
            label: row.action.replaceAll('_', ' '), classes: 'bg-slate-100 text-slate-700', icon: CircleDot,
          };
          const Icon = style.icon;
          return (
            <div key={row.id} className="flex gap-3 px-5 py-3.5 hover:bg-slate-50/70">
              <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${style.classes}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-semibold text-slate-900">{style.label}</span>
                  <span className="font-mono text-[10px] text-indigo-600">{row.ref_id}</span>
                  {row.amount != null && <span className="ml-auto font-mono text-[11px] font-semibold text-slate-700">₹{Number(row.amount).toLocaleString('en-IN')}</span>}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-600">{row.subject}</p>
                <p className="mt-1 text-[10px] text-slate-400">{row.actor_name} · {timeLabel(row.created_at)}</p>
                {row.note && <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{row.note}</p>}
              </div>
            </div>
          );
        })}
        {!visible.length && <div className="px-5 py-14 text-center text-xs text-slate-400">No activity has been recorded yet.</div>}
      </div>
    </section>
  );
}
