import { useMemo, useState } from "react";
import { AlertTriangle, Package, Pencil, Check, X, Plus, Search } from "lucide-react";
import { inventoryStore, isLow, useInventory, type InventoryItem } from "./liveInventory";
import { fmtINR } from "./requestMeta";

const CATS: InventoryItem["category"][] = ["Writing", "Paper", "Printing", "Filing", "Desk", "Misc"];

export function InventoryPanel() {
  const items = useInventory();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<InventoryItem["category"] | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => cat === "all" || i.category === cat)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [items, query, cat]);

  const lowCount = items.filter(isLow).length;
  const totalValue = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">Stationery Inventory</p>
        </div>
        {lowCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-50 text-rose-700 border border-rose-100">
            <AlertTriangle className="w-3 h-3" /> {lowCount} item{lowCount > 1 ? "s" : ""} low
          </span>
        )}
        <span className="text-[11px] text-slate-500 ml-auto">Total value <span className="font-mono font-semibold text-slate-800">{fmtINR(totalValue)}</span></span>
      </div>

      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item or SKU…"
            className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value as InventoryItem["category"] | "all")}
          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="all">All categories</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 rounded hover:bg-black">
          <Plus className="w-3 h-3" /> Add item
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0">
            <tr>
              <th className="text-left px-4 py-2 font-medium">SKU</th>
              <th className="text-left px-4 py-2 font-medium">Item</th>
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-left px-4 py-2 font-medium">Unit</th>
              <th className="text-right px-4 py-2 font-medium">Price</th>
              <th className="text-right px-4 py-2 font-medium">On-hand</th>
              <th className="text-right px-4 py-2 font-medium">Value</th>
              <th className="text-right px-4 py-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((i) => {
              const low = isLow(i);
              const isEditing = editing === i.sku;
              return (
                <tr key={i.sku} className={low ? "bg-rose-50/40" : "hover:bg-slate-50/50"}>
                  <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{i.sku}</td>
                  <td className="px-4 py-2 text-slate-800 font-medium">{i.name}</td>
                  <td className="px-4 py-2 text-slate-500">{i.category}</td>
                  <td className="px-4 py-2 text-slate-500">{i.unit}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtINR(i.price)}</td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <input autoFocus value={draftQty} onChange={(e) => setDraftQty(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-16 text-right font-mono tabular-nums border border-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300" />
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 font-mono tabular-nums font-semibold ${low ? "text-rose-700" : "text-slate-800"}`}>
                        {low && <AlertTriangle className="w-3 h-3" />}
                        {i.qty}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600">{fmtINR(i.qty * i.price)}</td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => { inventoryStore.update(i.sku, { qty: Number(draftQty) || 0 }); setEditing(null); }}
                          className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"><Check className="w-3 h-3" /></button>
                        <button onClick={() => setEditing(null)} className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(i.sku); setDraftQty(String(i.qty)); }}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900">
                        <Pencil className="w-3 h-3" /> Restock
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-10 text-center text-sm text-slate-400">No items match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && <AddItemDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddItemDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<InventoryItem["category"]>("Misc");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [threshold, setThreshold] = useState("10");

  const canSave = name.trim() && sku.trim() && unit.trim() && Number(price) > 0 && Number(qty) >= 0;
  const save = () => {
    inventoryStore.add({
      sku: sku.trim().toUpperCase(), name: name.trim(), category, unit: unit.trim(),
      price: Number(price), qty: Number(qty), threshold: Number(threshold) || 10,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-base font-semibold text-slate-900 mb-4">Add inventory item</p>
        <div className="space-y-3">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Post-it flags (assorted)" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} placeholder="STA-PIF-01" /></Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as InventoryItem["category"])} className={inputCls}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Unit"><input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="pack of 10" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price (₹)"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputCls} font-mono`} /></Field>
            <Field label="On-hand"><input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputCls} font-mono`} /></Field>
            <Field label="Low @"><input value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputCls} font-mono`} /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900">Cancel</button>
          <button onClick={save} disabled={!canSave} className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-black disabled:opacity-40">Add</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>{children}</div>;
}
