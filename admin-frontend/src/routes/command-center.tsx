import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { request } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";
import {
  Activity, TrendingUp, AlertTriangle, CheckCircle2,
  MapPin, Clock, IndianRupee, Zap, BarChart3, Users, ArrowUpRight
} from "lucide-react";

export const Route = createFileRoute("/command-center")({
  head: () => ({
    meta: [
      { title: "Command Center — RequestHub" },
      { name: "description", content: "Super Admin command center with live center health, budget burn rate, and peer comparison." },
    ],
  }),
  component: CommandCenter,
});

const fmt = (n: number) => `₹${(n / 1000).toFixed(0)}k`;
const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

interface CenterHealth {
  code: string; name: string; city: string; is_active: boolean;
  allocated: number; committed: number; spent: number;
  pending_requests: number; total_requests: number;
  avg_response_hrs: number; burn_pct: number;
  health: "green" | "amber" | "red"; admin_name: string;
}

interface BurnRate {
  center_code: string; name: string; city: string;
  allocated: number; spent: number;
  projected_spend: number; days_left: number;
  days_until_empty: number; overrun: boolean; overrun_amount: number;
}

interface PeerRow {
  code: string; name: string; city: string;
  total_requests: number; approved: number; rejected: number;
  pending: number; avg_response_hrs: number; total_spent: number;
}

interface ActivityItem {
  action: string; note: string; created_at: string;
  actor: string; employee: string; ref_id: string;
  type: string; amount: number | null; center_name: string;
}

const HEALTH_CONFIG = {
  green: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", dot: "#22c55e", label: "Healthy" },
  amber: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", dot: "#fbbf24", label: "Watch" },
  red:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  dot: "#ef4444", label: "Alert" },
};

function AnimatedBurnBar({ spent, allocated, overrun }: { spent: number; allocated: number; overrun: boolean }) {
  const pct = Math.min(allocated > 0 ? (spent / allocated) * 100 : 0, 100);
  const color = overrun ? "#ef4444" : pct > 70 ? "#f97316" : "#22c55e";
  return (
    <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, height: "100%",
        width: `${pct}%`, borderRadius: 4, background: color,
        transition: "width 1s ease", boxShadow: `0 0 8px ${color}60`,
      }} />
    </div>
  );
}

function CenterHealthCard({ c }: { c: CenterHealth }) {
  const cfg = HEALTH_CONFIG[c.health];
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: "24px 22px", transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 12px 40px ${cfg.border}`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "none"; el.style.boxShadow = "none"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }} />
            <span style={{ fontSize: 11, color: cfg.dot, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{cfg.label}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{c.name}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={11} /> {c.city}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
          {c.code}
        </div>
      </div>

      {/* Budget */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Budget Burn</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{c.burn_pct}% of {fmt(c.allocated)}</span>
        </div>
        <AnimatedBurnBar spent={c.spent} allocated={c.allocated} overrun={c.burn_pct > 90} />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
        {[
          { label: "Pending", value: c.pending_requests, color: "#fbbf24" },
          { label: "Avg Resp", value: `${c.avg_response_hrs}h`, color: "#a78bfa" },
          { label: "Total Req", value: c.total_requests, color: "#38bdf8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
      {c.admin_name && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={12} color="#64748b" />
          <span style={{ fontSize: 11, color: "#64748b" }}>{c.admin_name}</span>
        </div>
      )}
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const ACT_COLOR: Record<string, string> = { approved: "#22c55e", rejected: "#ef4444", queued: "#fbbf24", info_requested: "#a78bfa" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "flex-start" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACT_COLOR[item.action] ?? "#64748b", marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.ref_id} — {item.actor} <span style={{ color: ACT_COLOR[item.action] ?? "#64748b" }}>{item.action}</span>
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{item.employee} · {item.center_name}</div>
          </div>
          {item.amount && <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", flexShrink: 0 }}>{fmtFull(item.amount)}</span>}
        </div>
      ))}
    </div>
  );
}

function CommandCenter() {
  const sessionUser = useSessionUser();
  const [centers, setCenters]   = useState<CenterHealth[]>([]);
  const [burnData, setBurnData] = useState<BurnRate[]>([]);
  const [peers, setPeers]       = useState<PeerRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [panel, setPanel]       = useState<"health" | "burn" | "peers">("health");
  const [loading, setLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const [h, b, p, a] = await Promise.all([
        request<CenterHealth[]>("/api/dashboard/command-center"),
        request<BurnRate[]>("/api/dashboard/burn-rate"),
        request<PeerRow[]>("/api/dashboard/peer-comparison"),
        request<ActivityItem[]>("/api/dashboard/activity-feed"),
      ]);
      setCenters(h); setBurnData(b); setPeers(p); setActivity(a);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  // Auto-refresh every 60s
  useEffect(() => { const t = setInterval(fetchAll, 60000); return () => clearInterval(t); }, [fetchAll]);

  const redCount   = centers.filter(c => c.health === "red").length;
  const amberCount = centers.filter(c => c.health === "amber").length;

  return (
    <DashboardLayout workspace="Command Center" currentUser={sessionUser?.name ?? ""} role={sessionUser?.dept || "Executive Oversight"}>
      <div style={{ minHeight: "100vh", background: "#070c19", fontFamily: "'Inter', sans-serif", padding: "32px 28px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Activity size={18} color="#6366f1" />
              <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Super Admin</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#fff" }}>Command Center</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
              Last updated: {lastUpdated.toLocaleTimeString("en-IN")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {redCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", padding: "8px 16px", borderRadius: 20 }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>{redCount} Alert{redCount > 1 ? "s" : ""}</span>
              </div>
            )}
            {amberCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", padding: "8px 16px", borderRadius: 20 }}>
                <Zap size={14} color="#fbbf24" />
                <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>{amberCount} Watch</span>
              </div>
            )}
            <button onClick={() => void fetchAll()} style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", borderRadius: 20, padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>
          {/* Main Panel */}
          <div>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 4, marginBottom: 28 }}>
              {([
                { key: "health", label: "Center Health", icon: CheckCircle2 },
                { key: "burn",   label: "Burn Rate",     icon: TrendingUp   },
                { key: "peers",  label: "Peer Ranking",  icon: BarChart3    },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setPanel(key)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  background: panel === key ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "transparent",
                  color: panel === key ? "#fff" : "#475569", fontWeight: 700, fontSize: 13, transition: "all 0.2s",
                }}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {/* Health Panel */}
            {panel === "health" && !loading && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {centers.map(c => <CenterHealthCard key={c.code} c={c} />)}
              </div>
            )}

            {/* Burn Rate Panel */}
            {panel === "burn" && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {burnData.map(b => (
                  <div key={b.center_code} style={{
                    background: b.overrun ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${b.overrun ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 18, padding: "22px 26px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{b.city}</div>
                      </div>
                      {b.overrun ? (
                        <div style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: 10, padding: "4px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <ArrowUpRight size={13} /> Overrun by {fmtFull(b.overrun_amount)}
                        </div>
                      ) : (
                        <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>
                          {b.days_until_empty} days runway
                        </div>
                      )}
                    </div>
                    <AnimatedBurnBar spent={b.spent} allocated={b.allocated} overrun={b.overrun} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Spent: {fmtFull(b.spent)}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Projected: {fmtFull(b.projected_spend)} / {fmtFull(b.allocated)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Peer Comparison Panel */}
            {panel === "peers" && !loading && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                      {["Rank", "Center", "Requests", "Approved", "Pending", "Avg Response", "Total Spend"].map(h => (
                        <th key={h} style={{ padding: "14px 18px", fontSize: 11, color: "#475569", fontWeight: 700, textAlign: "left", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {peers.map((p, i) => (
                      <tr key={p.code} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? "#fbbf24" : "#64748b" }}>#{i + 1}</span>
                          {i === 0 && <span style={{ marginLeft: 6, fontSize: 13 }}>⭐</span>}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{p.city}</div>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{p.total_requests}</td>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 600, color: "#22c55e" }}>{p.approved}</td>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 600, color: p.pending > 5 ? "#ef4444" : "#fbbf24" }}>{p.pending}</td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: p.avg_response_hrs > 12 ? "#ef4444" : p.avg_response_hrs > 6 ? "#fbbf24" : "#22c55e" }}>
                            {p.avg_response_hrs}h
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{fmtFull(p.total_spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Feed Sidebar */}
          <div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Activity size={15} color="#22c55e" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Live Activity</span>
                <div style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              </div>
              {activity.length > 0 ? <ActivityFeed items={activity} /> : (
                <div style={{ textAlign: "center", color: "#475569", padding: "30px 0", fontSize: 13 }}>No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
