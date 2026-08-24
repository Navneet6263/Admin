import { AlertTriangle, Boxes, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CenterInventoryRow } from './types';

export function CenterInventoryTable({ rows }: { rows: CenterInventoryRow[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return rows.filter((row) => !value || `${row.sku} ${row.name} ${row.category}`.toLowerCase().includes(value));
  }, [query, rows]);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Boxes className="h-4 w-4 text-indigo-600" /> Center inventory</h2>
          <p className="mt-1 text-[11px] text-slate-500">Read-only center stock position with reserved and available units.</p>
        </div>
        <div className="relative ml-auto min-w-[230px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU or item"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:bg-white" />
        </div>
      </div>
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>{['SKU', 'Item', 'Category', 'On hand', 'Reserved', 'Available', 'Status', 'Stock value'].map((title) =>
              <th key={title} className={`px-4 py-2.5 font-medium ${['On hand','Reserved','Available','Stock value'].includes(title) ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => {
              const low = Number(row.available_qty) <= Number(row.threshold);
              return <tr key={row.sku} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{row.sku}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}<span className="block text-[10px] font-normal text-slate-400">{row.unit}</span></td>
                <td className="px-4 py-3 text-slate-500">{row.category}</td>
                <td className="px-4 py-3 text-right font-mono">{row.qty}</td><td className="px-4 py-3 text-right font-mono text-amber-600">{row.reserved_qty}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{row.available_qty}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${low ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {low && <AlertTriangle className="h-3 w-3" />}{low ? 'Low stock' : 'Healthy'}</span></td>
                <td className="px-4 py-3 text-right font-mono">₹{Number(row.qty * row.price).toLocaleString('en-IN')}</td>
              </tr>;
            })}
            {!filtered.length && <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">No inventory items match your search.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
