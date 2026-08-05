import { useState, useMemo } from "react";
import { Boxes, Package, Wallet, AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { useInventory, isLow, type InventoryItem } from "@/components/liveInventory";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { fmtINR } from "./shared";
import { KpiCard } from "./widgets";

export function InventoryTab() {
  const items = useInventory();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<InventoryItem["category"] | "all">("all");
  const [historySku, setHistorySku] = useState<string | undefined>(undefined);

  const stats = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.qty * i.price, 0);
    const totalUnits = items.reduce((s, i) => s + i.qty, 0);
    const low = items.filter(isLow);
    const out = items.filter((i) => i.qty === 0);
    return { totalValue, totalUnits, low, out, skus: items.length };
  }, [items]);

  const byCat = useMemo(() => {
    const m = new Map<string, { qty: number; value: number; count: number }>();
    items.forEach((i) => {
      const c = m.get(i.category) ?? { qty: 0, value: 0, count: 0 };
      c.qty += i.qty; c.value += i.qty * i.price; c.count += 1;
      m.set(i.category, c);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [items]);
  const maxCatValue = Math.max(1, ...byCat.map(([, v]) => v.value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => cat === "all" || i.category === cat)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.qty / a.threshold - b.qty / b.threshold);
  }, [items, query, cat]);

  const cats: InventoryItem["category"][] = ["Writing", "Paper", "Printing", "Filing", "Desk", "Misc"];

  return (
    <div className="space-y-5 mt-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Boxes} label="Total SKUs" value={String(stats.skus)} tone="slate" />
        <KpiCard icon={Package} label="Units on-hand" value={stats.totalUnits.toLocaleString("en-IN")} tone="slate" />
        <KpiCard icon={Wallet} label="Inventory value" value={fmtINR(stats.totalValue)} tone="indigo" />
        <KpiCard icon={AlertTriangle} label="Low-stock items" value={String(stats.low.length)} tone={stats.low.length ? "amber" : "slate"} />
        <KpiCard icon={Ban} label="Out of stock" value={String(stats.out.length)} tone={stats.out.length ? "rose" : "slate"} />
      </div>

      {/* Category mix + low-stock panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Boxes className="w-4 h-4 text-slate-500" /> Stock value by category</p>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Group-wide</span>
          </div>
          <div className="space-y-2.5">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-700 font-medium">{c} <span className="text-slate-400">· {v.count} SKUs · {v.qty} units</span></span>
                  <span className="font-mono tabular-nums text-slate-800">{fmtINR(v.value)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${(v.value / maxCatValue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Reorder watchlist</p>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{stats.low.length}</span>
          </div>
          {stats.low.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">All items above threshold.</p>
          ) : (
            <ul className="space-y-2">
              {stats.low.slice(0, 8).map((i) => (
                <li key={i.sku} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{i.name}</p>
                    <p className="font-mono text-[10px] text-slate-400">{i.sku} · {i.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-semibold tabular-nums ${i.qty === 0 ? "text-rose-700" : "text-amber-700"}`}>{i.qty}<span className="text-slate-400 font-normal"> / {i.threshold}</span></p>
                    <p className="text-[10px] text-slate-400">{i.unit}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Full stock table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Package className="w-4 h-4 text-slate-500" /> Stock register</p>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Read-only · executive view</span>
          <div className="ml-auto flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item or SKU…"
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <select value={cat} onChange={(e) => setCat(e.target.value as InventoryItem["category"] | "all")}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium">SKU</th>
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-left px-4 py-2 font-medium">Unit</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">On-hand</th>
                <th className="text-right px-4 py-2 font-medium">Threshold</th>
                <th className="text-right px-4 py-2 font-medium">Value</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((i) => {
                const low = isLow(i);
                const outOf = i.qty === 0;
                return (
                  <tr key={i.sku} onClick={() => setHistorySku(i.sku)}
                    className={`cursor-pointer ${historySku === i.sku ? "bg-indigo-50/60 outline outline-1 outline-indigo-200" : outOf ? "bg-rose-50/60" : low ? "bg-amber-50/40" : "hover:bg-slate-50/50"}`}>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{i.sku}</td>

                    <td className="px-4 py-2 text-slate-800 font-medium">{i.name}</td>
                    <td className="px-4 py-2 text-slate-500">{i.category}</td>
                    <td className="px-4 py-2 text-slate-500">{i.unit}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtINR(i.price)}</td>
                    <td className={`px-4 py-2 text-right font-mono tabular-nums font-semibold ${outOf ? "text-rose-700" : low ? "text-amber-700" : "text-slate-800"}`}>{i.qty}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-500">{i.threshold}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtINR(i.qty * i.price)}</td>
                    <td className="px-4 py-2">
                      {outOf ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-100 text-rose-700 border border-rose-200">Out of stock</span>
                      ) : low ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200"><AlertTriangle className="w-3 h-3" /> Low</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> Healthy</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-sm text-slate-400">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement history */}
      <div className="space-y-2">
        {historySku && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Filtered to</span>
            <span className="font-mono font-semibold text-slate-800">{historySku}</span>
            <button onClick={() => setHistorySku(undefined)} className="text-indigo-600 hover:underline">clear</button>
            <span className="text-slate-400">· click any stock row above to focus its history</span>
          </div>
        )}
        <StockMovementHistory key={historySku ?? "all"} initialSku={historySku} />
      </div>
    </div>
  );
}
