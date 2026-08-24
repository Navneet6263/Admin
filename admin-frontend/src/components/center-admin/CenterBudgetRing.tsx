interface BudgetRingProps {
  allocated: number;
  spent: number;
  committed: number;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function CenterBudgetRing({ allocated, spent, committed }: BudgetRingProps) {
  const spentPct = pct(spent, allocated);
  const spentArcPct = Math.min(spentPct, 100);
  const committedPct = Math.max(0, Math.min(pct(committed, allocated), 100 - spentArcPct));
  const r = 56;
  const circ = 2 * Math.PI * r;
  const spentDash = (spentArcPct / 100) * circ;
  const commitDash = (committedPct / 100) * circ;
  const color = spentPct > 90 ? "#ef4444" : spentPct > 70 ? "#f97316" : "#22c55e";

  return (
    <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
      <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="#e2e8f0" strokeWidth={14} />
        <circle
          cx={70} cy={70} r={r} fill="none" stroke="rgba(251,191,36,0.5)"
          strokeWidth={14} strokeDasharray={`${commitDash} ${circ}`}
          strokeDashoffset={-spentDash} strokeLinecap="round"
        />
        <circle
          cx={70} cy={70} r={r} fill="none" stroke={color}
          strokeWidth={14} strokeDasharray={`${spentDash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{spentPct}%</span>
        <span style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Spent</span>
      </div>
    </div>
  );
}
