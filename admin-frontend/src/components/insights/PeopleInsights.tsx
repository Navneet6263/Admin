import { useMemo } from "react";
import type { RequestItem } from "@/components/models";
import { PeopleSignalCards } from "./PeopleSignalCards";
import { SpendLeaderboard } from "./SpendLeaderboard";
import { buildEmployeeStats, currentFinancialYear } from "./peopleInsightsData";

export function PeopleInsights({
  requests,
  financialYearStart = currentFinancialYear(),
}: {
  requests: RequestItem[];
  financialYearStart?: number;
}) {
  const stats = useMemo(
    () => buildEmployeeStats(requests, financialYearStart),
    [financialYearStart, requests],
  );
  const periodLabel = `FY ${financialYearStart}–${String(financialYearStart + 1).slice(-2)}${financialYearStart === currentFinancialYear() ? " YTD" : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400">People analytics</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
          Employee spend passport
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Who is raising what · frequency and approval signals
        </p>
      </div>
      <PeopleSignalCards stats={stats} periodLabel={periodLabel} />
      <SpendLeaderboard stats={stats} periodLabel={periodLabel} />
    </div>
  );
}
