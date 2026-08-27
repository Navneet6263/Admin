import type { RequestItem, RequestType } from "@/components/models";

export interface EmployeeStat {
  id: number;
  name: string;
  dept: string;
  company: string;
  center: string;
  approvedSpend: number;
  pendingSpend: number;
  rejectedSpend: number;
  reqCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  byCategory: Record<RequestType, number>;
}

export function buildEmployeeStats(requests: RequestItem[], financialYearStart: number) {
  const stats = new Map<number, EmployeeStat>();
  const start = new Date(financialYearStart, 3, 1);
  const end = new Date(financialYearStart + 1, 3, 1);

  requests.forEach((request) => {
    const createdAt = new Date(request.createdAt);
    if (createdAt < start || createdAt >= end) return;
    if (!stats.has(request.employeeId)) {
      stats.set(request.employeeId, {
        id: request.employeeId,
        name: request.employeeName,
        dept: request.employeeDept,
        company: request.company,
        center:
          request.homeCenter || request.chargeCenter || request.approvalCenter || "Unassigned",
        approvedSpend: 0,
        pendingSpend: 0,
        rejectedSpend: 0,
        reqCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        byCategory: {} as Record<RequestType, number>,
      });
    }

    const row = stats.get(request.employeeId)!;
    const amount = request.actualAmount ?? request.amount ?? 0;
    row.reqCount += 1;
    if (request.status === "approved") {
      row.approvedSpend += amount;
      row.approvedCount += 1;
      row.byCategory[request.type] = (row.byCategory[request.type] || 0) + amount;
    } else if (request.status === "rejected") {
      row.rejectedSpend += amount;
      row.rejectedCount += 1;
    } else {
      row.pendingSpend += amount;
      row.pendingCount += 1;
    }
  });

  return [...stats.values()].sort((a, b) => b.approvedSpend - a.approvedSpend);
}

export function currentFinancialYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export const employeeInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function departmentTone(department: string) {
  const tones: Record<string, string> = {
    Engineering: "bg-sky-100 text-sky-700",
    Sales: "bg-rose-100 text-rose-700",
    Marketing: "bg-amber-100 text-amber-700",
    Operations: "bg-indigo-100 text-indigo-700",
    Design: "bg-fuchsia-100 text-fuchsia-700",
    HR: "bg-emerald-100 text-emerald-700",
    Finance: "bg-slate-200 text-slate-800",
    Product: "bg-violet-100 text-violet-700",
  };
  return tones[department] ?? "bg-slate-100 text-slate-700";
}
