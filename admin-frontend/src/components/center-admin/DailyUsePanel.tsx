import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, BookOpenText, ClipboardCheck, Layers, PackagePlus, Pencil,
  Search, SlidersHorizontal, SprayCan, Undo2, Users, X,
} from 'lucide-react';
import { request } from '@/lib/api';
import { PanelLoadingSkeleton } from '@/components/LoadingSkeletons';
import { ExcelExportButton } from '@/components/ExcelExportButton';
import type { ExportColumn } from '@/lib/excelExport';

type DailyItem = {
  id: number; item_code: string; center_code: string; name: string; category: string; unit: string; qty: number; threshold: number;
  is_active: boolean; avg_cost: number; stock_value: number; month_in: number; month_out: number; month_spend: number;
  last_movement_at: string | null;
};
type StockSummary = { item_count: number; low_stock: number; out_of_stock: number; stock_value: number; month_spend: number;
  month_issued: number; month_issued_value: number; month_writeoff_value: number };
type Direction = 'opening' | 'purchase' | 'issue' | 'return' | 'adjust_in' | 'adjust_out';
type LedgerRow = {
  id: number; voucher_no: string; entry_date: string; created_at: string; item_id: number; item_code: string; item_name: string;
  category: string; unit: string; direction: Direction; qty: number; qty_in: number; qty_out: number; balance_after: number;
  rate: number | null; value: number | null; amount: number | null; vendor: string | null; bill_no: string | null;
  bill_date: string | null; payment_mode: string | null; handed_to: string | null; department: string | null;
  reason: string | null; note: string | null; actor_name: string; actor_role: string;
};
type SummaryRow = {
  id: number; item_code: string; name: string; category: string; unit: string; threshold: number; avg_cost: number;
  opening_qty: number; purchased_qty: number; purchase_value: number; returned_qty: number; issued_qty: number; issued_value: number;
  adjusted_in_qty: number; adjusted_out_qty: number; writeoff_value: number; inward_qty: number; outward_qty: number;
  closing_qty: number; closing_value: number;
};
type ConsumptionRow = { person: string; department: string; item_name: string; unit: string; issued_qty: number; returned_qty: number;
  net_qty: number; net_value: number; entries: number; last_at: string };
type Meta = { categories: string[]; adjust_reasons: { adjust_in: string[]; adjust_out: string[] }; payment_modes: string[] };
type View = 'stock' | 'register' | 'summary' | 'consumption';
type EntryKind = 'purchase' | 'issue' | 'return' | 'adjust' | 'count';
type Dialog = { kind: 'item'; item?: DailyItem } | { kind: EntryKind; item: DailyItem };

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const filterCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400';
const inr = (value: number | null | undefined) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (value: string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const iso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const join = (...parts: string[]) => parts.filter(Boolean).join('&');
const monthStart = () => { const now = new Date(); return iso(new Date(now.getFullYear(), now.getMonth(), 1)); };
const directionMeta: Record<Direction, { label: string; tone: string }> = {
  opening: { label: 'Opening', tone: 'bg-slate-100 text-slate-700' },
  purchase: { label: 'Stock in', tone: 'bg-emerald-50 text-emerald-700' },
  issue: { label: 'Issued', tone: 'bg-indigo-50 text-indigo-700' },
  return: { label: 'Returned', tone: 'bg-sky-50 text-sky-700' },
  adjust_in: { label: 'Adjust +', tone: 'bg-amber-50 text-amber-700' },
  adjust_out: { label: 'Adjust −', tone: 'bg-rose-50 text-rose-700' },
};
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) =>
  <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}
    {hint && <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>}</label>;

const itemColumns: ExportColumn<DailyItem>[] = [
  { key: 'code', label: 'Item code', value: (row) => row.item_code },
  { key: 'name', label: 'Item', value: (row) => row.name },
  { key: 'category', label: 'Category', value: (row) => row.category },
  { key: 'unit', label: 'Unit', value: (row) => row.unit },
  { key: 'qty', label: 'In stock', value: (row) => row.qty, type: 'number' },
  { key: 'threshold', label: 'Reorder level', value: (row) => row.threshold, type: 'number' },
  { key: 'status', label: 'Status', value: (row) => (row.qty === 0 ? 'Out of stock' : row.qty <= row.threshold ? 'Low stock' : 'OK') },
  { key: 'avg', label: 'Avg cost / unit', value: (row) => row.avg_cost, type: 'currency' },
  { key: 'value', label: 'Stock value', value: (row) => row.stock_value, type: 'currency' },
  { key: 'in', label: 'In this month', value: (row) => row.month_in, type: 'number', defaultOn: false },
  { key: 'out', label: 'Out this month', value: (row) => row.month_out, type: 'number', defaultOn: false },
  { key: 'spend', label: 'Purchased this month', value: (row) => row.month_spend, type: 'currency', defaultOn: false },
];
const ledgerColumns: ExportColumn<LedgerRow>[] = [
  { key: 'voucher', label: 'Voucher no.', value: (row) => row.voucher_no },
  { key: 'date', label: 'Date', value: (row) => row.entry_date, type: 'date' },
  { key: 'time', label: 'Entered at', value: (row) => row.created_at, type: 'datetime', defaultOn: false },
  { key: 'type', label: 'Entry type', value: (row) => directionMeta[row.direction].label },
  { key: 'code', label: 'Item code', value: (row) => row.item_code, defaultOn: false },
  { key: 'item', label: 'Item', value: (row) => row.item_name },
  { key: 'category', label: 'Category', value: (row) => row.category, defaultOn: false },
  { key: 'in', label: 'Qty in', value: (row) => row.qty_in || null, type: 'number' },
  { key: 'out', label: 'Qty out', value: (row) => row.qty_out || null, type: 'number' },
  { key: 'balance', label: 'Balance', value: (row) => row.balance_after, type: 'number' },
  { key: 'unit', label: 'Unit', value: (row) => row.unit },
  { key: 'rate', label: 'Rate', value: (row) => row.rate, type: 'currency', defaultOn: false },
  { key: 'value', label: 'Value', value: (row) => row.value, type: 'currency' },
  { key: 'person', label: 'Given to / returned by', value: (row) => row.handed_to },
  { key: 'dept', label: 'Department', value: (row) => row.department },
  { key: 'vendor', label: 'Vendor', value: (row) => row.vendor },
  { key: 'bill', label: 'Bill no.', value: (row) => row.bill_no },
  { key: 'billDate', label: 'Bill date', value: (row) => row.bill_date, type: 'date', defaultOn: false },
  { key: 'mode', label: 'Payment mode', value: (row) => row.payment_mode, defaultOn: false },
  { key: 'reason', label: 'Adjustment reason', value: (row) => row.reason },
  { key: 'note', label: 'Note', value: (row) => row.note },
  { key: 'by', label: 'Entered by', value: (row) => row.actor_name },
];
const summaryColumns: ExportColumn<SummaryRow>[] = [
  { key: 'code', label: 'Item code', value: (row) => row.item_code },
  { key: 'name', label: 'Item', value: (row) => row.name },
  { key: 'category', label: 'Category', value: (row) => row.category },
  { key: 'unit', label: 'Unit', value: (row) => row.unit },
  { key: 'opening', label: 'Opening qty', value: (row) => row.opening_qty, type: 'number' },
  { key: 'purchased', label: 'Purchased qty', value: (row) => row.purchased_qty, type: 'number' },
  { key: 'returned', label: 'Returned qty', value: (row) => row.returned_qty, type: 'number' },
  { key: 'adjIn', label: 'Adjusted in', value: (row) => row.adjusted_in_qty, type: 'number', defaultOn: false },
  { key: 'inward', label: 'Total in', value: (row) => row.inward_qty, type: 'number' },
  { key: 'issued', label: 'Issued qty', value: (row) => row.issued_qty, type: 'number' },
  { key: 'adjOut', label: 'Written off', value: (row) => row.adjusted_out_qty, type: 'number' },
  { key: 'outward', label: 'Total out', value: (row) => row.outward_qty, type: 'number' },
  { key: 'closing', label: 'Closing qty', value: (row) => row.closing_qty, type: 'number' },
  { key: 'purchaseValue', label: 'Purchase value', value: (row) => row.purchase_value, type: 'currency' },
  { key: 'issuedValue', label: 'Consumption value', value: (row) => row.issued_value, type: 'currency' },
  { key: 'writeoff', label: 'Write-off value', value: (row) => row.writeoff_value, type: 'currency', defaultOn: false },
  { key: 'closingValue', label: 'Closing value', value: (row) => row.closing_value, type: 'currency' },
];
const consumptionColumns: ExportColumn<ConsumptionRow>[] = [
  { key: 'person', label: 'Person', value: (row) => row.person },
  { key: 'dept', label: 'Department', value: (row) => row.department },
  { key: 'item', label: 'Item', value: (row) => row.item_name },
  { key: 'issued', label: 'Issued', value: (row) => row.issued_qty, type: 'number' },
  { key: 'returned', label: 'Returned', value: (row) => row.returned_qty, type: 'number' },
  { key: 'net', label: 'Net used', value: (row) => row.net_qty, type: 'number' },
  { key: 'unit', label: 'Unit', value: (row) => row.unit },
  { key: 'value', label: 'Value', value: (row) => row.net_value, type: 'currency' },
  { key: 'entries', label: 'Entries', value: (row) => row.entries, type: 'number', defaultOn: false },
  { key: 'last', label: 'Last issued', value: (row) => row.last_at, type: 'datetime', defaultOn: false },
];

function EntryDialog({ dialog, meta, centerCode, onClose, onDone }: { dialog: Dialog; meta: Meta; centerCode?: string; onClose: () => void; onDone: () => void }) {
  const item = dialog.item;
  const [form, setForm] = useState({
    name: item?.name ?? '', unit: item?.unit ?? 'piece', category: item?.category ?? meta.categories[0], threshold: String(item?.threshold ?? 5),
    opening_qty: '', opening_rate: '', qty: '1', amount: '', rate: '', vendor: '', bill_no: '', bill_date: '', payment_mode: 'Cash',
    handed_to: '', department: 'Housekeeping', note: '', direction: 'adjust_out' as 'adjust_in' | 'adjust_out', reason: '',
    physical_qty: String(item?.qty ?? ''),
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const qty = Math.trunc(Number(form.qty));
  const amount = form.amount !== '' ? Number(form.amount) : Number(form.rate || 0) * qty;
  const reasons = meta.adjust_reasons[form.direction];
  const variance = item ? Math.trunc(Number(form.physical_qty)) - item.qty : 0;
  const valid = dialog.kind === 'item' ? form.name.trim() && form.unit.trim() && Number(form.threshold) >= 0
    : dialog.kind === 'count' ? form.physical_qty !== '' && Number(form.physical_qty) >= 0
    : qty >= 1 && (dialog.kind !== 'issue' || (qty <= item!.qty && form.handed_to.trim()))
      && (dialog.kind !== 'return' || form.handed_to.trim())
      && (dialog.kind !== 'purchase' || amount >= 0)
      && (dialog.kind !== 'adjust' || (reasons.includes(form.reason) && form.note.trim() && (form.direction === 'adjust_in' || qty <= item!.qty)));
  const save = async () => {
    if (!valid || busy) return; setBusy(true); setError('');
    try {
      if (dialog.kind === 'item' && dialog.item) await request(`/api/daily-use/items/${dialog.item.id}`, { method: 'PATCH',
        body: { name: form.name.trim(), unit: form.unit.trim(), category: form.category, threshold: Math.trunc(Number(form.threshold)) } });
      else if (dialog.kind === 'item') await request('/api/daily-use/items', { method: 'POST', body: {
        name: form.name.trim(), unit: form.unit.trim(), category: form.category, threshold: Math.trunc(Number(form.threshold)),
        opening_qty: Math.trunc(Number(form.opening_qty || 0)), opening_rate: Number(form.opening_rate || 0), center_code: centerCode || undefined } });
      else if (dialog.kind === 'count') await request(`/api/daily-use/items/${item!.id}/count`, { method: 'POST',
        body: { physical_qty: Math.trunc(Number(form.physical_qty)), note: form.note.trim() } });
      else await request(`/api/daily-use/items/${item!.id}/movements`, { method: 'POST', body: {
        type: dialog.kind === 'adjust' ? form.direction : dialog.kind, qty,
        amount: dialog.kind === 'purchase' ? Math.round(amount * 100) / 100 : undefined,
        vendor: form.vendor.trim(), bill_no: form.bill_no.trim(), bill_date: form.bill_date || undefined,
        payment_mode: dialog.kind === 'purchase' ? form.payment_mode : undefined,
        handed_to: form.handed_to.trim(), department: form.department.trim(), reason: dialog.kind === 'adjust' ? form.reason : undefined,
        note: form.note.trim() } });
      onDone(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save'); setBusy(false); }
  };
  const titles: Record<Dialog['kind'], string> = { item: item ? `Edit · ${item.name}` : 'Add daily-use item', purchase: `Stock in (GRN) · ${item?.name}`,
    issue: `Issue / hand over · ${item?.name}`, return: `Return to store · ${item?.name}`, adjust: `Adjust stock · ${item?.name}`, count: `Physical count · ${item?.name}` };
  const hints: Record<Dialog['kind'], string> = { item: 'e.g. Surf Excel 1kg, Harpic 500ml, Phenyl 5L, Tissue roll',
    purchase: 'Record what the center bought, from whom, and what was paid. Cost is averaged automatically.',
    issue: `In stock: ${item?.qty} ${item?.unit}. Record who received it.`, return: 'Unused items coming back to the store.',
    adjust: 'Damaged, expired, lost or found stock. A reason and note are mandatory for audit.',
    count: `Books show ${item?.qty} ${item?.unit}. Enter what is actually on the shelf — the difference is posted as an adjustment.` };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
    <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-base font-bold text-slate-900">{titles[dialog.kind]}</p>
        <p className="mt-1 text-xs text-slate-500">{hints[dialog.kind]}</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="space-y-3">
        {dialog.kind === 'item' && <>
          <Field label="Item name *"><input value={form.name} onChange={(event) => set('name', event.target.value)} className={input} autoFocus /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category"><select value={form.category} onChange={(event) => set('category', event.target.value)} className={input}>{meta.categories.map((category) => <option key={category}>{category}</option>)}</select></Field>
            <Field label="Unit *"><input value={form.unit} onChange={(event) => set('unit', event.target.value)} className={input} placeholder="packet / litre" /></Field>
            <Field label="Reorder level"><input type="number" min="0" value={form.threshold} onChange={(event) => set('threshold', event.target.value)} className={input} /></Field>
          </div>
          {!item && <div className="grid grid-cols-2 gap-3">
            <Field label="Opening stock (optional)"><input type="number" min="0" value={form.opening_qty} onChange={(event) => set('opening_qty', event.target.value)} className={input} placeholder="0" /></Field>
            <Field label="Opening rate per unit (₹)"><input type="number" min="0" step="0.01" value={form.opening_rate} onChange={(event) => set('opening_rate', event.target.value)} className={input} placeholder="0" /></Field>
          </div>}
        </>}
        {dialog.kind === 'count' && <>
          <Field label={`Physical quantity (${item!.unit}) *`}><input type="number" min="0" value={form.physical_qty} onChange={(event) => set('physical_qty', event.target.value)} className={input} autoFocus /></Field>
          {form.physical_qty !== '' && <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
            {variance === 0 ? 'Matches the books — nothing to adjust.' : `Variance ${variance > 0 ? '+' : ''}${variance} ${item!.unit} will be posted as a count correction.`}</p>}
          <Field label="Note"><input value={form.note} onChange={(event) => set('note', event.target.value)} className={input} placeholder="e.g. Month-end stock take" /></Field>
        </>}
        {['purchase', 'issue', 'return', 'adjust'].includes(dialog.kind) && <>
          {dialog.kind === 'adjust' && <div className="grid grid-cols-2 gap-2">
            {(['adjust_out', 'adjust_in'] as const).map((direction) => <button key={direction} type="button" onClick={() => setForm((current) => ({ ...current, direction, reason: '' }))}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${form.direction === direction ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>
              {direction === 'adjust_out' ? 'Reduce stock (write-off)' : 'Increase stock (found)'}</button>)}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Quantity (${item!.unit}) *`}><input type="number" min="1" value={form.qty} onChange={(event) => set('qty', event.target.value)} className={input} autoFocus /></Field>
            {dialog.kind === 'purchase' && <Field label="Total amount paid (₹) *" hint={form.amount === '' && form.rate ? `= ${inr(amount)}` : undefined}>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => set('amount', event.target.value)} className={input} placeholder="or fill rate →" /></Field>}
            {(dialog.kind === 'issue' || dialog.kind === 'return') && <Field label={dialog.kind === 'issue' ? 'Handed over to *' : 'Returned by *'}>
              <input value={form.handed_to} onChange={(event) => set('handed_to', event.target.value)} className={input} placeholder="e.g. Ram" /></Field>}
            {dialog.kind === 'adjust' && <Field label="Reason *"><select value={form.reason} onChange={(event) => set('reason', event.target.value)} className={input}>
              <option value="">Select reason</option>{reasons.map((reason) => <option key={reason}>{reason}</option>)}</select></Field>}
          </div>
          {dialog.kind === 'purchase' && <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rate per unit (₹)"><input type="number" min="0" step="0.01" value={form.rate} onChange={(event) => set('rate', event.target.value)} className={input} placeholder="optional" /></Field>
              <Field label="Payment mode"><select value={form.payment_mode} onChange={(event) => set('payment_mode', event.target.value)} className={input}>{meta.payment_modes.map((mode) => <option key={mode}>{mode}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Vendor / shop"><input value={form.vendor} onChange={(event) => set('vendor', event.target.value)} className={input} /></Field>
              <Field label="Bill no."><input value={form.bill_no} onChange={(event) => set('bill_no', event.target.value)} className={input} /></Field>
              <Field label="Bill date"><input type="date" max={iso(new Date())} value={form.bill_date} onChange={(event) => set('bill_date', event.target.value)} className={input} /></Field>
            </div>
          </>}
          {(dialog.kind === 'issue' || dialog.kind === 'return') && <Field label="Department"><input value={form.department} onChange={(event) => set('department', event.target.value)} className={input} /></Field>}
          <Field label={dialog.kind === 'adjust' ? 'Note *' : 'Note'}><input value={form.note} onChange={(event) => set('note', event.target.value)} className={input}
            placeholder={dialog.kind === 'issue' ? 'e.g. Floor 2 washrooms' : dialog.kind === 'adjust' ? 'What happened?' : ''} /></Field>
          {dialog.kind === 'issue' && qty > item!.qty && <p className="text-xs text-rose-600">Only {item!.qty} {item!.unit} in stock.</p>}
        </>}
      </div>
      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">{busy ? 'Saving…' : 'Save entry'}</button></div>
    </div>
  </div>;
}

function useRange() {
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(iso(new Date()));
  return { from, to, setFrom, setTo, query: `from=${from}&to=${to}` };
}

function RangePicker({ range }: { range: ReturnType<typeof useRange> }) {
  return <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
    <input type="date" value={range.from} max={range.to} onChange={(event) => range.setFrom(event.target.value)} className={filterCls} />
    to <input type="date" value={range.to} min={range.from} onChange={(event) => range.setTo(event.target.value)} className={filterCls} />
  </div>;
}

/** Daily-use consumables register for one center. HQ/Super Admin pass the center they are viewing. */
export function DailyUsePanel({ centerCode, requireCenter = false }: { centerCode?: string; requireCenter?: boolean }) {
  const [view, setView] = useState<View>('stock');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<DailyItem[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [stockRows, setStockRows] = useState<SummaryRow[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('all');
  const [ledgerType, setLedgerType] = useState('all'); const [ledgerItem, setLedgerItem] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const range = useRange();
  const scope = centerCode ? `center_code=${encodeURIComponent(centerCode)}` : '';
  const blocked = requireCenter && !centerCode;
  const registerSearch = view === 'register' ? query.trim() : '';

  useEffect(() => { void request<Meta>('/api/daily-use/meta').then(setMeta).catch(() => undefined); }, []);
  const load = useCallback(async () => {
    if (blocked) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const stock = await request<{ items: DailyItem[]; summary: StockSummary }>(`/api/daily-use/items?${scope}`);
      setItems(stock.items); setSummary(stock.summary);
      if (view === 'register') setLedger((await request<{ rows: LedgerRow[] }>(`/api/daily-use/register?${join(scope, range.query,
        ledgerType !== 'all' ? `type=${ledgerType}` : '', ledgerItem ? `item_id=${ledgerItem}` : '', registerSearch ? `q=${encodeURIComponent(registerSearch)}` : '', 'limit=2000')}`)).rows);
      if (view === 'summary') setStockRows((await request<{ rows: SummaryRow[] }>(`/api/daily-use/summary?${join(scope, range.query)}`)).rows);
      if (view === 'consumption') setConsumption((await request<{ rows: ConsumptionRow[] }>(`/api/daily-use/consumption?${join(scope, range.query)}`)).rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Daily-use stock could not be loaded'); }
    finally { setLoading(false); }
  }, [blocked, scope, view, range.query, ledgerType, ledgerItem, registerSearch]);
  useEffect(() => { void load(); }, [load]);

  const activeItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items.filter((item) => item.is_active && (category === 'all' || item.category === category)
      && (!value || `${item.name} ${item.item_code}`.toLowerCase().includes(value)));
  }, [category, items, query]);
  const removeItem = async (item: DailyItem) => {
    if (item.qty > 0 && !window.confirm(`${item.name} still has ${item.qty} ${item.unit} in stock. Remove it anyway? History is kept.`)) return;
    if (item.qty === 0 && !window.confirm(`Remove ${item.name} from the list? History is kept.`)) return;
    try { await request(`/api/daily-use/items/${item.id}`, { method: 'PATCH', body: { is_active: false } }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Item could not be removed'); }
  };
  const totals = (rows: SummaryRow[]) => rows.reduce((sum, row) => ({ purchase: sum.purchase + Number(row.purchase_value), issued: sum.issued + Number(row.issued_value),
    closing: sum.closing + Number(row.closing_value), writeoff: sum.writeoff + Number(row.writeoff_value) }), { purchase: 0, issued: 0, closing: 0, writeoff: 0 });

  if (blocked) return <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
    Select a center from the center filter to view its daily-use stock.</div>;

  const periodLabel = `${range.from} to ${range.to}`;
  const views: { key: View; label: string; icon: typeof Layers }[] = [
    { key: 'stock', label: 'Stock', icon: Layers }, { key: 'register', label: 'Stock register (in / out)', icon: BookOpenText },
    { key: 'summary', label: 'Stock summary', icon: ClipboardCheck }, { key: 'consumption', label: 'Consumption by person', icon: Users },
  ];
  const sumTotals = totals(stockRows);

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[['Items tracked', String(summary?.item_count ?? 0)], ['Low stock', String(summary?.low_stock ?? 0)], ['Out of stock', String(summary?.out_of_stock ?? 0)],
        ['Stock value', inr(summary?.stock_value)], ['Purchased this month', inr(summary?.month_spend)], ['Consumed this month', inr(summary?.month_issued_value)]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className={`mt-1 text-lg font-semibold ${(label === 'Low stock' || label === 'Out of stock') && value !== '0' ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
        </div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
        {views.map((option) => <button key={option.key} type="button" onClick={() => setView(option.key)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${view === option.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <option.icon className="h-3.5 w-3.5" /> {option.label}</button>)}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {view !== 'stock' && <RangePicker range={range} />}
        {view === 'stock' && <ExcelExportButton exportKey="daily-stock" title="Daily-use stock" columns={itemColumns} rows={activeItems} />}
        {view === 'register' && <ExcelExportButton exportKey="daily-register" title="Stock register" subtitle={periodLabel} columns={ledgerColumns} rows={ledger} dateKey="date" />}
        {view === 'summary' && <ExcelExportButton exportKey="daily-summary" title="Stock summary" subtitle={periodLabel} columns={summaryColumns} rows={stockRows} />}
        {view === 'consumption' && <ExcelExportButton exportKey="daily-consumption" title="Consumption report" subtitle={periodLabel} columns={consumptionColumns} rows={consumption} />}
        <button type="button" disabled={!meta} onClick={() => setDialog({ kind: 'item' })} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">
          <PackagePlus className="h-3.5 w-3.5" /> Add item</button>
      </div>
    </div>
    {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <SprayCan className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-slate-900">{views.find((option) => option.key === view)?.label}</h2>
        {(view === 'stock' || view === 'register') && <div className="relative ml-auto min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'stock' ? 'Search item or code' : 'Search item, person, vendor, bill'}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:bg-white" />
        </div>}
        {view === 'stock' && <select value={category} onChange={(event) => setCategory(event.target.value)} className={filterCls}>
          <option value="all">All categories</option>{meta?.categories.map((option) => <option key={option}>{option}</option>)}</select>}
        {view === 'register' && <>
          <select value={ledgerType} onChange={(event) => setLedgerType(event.target.value)} className={filterCls}>
            <option value="all">All entries</option><option value="purchase">Stock in (GRN)</option><option value="issue">Issued</option>
            <option value="return">Returned</option><option value="adjust">Adjustments</option><option value="opening">Opening</option></select>
          <select value={ledgerItem} onChange={(event) => setLedgerItem(event.target.value)} className={filterCls}>
            <option value="">All items</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </>}
      </div>

      {loading ? <div className="p-5"><PanelLoadingSkeleton /></div> : <div className="overflow-x-auto">
        {view === 'stock' && <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
            {['Item', 'Category', 'In stock', 'Status', 'Avg cost', 'Stock value', 'This month in / out', ''].map((title) =>
              <th key={title} className={`px-4 py-2.5 font-medium ${['In stock', 'Avg cost', 'Stock value'].includes(title) ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {activeItems.map((item) => {
              const status = item.qty === 0 ? ['Out of stock', 'bg-rose-100 text-rose-800'] : item.qty <= item.threshold ? ['Low stock', 'bg-rose-50 text-rose-700'] : ['OK', 'bg-emerald-50 text-emerald-700'];
              return <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3"><span className="font-medium text-slate-900">{item.name}</span>
                  <span className="block font-mono text-[10px] text-slate-400">{item.item_code} · {item.unit} · reorder at {item.threshold}</span></td>
                <td className="px-4 py-3 text-slate-600">{item.category}</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{item.qty}</td>
                <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${status[1]}`}>
                  {status[0] !== 'OK' && <AlertTriangle className="h-3 w-3" />}{status[0]}</span></td>
                <td className="px-4 py-3 text-right font-mono">{inr(item.avg_cost)}</td>
                <td className="px-4 py-3 text-right font-mono">{inr(item.stock_value)}</td>
                <td className="px-4 py-3 font-mono text-[11px]"><span className="text-emerald-700">+{item.month_in}</span> / <span className="text-indigo-700">−{item.month_out}</span></td>
                <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1">
                  <button type="button" onClick={() => setDialog({ kind: 'purchase', item })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"><ArrowDownToLine className="h-3 w-3" /> Stock in</button>
                  <button type="button" disabled={!item.qty} onClick={() => setDialog({ kind: 'issue', item })} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"><ArrowUpFromLine className="h-3 w-3" /> Issue</button>
                  <button type="button" onClick={() => setDialog({ kind: 'return', item })} title="Return to store" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-50"><Undo2 className="h-3 w-3" /></button>
                  <button type="button" onClick={() => setDialog({ kind: 'adjust', item })} title="Adjust (damaged / found)" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-50"><SlidersHorizontal className="h-3 w-3" /></button>
                  <button type="button" onClick={() => setDialog({ kind: 'count', item })} title="Physical count" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"><ClipboardCheck className="h-3 w-3" /></button>
                  <button type="button" onClick={() => setDialog({ kind: 'item', item })} title="Edit item" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"><Pencil className="h-3 w-3" /></button>
                  <button type="button" onClick={() => void removeItem(item)} title="Remove item" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-3 w-3" /></button>
                </div></td>
              </tr>;
            })}
            {!activeItems.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">No items yet. Add Surf, Soap, Phenyl etc. to start the register.</td></tr>}
          </tbody>
        </table>}

        {view === 'register' && <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
            {['Voucher', 'Date', 'Type', 'Item', 'In', 'Out', 'Balance', 'Value', 'Party / person', 'Details', 'By'].map((title) =>
              <th key={title} className={`px-3 py-2.5 font-medium ${['In', 'Out', 'Balance', 'Value'].includes(title) ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.map((row) => <tr key={row.id} className="hover:bg-slate-50/70">
              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{row.voucher_no}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{when(row.created_at)}</td>
              <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${directionMeta[row.direction].tone}`}>{directionMeta[row.direction].label}</span></td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{row.item_name}</td>
              <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{row.qty_in || ''}</td>
              <td className="px-3 py-2.5 text-right font-mono text-indigo-700">{row.qty_out || ''}</td>
              <td className="px-3 py-2.5 text-right font-mono font-semibold">{row.balance_after} <span className="text-[10px] font-normal text-slate-400">{row.unit}</span></td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(row.value)}</td>
              <td className="px-3 py-2.5 text-slate-700">{row.handed_to || row.vendor || '—'}{row.department && <span className="block text-[10px] text-slate-400">{row.department}</span>}</td>
              <td className="max-w-[220px] px-3 py-2.5 text-[11px] text-slate-500">{[row.reason, row.bill_no && `Bill ${row.bill_no}`, row.payment_mode, row.note].filter(Boolean).join(' · ') || '—'}</td>
              <td className="px-3 py-2.5 text-[11px] text-slate-500">{row.actor_name}</td>
            </tr>)}
            {!ledger.length && <tr><td colSpan={11} className="px-4 py-14 text-center text-slate-400">No entries in this period.</td></tr>}
          </tbody>
        </table>}

        {view === 'summary' && <table className="w-full min-w-[1000px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
            {['Item', 'Opening', 'Purchased', 'Returned', 'Issued', 'Written off', 'Closing', 'Purchase value', 'Consumed value', 'Closing value'].map((title) =>
              <th key={title} className={`px-3 py-2.5 font-medium ${title === 'Item' ? 'text-left' : 'text-right'}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {stockRows.map((row) => <tr key={row.id} className="hover:bg-slate-50/70">
              <td className="px-3 py-2.5"><span className="font-medium text-slate-900">{row.name}</span><span className="block text-[10px] text-slate-400">{row.item_code} · {row.unit}</span></td>
              <td className="px-3 py-2.5 text-right font-mono">{row.opening_qty}</td>
              <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{row.purchased_qty || ''}</td>
              <td className="px-3 py-2.5 text-right font-mono text-sky-700">{row.returned_qty || ''}</td>
              <td className="px-3 py-2.5 text-right font-mono text-indigo-700">{row.issued_qty || ''}</td>
              <td className="px-3 py-2.5 text-right font-mono text-rose-700">{(row.adjusted_out_qty - row.adjusted_in_qty) || ''}</td>
              <td className={`px-3 py-2.5 text-right font-mono font-semibold ${row.closing_qty <= row.threshold ? 'text-rose-600' : ''}`}>{row.closing_qty}</td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(row.purchase_value)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(row.issued_value)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(row.closing_value)}</td>
            </tr>)}
            {!stockRows.length && <tr><td colSpan={10} className="px-4 py-14 text-center text-slate-400">No items for this period.</td></tr>}
            {stockRows.length > 0 && <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2.5" colSpan={7}>Total</td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(sumTotals.purchase)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(sumTotals.issued)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(sumTotals.closing)}</td></tr>}
          </tbody>
        </table>}

        {view === 'consumption' && <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>
            {['Person', 'Department', 'Item', 'Issued', 'Returned', 'Net used', 'Value', 'Last issued'].map((title) =>
              <th key={title} className={`px-3 py-2.5 font-medium ${['Issued', 'Returned', 'Net used', 'Value'].includes(title) ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {consumption.map((row, index) => <tr key={`${row.person}-${row.item_name}-${index}`} className="hover:bg-slate-50/70">
              <td className="px-3 py-2.5 font-medium text-slate-900">{row.person}</td>
              <td className="px-3 py-2.5 text-slate-600">{row.department}</td>
              <td className="px-3 py-2.5 text-slate-700">{row.item_name}</td>
              <td className="px-3 py-2.5 text-right font-mono">{row.issued_qty}</td>
              <td className="px-3 py-2.5 text-right font-mono text-sky-700">{row.returned_qty || ''}</td>
              <td className="px-3 py-2.5 text-right font-mono font-semibold">{row.net_qty} <span className="text-[10px] font-normal text-slate-400">{row.unit}</span></td>
              <td className="px-3 py-2.5 text-right font-mono">{inr(row.net_value)}</td>
              <td className="px-3 py-2.5 text-[11px] text-slate-500">{when(row.last_at)}</td>
            </tr>)}
            {!consumption.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">Nothing was issued in this period.</td></tr>}
          </tbody>
        </table>}
      </div>}
    </section>
    {dialog && meta && <EntryDialog dialog={dialog} meta={meta} centerCode={centerCode} onClose={() => setDialog(null)} onDone={() => void load()} />}
  </div>;
}
