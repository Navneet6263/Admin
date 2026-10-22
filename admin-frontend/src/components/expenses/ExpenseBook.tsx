import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, ReceiptIndianRupee, Search, Trash2, X } from 'lucide-react';
import { request } from '@/lib/api';
import { ExcelExportButton } from '@/components/ExcelExportButton';
import { PaginationBar } from '@/components/PaginationBar';
import { PanelLoadingSkeleton } from '@/components/LoadingSkeletons';
import type { ExportColumn } from '@/lib/excelExport';

export type Expense = {
  id: number; expense_date: string; company: string; center_code: string | null; center_name: string; category: string;
  description: string; paid_to: string | null; amount: number; gst_amount: number; net_amount: number; payment_mode: string;
  reference_no: string | null; notes: string | null; created_at: string; updated_at: string | null;
  created_by_name: string; created_by_role: string; updated_by_name: string | null;
};
type Bucket = { label: string; code?: string; entries: number; total: number };
type Summary = { entries: number; total: number; gst: number; average: number; largest: number;
  by_company: Bucket[]; by_category: Bucket[]; by_center: Bucket[]; by_month: Bucket[]; by_mode: Bucket[] };
type Meta = { companies: { code: string; name: string }[]; centers: { code: string; name: string; city: string }[];
  allow_head_office: boolean; categories: string[]; payment_modes: string[] };
type Period = 'month' | 'last_month' | 'quarter' | 'fy' | 'all' | 'custom';

const inr = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const iso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const dayLabel = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const filterCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400';

function periodRange(period: Period, custom: { from: string; to: string }) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  if (period === 'month') return { from: iso(new Date(y, m, 1)), to: iso(now) };
  if (period === 'last_month') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (period === 'quarter') { const start = Math.floor(m / 3) * 3; return { from: iso(new Date(y, start, 1)), to: iso(now) }; }
  if (period === 'fy') { const fyStart = m >= 3 ? y : y - 1; return { from: iso(new Date(fyStart, 3, 1)), to: iso(now) }; }
  if (period === 'custom') return custom;
  return { from: '', to: '' };
}

export const expenseExportColumns: ExportColumn<Expense>[] = [
  { key: 'date', label: 'Expense date', value: (row) => row.expense_date, type: 'date' },
  { key: 'company', label: 'Company', value: (row) => row.company },
  { key: 'center', label: 'Center', value: (row) => row.center_name },
  { key: 'center_code', label: 'Center code', value: (row) => row.center_code ?? 'HQ', defaultOn: false },
  { key: 'category', label: 'Category', value: (row) => row.category },
  { key: 'description', label: 'Description', value: (row) => row.description, width: 40 },
  { key: 'paid_to', label: 'Paid to', value: (row) => row.paid_to },
  { key: 'net', label: 'Amount before GST', value: (row) => row.net_amount, type: 'currency', defaultOn: false },
  { key: 'gst', label: 'GST', value: (row) => row.gst_amount, type: 'currency' },
  { key: 'amount', label: 'Total amount', value: (row) => row.amount, type: 'currency' },
  { key: 'mode', label: 'Payment mode', value: (row) => row.payment_mode },
  { key: 'ref', label: 'Bill / ref no.', value: (row) => row.reference_no },
  { key: 'notes', label: 'Notes', value: (row) => row.notes, defaultOn: false },
  { key: 'by', label: 'Entered by', value: (row) => row.created_by_name },
  { key: 'entered', label: 'Entered on', value: (row) => row.created_at, type: 'datetime', defaultOn: false },
  { key: 'edited', label: 'Last edited by', value: (row) => row.updated_by_name, defaultOn: false },
];

function Breakdown({ title, rows, total, onPick }: { title: string; rows: Bucket[]; total: number; onPick?: (row: Bucket) => void }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
    {rows.length ? <div className="space-y-2.5">{rows.slice(0, 6).map((row) => {
      const share = total ? (Number(row.total) / total) * 100 : 0;
      return <button key={row.label} type="button" disabled={!onPick} onClick={() => onPick?.(row)} className="block w-full text-left disabled:cursor-default">
        <div className="flex items-baseline justify-between gap-2 text-xs"><span className="truncate font-medium text-slate-800">{row.label}</span>
          <span className="shrink-0 font-mono text-slate-700">{inr(row.total)} <span className="text-[10px] text-slate-400">{share.toFixed(0)}%</span></span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, share)}%` }} /></div>
      </button>;
    })}{rows.length > 6 && <p className="text-[10px] text-slate-400">+{rows.length - 6} more in the Excel report</p>}</div>
      : <p className="py-6 text-center text-xs text-slate-400">No data for this period</p>}
  </div>;
}

function MonthTrend({ rows }: { rows: Bucket[] }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total)));
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Month-wise spend</p>
    {rows.length ? <div className="flex h-32 items-end gap-2">{rows.slice(-12).map((row) => {
      const label = new Date(`${row.label}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      return <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${label}: ${inr(row.total)}`}>
        <div className="w-full rounded-t bg-indigo-500/85" style={{ height: `${Math.max(4, (Number(row.total) / max) * 100)}%` }} />
        <span className="text-[9px] text-slate-500">{label}</span>
      </div>;
    })}</div> : <p className="py-6 text-center text-xs text-slate-400">No data for this period</p>}
  </div>;
}

function ExpenseDialog({ meta, expense, defaultCenter, onClose, onSaved }: { meta: Meta; expense?: Expense; defaultCenter?: string; onClose: () => void; onSaved: () => void }) {
  const firstCenter = defaultCenter || meta.centers[0]?.code || (meta.allow_head_office ? 'HQ' : '');
  const [form, setForm] = useState({
    expense_date: expense?.expense_date.slice(0, 10) ?? iso(new Date()), company: expense?.company ?? '',
    center_code: expense ? expense.center_code ?? 'HQ' : firstCenter, category: expense?.category ?? '',
    description: expense?.description ?? '', paid_to: expense?.paid_to ?? '', amount: expense ? String(expense.amount) : '',
    gst_amount: expense ? String(expense.gst_amount || '') : '', payment_mode: expense?.payment_mode ?? 'Cash',
    reference_no: expense?.reference_no ?? '', notes: expense?.notes ?? '',
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const amount = Number(form.amount); const gst = Number(form.gst_amount || 0);
  const valid = form.expense_date && form.company && form.center_code && form.category.trim() && form.description.trim()
    && amount > 0 && gst >= 0 && gst <= amount && form.payment_mode;
  const save = async () => {
    if (!valid || busy) return; setBusy(true); setError('');
    const body = { ...form, amount, gst_amount: gst, category: form.category.trim(), description: form.description.trim() };
    try {
      if (expense) await request(`/api/expenses/${expense.id}`, { method: 'PATCH', body });
      else await request('/api/expenses', { method: 'POST', body });
      onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Expense could not be saved'); setBusy(false); }
  };
  const field = (label: string, child: React.ReactNode, hint?: string) => <label className="block">
    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{child}
    {hint && <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>}</label>;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
    <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3"><div>
        <p className="flex items-center gap-2 text-base font-bold text-slate-900"><ReceiptIndianRupee className="h-4 w-4 text-indigo-600" /> {expense ? 'Edit expense' : 'Record an expense'}</p>
        <p className="mt-1 text-xs text-slate-500">Choose which company this money is spent for, so reports map every rupee correctly.</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {field('Date *', <input type="date" max={iso(new Date())} value={form.expense_date} onChange={(event) => set('expense_date', event.target.value)} className={input} />)}
        {field('Company (expense for) *', <select value={form.company} onChange={(event) => set('company', event.target.value)} className={input}>
          <option value="">Select company</option>{meta.companies.map((company) => <option key={company.code} value={company.name}>{company.name}</option>)}</select>)}
        {field('Center *', <select value={form.center_code} onChange={(event) => set('center_code', event.target.value)} className={input}>
          {meta.allow_head_office && <option value="HQ">Head Office</option>}
          {meta.centers.map((center) => <option key={center.code} value={center.code}>{center.name} ({center.code})</option>)}</select>)}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field('Category *', <><input list="expense-categories" value={form.category} onChange={(event) => set('category', event.target.value)} className={input} placeholder="Pick or type your own" />
          <datalist id="expense-categories">{meta.categories.map((category) => <option key={category} value={category} />)}</datalist></>, 'Not in the list? Just type a new one.')}
        {field('Paid to', <input value={form.paid_to} onChange={(event) => set('paid_to', event.target.value)} className={input} placeholder="Vendor / person" />)}
      </div>
      <div className="mt-3">{field('What was it for? *', <input value={form.description} onChange={(event) => set('description', event.target.value)} className={input} placeholder="e.g. Generator diesel for 3 days" />)}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {field('Total amount (₹) *', <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => set('amount', event.target.value)} className={input} />)}
        {field('GST included (₹)', <input type="number" min="0" step="0.01" value={form.gst_amount} onChange={(event) => set('gst_amount', event.target.value)} className={input} placeholder="0" />)}
        {field('Payment mode *', <select value={form.payment_mode} onChange={(event) => set('payment_mode', event.target.value)} className={input}>
          {meta.payment_modes.map((mode) => <option key={mode}>{mode}</option>)}</select>)}
        {field('Bill / ref no.', <input value={form.reference_no} onChange={(event) => set('reference_no', event.target.value)} className={input} />)}
      </div>
      <div className="mt-3">{field('Notes', <input value={form.notes} onChange={(event) => set('notes', event.target.value)} className={input} placeholder="Anything an auditor should know" />)}</div>
      {gst > amount && <p className="mt-2 text-xs text-rose-600">GST cannot be more than the total amount.</p>}
      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">{busy ? 'Saving…' : expense ? 'Save changes' : 'Submit expense'}</button></div>
    </div>
  </div>;
}

/** Expense book for Center Admin (own centers), HQ Admin and Super Admin (all + Head Office). */
export function ExpenseBook({ centerCode }: { centerCode?: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState({ from: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: iso(new Date()) });
  const [filters, setFilters] = useState({ company: 'all', center: centerCode || 'all', category: 'all', mode: 'all', q: '' });
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const pageSize = 25;
  useEffect(() => { setFilters((current) => ({ ...current, center: centerCode || 'all' })); }, [centerCode]);
  const range = periodRange(period, custom);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (filters.company !== 'all') params.set('company', filters.company);
    if (filters.center !== 'all') params.set('center_code', filters.center);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.mode !== 'all') params.set('payment_mode', filters.mode);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    return params.toString();
  }, [filters, range.from, range.to]);

  const loadMeta = useCallback(() => request<Meta>('/api/expenses/meta').then(setMeta)
    .catch((cause) => setError(cause instanceof Error ? cause.message : 'Expense options unavailable')), []);
  useEffect(() => { void loadMeta(); }, [loadMeta]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request<{ data: Expense[]; total: number; summary: Summary }>(`/api/expenses?${query}&page=${page}&page_size=${pageSize}`);
      setRows(result.data); setTotal(result.total); setSummary(result.summary);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Expenses could not be loaded'); }
    finally { setLoading(false); }
  }, [page, query]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setPage(1), [query]);
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const remove = async (expense: Expense) => {
    const reason = window.prompt(`Delete "${expense.description}" (${inr(expense.amount)})?\nEnter a reason (kept for audit):`);
    if (!reason?.trim()) return;
    try { await request(`/api/expenses/${expense.id}`, { method: 'DELETE', body: { reason: reason.trim() } }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Expense could not be deleted'); }
  };
  const grand = Number(summary?.total || 0);
  const periodLabel = range.from || range.to ? `${range.from ? dayLabel(range.from) : '…'} – ${range.to ? dayLabel(range.to) : '…'}` : 'All time';
  const showCenters = (meta?.centers.length ?? 0) > 1 || meta?.allow_head_office;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><ReceiptIndianRupee className="h-4 w-4 text-indigo-600" /> Expense book</h2>
        <p className="text-[11px] text-slate-500">Record every spend against a company. Reports below update instantly · {periodLabel}</p>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <ExcelExportButton exportKey="expenses" title="Expense report" subtitle={periodLabel} columns={expenseExportColumns} rows={rows}
          fetchAll={async () => (await request<{ data: Expense[] }>(`/api/expenses?${query}&page=1&page_size=5000`)).data}
          fetchAllLabel={`All ${total} expenses matching the filters`} dateKey="date" />
        <button type="button" disabled={!meta} onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">
          <Plus className="h-3.5 w-3.5" /> Add expense</button>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex overflow-hidden rounded-lg border border-slate-200">
        {([['month', 'This month'], ['last_month', 'Last month'], ['quarter', 'This quarter'], ['fy', 'This FY'], ['all', 'All'], ['custom', 'Custom']] as const).map(([value, label]) =>
          <button key={value} type="button" onClick={() => setPeriod(value)} className={`px-2.5 py-1.5 text-[11px] font-semibold ${period === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
      </div>
      {period === 'custom' && <><input type="date" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} className={filterCls} />
        <input type="date" value={custom.to} min={custom.from} onChange={(event) => setCustom({ ...custom, to: event.target.value })} className={filterCls} /></>}
      <select value={filters.company} onChange={(event) => setFilter('company', event.target.value)} className={filterCls}>
        <option value="all">All companies</option>{meta?.companies.map((company) => <option key={company.code} value={company.name}>{company.name}</option>)}</select>
      {showCenters && <select value={filters.center} onChange={(event) => setFilter('center', event.target.value)} className={filterCls}>
        <option value="all">All centers</option>{meta?.allow_head_office && <option value="HQ">Head Office</option>}
        {meta?.centers.map((center) => <option key={center.code} value={center.code}>{center.name}</option>)}</select>}
      <select value={filters.category} onChange={(event) => setFilter('category', event.target.value)} className={filterCls}>
        <option value="all">All categories</option>{meta?.categories.map((category) => <option key={category}>{category}</option>)}</select>
      <select value={filters.mode} onChange={(event) => setFilter('mode', event.target.value)} className={filterCls}>
        <option value="all">All payment modes</option>{meta?.payment_modes.map((mode) => <option key={mode}>{mode}</option>)}</select>
      <div className="relative min-w-[180px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input value={filters.q} onChange={(event) => setFilter('q', event.target.value)} placeholder="Search description, vendor, bill no."
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:bg-white" />
      </div>
    </div>

    {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[['Total spent', inr(grand)], ['Entries', String(summary?.entries ?? 0)], ['GST included', inr(summary?.gst || 0)],
        ['Average entry', inr(summary?.average || 0)], ['Largest entry', inr(summary?.largest || 0)]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>)}
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Breakdown title="By company" rows={summary?.by_company ?? []} total={grand} onPick={(row) => setFilter('company', row.label)} />
      <Breakdown title="By category" rows={summary?.by_category ?? []} total={grand} onPick={(row) => setFilter('category', row.label)} />
      {showCenters ? <Breakdown title="By center" rows={summary?.by_center ?? []} total={grand} onPick={(row) => setFilter('center', row.code || 'all')} />
        : <Breakdown title="By payment mode" rows={summary?.by_mode ?? []} total={grand} onPick={(row) => setFilter('mode', row.label)} />}
      <MonthTrend rows={summary?.by_month ?? []} />
    </div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {loading ? <div className="p-5"><PanelLoadingSkeleton /></div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
            {['Date', 'Company', 'Center', 'Category', 'Description', 'Paid to', 'Mode', 'Amount', 'Entered by', ''].map((title) =>
              <th key={title} className={`px-3 py-2.5 font-medium ${title === 'Amount' ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/70">
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{dayLabel(row.expense_date)}</td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{row.company}</td>
              <td className="px-3 py-2.5 text-slate-600">{row.center_name}</td>
              <td className="px-3 py-2.5"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{row.category}</span></td>
              <td className="max-w-[260px] px-3 py-2.5 text-slate-700"><span className="line-clamp-2">{row.description}</span>
                {row.reference_no && <span className="block font-mono text-[10px] text-slate-400">Ref {row.reference_no}</span>}</td>
              <td className="px-3 py-2.5 text-slate-600">{row.paid_to || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{row.payment_mode}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold text-slate-900">{inr(row.amount)}
                {Number(row.gst_amount) > 0 && <span className="block text-[10px] font-normal text-slate-400">GST {inr(row.gst_amount)}</span>}</td>
              <td className="px-3 py-2.5 text-[11px] text-slate-500">{row.created_by_name}</td>
              <td className="px-3 py-2.5"><div className="flex justify-end gap-1">
                <button type="button" title="Edit" onClick={() => setEditing(row)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" title="Delete" onClick={() => void remove(row)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div></td>
            </tr>)}
            {!rows.length && <tr><td colSpan={10} className="px-4 py-16 text-center text-slate-400">No expenses in this view. Use “Add expense” to record one.</td></tr>}
          </tbody>
        </table>
      </div>}
      <div className="border-t border-slate-100"><PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} /></div>
    </section>
    {editing && meta && <ExpenseDialog meta={meta} expense={editing === 'new' ? undefined : editing}
      defaultCenter={filters.center !== 'all' ? filters.center : centerCode} onClose={() => setEditing(null)} onSaved={() => { void load(); void loadMeta(); }} />}
  </div>;
}
