import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { request, session, type Paged } from "@/lib/api";
import { CenterBudgetRing } from "@/components/center-admin/CenterBudgetRing";
import { CenterRequestCard, type CenterRequest } from "@/components/center-admin/CenterRequestCard";
import { CenterStatsRow } from "@/components/center-admin/CenterStatsRow";
import { CheckCircle2, XCircle, Inbox, IndianRupee, Building2 } from "lucide-react";

export const Route = createFileRoute("/center-admin")({
  head: () => ({
    meta: [
      { title: "Center Admin — RequestHub" },
      { name: "description", content: "Center-wise request management for center administrators." },
    ],
  }),
  component: CenterAdminDashboard,
});

interface Budget {
  center_name: string; city: string;
  allocated: number; committed: number; spent: number;
}

interface Stats {
  pending: number; approved: number; rejected: number;
  awaiting_verification: number; total: number; avg_response_hrs: number;
}

const fmt = (n: number | null) => (n != null ? `₹${n.toLocaleString("en-IN")}` : "—");

function CenterAdminDashboard() {
  const [requests, setRequests] = useState<CenterRequest[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(true);
  const user = session.user;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const workflowStatus = tab === "pending" ? "awaiting_approval" : tab;
      const [reqs, bud, st] = await Promise.all([
        request<Paged<CenterRequest>>(`/api/workflow/queue?status=${workflowStatus}&page_size=100`),
        request<Budget>("/api/center-admin/budget"),
        request<Stats>("/api/center-admin/stats"),
      ]);
      setRequests(reqs.data); setBudget(bud); setStats(st);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const approve = async (id: number) => {
    await request(`/api/workflow/requests/${id}/approve`, { method: "POST", body: { remarks: "" } });
    void fetchAll();
  };
  const reject = async (id: number) => {
    await request(`/api/workflow/requests/${id}/reject`, { method: "POST", body: { remarks: "" } });
    void fetchAll();
  };

  const TABS = [
    { key: "pending" as const, label: "Inbox", icon: Inbox },
    { key: "approved" as const, label: "Approved", icon: CheckCircle2 },
    { key: "rejected" as const, label: "Rejected", icon: XCircle },
  ];

  return (
    <DashboardLayout
      workspace="Center Console"
      role="Center Admin"
      currentUser={user ? `${user.name} · ${user.center_code || "—"}` : "Center Admin"}
    >
      <div style={{ minHeight: "100vh", background: "#0a0f1e", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Building2 size={20} color="#6366f1" />
              <span style={{ fontSize: 13, color: "#6366f1", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                {budget?.center_name ?? "Center Admin"} · {budget?.city ?? ""}
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0 }}>Request Console</h1>
          </div>
        </div>

        {stats && <CenterStatsRow stats={stats} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setTab(key)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: tab === key ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "transparent",
                  color: tab === key ? "#fff" : "#64748b", fontWeight: 700, fontSize: 13,
                }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: 60 }}>Loading…</div>
              ) : requests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Inbox size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <div>No {tab} requests</div>
                </div>
              ) : requests.map((r) => (
                <CenterRequestCard key={r.id} req={r} onApprove={approve} onReject={reject} />
              ))}
            </div>
          </div>

          {budget && (
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                <IndianRupee size={16} color="#fbbf24" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
                  Monthly Budget
                </span>
              </div>
              <CenterBudgetRing allocated={budget.allocated} spent={budget.spent} committed={budget.committed} />
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Allocated", value: budget.allocated, color: "#94a3b8" },
                  { label: "Spent", value: budget.spent, color: "#ef4444" },
                  { label: "Committed", value: budget.committed, color: "#fbbf24" },
                  { label: "Available", value: budget.allocated - budget.spent - budget.committed, color: "#22c55e" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>{fmt(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
