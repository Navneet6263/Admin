import { AlertTriangle, Flame, Ban, TrendingDown, Clock, Sparkles } from "lucide-react";
import { type RequestItem } from "@/components/models";
import { buildHistory, fmtINR } from "./shared";

function AnomalyCard({ tone, icon: Icon, title, body }: {
  tone: "rose" | "amber" | "emerald" | "indigo";
  icon: typeof AlertTriangle; title: string; body: string;
}) {
  const tones = {
    rose: "border-rose-100 bg-rose-50/50 text-rose-700",
    amber: "border-amber-100 bg-amber-50/50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-700",
    indigo: "border-indigo-100 bg-indigo-50/50 text-indigo-700",
  };
  return <div className={`border rounded-md p-4 ${tones[tone]}`}>
    <div className="flex items-center gap-2 text-xs font-semibold"><Icon className="w-3.5 h-3.5" />{title}</div>
    <p className="text-xs text-slate-800 mt-2 leading-relaxed">{body}</p>
  </div>;
}

export function AnomaliesTab({ requests }: { requests: RequestItem[] }) {
  const history = buildHistory(requests);
  const travelNow = history.heat.at(-1)?.[0] ?? 0;
  const travelPrior = history.heat.at(-2)?.[0] ?? 0;
  const travelDelta = travelPrior ? Math.round((travelNow - travelPrior) / travelPrior * 100) : null;
  const foodPeak = history.heat.map((row, i) => ({ value: row[6], month: history.MONTHS[i] })).sort((a, b) => b.value - a.value)[0];
  const rejected = requests.reduce<Record<string, number>>((sum, row) => {
    if (row.status === "rejected") sum[row.employeeName] = (sum[row.employeeName] ?? 0) + 1;
    return sum;
  }, {});
  const highRejector = Object.entries(rejected).sort((a, b) => b[1] - a[1])[0];
  const stationeryNow = history.heat.slice(-3).reduce((sum, row) => sum + row[2], 0);
  const stationeryPrior = history.heat.slice(-6, -3).reduce((sum, row) => sum + row[2], 0);
  const stationeryDelta = stationeryPrior ? Math.round((stationeryNow - stationeryPrior) / stationeryPrior * 100) : null;
  const closedTravel = requests.filter(row => row.type === "travel" && ["approved", "rejected"].includes(row.status));
  const travelTat = closedTravel.length ? Math.round(closedTravel.reduce((sum, row) =>
    sum + (+new Date(row.updatedAt) - +new Date(row.createdAt)) / 3_600_000, 0) / closedTravel.length) : null;
  const spend = requests.filter(row => row.status === "approved").reduce<Record<string, number>>((sum, row) => {
    sum[row.employeeName] = (sum[row.employeeName] ?? 0) + (row.amount ?? 0); return sum;
  }, {});
  const values = Object.values(spend).sort((a, b) => b - a);
  const total = values.reduce((sum, value) => sum + value, 0);
  const topShare = total ? Math.round(values.slice(0, 3).reduce((sum, value) => sum + value, 0) / total * 100) : null;

  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-[1400px] mx-auto">
    <AnomalyCard tone="rose" icon={AlertTriangle} title="Travel movement" body={travelDelta === null ? "Not enough database history to compare travel spend." : `Travel outflow is ${Math.abs(travelDelta)}% ${travelDelta >= 0 ? "higher" : "lower"} than last month.`} />
    <AnomalyCard tone="amber" icon={Flame} title="Catering peak" body={foodPeak?.value ? `Fooding spend peaked at ${fmtINR(foodPeak.value)} in ${foodPeak.month}.` : "No fooding spend is recorded in the last 12 months."} />
    <AnomalyCard tone="rose" icon={Ban} title="Rejection outlier" body={highRejector ? `${highRejector[0]} has the highest rejection count: ${highRejector[1]}.` : "No rejected request is recorded."} />
    <AnomalyCard tone="emerald" icon={TrendingDown} title="Stationery movement" body={stationeryDelta === null ? "Not enough database history to compare stationery spend." : `Last 3-month spend is ${Math.abs(stationeryDelta)}% ${stationeryDelta >= 0 ? "higher" : "lower"} than the prior 3 months.`} />
    <AnomalyCard tone="indigo" icon={Clock} title="Travel turnaround" body={travelTat === null ? "No closed travel request is available for analysis." : `Closed travel requests average ${travelTat} hours to decision.`} />
    <AnomalyCard tone="amber" icon={Sparkles} title="Spend concentration" body={topShare === null ? "No approved spend is available for analysis." : `Top 3 employees account for ${topShare}% of approved recorded spend.`} />
  </div>;
}
