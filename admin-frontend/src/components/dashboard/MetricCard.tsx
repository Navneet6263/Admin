import type { LucideIcon } from 'lucide-react';

const tones = {
  slate: 'bg-slate-100 text-slate-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  cyan: 'bg-cyan-50 text-cyan-700',
};

export function MetricCard({ icon: Icon, label, value, hint, tone = 'slate' }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 truncate text-[11px] text-slate-500">{hint}</p>}
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
      </div>
    </div>
  );
}
