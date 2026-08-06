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

export const financialYearStartFor = (date: Date) => date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
export const financialYearLabel = (startYear: number) => `FY ${startYear}–${String(startYear + 1).slice(-2)}`;
export const availableFinancialYears = (requests: RequestItem[]) => {
  const current = financialYearStartFor(new Date());
  const years = new Set<number>(Array.from({ length: 5 }, (_, index) => current - index));
  requests.forEach((row) => {
    const date = new Date(row.createdAt);
    if (!Number.isNaN(date.getTime())) years.add(financialYearStartFor(date));
  });
  return [...years].sort((a, b) => b - a);
};

export interface SpendHeatmapRow { month_index: number; type: RequestType; total_spend: number; }
export interface CompanySpendRow { company: string; request_count: number; total_spend: number; }
export interface SpendHeatmapResponse {
  fy_start: number; center_code: string; heatmap: SpendHeatmapRow[]; companies: CompanySpendRow[];
}

const financialYearShape = (financialYearStart: number) => {
  const now = new Date();
  const currentFinancialYear = financialYearStartFor(now);
  const monthCount = financialYearStart === currentFinancialYear
    ? ((now.getFullYear() - financialYearStart) * 12 + now.getMonth() - 3) + 1
    : 12;
  const dates = Array.from({ length: monthCount }, (_, offset) => new Date(financialYearStart, 3 + offset, 1));
  return { dates, labels: dates.map(date => date.toLocaleString("en-IN", { month: "short" })) };
};

const finishHistory = (labels: string[], values: number[][], financialYearStart: number) => {
  const totals = values.map(row => row.reduce((sum,value) => sum+value, 0));
  const categoryTotals = CATS.map((_, index) => values.reduce((sum, row) => sum + row[index], 0));
  const recent = totals.slice(-6);
  const average = recent.length ? recent.reduce((sum,value) => sum+value, 0) / recent.length : 0;
  const slope = recent.length > 1 ? ((recent.at(-1) ?? 0) - recent[0]) / (recent.length - 1) : 0;
  return {
    MONTHS: labels, heat: values, monthTotals: totals, catTotals: categoryTotals,
    financialYearLabel: financialYearLabel(financialYearStart), grandTotal: totals.reduce((sum,value) => sum+value, 0),
    thisMonth: totals.at(-1) ?? 0, lastMonth: totals.at(-2) ?? 0,
    forecast: [1,2,3].map(step => Math.max(0, Math.round(average + slope * (2.5 + step)))), avg6: average,
  };
};

export function buildHistory(requests: RequestItem[], selectedFinancialYear?: number) {
  const financialYearStart = selectedFinancialYear ?? financialYearStartFor(new Date());
  const { dates, labels } = financialYearShape(financialYearStart);
  const values = dates.map(() => CATS.map(() => 0));
  requests.forEach(row => {
    const d = new Date(row.createdAt);
    const month = dates.findIndex(v => v.getFullYear() === d.getFullYear() && v.getMonth() === d.getMonth());
    const cat = CATS.indexOf(row.type);
    if (month >= 0 && cat >= 0 && row.status !== "rejected") values[month][cat] += row.amount ?? 0;
  });
  return finishHistory(labels, values, financialYearStart);
}

export function buildHistoryFromAggregates(rows: SpendHeatmapRow[], financialYearStart: number) {
  const { dates, labels } = financialYearShape(financialYearStart);
  const values = dates.map(() => CATS.map(() => 0));
  rows.forEach((row) => {
    const category = CATS.indexOf(row.type);
    if (row.month_index >= 0 && row.month_index < values.length && category >= 0)
      values[row.month_index][category] = Number(row.total_spend || 0);
  });
  return finishHistory(labels, values, financialYearStart);
}

// Re-export fmtINR for convenience
export { fmtINR };
