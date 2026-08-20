import { useState } from "react";
import { AlertTriangle, PackagePlus, Save, Trash2, X } from "lucide-react";
import { INVENTORY_CATEGORIES, inventoryStore, type InventoryItem } from "./liveInventory";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;

export function InventoryItemDialog({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const [form, setForm] = useState<InventoryItem>(item ?? { sku: "", name: "", category: "Other", unit: "piece", price: 0, qty: 0, threshold: 10 });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const set = <K extends keyof InventoryItem>(key: K, value: InventoryItem[K]) => setForm((current) => ({ ...current, [key]: value }));
  const valid = form.sku.trim() && form.name.trim() && form.category && form.unit.trim() && form.price >= 0 && form.qty >= 0 && form.threshold >= 0;
  const save = async () => {
    if (!valid || busy) return; setBusy(true); setError("");
    try {
      const normalized = { ...form, sku: form.sku.trim().toUpperCase(), name: form.name.trim(), unit: form.unit.trim() };
      if (item) await inventoryStore.update(item.sku, normalized); else await inventoryStore.add(normalized);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Item could not be saved"); setBusy(false); }
  };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-5 flex items-start justify-between"><div><p className="flex items-center gap-2 text-base font-bold text-slate-900"><PackagePlus className="h-4 w-4 text-indigo-600" /> {item ? "Edit stationery item" : "Add stationery item"}</p>
        <p className="mt-1 text-xs text-slate-500">Manage the official stationery catalog and stock values.</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="space-y-3">
        <Field label="Stationery item"><input value={form.name} onChange={(event) => set("name", event.target.value)} className={input} placeholder="Item name" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="SKU"><input disabled={Boolean(item)} value={form.sku} onChange={(event) => set("sku", event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} className={`${input} font-mono disabled:bg-slate-100`} placeholder="STY-092" /></Field>
          <Field label="Category"><select value={form.category} onChange={(event) => set("category", event.target.value)} className={input}>{INVENTORY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Unit"><input value={form.unit} onChange={(event) => set("unit", event.target.value)} className={input} placeholder="piece / pack / rim" /></Field>
          <Field label="Price (₹)"><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => set("price", Math.max(0, Number(event.target.value)))} className={input} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="On-hand quantity"><input type="number" min="0" step="1" value={form.qty} onChange={(event) => set("qty", Math.max(0, Math.trunc(Number(event.target.value))))} className={input} /></Field>
          <Field label="Low-stock threshold"><input type="number" min="0" step="1" value={form.threshold} onChange={(event) => set("threshold", Math.max(0, Math.trunc(Number(event.target.value))))} className={input} /></Field></div>
      </div>
      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40"><Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : item ? "Save changes" : "Add item"}</button></div>
    </div>
  </div>;
}

export function DeleteInventoryDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const remove = async () => { setBusy(true); setError(""); try { await inventoryStore.remove(item.sku); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Item could not be removed"); setBusy(false); } };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700"><AlertTriangle className="h-5 w-5" /></div>
      <p className="text-base font-bold text-slate-900">Remove {item.name}?</p><p className="mt-1 text-xs leading-5 text-slate-500">It will disappear from new stationery requests. Existing requests and movement history will remain available for audit.</p>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"><Trash2 className="h-3.5 w-3.5" /> {busy ? "Removing…" : "Remove item"}</button></div>
    </div>
  </div>;
}
