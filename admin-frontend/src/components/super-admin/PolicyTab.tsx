import { useCallback, useEffect, useState } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { request } from "@/lib/api";
import { PolicyEditor } from "./PolicyEditor";

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
  const load = useCallback(async () => {
    const [p, u, c] = await Promise.all([
      request<Policy[]>("/api/super-admin/policies"),
      request<PolicyUser[]>("/api/super-admin/users"),
      request<PolicyCenter[]>("/api/centers"),
    ]);
    setRows(p);
    setUsers(u);
    setCenters(c);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const toggle = async (policy: Policy) => {
    await request(`/api/super-admin/policies/${policy.id}`, {
      method: "PATCH",
      body: { ...policy, is_active: !policy.is_active },
    });
    await load();
  };
  return (
    <div className="space-y-4">
      <PolicyEditor users={users} centers={centers} onCreated={load} />
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
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
            {rows.map((p) => (
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
                  <button onClick={() => void toggle(p)}>
                    {p.is_active ? (
                      <ToggleRight className="text-emerald-600" />
                    ) : (
                      <ToggleLeft className="text-slate-400" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
