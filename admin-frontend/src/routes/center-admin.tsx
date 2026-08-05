import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { request } from "@/lib/api";
import {
  MapPin, Clock, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Inbox, IndianRupee, Building2, Users, BarChart3
} from "lucide-react";

export const Route = createFileRoute("/center-admin")({
  head: () => ({
    meta: [
      { title: "Center Admin — RequestHub" },
      { name: "description", content: "Center-wise request management dashboard for center administrators." },
    ],
  }),
  component: CenterAdminDashboard,
});

interface CenterRequest {
  id: number; ref_id: string; type: string; subject: string;
  amount: number | null; priority: string; status: string;
  created_at: string; employeeName: string; email: string;
  employeeDept: string; home_center_code: string;
}

interface Budget {
  center_name: string; city: string;
  allocated: number; committed: number; spent: number;
}

interface Stats {
  pending: number; approved: number; rejected: number;
  awaiting_verification: number; total: number; avg_response_hrs: number;
}

const API = "http://localhost:3001";
const fmt = (n: number | null) => n != null ? `₹${n.toLocaleString("en-IN")}` : "—";
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#6366f1", low: "#94a3b8"
};
const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  pending: { bg: "rgba(251,191,36,0.15)", label: "Pending" },
  approved: { bg: "rgba(34,197,94,0.15)", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.15)", label: "Rejected" },
  awaiting_verification: { bg: "rgba(99,102,241,0.15)", label: "In Verification" },
};

function BudgetRing({ allocated, spent, committed }: { allocated: number; spent: number; committed: number }) {
  const spentPct   = pct(spent, allocated);
  const committedPct = Math.min(pct(committed, allocated), 100 - spentPct);
  const r = 56; const circ = 2 * Math.PI * r;

  const spentDash   = (spentPct / 100) * circ;
  const commitDash  = (committedPct / 100) * circ;
  const color = spentPct > 90 ? "#ef4444" : spentPct > 70 ? "#f97316" : "#22c55e";

  return (
    <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
      <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
        <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(251,191,36,0.5)"
          strokeWidth={14} strokeDasharray={`${commitDash} ${circ}`}
          strokeDashoffset={-spentDash} strokeLinecap="round" />
        <circle cx={70} cy={70} r={r} fill="none" stroke={color}
          strokeWidth={14} strokeDasharray={`${spentDash} ${circ}`}
          strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{spentPct}%</span>
        <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Spent</span>
      </div>
    </div>
  );
}

function RequestCard({ req, onApprove, onReject }: { req: CenterRequest; onApprove: (id: number) => void; onReject: (id: number) => void }) {
  const [loading, setLoading] = useState(false);
  const badge = STATUS_BADGE[req.status] ?? { bg: "rgba(148,163,184,0.15)", label: req.status };
  const prioColor = PRIORITY_COLORS[req.priority] ?? "#94a3b8";

  const act = async (type: "approve" | "reject") => {
    setLoading(true);
    if (type === "approve") onApprove(req.id); else onReject(req.id);
    setLoading(false);
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14,
      transition: "all 0.2s", cursor: "default",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: prioColor, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: 1 }}>{req.ref_id}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>{req.subject}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{req.employeeName} · {req.employeeDept}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ background: badge.bg, color: "#e2e8f0", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
          {req.amount && <span style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{fmt(req.amount)}</span>}
        </div>
      </div>
      {req.status === "pending" && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => act("approve")} disabled={loading} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff",
            fontWeight: 700, fontSize: 13, transition: "opacity 0.2s",
          }}>
            ✓ Approve
          </button>
          <button onClick={() => act("reject")} disabled={loading} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)",
            cursor: "pointer", background: "rgba(239,68,68,0.1)", color: "#ef4444",
            fontWeight: 700, fontSize: 13, transition: "opacity 0.2s",
          }}>
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}

function CenterAdminDashboard() {
  const [requests, setRequests] = useState<CenterRequest[]>([]);
  const [budget, setBudget]     = useState<Budget | null>(null);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [tab, setTab]           = useState<"pending" | "approved" | "rejected">("pending");
  const [loading, setLoading]   = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, bud, st] = await Promise.all([
        request<CenterRequest[]>(`${API}/api/center-admin/requests?status=${tab}`),
        request<Budget>(`${API}/api/center-admin/budget`),
        request<Stats>(`${API}/api/center-admin/stats`),
      ]);
      setRequests(reqs); setBudget(bud); setStats(st);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const approve = async (id: number) => {
    await request(`${API}/api/center-admin/requests/${id}/approve`, { method: "POST", body: { remarks: "" } });
    void fetchAll();
  };
  const reject = async (id: number) => {
    await request(`${API}/api/center-admin/requests/${id}/reject`, { method: "POST", body: { remarks: "" } });
    void fetchAll();
  };

  const TABS = [
    { key: "pending", label: "Inbox", icon: Inbox },
    { key: "approved", label: "Approved", icon: CheckCircle2 },
    { key: "rejected", label: "Rejected", icon: XCircle },
  ] as const;

  return (
    <DashboardLayout>
      <div style={{ minHeight: "100vh", background: "#0a0f1e", padding: "32px 24px", fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.15)", padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(99,102,241,0.3)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 13, color: "#c7d2fe", fontWeight: 600 }}>Live</span>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Pending", value: stats.pending, icon: AlertTriangle, color: "#fbbf24" },
              { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "#22c55e" },
              { label: "Avg Response", value: `${stats.avg_response_hrs}h`, icon: Clock, color: "#a78bfa" },
              { label: "Total", value: stats.total, icon: BarChart3, color: "#38bdf8" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
                  </div>
                  <div style={{ background: `${color}18`, borderRadius: 12, padding: 10 }}>
                    <Icon size={20} color={color} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
          {/* Requests Column */}
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setTab(key as any)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: tab === key ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "transparent",
                  color: tab === key ? "#fff" : "#64748b", fontWeight: 700, fontSize: 13, transition: "all 0.2s",
                }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            {/* Request Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: 60 }}>Loading…</div>
              ) : requests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Inbox size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <div>No {tab} requests</div>
                </div>
              ) : requests.map(r => (
                <RequestCard key={r.id} req={r} onApprove={approve} onReject={reject} />
              ))}
            </div>
          </div>

          {/* Budget Sidebar */}
          {budget && (
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                <IndianRupee size={16} color="#fbbf24" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Monthly Budget</span>
              </div>
              <BudgetRing allocated={budget.allocated} spent={budget.spent} committed={budget.committed} />
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
