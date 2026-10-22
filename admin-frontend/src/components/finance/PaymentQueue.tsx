import { CheckCircle2, Clock3, Landmark, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PaymentCard, type PaymentRow } from '@/components/payments/PaymentCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { request, type Paged } from '@/lib/api';
import { TableLoadingSkeleton } from '@/components/LoadingSkeletons';
import { ExcelExportButton } from '@/components/ExcelExportButton';
import type { ExportColumn } from '@/lib/excelExport';
import { typeLabels, type RequestType } from '@/components/models';

const humanise = (value: string | null) => (value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '');
const paymentColumns: ExportColumn<PaymentRow>[] = [
  { key: 'ref', label: 'Request ID', value: (row) => row.ref_id },
  { key: 'type', label: 'Category', value: (row) => typeLabels[row.type as RequestType] ?? row.type },
  { key: 'subject', label: 'Subject', value: (row) => row.subject, width: 40 },
  { key: 'employee', label: 'Employee', value: (row) => row.employee_name },
  { key: 'charge', label: 'Charged to center', value: (row) => row.charge_center_code },
  { key: 'approval', label: 'Approval center', value: (row) => row.approval_center_code, defaultOn: false },
  { key: 'estimated', label: 'Estimated amount', value: (row) => row.estimated_amount, type: 'currency' },
  { key: 'actual', label: 'Final amount', value: (row) => row.actual_amount, type: 'currency' },
  { key: 'status', label: 'Payment status', value: (row) => humanise(row.status) },
  { key: 'vendor', label: 'Vendor', value: (row) => row.vendor_name },
  { key: 'invoice', label: 'Invoice no.', value: (row) => row.invoice_number },
  { key: 'method', label: 'Payment method', value: (row) => row.payment_method },
  { key: 'txn', label: 'Transaction ref', value: (row) => row.transaction_ref },
  { key: 'due', label: 'Due by', value: (row) => row.due_at, type: 'datetime', defaultOn: false },
];

async function fetchAllPayments(status: string) {
  const all: PaymentRow[] = [];
  for (let page = 1; all.length < 5000; page += 1) {
    const result = await request<Paged<PaymentRow>>(`/api/payments?status=${status}&page=${page}&page_size=100`);
    all.push(...result.data);
    if (all.length >= result.total || !result.data.length) break;
  }
  return all;
}

export function PaymentQueue({ defaultStatus = 'all' }: { defaultStatus?: string }) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState(defaultStatus);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestedId, setRequestedId] = useState('');
  useEffect(() => { setRequestedId(new URLSearchParams(window.location.search).get('request') || ''); }, []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request<Paged<PaymentRow>>(`/api/payments?status=${status}&page=${page}&page_size=25${requestedId ? `&request_id=${encodeURIComponent(requestedId)}` : ''}`);
      setRows(result.data); setTotal(result.total);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payment queue unavailable'); }
    finally { setLoading(false); }
  }, [page, requestedId, status]);
  useEffect(() => { void load(); }, [load]);
  const metrics = useMemo(() => ({
    pending: rows.filter((row) => row.status !== 'paid').length,
    paid: rows.filter((row) => row.status === 'paid').length,
    value: rows.reduce((sum, row) => sum + Number(row.actual_amount ?? row.estimated_amount ?? 0), 0),
  }), [rows]);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard icon={Clock3} label="Open on this page" value={metrics.pending} hint="Needs update or verification" tone="amber" />
      <MetricCard icon={CheckCircle2} label="Paid on this page" value={metrics.paid} hint={`${total} total matching records`} tone="emerald" />
      <MetricCard icon={Landmark} label="Page value" value={`₹${metrics.value.toLocaleString('en-IN')}`} hint="Estimated or final amount" tone="indigo" />
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="mr-auto"><h2 className="text-sm font-semibold text-slate-900">Payment action queue</h2><p className="mt-0.5 text-[10px] text-slate-500">Policy limits are enforced by the backend for every action.</p></div>
        <ExcelExportButton exportKey="payments" title="Payments" subtitle={`Queue: ${status.replaceAll('_', ' ')}`} columns={paymentColumns}
          rows={rows} fetchAll={() => fetchAllPayments(status)} fetchAllLabel={`All ${total} payments in this queue`} />
        {requestedId && <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700"><Search className="h-3 w-3" /> Request #{requestedId}</span>}
        {([['all','All'],['awaiting_update','Need update'],['awaiting_verification','Verify'],['paid','Paid']] as const).map(([value,label]) =>
          <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${status === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
      </div>
      {error && <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
      {loading ? <div className="p-4"><TableLoadingSkeleton rows={5} columns={4} /></div> :
        <div className="grid gap-3 bg-slate-50/60 p-4 lg:grid-cols-2">{rows.map((row) => <PaymentCard key={row.request_id} row={row} onDone={() => void load()} />)}</div>}
      {!loading && !rows.length && <div className="py-20 text-center text-xs text-slate-400">No payments in this queue.</div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
        <span>{total} records</span><div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-30">Previous</button>
          <span>Page {page}</span><button disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-30">Next</button>
        </div>
      </div>
    </section>
  </div>;
}
