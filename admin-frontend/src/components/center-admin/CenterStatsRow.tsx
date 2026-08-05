import {
  Clock, CheckCircle2, AlertTriangle, BarChart3, type LucideIcon,
} from "lucide-react";

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  awaiting_verification: number;
  total: number;
  avg_response_hrs: number;
}

const CELLS: { label: string; key: keyof Stats | "avg"; icon: LucideIcon; color: string }[] = [
  { label: "Pending", key: "pending", icon: AlertTriangle, color: "#fbbf24" },
  { label: "Approved", key: "approved", icon: CheckCircle2, color: "#22c55e" },
  { label: "Avg Response", key: "avg", icon: Clock, color: "#a78bfa" },
  { label: "Total", key: "total", icon: BarChart3, color: "#38bdf8" },
];

export function CenterStatsRow({ stats }: { stats: Stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
      {CELLS.map(({ label, key, icon: Icon, color }) => {
        const value = key === "avg" ? `${stats.avg_response_hrs}h` : stats[key];
        return (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{
                  fontSize: 11, color: "#64748b", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: 1,
                }}>
                  {label}
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
              </div>
              <div style={{ background: `${color}18`, borderRadius: 12, padding: 10 }}>
                <Icon size={20} color={color} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
