import { ChevronDown } from "lucide-react";
import { useCompanies } from "@/lib/directory";
import { typeLabels, type RequestType, type Priority } from "@/components/models";

export type SortKey = "priority" | "newest" | "oldest" | "amount";

export function TypeFilter({ value, onChange }: { value: RequestType | "all"; onChange: (v: RequestType | "all") => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RequestType | "all")}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <option value="all">All categories</option>
        {(Object.keys(typeLabels) as RequestType[]).map((t) => (
          <option key={t} value={t}>{typeLabels[t]}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function PriorityFilter({ value, onChange }: { value: Priority | "all"; onChange: (v: Priority | "all") => void }) {
  const opts: { v: Priority | "all"; label: string }[] = [
    { v: "all", label: "Any priority" },
    { v: "urgent", label: "Urgent" },
    { v: "high", label: "High" },
    { v: "normal", label: "Normal" },
    { v: "low", label: "Low" },
  ];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Priority | "all")}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const companies = useCompanies();
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <option value="all">All companies</option>
        {companies.map((c) => (
          <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function SortFilter({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const opts: { v: SortKey; label: string }[] = [
    { v: "priority", label: "Sort: Priority" },
    { v: "newest", label: "Sort: Newest" },
    { v: "oldest", label: "Sort: Oldest" },
    { v: "amount", label: "Sort: Amount ↓" },
  ];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="appearance-none text-xs bg-slate-50 border border-slate-200 rounded pl-2.5 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

const kpiTone = {
  amber: "border-l-amber-400",
  indigo: "border-l-indigo-400",
  emerald: "border-l-emerald-400",
  rose: "border-l-rose-400",
} as const;

export function KpiTile({ label, value, tone }: { label: string; value: number; tone: keyof typeof kpiTone }) {
  return (
    <div className={`px-3.5 py-2.5 bg-white border border-slate-200 border-l-4 rounded-md min-w-[130px] ${kpiTone[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      <p className="text-xl font-display font-semibold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
