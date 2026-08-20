import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Package, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { INVENTORY_CATEGORIES, inventoryStore, isLow, useInventory, type InventoryItem } from "./liveInventory";
import { DeleteInventoryDialog, InventoryItemDialog } from "./InventoryItemDialog";
import { fmtINR } from "./requestMeta";
import { TablePagination } from "./TablePagination";
import { InventoryCategorySummary } from "./InventoryCategorySummary";

export function InventoryPanel() {
  const items = useInventory(); const [query, setQuery] = useState(""); const [category, setCategory] = useState("all");
  const [editingQty, setEditingQty] = useState<string | null>(null); const [draftQty, setDraftQty] = useState("");
  const [addOpen, setAddOpen] = useState(false); const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return items
    .filter((item) => category === "all" || item.category === category)
    .filter((item) => !q || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(q)); }, [items, query, category]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedItems = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  useEffect(() => setPage(1), [query, category, pageSize]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);
  const lowCount = items.filter(isLow).length; const totalValue = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const saveQty = async (item: InventoryItem) => { await inventoryStore.update(item.sku, { qty: Number(draftQty) || 0 }); setEditingQty(null); };
  return <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Package className="h-4 w-4 text-slate-500" /> Stationery Inventory</p>
      {lowCount > 0 && <span className="inline-flex items-center gap-1.5 rounded border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700"><AlertTriangle className="h-3 w-3" /> {lowCount} low</span>}
      <span className="ml-auto text-[11px] text-slate-500">Total value <b className="font-mono text-slate-800">{fmtINR(totalValue)}</b></span>
    </div>
    <InventoryCategorySummary items={items} dense className="m-3 mb-0 shrink-0" />
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
      <div className="relative min-w-[200px] flex-1"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item, category or SKU…" className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-slate-300" /></div>
      <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"><option value="all">All categories</option>{INVENTORY_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select>
      <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"><Plus className="h-3.5 w-3.5" /> Add item</button>
    </div>
    <div className="flex-1 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
      {['SKU','Item','Category','Unit','Price','On-hand','Value','Actions'].map((title) => <th key={title} className={`${['Price','On-hand','Value','Actions'].includes(title) ? 'text-right' : 'text-left'} px-4 py-2 font-medium`}>{title}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-50">{pagedItems.map((item) => { const low = isLow(item); const editing = editingQty === item.sku; return <tr key={item.sku} className={low ? "bg-rose-50/40" : "hover:bg-slate-50/50"}>
        <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{item.sku}</td><td className="px-4 py-2 font-medium text-slate-800">{item.name}</td><td className="px-4 py-2 text-slate-500">{item.category}</td><td className="px-4 py-2 text-slate-500">{item.unit}</td>
        <td className="px-4 py-2 text-right font-mono text-slate-700">{fmtINR(item.price)}</td><td className="px-4 py-2 text-right">{editing ? <input autoFocus value={draftQty} onChange={(event) => setDraftQty(event.target.value.replace(/[^0-9]/g, ""))} className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-right font-mono" /> : <span className={`font-mono font-semibold ${low ? 'text-rose-700' : 'text-slate-800'}`}>{item.qty}</span>}</td>
        <td className="px-4 py-2 text-right font-mono text-slate-600">{fmtINR(item.qty * item.price)}</td><td className="px-4 py-2 text-right">{editing ? <span className="inline-flex gap-1"><button type="button" onClick={() => void saveQty(item)} className="rounded bg-emerald-600 p-1 text-white"><Check className="h-3 w-3" /></button><button type="button" onClick={() => setEditingQty(null)} className="rounded bg-slate-200 p-1 text-slate-700"><X className="h-3 w-3" /></button></span> : <span className="inline-flex items-center gap-1">
          <button type="button" title="Restock" onClick={() => { setEditingQty(item.sku); setDraftQty(String(item.qty)); }} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button><button type="button" title="Edit item" onClick={() => setEditItem(item)} className="rounded p-1 text-indigo-600 hover:bg-indigo-50"><Settings2 className="h-3.5 w-3.5" /></button><button type="button" title="Remove item" onClick={() => setDeleteItem(item)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></span>}</td></tr>; })}
        {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-sm text-slate-400">No items match your filter.</td></tr>}</tbody></table></div>
    <TablePagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
    {addOpen && <InventoryItemDialog onClose={() => setAddOpen(false)} />}{editItem && <InventoryItemDialog item={editItem} onClose={() => setEditItem(null)} />}{deleteItem && <DeleteInventoryDialog item={deleteItem} onClose={() => setDeleteItem(null)} />}
  </div>;
}
