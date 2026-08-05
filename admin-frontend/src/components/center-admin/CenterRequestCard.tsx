import { useState } from "react";

export interface CenterRequest {
  id: number;
  ref_id: string;
  type: string;
  subject: string;
  amount: number | null;
  priority: string;
  status: string;
  created_at: string;
  employeeName: string;
  email: string;
  employeeDept: string;
  home_center_code: string;
  request_center_code?: string;
  charge_center_code?: string;
  assignment_type?: string;
  can_act?: boolean;
}

const fmt = (n: number | null) => (n != null ? `₹${n.toLocaleString("en-IN")}` : "—");

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#6366f1", low: "#94a3b8",
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  pending: { bg: "rgba(251,191,36,0.15)", label: "Pending" },
  approved: { bg: "rgba(34,197,94,0.15)", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.15)", label: "Rejected" },
  awaiting_verification: { bg: "rgba(99,102,241,0.15)", label: "In Verification" },
};

interface Props {
  req: CenterRequest;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export function CenterRequestCard({ req, onApprove, onReject }: Props) {
  const [loading, setLoading] = useState(false);
  const badge = STATUS_BADGE[req.status] ?? { bg: "rgba(148,163,184,0.15)", label: req.status };
  const prioColor = PRIORITY_COLORS[req.priority] ?? "#94a3b8";

  const act = async (type: "approve" | "reject") => {
    setLoading(true);
    if (type === "approve") onApprove(req.id);
    else onReject(req.id);
    setLoading(false);
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: prioColor, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: 1 }}>{req.ref_id}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>{req.subject}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {req.employeeName} · {req.employeeDept}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{
            background: badge.bg, color: "#e2e8f0", borderRadius: 20,
            padding: "3px 10px", fontSize: 11, fontWeight: 600,
          }}>
            {badge.label}
          </span>
          {req.amount != null && (
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{fmt(req.amount)}</span>
          )}
        </div>
      </div>
      {req.status === "pending" && req.can_act !== false && (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void act("approve")}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff",
              fontWeight: 700, fontSize: 13,
            }}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => void act("reject")}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)",
              cursor: "pointer", background: "rgba(239,68,68,0.1)", color: "#ef4444",
              fontWeight: 700, fontSize: 13,
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
