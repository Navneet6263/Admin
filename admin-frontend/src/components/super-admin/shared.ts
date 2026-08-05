// Shared constants, types and helpers used across all super-admin tabs
import { type RequestItem, type RequestType } from "@/components/models";
import { fmtINR } from "@/components/requestMeta";

export const SA = { id: "SA-001", name: "Vikram Rathore", role: "Chief Operating Officer" };
export const actorTag = () => `${SA.name} (${SA.id})`;
export const autoNote = (verb: string, userNote: string) => {
  const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const head = `${verb} by ${actorTag()} · ${ts} IST · Super Admin override`;
  return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
};

export type Tab = "overview" | "analytics" | "inventory" | "override" | "anomalies" | "team" | "centers";

export interface UserRow {
  id: number; name: string; email: string; role: string;
  dept: string; company: string;
  center_code: string | null; center_name: string | null; center_city: string | null;
}
export interface CenterRow {
  id: number; code: string; name: string; city: string; company: string; is_active: boolean;
}

// ---------- Synthetic 12-month history ----------
export const MONTHS = ["Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul"];
export const CATS: RequestType[] = ["travel","courier","stationery","visiting_card","id_card","meeting_room","fooding"];

const seeded = (i: number, j: number) => { const x = Math.sin(i*928.37 + j*17.13)*10000; return x - Math.floor(x); };
const baseSpend: Record<RequestType, number> = {
  travel: 90000, courier: 6000, stationery: 12000,
  visiting_card: 4000, id_card: 3000, meeting_room: 0, fooding: 15000,
};
export const heat = MONTHS.map((_, mi) => CATS.map((c, ci) => {
  const base = baseSpend[c];
  const variance = 0.4 + seeded(mi + 3, ci + 7) * 1.5;
  const seasonal = c === "travel" && (mi === 3 || mi === 11) ? 1.8 : 1;
  return Math.round(base * variance * seasonal);
}));
export const monthTotals = heat.map(row => row.reduce((a,b) => a+b, 0));
export const catTotals   = CATS.map((_, ci) => heat.reduce((a, row) => a + row[ci], 0));
export const grandTotal  = monthTotals.reduce((a,b) => a+b, 0);
export const thisMonth   = monthTotals.at(-1)!;
export const lastMonth   = monthTotals.at(-2)!;
export const monthDelta  = ((thisMonth - lastMonth) / lastMonth) * 100;

const last6 = monthTotals.slice(-6);
export const avg6     = last6.reduce((a,b)=>a+b,0)/6;
export const slope    = (last6.at(-1)! - last6[0]) / 5;
export const forecast = [1,2,3].map(i => Math.max(0, Math.round(avg6 + slope * (2.5 + i))));

export const heatColor = (v: number, maxCell: number) => {
  const t = v / maxCell;
  if (t < 0.15) return "bg-slate-50 text-slate-400";
  if (t < 0.3)  return "bg-sky-50 text-sky-700";
  if (t < 0.5)  return "bg-sky-100 text-sky-800";
  if (t < 0.7)  return "bg-indigo-200 text-indigo-900";
  if (t < 0.85) return "bg-indigo-400 text-white";
  return "bg-indigo-600 text-white";
};

export function buildHistory(requests: RequestItem[]) {
  const dates = Array.from({ length: 12 }, (_, offset) =>
    new Date(new Date().getFullYear(), new Date().getMonth() - 11 + offset, 1));
  const labels = dates.map(d => d.toLocaleString("en-IN", { month: "short" }));
  const values = dates.map(() => CATS.map(() => 0));
  requests.forEach(row => {
    const d = new Date(row.createdAt);
    const month = dates.findIndex(v => v.getFullYear() === d.getFullYear() && v.getMonth() === d.getMonth());
    const cat = CATS.indexOf(row.type);
    if (month >= 0 && cat >= 0 && row.status !== "rejected") values[month][cat] += row.amount ?? 0;
  });
  const totals = values.map(row => row.reduce((s,v) => s+v, 0));
  const average = totals.slice(-6).reduce((s,v) => s+v, 0) / 6;
  const sl = (totals.at(-1)! - totals.at(-6)!) / 5;
  return {
    MONTHS: labels, heat: values, monthTotals: totals,
    grandTotal: totals.reduce((s,v) => s+v, 0),
    thisMonth: totals.at(-1) ?? 0,
    lastMonth: totals.at(-2) ?? 0,
    forecast: [1,2,3].map(step => Math.max(0, Math.round(average + sl * (2.5 + step)))),
    avg6: average,
  };
}

// Re-export fmtINR for convenience
export { fmtINR };
