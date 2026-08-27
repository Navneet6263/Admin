import { useMemo } from "react";
import { AlertTriangle, Ban, Boxes, Package, Wallet } from "lucide-react";
import { InventoryCategorySummary } from "@/components/InventoryCategorySummary";
import type { InventoryItem } from "@/components/liveInventory";
import { fmtINR } from "./shared";
import { KpiCard } from "./widgets";
import { getStockStatus, stockCounts } from "./inventoryDisplay";

export function InventoryOverview({ items }: { items: InventoryItem[] }) {
  const summary = useMemo(() => {
    const counts = stockCounts(items);
    const attention = items
      .filter((item) => getStockStatus(item) !== "healthy")
      .sort(
        (a, b) =>
          Number(a.qty > 0) - Number(b.qty > 0) ||
          a.qty / Math.max(a.threshold, 1) - b.qty / Math.max(b.threshold, 1),
      );
    return {
      counts,
      attention,
      units: items.reduce((total, item) => total + item.qty, 0),
      value: items.reduce((total, item) => total + item.qty * item.price, 0),
    };
  }, [items]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard icon={Boxes} label="Total SKUs" value={String(items.length)} tone="slate" />
        <KpiCard
          icon={Package}
          label="Units on hand"
          value={summary.units.toLocaleString("en-IN")}
          tone="slate"
        />
        <KpiCard
          icon={Wallet}
          label="Inventory value"
          value={fmtINR(summary.value)}
          tone="indigo"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Low stock"
          value={String(summary.counts.low)}
          tone={summary.counts.low ? "amber" : "slate"}
        />
        <KpiCard
          icon={Ban}
          label="Out of stock"
          value={String(summary.counts.out)}
          tone={summary.counts.out ? "rose" : "slate"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InventoryCategorySummary items={items} className="lg:col-span-2" />
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Reorder watchlist</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Items at or below their stock threshold
              </p>
            </div>
            <span className="rounded border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              {summary.attention.length} need attention
            </span>
          </div>
          {!summary.attention.length ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-8 text-center">
              <p className="text-xs font-semibold text-emerald-700">Stock levels look healthy</p>
              <p className="mt-1 text-[10px] text-emerald-600">No item is below its threshold.</p>
            </div>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {summary.attention.slice(0, 10).map((item) => {
                const out = item.qty === 0;
                return (
                  <li
                    key={item.sku}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{item.name}</p>
                      <p className="truncate font-mono text-[9px] text-slate-400">
                        {item.sku} · {item.category}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`font-mono text-xs font-semibold tabular-nums ${out ? "text-rose-700" : "text-amber-700"}`}
                      >
                        {item.qty}{" "}
                        <span className="font-normal text-slate-400">/ {item.threshold}</span>
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {out ? "Out of stock" : "Low stock"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
