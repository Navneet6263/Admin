import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { request } from "@/lib/api";
import type { PolicyCenter, PolicyUser } from "./PolicyTab";

const roles = ["center_admin", "hq_admin", "finance", "finance_head", "super_admin"];
const categories = [
  "id_card",
  "visiting_card",
  "stationery",
  "travel",
  "courier",
  "meeting_room",
  "fooding",
];
const field = "border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white";
export function PolicyEditor({
  users,
  centers,
  onCreated,
}: {
  users: PolicyUser[];
  centers: PolicyCenter[];
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    role: "center_admin",
    user_id: "",
    center_code: "",
    category: "",
    max_amount: "50000",
    can_approve: true,
    can_update_payment: true,
    can_verify_payment: false,
    can_view_analytics: false,
  });
  const create = async () => {
    await request("/api/super-admin/policies", {
      method: "POST",
      body: {
        ...form,
        user_id: form.user_id ? Number(form.user_id) : null,
        center_code: form.center_code || null,
        category: form.category || null,
        max_amount: form.max_amount ? Number(form.max_amount) : null,
        can_view: true,
      },
    });
    await onCreated();
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4" />
        <div>
          <h2 className="text-sm font-semibold">Approval & access policy</h2>
          <p className="text-xs text-slate-500">
            Blank user, center or category creates a reusable default.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <select
          className={field}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          {roles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
        <select
          className={field}
          value={form.user_id}
          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
        >
          <option value="">All users in role</option>
          {users
            .filter((u) => u.role === form.role)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
        <select
          className={field}
          value={form.center_code}
          onChange={(e) => setForm({ ...form, center_code: e.target.value })}
        >
          <option value="">All centers</option>
          {centers.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
        <select
          className={field}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          className={field}
          type="number"
          placeholder="Unlimited"
          value={form.max_amount}
          onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        {(
          [
            ["can_approve", "Approve"],
            ["can_update_payment", "Update payment"],
            ["can_verify_payment", "Verify payment"],
            ["can_view_analytics", "Analytics"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex gap-2">
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <button
        onClick={() => void create()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold"
      >
        <Plus className="w-3.5 h-3.5" />
        Add policy
      </button>
    </div>
  );
}
