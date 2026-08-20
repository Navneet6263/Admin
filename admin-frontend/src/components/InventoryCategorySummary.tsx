import { useMemo } from "react";
import { Boxes } from "lucide-react";
import { fmtINR } from "./requestMeta";
import type { InventoryItem } from "./liveInventory";

export function InventoryCategorySummary({ items, dense = false, className = "" }: { items: InventoryItem[]; dense?: boolean; className?: string }) {
  const rows = useMemo(() => { const grouped = new Map<string, { count: number; qty: number; value: number }>();
    items.forEach((item) => { const row = grouped.get(item.category) ?? { count: 0, qty: 0, value: 0 }; row.count += 1; row.qty += item.qty; row.value += item.qty * item.price; grouped.set(item.category, row); });
    return [...grouped.entries()].sort((a, b) => b[1].value - a[1].value || b[1].count - a[1].count || a[0].localeCompare(b[0])); }, [items]);
  const valueMode = rows.some(([, row]) => row.value > 0); const maximum = Math.max(1, ...rows.map(([, row]) => valueMode ? row.value : row.count));
  return <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Boxes className="h-4 w-4 text-slate-500" /> Stock value by category</p>
      <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${valueMode ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{valueMode ? 'Inventory value' : 'SKU coverage · prices pending'}</span></div>
    {rows.length === 0 ? <p className="py-5 text-center text-xs text-slate-400">No inventory categories available.</p> : <div className={dense ? "grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2" : "max-h-80 space-y-2.5 overflow-y-auto pr-1"}>{rows.map(([category, row]) => {
      const metric = valueMode ? row.value : row.count; return <div key={category} className={dense ? "rounded-lg border border-slate-100 p-2" : ""}>
        <div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="truncate font-medium text-slate-700">{category} <span className="text-slate-400">· {row.count} SKUs · {row.qty} units</span></span><span className="shrink-0 font-mono text-slate-800">{valueMode ? fmtINR(row.value) : `${row.count} SKUs`}</span></div>
        <div className="h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full rounded ${valueMode ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' : 'bg-gradient-to-r from-amber-300 to-amber-500'}`} style={{ width: `${Math.max(4, metric / maximum * 100)}%` }} /></div>
      </div>; })}</div>}
    {!valueMode && rows.length > 0 && <p className="mt-3 text-[10px] text-slate-400">Bars show SKU coverage until item prices and stock quantities are added; then this switches automatically to ₹ value.</p>}
  </div>;
}
