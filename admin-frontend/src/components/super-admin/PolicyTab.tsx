import { useCallback, useEffect, useMemo, useState } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { request } from "@/lib/api";
import { PolicyEditor } from "./PolicyEditor";
import { TableLoadingSkeleton } from "@/components/LoadingSkeletons";
import { TablePagination } from "@/components/TablePagination";

export interface Policy {
  id: number;
  role: string;
  user_id: number | null;
  user_name?: string;
  center_code: string | null;
  category: string | null;
  max_amount: number | null;
  can_view: boolean;
  can_approve: boolean;
  can_update_payment: boolean;
  can_verify_payment: boolean;
  can_view_analytics: boolean;
  is_active: boolean;
}
export interface PolicyUser {
  id: number;
  name: string;
  role: string;
}
export interface PolicyCenter {
  code: string;
  name: string;
}

export function PolicyTab() {
  const [rows, setRows] = useState<Policy[]>([]);
  const [users, setUsers] = useState<PolicyUser[]>([]);
  const [centers, setCenters] = useState<PolicyCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [p, u, c] = await Promise.all([
        request<Policy[]>("/api/super-admin/policies"),
        request<PolicyUser[]>("/api/super-admin/users"),
        request<PolicyCenter[]>("/api/centers"),
      ]);
      setRows(p); setUsers(u); setCenters(c);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval policies could not be loaded");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const toggle = async (policy: Policy) => {
    const next = !policy.is_active;
    setBusyId(policy.id); setError("");
    setRows((current) => current.map((row) => row.id === policy.id ? { ...row, is_active: next } : row));
    try {
      await request(`/api/super-admin/policies/${policy.id}`, {
        method: "PATCH", body: { ...policy, is_active: next },
      });
    } catch (cause) {
      setRows((current) => current.map((row) => row.id === policy.id ? policy : row));
      setError(cause instanceof Error ? cause.message : "Policy status could not be saved");
    } finally { setBusyId(null); }
  };
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return rows.filter((row) => !value || `${row.role} ${row.user_name || "all"} ${row.center_code || "all"} ${row.category || "all"}`.toLowerCase().includes(value));
  }, [query, rows]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  useEffect(() => setPage(1), [pageSize, query]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);
  return (
    <div className="space-y-4">
      <PolicyEditor users={users} centers={centers} onCreated={load} />
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
      {loading ? <TableLoadingSkeleton rows={6} columns={7} /> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search role, user, center or category…" aria-label="Search approval policies"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-slate-400 focus:bg-white" />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {["Scope", "User", "Center", "Category", "Limit", "Capabilities", "Active"].map(
                (h) => (
                  <th key={h} className="text-left p-3">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold">{p.role}</td>
                <td className="p-3">{p.user_name || "All"}</td>
                <td className="p-3">{p.center_code || "All"}</td>
                <td className="p-3">{p.category || "All"}</td>
                <td className="p-3 font-mono">
                  {p.max_amount == null
                    ? "Unlimited"
                    : `₹${Number(p.max_amount).toLocaleString("en-IN")}`}
                </td>
                <td className="p-3 text-slate-500">
                  {[
                    p.can_approve && "Approve",
                    p.can_update_payment && "Update",
                    p.can_verify_payment && "Verify",
                    p.can_view_analytics && "Analytics",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td className="p-3">
                  <button disabled={busyId === p.id} onClick={() => void toggle(p)} aria-label={`${p.is_active ? "Disable" : "Enable"} ${p.role} policy`} className="disabled:opacity-40">
                    {p.is_active ? (
                      <ToggleRight className="text-emerald-600" />
                    ) : (
                      <ToggleLeft className="text-slate-400" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={7} className="p-10 text-center text-slate-400">No approval policies match this search.</td></tr>}
          </tbody>
        </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      </div>
      }
    </div>
  );
}
