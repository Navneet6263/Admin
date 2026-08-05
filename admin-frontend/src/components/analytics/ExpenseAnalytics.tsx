import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { request } from "@/lib/api";
interface Row {
  center_code: string;
  type: string;
  request_count: number;
  total_spend: number;
  paid_count: number;
  pending_count: number;
}
export function ExpenseAnalytics() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    request<Row[]>("/api/payments/analytics/summary").then(setRows).catch(console.error);
  }, []);
  const total = useMemo(() => rows.reduce((n, r) => n + Number(r.total_spend), 0), [rows]);
  const pending = rows.reduce((n, r) => n + Number(r.pending_count), 0);
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold flex gap-2">
            <CircleDollarSign className="w-4 h-4 text-emerald-600" />
            Live expense ledger
          </h2>
          <p className="text-xs text-slate-500">
            Final/estimated spend charged to employee home centers
          </p>
        </div>
        <div className="text-right">
          <b className="text-xl">₹{total.toLocaleString("en-IN")}</b>
          <p className="text-[10px] text-amber-600">{pending} payment actions open</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-400 bg-slate-50">
            <tr>
              {["Charge center", "Category", "Requests", "Paid", "Pending", "Spend"].map((h) => (
                <th key={h} className="text-left p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.center_code}-${r.type}-${i}`} className="border-t">
                <td className="p-2 font-semibold">{r.center_code}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.request_count}</td>
                <td className="p-2 text-emerald-600">{r.paid_count}</td>
                <td className="p-2 text-amber-600">{r.pending_count}</td>
                <td className="p-2 font-mono">₹{Number(r.total_spend).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
