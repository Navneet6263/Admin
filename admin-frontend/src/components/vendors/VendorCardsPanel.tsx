import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { PaginationBar } from '@/components/PaginationBar';
import { vendorButton, vendorInput, type VendorCard, type VendorPage } from './vendorTypes';
import { VendorSendDialog } from './VendorSendDialog';
import { ReconcileDelivery } from './ReconcileDelivery';

export function VendorCardsPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [sending, setSending] = useState<number[] | null>(null);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<VendorPage<VendorCard>>({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setChecked([]); setError('');
    const timer = setTimeout(() => {
      request<VendorPage<VendorCard>>(`/api/vendor-cards?page=${page}&search=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then(setData).catch(error => { if (!controller.signal.aborted) setError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, reload]);
  return <section className="space-y-3 text-slate-900">
    <p className="text-sm text-slate-500">Approved ID Cards and Visiting Cards. Select up to 10 to verify and send together.</p>
    <div className="flex flex-wrap gap-2"><input className={`${vendorInput} min-w-48 flex-1`} placeholder="Search request, employee or company" aria-label="Search approved cards" value={search}
      onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <button className={vendorButton} disabled={!checked.length || loading} onClick={() => setSending(checked)}>Verify and send ({checked.length})</button>
      <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setReload(value => value + 1)}>Refresh status</button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading ? <p className="animate-pulse p-6" role="status">Loading approved cards…</p> : <div className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Select</th><th>Request / company</th><th>Vendor dispatch</th></tr></thead>
        <tbody>{data.items.map(card => <tr key={card.id} className="border-b">
          <td className="p-2"><input type="checkbox" aria-label={`Select ${card.ref_id}`} checked={checked.includes(card.id)}
            disabled={['sending', 'unknown'].includes(card.delivery_status || '') || (checked.length >= 10 && !checked.includes(card.id))}
            onChange={e => setChecked(current => e.target.checked ? [...current, card.id] : current.filter(id => id !== card.id))} /></td>
          <td className="p-2"><p className="font-semibold">{card.ref_id} · {card.company_name}</p><p className="text-xs text-slate-500">{card.subject}</p></td>
          <td className="p-2"><p className="font-medium capitalize">{card.delivery_status || 'Not sent'}</p>
            {card.vendor_name && <p className="text-xs text-slate-500">{card.vendor_name} · {card.vendor_email}</p>}
            {card.sent_by && <p className="text-xs text-slate-500">By {card.sent_by}{card.sent_at ? ` · ${new Date(card.sent_at.endsWith('Z') ? card.sent_at : `${card.sent_at}Z`).toLocaleString()}` : ''}</p>}
            <ReconcileDelivery card={card} onChanged={() => setReload(value => value + 1)} />
          </td></tr>)}</tbody></table>
      {!data.items.length && <p className="p-6 text-center text-slate-500">No approved cards found.</p>}
    </div>}
    <PaginationBar page={page} pageSize={25} total={data.total} onPageChange={setPage} />
    {sending && <VendorSendDialog ids={sending} onClose={() => { setSending(null); setReload(value => value + 1); }} onSent={() => setReload(value => value + 1)} />}
  </section>;
}
