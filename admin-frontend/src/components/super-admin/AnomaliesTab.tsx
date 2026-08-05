import { AlertTriangle, Flame, Ban, TrendingDown, Clock, Sparkles } from "lucide-react";
import { type RequestItem } from "@/components/models";
import { heat, fmtINR } from "./shared";

function AnomalyCard({ tone, icon: Icon, title, body, action }: {
  tone: "rose"|"amber"|"emerald"|"indigo";
  icon: typeof AlertTriangle;
  title: string; body: string; action: string;
}) {
  const tones = {
    rose:    "border-rose-100 bg-rose-50/50 text-rose-700",
    amber:   "border-amber-100 bg-amber-50/50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-700",
    indigo:  "border-indigo-100 bg-indigo-50/50 text-indigo-700",
  };
  return (
    <div className={`border rounded-md p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <p className="text-xs text-slate-800 mt-2 leading-relaxed">{body}</p>
      <button className="text-[11px] font-medium mt-3 hover:underline">{action} →</button>
    </div>
  );
}

export function AnomaliesTab({ requests }: { requests: RequestItem[] }) {
  const travelDelta = Math.round(((heat[11][0] - heat[10][0]) / heat[10][0]) * 100);
  const foodPeak    = heat[4][6];

  const rejectionsByEmp = requests.reduce<Record<string, number>>((acc, r) => {
    if (r.status === "rejected") acc[r.employeeName] = (acc[r.employeeName] ?? 0) + 1;
    return acc;
  }, {});
  const highRejector = Object.entries(rejectionsByEmp).sort((a,b) => b[1]-a[1])[0];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnomalyCard tone="rose" icon={AlertTriangle} title="Travel spike"
          body={`July travel outflow is ${Math.abs(travelDelta)}% ${travelDelta>=0?"higher":"lower"} than June. Q3 offsites likely driver.`}
          action="Investigate top travelers" />
        <AnomalyCard tone="amber" icon={Flame} title="Catering spend peak"
          body={`Food & catering peaked at ${fmtINR(foodPeak)} in Dec — festive events cycle. Plan Q4 budget accordingly.`}
          action="Review Q4 capex plan" />
        <AnomalyCard tone="rose" icon={Ban} title="Rejection outlier"
          body={highRejector
            ? `${highRejector[0]} has ${highRejector[1]} rejected requests — highest in group. Review approval clarity.`
            : "No employee has crossed the rejection threshold."}
          action="Open employee passport" />
        <AnomalyCard tone="emerald" icon={TrendingDown} title="Stationery declining"
          body="Stationery ordering down 32% YoY — hybrid work reducing consumption. Consider vendor renegotiation."
          action="Renegotiate contract" />
        <AnomalyCard tone="indigo" icon={Clock} title="TAT breach"
          body="Travel requests averaging >120h to close — SLA is 72h. Bottleneck at Verifier stage."
          action="Escalate to Verifier" />
        <AnomalyCard tone="amber" icon={Sparkles} title="Concentration risk"
          body="Top 3 employees drive 41% of approved outflow YTD. Review authorization limits."
          action="Set per-user caps" />
      </div>
    </div>
  );
}
