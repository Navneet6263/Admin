import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Search, X } from "lucide-react";
import { TablePagination } from "@/components/TablePagination";
import { request } from "@/lib/api";
import { TableLoadingSkeleton } from "@/components/LoadingSkeletons";
interface Row {
  center_code: string;
  type: string;
  request_count: number;
  total_spend: number;
  paid_count: number;
  pending_count: number;
}
export function ExpenseAnalytics({ centerCode = "" }: { centerCode?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const center = centerCode ? `?center_code=${encodeURIComponent(centerCode)}` : "";
    setLoading(true); setError("");
    request<Row[]>(`/api/payments/analytics/summary${center}`).then(setRows)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Expense ledger could not be loaded"))
      .finally(() => setLoading(false));
  }, [centerCode]);
  const total = useMemo(() => rows.reduce((n, r) => n + Number(r.total_spend), 0), [rows]);
  const pending = rows.reduce((n, r) => n + Number(r.pending_count), 0);
  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter(
      (row) =>
        row.center_code.toLowerCase().includes(value) ||
        row.type.replaceAll("_", " ").toLowerCase().includes(value),
    );
  }, [query, rows]);
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );
  useEffect(() => setPage(1), [centerCode, pageSize, query]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold flex gap-2">
            <CircleDollarSign className="w-4 h-4 text-emerald-600" />
            Live expense ledger
          </h2>
          <p className="text-xs text-slate-500">
            Final/estimated spend charged to employee home centers
          </p>
        </div>
        <div className="text-right">
          <b className="text-xl">₹{total.toLocaleString("en-IN")}</b>
          <p className="text-[10px] text-amber-600">{pending} payment actions open</p>
        </div>
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search charge center or category…"
          aria-label="Search expense ledger"
          className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/70 pl-9 pr-9 text-xs text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200/70"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear expense search"
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {loading ? <TableLoadingSkeleton rows={6} columns={6} /> : <div className="overflow-hidden rounded-md border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 text-slate-500 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
              <tr>
                {["Charge center", "Category", "Requests", "Paid", "Pending", "Spend"].map((h) => (
                  <th key={h} className="text-left p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={`${r.center_code}-${r.type}`} className="border-t">
                  <td className="p-2 font-semibold">{r.center_code}</td>
                  <td className="p-2">{r.type}</td>
                  <td className="p-2">{r.request_count}</td>
                  <td className="p-2 text-emerald-600">{r.paid_count}</td>
                  <td className="p-2 text-amber-600">{r.pending_count}</td>
                  <td className="p-2 font-mono">
                    ₹{Number(r.total_spend).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    No expense rows match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
      }
    </section>
  );
}
