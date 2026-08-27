import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, Users, X } from "lucide-react";
import { PaginationBar } from "@/components/PaginationBar";
import { fmtINR } from "@/components/requestMeta";
import { EmployeePassport } from "./EmployeePassport";
import { departmentTone, employeeInitials, type EmployeeStat } from "./peopleInsightsData";

const PAGE_SIZE = 10;

export function SpendLeaderboard({
  stats,
  periodLabel,
}: {
  stats: EmployeeStat[];
  periodLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(stats[0]?.id ?? null);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return stats;
    return stats.filter((row) =>
      `${row.name} ${row.dept} ${row.company} ${row.center} emp-${String(row.id).padStart(3, "0")}`
        .toLowerCase()
        .includes(value),
    );
  }, [query, stats]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = stats.find((row) => row.id === openId) ?? null;
  const maxApproved = Math.max(...stats.map((row) => row.approvedSpend), 1);

  useEffect(() => {
    setPage(1);
  }, [query]);
  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);
  useEffect(() => {
    if (filtered.length && !filtered.some((row) => row.id === openId)) setOpenId(filtered[0].id);
    if (!filtered.length) setOpenId(null);
  }, [filtered, openId]);

  const changePage = (next: number) => {
    setPage(next);
    const first = filtered[(next - 1) * PAGE_SIZE];
    if (first) setOpenId(first.id);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white lg:col-span-3">
        <div className="space-y-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Spend leaderboard
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Approved spend ranking · select an employee for details · {periodLabel}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-500">
              <Users className="h-3 w-3" />
              {query ? `${filtered.length} of ${stats.length}` : stats.length} employees
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee, department, company or ID…"
              aria-label="Search spend leaderboard employees"
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/70 pl-9 pr-9 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear employee search"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.map((row) => {
            const rank = stats.findIndex((item) => item.id === row.id) + 1;
            const active = row.id === openId;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenId(row.id)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50/70 sm:px-5 ${active ? "bg-slate-50" : ""}`}
              >
                <div className="grid grid-cols-[24px_36px_minmax(0,1fr)_20px] items-center gap-2 sm:grid-cols-[24px_36px_minmax(0,1fr)_110px_20px] sm:gap-3">
                  <span className="font-mono text-[10px] tabular-nums text-slate-400">#{rank}</span>
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold text-white">
                    {employeeInitials(row.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                      <span
                        className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-medium md:inline ${departmentTone(row.dept)}`}
                      >
                        {row.dept}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-slate-800 to-slate-500"
                        style={{ width: `${(row.approvedSpend / maxApproved) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-[10px] text-slate-500">
                      {row.company} · {row.center} · {row.reqCount} requests
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {fmtINR(row.approvedSpend)}
                    </p>
                    <p className="text-[10px] text-slate-400">approved</p>
                  </div>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-slate-300 transition-transform ${active ? "rotate-90 text-slate-600" : ""}`}
                  />
                </div>
              </button>
            );
          })}
          {!visible.length && (
            <div className="px-5 py-12 text-center">
              <Search className="mx-auto h-5 w-5 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-600">No employee found</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Try another name, department, company or employee ID.
              </p>
            </div>
          )}
        </div>
        <PaginationBar
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={changePage}
        />
      </div>

      <div className="self-start rounded-lg border border-slate-200/70 bg-white p-5 lg:sticky lg:top-16 lg:col-span-2">
        {selected ? (
          <EmployeePassport employee={selected} periodLabel={periodLabel} />
        ) : (
          <p className="py-10 text-center text-xs text-slate-500">Select an employee to inspect.</p>
        )}
      </div>
    </div>
  );
}
