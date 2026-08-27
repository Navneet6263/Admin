import type { ReactNode } from "react";
import { ArrowUpRight, Repeat, TrendingUp } from "lucide-react";
import { typeLabels, type RequestType } from "@/components/models";
import { fmtINR } from "@/components/requestMeta";
import { departmentTone, employeeInitials, type EmployeeStat } from "./peopleInsightsData";

export function EmployeePassport({
  employee,
  periodLabel,
}: {
  employee: EmployeeStat;
  periodLabel: string;
}) {
  const categories = Object.entries(employee.byCategory)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]) as [RequestType, number][];
  const maximum = categories[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white">
          {employeeInitials(employee.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-slate-900">{employee.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${departmentTone(employee.dept)}`}
            >
              {employee.dept}
            </span>
            <span className="text-[10px] text-slate-500">
              EMP-{String(employee.id).padStart(3, "0")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat
          label="Approved"
          value={employee.approvedCount}
          tone="text-emerald-700"
          bg="bg-emerald-50"
        />
        <MiniStat
          label="Pending"
          value={employee.pendingCount}
          tone="text-amber-700"
          bg="bg-amber-50"
        />
        <MiniStat
          label="Rejected"
          value={employee.rejectedCount}
          tone="text-rose-700"
          bg="bg-rose-50"
        />
      </div>

      <div className="rounded-md border border-slate-200/70 bg-slate-50/50 p-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">
          Approved outflow · {periodLabel}
        </p>
        <p className="mt-1 font-display text-xl font-semibold tabular-nums text-slate-900">
          {fmtINR(employee.approvedSpend)}
        </p>
        {employee.pendingSpend > 0 && (
          <p className="mt-0.5 text-[10px] text-amber-700">
            + {fmtINR(employee.pendingSpend)} pending review
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-400">
          <TrendingUp className="h-3 w-3" /> Spend by category
        </p>
        {!categories.length ? (
          <p className="text-[11px] text-slate-500">No amounted requests yet.</p>
        ) : (
          <div className="space-y-1.5">
            {categories.slice(0, 5).map(([category, value]) => (
              <div key={category} className="flex items-center gap-2">
                <span className="w-20 truncate text-[11px] text-slate-600">
                  {typeLabels[category]}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800"
                    style={{ width: `${(value / maximum) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-[10px] tabular-nums text-slate-600">
                  {fmtINR(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {employee.reqCount >= 3 && (
          <Badge className="border-indigo-100 bg-indigo-50 text-indigo-700">
            <Repeat className="h-2.5 w-2.5" /> Frequent requester
          </Badge>
        )}
        {employee.rejectedCount >= 1 && (
          <Badge className="border-rose-100 bg-rose-50 text-rose-700">Reject history</Badge>
        )}
        {employee.approvedSpend >= 100000 && (
          <Badge className="border-emerald-100 bg-emerald-50 text-emerald-700">
            <ArrowUpRight className="h-2.5 w-2.5" /> Big-ticket buyer
          </Badge>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  bg,
}: {
  label: string;
  value: number;
  tone: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-md py-2`}>
      <p className={`font-display text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${className}`}
    >
      {children}
    </span>
  );
}
