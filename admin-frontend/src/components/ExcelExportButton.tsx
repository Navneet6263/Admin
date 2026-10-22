import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { cellValue, downloadExcel, type ExportColumn } from '@/lib/excelExport';

interface Props<T> {
  /** Stable id used to remember the viewer's column choices. */
  exportKey: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  /** Rows currently on screen (already filtered). */
  rows: T[];
  /** Optional loader for every matching row (e.g. all pages), offered as a second scope. */
  fetchAll?: () => Promise<T[]>;
  fetchAllLabel?: string;
  /** Column key holding a date, enabling the date-range filter. */
  dateKey?: string;
  label?: string;
  className?: string;
}

type Saved = { order: string[]; enabled: string[]; groupBy: string; totals: boolean };
const storageKey = (key: string) => `requesthub.export.${key}`;

function loadSaved(key: string): Saved | null {
  try { const raw = localStorage.getItem(storageKey(key)); return raw ? JSON.parse(raw) as Saved : null; }
  catch { return null; }
}
function save(key: string, value: Saved) {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)); } catch { /* private mode: choices are not remembered */ }
}
const stamp = () => new Date().toISOString().slice(0, 10);

/** "Export Excel" button + dialog: pick/reorder columns, scope, date range, totals and a grouped summary sheet. */
export function ExcelExportButton<T>({ exportKey, title, subtitle, columns, rows, fetchAll, fetchAllLabel, dateKey, label = 'Export Excel', className }: Props<T>) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}
      className={className ?? 'inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100'}>
      <FileSpreadsheet className="h-3.5 w-3.5" /> {label}
    </button>
    {open && <ExportDialog exportKey={exportKey} title={title} subtitle={subtitle} columns={columns} rows={rows}
      fetchAll={fetchAll} fetchAllLabel={fetchAllLabel} dateKey={dateKey} onClose={() => setOpen(false)} />}
  </>;
}

function ExportDialog<T>({ exportKey, title, subtitle, columns, rows, fetchAll, fetchAllLabel, dateKey, onClose }: Omit<Props<T>, 'label' | 'className'> & { onClose: () => void }) {
  const saved = useMemo(() => loadSaved(exportKey), [exportKey]);
  const [order, setOrder] = useState<string[]>(() => {
    const known = new Set(columns.map((column) => column.key));
    const kept = (saved?.order ?? []).filter((key) => known.has(key));
    return [...kept, ...columns.map((column) => column.key).filter((key) => !kept.includes(key))];
  });
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(saved?.enabled
    ?? columns.filter((column) => column.defaultOn !== false).map((column) => column.key)));
  const [scope, setScope] = useState<'view' | 'all'>(fetchAll ? 'all' : 'view');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [fileName, setFileName] = useState(`${title} ${stamp()}`);
  const [groupBy, setGroupBy] = useState(saved?.groupBy ?? '');
  const [totals, setTotals] = useState(saved?.totals ?? true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const byKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const dateColumn = dateKey ? byKey.get(dateKey) : undefined;
  const textColumns = columns.filter((column) => !column.type || column.type === 'text');

  const move = (key: string, delta: number) => setOrder((current) => {
    const index = current.indexOf(key); const target = index + delta;
    if (target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const toggle = (key: string) => setEnabled((current) => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });

  const run = async () => {
    const chosen = order.filter((key) => enabled.has(key)).map((key) => byKey.get(key)!).filter(Boolean);
    if (!chosen.length) { setError('Select at least one column'); return; }
    setBusy(true); setError('');
    try {
      let data = scope === 'all' && fetchAll ? await fetchAll() : rows;
      if (dateColumn && (from || to)) data = data.filter((row) => {
        const value = cellValue(dateColumn.value(row), 'date');
        if (!(value instanceof Date)) return false;
        const day = value.toISOString().slice(0, 10);
        return (!from || day >= from) && (!to || day <= to);
      });
      const range = from || to ? `Period ${from || '…'} to ${to || '…'}` : '';
      await downloadExcel({ fileName: fileName || title, sheetName: title, title, subtitle: [subtitle, range].filter(Boolean).join('  ·  '),
        columns: chosen, rows: data, includeTotals: totals, groupBy: groupBy || null });
      save(exportKey, { order, enabled: [...enabled], groupBy, totals });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    } finally { setBusy(false); }
  };

  const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500';
  const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200';
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
    <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><p className="flex items-center gap-2 text-base font-bold text-slate-900"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export to Excel</p>
          <p className="mt-0.5 text-xs text-slate-500">{title} — choose exactly what goes into your report.</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div><span className={label}>File name</span><input value={fileName} onChange={(event) => setFileName(event.target.value)} className={input} /></div>
          <div><span className={label}>Rows</span>
            <div className="space-y-1.5">
              {fetchAll && <label className="flex items-center gap-2 text-xs text-slate-700"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} className="accent-emerald-600" />
                {fetchAllLabel ?? 'All matching records'}</label>}
              <label className="flex items-center gap-2 text-xs text-slate-700"><input type="radio" checked={scope === 'view'} onChange={() => setScope('view')} className="accent-emerald-600" />
                Only what is on screen ({rows.length} rows)</label>
            </div></div>
          {dateColumn && <div><span className={label}>{dateColumn.label} between</span>
            <div className="grid grid-cols-2 gap-2"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={input} />
              <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={input} /></div>
            <p className="mt-1 text-[10px] text-slate-400">Leave empty to include every date.</p></div>}
          <div><span className={label}>Summary sheet (group by)</span>
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className={input}>
              <option value="">No summary sheet</option>
              {textColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">Adds a second sheet with count and totals per group.</p></div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={totals} onChange={(event) => setTotals(event.target.checked)} className="accent-emerald-600" />
            Add a totals row (follows Excel filters)</label>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between"><span className={label}>Columns · {enabled.size} of {columns.length}</span>
            <span className="flex gap-2 text-[10px] font-semibold">
              <button type="button" onClick={() => setEnabled(new Set(columns.map((column) => column.key)))} className="text-emerald-700 hover:underline">All</button>
              <button type="button" onClick={() => setEnabled(new Set())} className="text-slate-500 hover:underline">None</button>
            </span></div>
          <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-slate-200">
            {order.map((key, index) => {
              const column = byKey.get(key); if (!column) return null;
              return <div key={key} className={`flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 last:border-0 ${enabled.has(key) ? '' : 'opacity-50'}`}>
                <input type="checkbox" checked={enabled.has(key)} onChange={() => toggle(key)} className="accent-emerald-600" />
                <span className="flex-1 truncate text-xs text-slate-800">{column.label}</span>
                <button type="button" disabled={index === 0} onClick={() => move(key, -1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up"><ArrowUp className="h-3 w-3" /></button>
                <button type="button" disabled={index === order.length - 1} onClick={() => move(key, 1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down"><ArrowDown className="h-3 w-3" /></button>
              </div>;
            })}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Your column choices are remembered for next time.</p>
        </div>
      </div>
      {error && <p className="mx-5 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" disabled={busy || !enabled.size} onClick={() => void run()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} {busy ? 'Preparing…' : 'Download .xlsx'}</button>
      </div>
    </div>
  </div>;
}
