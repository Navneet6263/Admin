import { useEffect, useState, useMemo } from "react";
import { Boxes, Package, Wallet, AlertTriangle, Ban, CheckCircle2, Plus, Settings2, Trash2 } from "lucide-react";
import { INVENTORY_CATEGORIES, useInventory, isLow, type InventoryItem } from "@/components/liveInventory";
import { DeleteInventoryDialog, InventoryItemDialog } from "@/components/InventoryItemDialog";
import { StockMovementHistory } from "@/components/StockMovementHistory";
import { fmtINR } from "./shared";
import { KpiCard } from "./widgets";
import { TablePagination } from "@/components/TablePagination";
import { InventoryCategorySummary } from "@/components/InventoryCategorySummary";

export function InventoryTab({ searchQuery = "" }: { searchQuery?: string }) {
  const items = useInventory();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [historySku, setHistorySku] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false); const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);

  const stats = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.qty * i.price, 0);
    const totalUnits = items.reduce((s, i) => s + i.qty, 0);
    const low = items.filter(isLow);
    const out = items.filter((i) => i.qty === 0);
    return { totalValue, totalUnits, low, out, skus: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    const queries = [query, searchQuery].map((value) => value.trim().toLowerCase()).filter(Boolean);
    return items
      .filter((i) => cat === "all" || i.category === cat)
      .filter((i) => queries.every((q) => `${i.name} ${i.sku} ${i.category} ${i.unit}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.qty / a.threshold - b.qty / b.threshold);
  }, [items, query, searchQuery, cat]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedItems = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  useEffect(() => setPage(1), [query, searchQuery, cat, pageSize]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);

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
        <InventoryCategorySummary items={items} className="lg:col-span-2" />

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
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Master catalog · add, edit and remove</span>
          <div className="ml-auto flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item or SKU…"
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <select value={cat} onChange={(e) => setCat(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="all">All categories</option>
              {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"><Plus className="h-3.5 w-3.5" /> Add item</button>
          </div>
        </div>
        <div className="overflow-x-auto">
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
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedItems.map((i) => {
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
                    <td className="px-4 py-2 text-right"><span className="inline-flex gap-1"><button type="button" title="Edit item" onClick={(event) => { event.stopPropagation(); setEditItem(i); }} className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"><Settings2 className="h-3.5 w-3.5" /></button><button type="button" title="Remove item" onClick={(event) => { event.stopPropagation(); setDeleteItem(i); }} className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-10 text-center text-sm text-slate-400">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
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
      {addOpen && <InventoryItemDialog onClose={() => setAddOpen(false)} />}
      {editItem && <InventoryItemDialog item={editItem} onClose={() => setEditItem(null)} />}
      {deleteItem && <DeleteInventoryDialog item={deleteItem} onClose={() => setDeleteItem(null)} />}
    </div>
  );
}
