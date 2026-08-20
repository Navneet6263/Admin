import { useEffect, useMemo, useState } from "react";
import {
  Users, TrendingUp, Repeat, Crown, ChevronRight, ArrowUpRight, AlertCircle, Search, X,
} from "lucide-react";
import { typeLabels, type RequestItem, type RequestType } from "@/components/models";
import { fmtINR } from "@/components/requestMeta";

// -------- Aggregate per-employee ledger --------
interface EmployeeStat {
  id: number;
  name: string;
  dept: string;
  company: string;
  center: string;
  approvedSpend: number;
  pendingSpend: number;
  rejectedSpend: number;
  reqCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  byCategory: Record<RequestType, number>;
}

function buildEmployeeStats(requests: RequestItem[], financialYearStart: number): EmployeeStat[] {
  const map = new Map<number, EmployeeStat>();
  const start = new Date(financialYearStart, 3, 1); const end = new Date(financialYearStart + 1, 3, 1);
  for (const r of requests.filter((row) => { const date = new Date(row.createdAt); return date >= start && date < end; })) {
    if (!map.has(r.employeeId)) {
      map.set(r.employeeId, {
        id: r.employeeId, name: r.employeeName, dept: r.employeeDept, company: r.company,
        center: r.homeCenter || r.chargeCenter || r.approvalCenter || "Unassigned",
        approvedSpend: 0, pendingSpend: 0, rejectedSpend: 0,
        reqCount: 0, approvedCount: 0, rejectedCount: 0, pendingCount: 0,
        byCategory: {} as Record<RequestType, number>,
      });
    }
    const s = map.get(r.employeeId)!;
    s.reqCount++;
    const amt = r.actualAmount ?? r.amount ?? 0;
    if (r.status === "approved") { s.approvedSpend += amt; s.approvedCount++; s.byCategory[r.type] = (s.byCategory[r.type] || 0) + amt; }
    else if (r.status === "rejected") { s.rejectedSpend += amt; s.rejectedCount++; }
    else { s.pendingSpend += amt; s.pendingCount++; }
  }
  return Array.from(map.values()).sort((a, b) => b.approvedSpend - a.approvedSpend);
}

const initials = (n: string) => n.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

const deptTone = (d: string) => {
  const map: Record<string, string> = {
    Engineering: "bg-sky-100 text-sky-700",
    Sales: "bg-rose-100 text-rose-700",
    Marketing: "bg-amber-100 text-amber-700",
    Operations: "bg-indigo-100 text-indigo-700",
    Design: "bg-fuchsia-100 text-fuchsia-700",
    HR: "bg-emerald-100 text-emerald-700",
    Finance: "bg-slate-200 text-slate-800",
    Product: "bg-violet-100 text-violet-700",
  };
  return map[d] ?? "bg-slate-100 text-slate-700";
};

const currentFinancialYear = () => { const now = new Date(); return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; };
export function PeopleInsights({ requests, financialYearStart = currentFinancialYear() }: { requests: RequestItem[]; financialYearStart?: number }) {
  const stats = useMemo(() => buildEmployeeStats(requests, financialYearStart), [financialYearStart, requests]);
  const periodLabel = `FY ${financialYearStart}–${String(financialYearStart + 1).slice(-2)}${financialYearStart === currentFinancialYear() ? " YTD" : ""}`;
  const [openId, setOpenId] = useState<number | null>(stats[0]?.id ?? null);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const filteredStats = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter((s) =>
      s.name.toLowerCase().includes(q)
      || s.dept.toLowerCase().includes(q)
      || `emp-${String(s.id).padStart(3, "0")}`.includes(q),
    );
  }, [employeeQuery, stats]);
  const open = stats.find(s => s.id === openId) ?? null;
  useEffect(() => { if (stats.length && !stats.some((row) => row.id === openId)) setOpenId(stats[0].id); }, [openId, stats]);

  const maxApproved = Math.max(...stats.map(s => s.approvedSpend), 1);
  const topSpender = stats[0];
  const mostFrequent = [...stats].sort((a, b) => b.reqCount - a.reqCount)[0];
  const mostRejected = [...stats].sort((a, b) => b.rejectedCount - a.rejectedCount)[0];
  const bigTicket = [...stats].sort((a, b) => b.approvedSpend - a.approvedSpend)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">People analytics</p>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1">Employee spend passport</h2>
          <p className="text-xs text-slate-500 mt-1">Who is raising what · frequency & approval signals</p>
        </div>
      </div>

      {/* Signal cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SignalCard
          icon={Crown} tone="amber"
          label="Top spender"
          primary={topSpender?.name ?? "—"}
          secondary={fmtINR(topSpender?.approvedSpend ?? 0)}
          hint={`${topSpender?.dept} · ${topSpender?.approvedCount} approved`}
        />
        <SignalCard
          icon={Repeat} tone="indigo"
          label="Most frequent"
          primary={mostFrequent?.name ?? "—"}
          secondary={`${mostFrequent?.reqCount} requests`}
          hint={`${mostFrequent?.approvedCount} approved · ${mostFrequent?.rejectedCount} rejected`}
        />
        <SignalCard
          icon={AlertCircle} tone="rose"
          label="Most rejections"
          primary={mostRejected?.name ?? "—"}
          secondary={`${mostRejected?.rejectedCount} rejected`}
          hint={`${mostRejected?.dept}`}
        />
        <SignalCard
          icon={ArrowUpRight} tone="slate"
          label="Big-ticket buyer"
          primary={bigTicket?.name ?? "—"}
          secondary={fmtINR(bigTicket?.approvedSpend ?? 0)}
          hint={`Highest approved outflow · ${periodLabel}`}
        />
      </div>

      {/* Employee leaderboard + drill-down */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/70 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold text-slate-900 text-sm">Spend leaderboard</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Click a row to drill down · final paid amount where available · {periodLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-500">
                <Users className="w-3 h-3" />
                {employeeQuery ? `${filteredStats.length} of ${stats.length}` : stats.length} employees
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={employeeQuery}
                onChange={(event) => setEmployeeQuery(event.target.value)}
                placeholder="Search employee, department or ID…"
                aria-label="Search spend leaderboard employees"
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/70 pl-9 pr-9 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200/70"
              />
              {employeeQuery && (
                <button type="button" onClick={() => setEmployeeQuery("")}
                  aria-label="Clear employee search"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
            {filteredStats.map((s) => {
              const rank = stats.findIndex((row) => row.id === s.id) + 1;
              const pct = (s.approvedSpend / maxApproved) * 100;
              const active = s.id === openId;
              return (
                <button
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className={`w-full text-left px-5 py-3 hover:bg-slate-50/70 transition-colors ${active ? "bg-slate-50" : ""}`}
                >
                  <div className="grid grid-cols-[24px_36px_1fr_120px_20px] items-center gap-3">
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">#{rank}</span>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-[10px] font-semibold text-white">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${deptTone(s.dept)}`}>{s.dept}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-slate-800 to-slate-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 flex items-center gap-3 overflow-hidden text-[10px] text-slate-500 tabular-nums">
                        <span className="max-w-44 truncate" title={`${s.company} · ${s.center}`}>{s.company} · {s.center}</span>
                        <span>{s.reqCount} req</span>
                        <span className="text-emerald-600">✓ {s.approvedCount}</span>
                        {s.rejectedCount > 0 && <span className="text-rose-600">✗ {s.rejectedCount}</span>}
                        {s.pendingCount > 0 && <span className="text-amber-600">◔ {s.pendingCount}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold font-mono tabular-nums text-slate-900">{fmtINR(s.approvedSpend)}</p>
                      <p className="text-[10px] text-slate-400">approved</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-300 transition-transform ${active ? "rotate-90 text-slate-600" : ""}`} />
                  </div>
                </button>
              );
            })}
            {filteredStats.length === 0 && (
              <div className="px-5 py-12 text-center">
                <Search className="mx-auto h-5 w-5 text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-600">No employee found</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Try another name, department or employee ID.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/70 p-5 sticky top-16 self-start">
          {!open ? (
            <p className="text-xs text-slate-500">Select an employee to inspect.</p>
          ) : (
            <EmployeePassport s={open} periodLabel={periodLabel} />
          )}
        </div>
      </div>
    </div>
  );
}

function SignalCard({
  icon: Icon, tone, label, primary, secondary, hint,
}: {
  icon: typeof Users; tone: "amber" | "indigo" | "rose" | "slate";
  label: string; primary: string; secondary: string; hint: string;
}) {
  const tones = {
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
    slate: "text-slate-600 bg-slate-100 border-slate-200",
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200/70 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
        <div className={`w-6 h-6 grid place-items-center rounded-md border ${tones[tone]}`}>
          <Icon className="w-3 h-3" strokeWidth={2} />
        </div>
      </div>
      <p className="font-display text-base font-semibold text-slate-900 mt-2 truncate">{primary}</p>
      <p className="text-xs font-mono tabular-nums text-slate-700 mt-0.5">{secondary}</p>
      <p className="text-[10px] text-slate-500 mt-1 truncate">{hint}</p>
    </div>
  );
}

function EmployeePassport({ s, periodLabel }: { s: EmployeeStat; periodLabel: string }) {
  const cats = Object.entries(s.byCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]) as [RequestType, number][];
  const maxCat = cats[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-sm font-semibold text-white">
          {initials(s.name)}
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-slate-900">{s.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${deptTone(s.dept)}`}>{s.dept}</span>
            <span className="text-[10px] text-slate-500">EMP-{String(s.id).padStart(3, "0")}</span>
          </div>
        </div>
      </div>

      {/* Request funnel */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Approved" value={s.approvedCount} tone="text-emerald-700" bg="bg-emerald-50" />
        <MiniStat label="Pending" value={s.pendingCount} tone="text-amber-700" bg="bg-amber-50" />
        <MiniStat label="Rejected" value={s.rejectedCount} tone="text-rose-700" bg="bg-rose-50" />
      </div>

      {/* Approved outflow highlight */}
      <div className="border border-slate-200/70 rounded-md p-3 bg-slate-50/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Approved outflow · {periodLabel}</p>
        <p className="font-display text-xl font-semibold text-slate-900 mt-1 tabular-nums">{fmtINR(s.approvedSpend)}</p>
        {s.pendingSpend > 0 && (
          <p className="text-[10px] text-amber-700 mt-0.5">+ {fmtINR(s.pendingSpend)} pending review</p>
        )}
      </div>

      {/* Category mix */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Spend by category
        </p>
        {cats.length === 0 ? (
          <p className="text-[11px] text-slate-500">No amounted requests yet.</p>
        ) : (
          <div className="space-y-1.5">
            {cats.slice(0, 5).map(([c, v]) => (
              <div key={c} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-600 w-20 truncate">{typeLabels[c]}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-800 rounded-full" style={{ width: `${(v / maxCat) * 100}%` }} />
                </div>
                <span className="text-[10px] font-mono tabular-nums text-slate-600 w-16 text-right">{fmtINR(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Behavioural badges */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {s.reqCount >= 3 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
            <Repeat className="w-2.5 h-2.5" /> Frequent requester
          </span>
        )}
        {s.rejectedCount >= 1 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
            Reject history
          </span>
        )}
        {s.approvedSpend >= 100000 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
            <ArrowUpRight className="w-2.5 h-2.5" /> Big-ticket buyer
          </span>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, bg }: { label: string; value: number; tone: string; bg: string }) {
  return (
    <div className={`${bg} rounded-md py-2`}>
      <p className={`font-display text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}
