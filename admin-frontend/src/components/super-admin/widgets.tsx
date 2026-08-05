// Shared small UI widgets used across multiple super-admin tabs
import type { Wallet } from "lucide-react";

/** Top-bar stat chip */
export function StatChip({ icon: Icon, label, value, sub, tone = "slate" }: {
  icon: typeof Wallet; label: string; value: string; sub?: string;
  tone?: "slate"|"emerald"|"rose";
}) {
  const subTone = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-slate-500";
  return (
    <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-md min-w-[130px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
        <Icon className="w-3 h-3 text-slate-400" />
      </div>
      <p className="font-display text-base font-semibold text-slate-900 mt-1 tabular-nums">{value}</p>
      {sub && <p className={`text-[10px] tabular-nums ${subTone}`}>{sub}</p>}
    </div>
  );
}

/** KPI card for Inventory tab */
export function KpiCard({ icon: Icon, label, value, tone }: {
  icon: typeof Wallet; label: string; value: string;
  tone: "slate"|"indigo"|"amber"|"rose";
}) {
  const tones = {
    slate:  { bg: "bg-white",        ring: "border-slate-200",  ic: "text-slate-400",  val: "text-slate-900" },
    indigo: { bg: "bg-indigo-50/60", ring: "border-indigo-100", ic: "text-indigo-500", val: "text-indigo-900" },
    amber:  { bg: "bg-amber-50/70",  ring: "border-amber-100",  ic: "text-amber-600",  val: "text-amber-900" },
    rose:   { bg: "bg-rose-50/70",   ring: "border-rose-100",   ic: "text-rose-600",   val: "text-rose-900" },
  }[tone];
  return (
    <div className={`px-3.5 py-3 border rounded-lg ${tones.bg} ${tones.ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${tones.ic}`} />
      </div>
      <p className={`font-display text-xl font-semibold mt-1 tabular-nums ${tones.val}`}>{value}</p>
    </div>
  );
}
