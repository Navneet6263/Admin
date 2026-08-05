// Shared constants, types and helpers used across all super-admin tabs
import { type RequestItem, type RequestType } from "@/components/models";
import { fmtINR } from "@/components/requestMeta";

export const autoNote = (actor: string, verb: string, userNote: string) => {
  const ts = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const head = `${verb} by ${actor} · ${ts} IST · Super Admin override`;
  return userNote?.trim() ? `${head}\n— ${userNote.trim()}` : head;
};

export type Tab = "overview" | "analytics" | "inventory" | "override" | "anomalies" | "team" | "centers" | "policies";

export interface UserRow {
  id: number; name: string; email: string; role: string;
  dept: string; company: string;
  center_code: string | null; center_name: string | null; center_city: string | null;
}
export interface CenterRow {
  id: number; code: string; name: string; city: string; company: string; is_active: boolean;
}

export const CATS: RequestType[] = ["travel","courier","stationery","visiting_card","id_card","meeting_room","fooding"];

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
  const categoryTotals = CATS.map((_, index) => values.reduce((sum, row) => sum + row[index], 0));
  const average = totals.slice(-6).reduce((s,v) => s+v, 0) / 6;
  const sl = (totals.at(-1)! - totals.at(-6)!) / 5;
  return {
    MONTHS: labels, heat: values, monthTotals: totals,
    catTotals: categoryTotals,
    grandTotal: totals.reduce((s,v) => s+v, 0),
    thisMonth: totals.at(-1) ?? 0,
    lastMonth: totals.at(-2) ?? 0,
    forecast: [1,2,3].map(step => Math.max(0, Math.round(average + sl * (2.5 + step)))),
    avg6: average,
  };
}

// Re-export fmtINR for convenience
export { fmtINR };
