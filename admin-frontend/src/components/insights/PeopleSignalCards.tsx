import { AlertCircle, ArrowUpRight, Crown, Repeat, Users } from "lucide-react";
import { fmtINR } from "@/components/requestMeta";
import type { EmployeeStat } from "./peopleInsightsData";

export function PeopleSignalCards({
  stats,
  periodLabel,
}: {
  stats: EmployeeStat[];
  periodLabel: string;
}) {
  const topSpender = stats[0];
  const mostFrequent = [...stats].sort((a, b) => b.reqCount - a.reqCount)[0];
  const mostRejected = [...stats].sort((a, b) => b.rejectedCount - a.rejectedCount)[0];
  const bigTicket = [...stats].sort((a, b) => b.approvedSpend - a.approvedSpend)[0];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SignalCard
        icon={Crown}
        tone="amber"
        label="Top spender"
        primary={topSpender?.name ?? "—"}
        secondary={fmtINR(topSpender?.approvedSpend ?? 0)}
        hint={`${topSpender?.dept ?? "No data"} · ${topSpender?.approvedCount ?? 0} approved`}
      />
      <SignalCard
        icon={Repeat}
        tone="indigo"
        label="Most frequent"
        primary={mostFrequent?.name ?? "—"}
        secondary={`${mostFrequent?.reqCount ?? 0} requests`}
        hint={`${mostFrequent?.approvedCount ?? 0} approved · ${mostFrequent?.rejectedCount ?? 0} rejected`}
      />
      <SignalCard
        icon={AlertCircle}
        tone="rose"
        label="Most rejections"
        primary={mostRejected?.name ?? "—"}
        secondary={`${mostRejected?.rejectedCount ?? 0} rejected`}
        hint={mostRejected?.dept ?? "No data"}
      />
      <SignalCard
        icon={ArrowUpRight}
        tone="slate"
        label="Big-ticket buyer"
        primary={bigTicket?.name ?? "—"}
        secondary={fmtINR(bigTicket?.approvedSpend ?? 0)}
        hint={`Highest approved outflow · ${periodLabel}`}
      />
    </div>
  );
}

function SignalCard({
  icon: Icon,
  tone,
  label,
  primary,
  secondary,
  hint,
}: {
  icon: typeof Users;
  tone: "amber" | "indigo" | "rose" | "slate";
  label: string;
  primary: string;
  secondary: string;
  hint: string;
}) {
  const tones = {
    amber: "border-amber-100 bg-amber-50 text-amber-600",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-600",
    rose: "border-rose-100 bg-rose-50 text-rose-600",
    slate: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
        <div className={`grid h-6 w-6 place-items-center rounded-md border ${tones[tone]}`}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="mt-2 truncate font-display text-base font-semibold text-slate-900">{primary}</p>
      <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-700">{secondary}</p>
      <p className="mt-1 truncate text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}
